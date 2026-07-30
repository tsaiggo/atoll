use std::{
    cmp::Reverse,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver, RecvTimeoutError, Sender, SyncSender},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use windows::{
    Foundation::TypedEventHandler,
    Media::Control::{
        CurrentSessionChangedEventArgs, GlobalSystemMediaTransportControlsSession,
        GlobalSystemMediaTransportControlsSessionManager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus, MediaPropertiesChangedEventArgs,
        PlaybackInfoChangedEventArgs, SessionsChangedEventArgs,
    },
    Storage::Streams::DataReader,
    Win32::System::WinRT::{RoInitialize, RoUninitialize, RO_INIT_MULTITHREADED},
};
use windows_future::{AsyncOperationCompletedHandler, AsyncStatus};

const MEDIA_REFRESH_INTERVAL: Duration = Duration::from_secs(5);
const COMMAND_TIMEOUT: Duration = Duration::from_secs(4);
const COMMAND_REPLY_TIMEOUT: Duration = Duration::from_secs(5);
const WINDOWS_TO_UNIX_EPOCH_TICKS: i64 = 116_444_736_000_000_000;
const TICKS_PER_MILLISECOND: i64 = 10_000;
const MAX_ARTWORK_BYTES: u64 = 1024 * 1024;

#[derive(Clone, Default)]
pub struct MediaRuntime {
    request_sender: Arc<Mutex<Option<Sender<MediaRequest>>>>,
    latest_state: Arc<Mutex<MediaConnectState>>,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MediaConnectStatus {
    #[default]
    Checking,
    Ready,
    NoSession,
    MetadataUnavailable,
    Unavailable,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize)]
pub struct MediaConnectState {
    status: MediaConnectStatus,
    session_count: u32,
    media: Option<MediaSnapshot>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct MediaSnapshot {
    title: String,
    artist: String,
    source: String,
    playing: bool,
    can_previous: bool,
    can_play_pause: bool,
    can_next: bool,
    can_seek: bool,
    position_ms: Option<u64>,
    duration_ms: Option<u64>,
    position_updated_at_ms: Option<i64>,
    session_revision: u64,
    artwork_data_url: Option<String>,
}

enum MediaRequest {
    Command {
        command: String,
        session_revision: u64,
        deadline: Instant,
        reply: SyncSender<Result<bool, String>>,
    },
    Refresh,
}

#[derive(Clone)]
struct RefreshNotifier {
    sender: Sender<MediaRequest>,
    pending: Arc<AtomicBool>,
}

impl RefreshNotifier {
    fn new(sender: Sender<MediaRequest>) -> Self {
        Self {
            sender,
            pending: Arc::new(AtomicBool::new(false)),
        }
    }

    fn notify(&self) {
        if self.pending.swap(true, Ordering::AcqRel) {
            return;
        }
        if self.sender.send(MediaRequest::Refresh).is_err() {
            self.pending.store(false, Ordering::Release);
        }
    }

    fn mark_handled(&self) {
        self.pending.store(false, Ordering::Release);
    }
}

#[derive(Default)]
struct ArtworkCache {
    identity: String,
    data_url: Option<String>,
}

struct WinRtApartment(bool);

impl WinRtApartment {
    fn initialize() -> Self {
        Self(unsafe { RoInitialize(RO_INIT_MULTITHREADED) }.is_ok())
    }
}

impl Drop for WinRtApartment {
    fn drop(&mut self) {
        if self.0 {
            unsafe { RoUninitialize() };
        }
    }
}

struct Candidate {
    session: GlobalSystemMediaTransportControlsSession,
    playing: bool,
    current: bool,
    previous: bool,
    index: u32,
}

struct ManagerSubscription {
    manager: GlobalSystemMediaTransportControlsSessionManager,
    current_session_token: Option<i64>,
    sessions_token: Option<i64>,
}

impl ManagerSubscription {
    fn new(
        manager: &GlobalSystemMediaTransportControlsSessionManager,
        notifier: &RefreshNotifier,
    ) -> Self {
        let current_session_token = manager
            .CurrentSessionChanged(&TypedEventHandler::<
                GlobalSystemMediaTransportControlsSessionManager,
                CurrentSessionChangedEventArgs,
            >::new({
                let notifier = notifier.clone();
                move |_, _| {
                    notifier.notify();
                    Ok(())
                }
            }))
            .ok();
        let sessions_token = manager
            .SessionsChanged(&TypedEventHandler::<
                GlobalSystemMediaTransportControlsSessionManager,
                SessionsChangedEventArgs,
            >::new({
                let notifier = notifier.clone();
                move |_, _| {
                    notifier.notify();
                    Ok(())
                }
            }))
            .ok();

        Self {
            manager: manager.clone(),
            current_session_token,
            sessions_token,
        }
    }
}

impl Drop for ManagerSubscription {
    fn drop(&mut self) {
        if let Some(token) = self.current_session_token {
            let _ = self.manager.RemoveCurrentSessionChanged(token);
        }
        if let Some(token) = self.sessions_token {
            let _ = self.manager.RemoveSessionsChanged(token);
        }
    }
}

struct SessionSubscription {
    session: GlobalSystemMediaTransportControlsSession,
    media_token: Option<i64>,
    playback_token: Option<i64>,
}

impl SessionSubscription {
    fn new(
        session: &GlobalSystemMediaTransportControlsSession,
        notifier: &RefreshNotifier,
    ) -> Self {
        let media_token = session
            .MediaPropertiesChanged(&TypedEventHandler::<
                GlobalSystemMediaTransportControlsSession,
                MediaPropertiesChangedEventArgs,
            >::new({
                let notifier = notifier.clone();
                move |_, _| {
                    notifier.notify();
                    Ok(())
                }
            }))
            .ok();
        let playback_token = session
            .PlaybackInfoChanged(&TypedEventHandler::<
                GlobalSystemMediaTransportControlsSession,
                PlaybackInfoChangedEventArgs,
            >::new({
                let notifier = notifier.clone();
                move |_, _| {
                    notifier.notify();
                    Ok(())
                }
            }))
            .ok();
        Self {
            session: session.clone(),
            media_token,
            playback_token,
        }
    }

    fn is_for(&self, session: &GlobalSystemMediaTransportControlsSession) -> bool {
        self.session == *session
    }
}

impl Drop for SessionSubscription {
    fn drop(&mut self) {
        if let Some(token) = self.media_token {
            let _ = self.session.RemoveMediaPropertiesChanged(token);
        }
        if let Some(token) = self.playback_token {
            let _ = self.session.RemovePlaybackInfoChanged(token);
        }
    }
}

pub fn start_watcher(app: AppHandle) {
    let (sender, receiver) = mpsc::channel();
    if let Ok(mut request_sender) = app.state::<MediaRuntime>().request_sender.lock() {
        *request_sender = Some(sender.clone());
    }
    let notifier = RefreshNotifier::new(sender);

    thread::spawn(move || run_worker(app, notifier, receiver));
}

pub fn current_state(runtime: &MediaRuntime) -> MediaConnectState {
    runtime
        .latest_state
        .lock()
        .map(|state| state.clone())
        .unwrap_or_default()
}

pub fn send_command(
    runtime: &MediaRuntime,
    command: &str,
    session_revision: u64,
) -> Result<bool, String> {
    let sender = runtime
        .request_sender
        .lock()
        .map_err(|_| "Media controls are unavailable".to_string())?
        .clone()
        .ok_or_else(|| "Windows media sessions are not ready".to_string())?;
    let (reply_sender, reply_receiver) = mpsc::sync_channel(1);
    sender
        .send(MediaRequest::Command {
            command: command.to_string(),
            session_revision,
            deadline: Instant::now() + COMMAND_TIMEOUT,
            reply: reply_sender,
        })
        .map_err(|_| "The media worker is unavailable".to_string())?;
    reply_receiver
        .recv_timeout(COMMAND_REPLY_TIMEOUT)
        .map_err(|_| "The media player did not respond".to_string())?
}

fn run_worker(app: AppHandle, notifier: RefreshNotifier, receiver: Receiver<MediaRequest>) {
    let _winrt = WinRtApartment::initialize();
    let mut manager: Option<GlobalSystemMediaTransportControlsSessionManager> = None;
    let mut _manager_subscription: Option<ManagerSubscription> = None;
    let mut selected_session: Option<GlobalSystemMediaTransportControlsSession> = None;
    let mut selected_subscription: Option<SessionSubscription> = None;
    let mut selected_revision = 0_u64;
    let mut last_snapshot: Option<MediaSnapshot> = None;
    let mut cache = ArtworkCache::default();

    loop {
        if manager.is_none() {
            match GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
                .and_then(|operation| operation.get())
            {
                Ok(next_manager) => {
                    _manager_subscription =
                        Some(ManagerSubscription::new(&next_manager, &notifier));
                    manager = Some(next_manager);
                }
                Err(error) => {
                    log::warn!("Windows media sessions are temporarily unavailable: {error}");
                    selected_session = None;
                    selected_subscription = None;
                    last_snapshot = None;
                    publish_state(
                        &app,
                        MediaConnectState {
                            status: MediaConnectStatus::Unavailable,
                            session_count: 0,
                            media: None,
                        },
                    );
                }
            }
        }

        if let Some(active_manager) = manager.as_ref() {
            match capture_connect_state(
                active_manager,
                selected_session.as_ref(),
                last_snapshot.as_ref(),
                &mut cache,
            ) {
                Ok((mut state, next_session)) => {
                    let selection_changed = match (&selected_session, &next_session) {
                        (Some(previous), Some(next)) => previous != next,
                        (None, None) => false,
                        _ => true,
                    };
                    if selection_changed {
                        selected_revision = advance_revision(selected_revision);
                    }
                    selected_session = next_session;
                    if let Some(snapshot) = state.media.as_mut() {
                        snapshot.session_revision = selected_revision;
                    }
                    last_snapshot = state.media.clone();
                    let subscription_matches = selected_session.as_ref().is_some_and(|session| {
                        selected_subscription
                            .as_ref()
                            .is_some_and(|subscription| subscription.is_for(session))
                    });
                    if !subscription_matches {
                        selected_subscription = selected_session
                            .as_ref()
                            .map(|session| SessionSubscription::new(session, &notifier));
                    }
                    publish_state(&app, state);
                }
                Err(error) => {
                    log::warn!("Windows media session manager needs to reconnect: {error}");
                    manager = None;
                    _manager_subscription = None;
                    if selected_session.is_some() {
                        selected_revision = advance_revision(selected_revision);
                    }
                    selected_session = None;
                    selected_subscription = None;
                    last_snapshot = None;
                    cache = ArtworkCache::default();
                    publish_state(
                        &app,
                        MediaConnectState {
                            status: MediaConnectStatus::Unavailable,
                            session_count: 0,
                            media: None,
                        },
                    );
                }
            }
        }

        match receiver.recv_timeout(MEDIA_REFRESH_INTERVAL) {
            Ok(MediaRequest::Command {
                command,
                session_revision,
                deadline,
                reply,
            }) => {
                let result = if Instant::now() >= deadline {
                    Err("The media command expired before it could run".to_string())
                } else if session_revision != selected_revision {
                    Err("The selected media session changed".to_string())
                } else {
                    execute_command(selected_session.as_ref(), &command, deadline)
                };
                let _ = reply.send(result);
            }
            Ok(MediaRequest::Refresh) => notifier.mark_handled(),
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => break,
        }
    }
}

fn capture_connect_state(
    manager: &GlobalSystemMediaTransportControlsSessionManager,
    previous_session: Option<&GlobalSystemMediaTransportControlsSession>,
    previous_snapshot: Option<&MediaSnapshot>,
    cache: &mut ArtworkCache,
) -> windows::core::Result<(
    MediaConnectState,
    Option<GlobalSystemMediaTransportControlsSession>,
)> {
    let sessions = manager.GetSessions()?;
    let current_session = manager.GetCurrentSession().ok();
    let mut candidates = Vec::new();

    for index in 0..sessions.Size()? {
        let session = sessions.GetAt(index)?;
        let playback_status = session
            .GetPlaybackInfo()
            .and_then(|info| info.PlaybackStatus())
            .ok();
        if playback_status == Some(GlobalSystemMediaTransportControlsSessionPlaybackStatus::Closed)
        {
            continue;
        }
        candidates.push(Candidate {
            playing: playback_status
                == Some(GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing),
            current: current_session
                .as_ref()
                .is_some_and(|current| session == *current),
            previous: previous_session.is_some_and(|previous| session == *previous),
            session,
            index,
        });
    }

    candidates.sort_by_key(|candidate| {
        Reverse(candidate_rank(
            candidate.playing,
            candidate.current,
            candidate.previous,
            candidate.index,
        ))
    });

    let session_count = candidates.len() as u32;
    for candidate in &candidates {
        match snapshot_from_session(&candidate.session, cache) {
            Ok(Some(snapshot)) => {
                return Ok((
                    MediaConnectState {
                        status: MediaConnectStatus::Ready,
                        session_count,
                        media: Some(snapshot),
                    },
                    Some(candidate.session.clone()),
                ));
            }
            Ok(None) => {}
            Err(error) => {
                log::debug!("Unable to read media properties for a session: {error}");
            }
        }
    }

    if let (Some(previous_session), Some(previous_snapshot)) = (previous_session, previous_snapshot)
    {
        if candidates
            .iter()
            .any(|candidate| candidate.session == *previous_session)
        {
            return Ok((
                MediaConnectState {
                    status: MediaConnectStatus::Ready,
                    session_count,
                    media: Some(previous_snapshot.clone()),
                },
                Some(previous_session.clone()),
            ));
        }
    }

    cache.identity.clear();
    cache.data_url = None;
    let status = if session_count == 0 {
        MediaConnectStatus::NoSession
    } else {
        MediaConnectStatus::MetadataUnavailable
    };
    Ok((
        MediaConnectState {
            status,
            session_count,
            media: None,
        },
        None,
    ))
}

fn candidate_rank(
    playing: bool,
    current: bool,
    previous: bool,
    index: u32,
) -> (bool, bool, bool, Reverse<u32>) {
    (playing, current, previous, Reverse(index))
}

fn advance_revision(current: u64) -> u64 {
    let next = current.wrapping_add(1);
    if next == 0 {
        1
    } else {
        next
    }
}

fn snapshot_from_session(
    session: &GlobalSystemMediaTransportControlsSession,
    cache: &mut ArtworkCache,
) -> windows::core::Result<Option<MediaSnapshot>> {
    let properties = session.TryGetMediaPropertiesAsync()?.get()?;
    let title = properties.Title()?.to_string();
    let artist = properties.Artist()?.to_string();
    let source_id = session.SourceAppUserModelId()?.to_string();
    if title.trim().is_empty() && artist.trim().is_empty() && source_id.trim().is_empty() {
        return Ok(None);
    }
    let source = friendly_source(&source_id);
    let identity = format!("{source_id}\u{1f}{title}\u{1f}{artist}");

    if cache.identity != identity {
        cache.identity = identity;
        cache.data_url = read_artwork_data_url(&properties).ok().flatten();
    }

    let playback = session.GetPlaybackInfo()?;
    let controls = playback.Controls()?;
    let playing = playback.PlaybackStatus()?
        == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;
    let (position_ms, duration_ms, position_updated_at_ms) = read_timeline(session);

    Ok(Some(MediaSnapshot {
        title,
        artist,
        source,
        playing,
        can_previous: controls.IsPreviousEnabled().unwrap_or(false),
        can_play_pause: controls.IsPlayPauseToggleEnabled().unwrap_or(false)
            || controls.IsPlayEnabled().unwrap_or(false)
            || controls.IsPauseEnabled().unwrap_or(false),
        can_next: controls.IsNextEnabled().unwrap_or(false),
        can_seek: controls.IsPlaybackPositionEnabled().unwrap_or(false),
        position_ms,
        duration_ms,
        position_updated_at_ms,
        session_revision: 0,
        artwork_data_url: cache.data_url.clone(),
    }))
}

fn read_timeline(
    session: &GlobalSystemMediaTransportControlsSession,
) -> (Option<u64>, Option<u64>, Option<i64>) {
    let timeline = match session.GetTimelineProperties() {
        Ok(timeline) => timeline,
        Err(_) => return (None, None, None),
    };
    let start = timeline
        .StartTime()
        .map(|value| value.Duration)
        .unwrap_or(0);
    let end = timeline.EndTime().map(|value| value.Duration).unwrap_or(0);
    let position = timeline
        .Position()
        .map(|value| value.Duration)
        .unwrap_or(start);
    let Some((position_ms, duration_ms)) = normalize_timeline(start, end, position) else {
        return (None, None, None);
    };
    let updated_at_ms = timeline
        .LastUpdatedTime()
        .ok()
        .and_then(|value| windows_datetime_to_unix_ms(value.UniversalTime))
        .or_else(current_unix_time_ms);
    (Some(position_ms), Some(duration_ms), updated_at_ms)
}

fn normalize_timeline(start: i64, end: i64, position: i64) -> Option<(u64, u64)> {
    let duration_ticks = end.saturating_sub(start);
    if duration_ticks <= 0 {
        return None;
    }
    let position_ticks = position.saturating_sub(start).clamp(0, duration_ticks);
    Some((
        (position_ticks / TICKS_PER_MILLISECOND) as u64,
        (duration_ticks / TICKS_PER_MILLISECOND) as u64,
    ))
}

fn windows_datetime_to_unix_ms(value: i64) -> Option<i64> {
    value
        .checked_sub(WINDOWS_TO_UNIX_EPOCH_TICKS)
        .map(|ticks| ticks / TICKS_PER_MILLISECOND)
        .filter(|milliseconds| *milliseconds >= 0)
}

fn current_unix_time_ms() -> Option<i64> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|duration| i64::try_from(duration.as_millis()).ok())
}

fn execute_command(
    session: Option<&GlobalSystemMediaTransportControlsSession>,
    command: &str,
    deadline: Instant,
) -> Result<bool, String> {
    if Instant::now() >= deadline {
        return Err("The media command expired before it could run".to_string());
    }
    let session = session.ok_or_else(|| "There is no selected media session".to_string())?;
    let operation = match command {
        "previous" => session.TrySkipPreviousAsync(),
        "next" => session.TrySkipNextAsync(),
        "toggle" => {
            let playback = session
                .GetPlaybackInfo()
                .map_err(|error| error.to_string())?;
            let controls = playback.Controls().map_err(|error| error.to_string())?;
            let playing = playback
                .PlaybackStatus()
                .map_err(|error| error.to_string())?
                == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;
            if playing && controls.IsPauseEnabled().unwrap_or(false) {
                session.TryPauseAsync()
            } else if !playing && controls.IsPlayEnabled().unwrap_or(false) {
                session.TryPlayAsync()
            } else {
                session.TryTogglePlayPauseAsync()
            }
        }
        _ => return Err("Unsupported media command".to_string()),
    }
    .map_err(|error| error.to_string())?;
    let remaining = deadline.saturating_duration_since(Instant::now());
    if remaining.is_zero() {
        let _ = operation.Cancel();
        let _ = operation.Close();
        return Err("The media command expired before it could run".to_string());
    }

    if operation.Status().map_err(|error| error.to_string())? != AsyncStatus::Started {
        return operation.GetResults().map_err(|error| error.to_string());
    }

    let (result_sender, result_receiver) = mpsc::sync_channel(1);
    operation
        .SetCompleted(&AsyncOperationCompletedHandler::<bool>::new(
            move |operation, _| {
                let result = operation
                    .ok()
                    .and_then(|operation| operation.GetResults())
                    .map_err(|error| error.to_string());
                let _ = result_sender.send(result);
                Ok(())
            },
        ))
        .map_err(|error| error.to_string())?;

    match result_receiver.recv_timeout(remaining) {
        Ok(result) => result,
        Err(RecvTimeoutError::Timeout) => {
            let _ = operation.Cancel();
            let _ = operation.Close();
            Err("The media player did not respond in time".to_string())
        }
        Err(RecvTimeoutError::Disconnected) => {
            Err("The media command could not be completed".to_string())
        }
    }
}

fn read_artwork_data_url(
    properties: &windows::Media::Control::GlobalSystemMediaTransportControlsSessionMediaProperties,
) -> windows::core::Result<Option<String>> {
    let thumbnail = properties.Thumbnail()?;
    let stream = thumbnail.OpenReadAsync()?.get()?;
    let size = stream.Size()?;
    if size == 0 || size > MAX_ARTWORK_BYTES {
        return Ok(None);
    }
    let input = stream.GetInputStreamAt(0)?;
    let reader = DataReader::CreateDataReader(&input)?;
    let loaded = reader.LoadAsync(size as u32)?.get()?;
    if loaded == 0 {
        return Ok(None);
    }
    let mut bytes = vec![0_u8; loaded as usize];
    reader.ReadBytes(&mut bytes)?;
    let content_type = stream.ContentType()?.to_string();
    let mime = if content_type.starts_with("image/") {
        content_type
    } else {
        "image/jpeg".to_string()
    };
    Ok(Some(format!("data:{mime};base64,{}", BASE64.encode(bytes))))
}

fn friendly_source(source_id: &str) -> String {
    let lower = source_id.to_ascii_lowercase();
    if lower.contains("spotify") {
        "Spotify".to_string()
    } else if lower.contains("chrome") {
        "Google Chrome".to_string()
    } else if lower.contains("msedge") || lower.contains("microsoftedge") {
        "Microsoft Edge".to_string()
    } else if lower.contains("qqmusic") {
        "QQ Music".to_string()
    } else if lower.contains("cloudmusic") {
        "NetEase Cloud Music".to_string()
    } else {
        source_id
            .split(['!', '\\', '/'])
            .rfind(|part| !part.is_empty())
            .unwrap_or("Windows media")
            .trim_end_matches(".exe")
            .to_string()
    }
}

fn publish_state(app: &AppHandle, state: MediaConnectState) {
    let runtime = app.state::<MediaRuntime>();
    let (connection_changed, event_state) = match runtime.latest_state.lock() {
        Ok(latest) if *latest == state => (false, None),
        Ok(mut latest) => {
            let previous_source = latest.media.as_ref().map(|media| media.source.as_str());
            let next_source = state.media.as_ref().map(|media| media.source.as_str());
            let connection_changed = latest.status != state.status
                || latest.session_count != state.session_count
                || previous_source != next_source;
            let preserve_artwork = same_media_identity(latest.media.as_ref(), state.media.as_ref());
            *latest = state;
            let cached_artwork = if preserve_artwork {
                latest
                    .media
                    .as_mut()
                    .and_then(|media| media.artwork_data_url.take())
            } else {
                None
            };
            let event_state = latest.clone();
            if let Some(artwork) = cached_artwork {
                if let Some(media) = latest.media.as_mut() {
                    media.artwork_data_url = Some(artwork);
                }
            }
            (connection_changed, Some(event_state))
        }
        Err(_) => (true, Some(state)),
    };
    if connection_changed {
        let state = event_state
            .as_ref()
            .expect("changed state must be available");
        let source = state
            .media
            .as_ref()
            .map(|media| media.source.as_str())
            .unwrap_or("none");
        log::info!(
            "Atoll Connect: {:?}, {} session(s), source {source}",
            state.status,
            state.session_count
        );
    }
    if let Some(state) = event_state {
        if let Err(error) = app.emit("media-update", state) {
            log::debug!("Unable to emit media state: {error}");
        }
    }
}

fn same_media_identity(previous: Option<&MediaSnapshot>, next: Option<&MediaSnapshot>) -> bool {
    match (previous, next) {
        (Some(previous), Some(next)) => {
            previous.session_revision == next.session_revision
                && previous.source == next.source
                && previous.title == next.title
                && previous.artist == next.artist
        }
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn playing_beats_current_and_previous() {
        assert!(candidate_rank(true, false, false, 2) > candidate_rank(false, true, true, 0));
    }

    #[test]
    fn current_beats_previous_when_playback_matches() {
        assert!(candidate_rank(true, true, false, 4) > candidate_rank(true, false, true, 0));
    }

    #[test]
    fn previous_beats_list_order_when_other_flags_match() {
        assert!(candidate_rank(false, false, true, 5) > candidate_rank(false, false, false, 0));
    }

    #[test]
    fn session_revision_never_wraps_to_zero() {
        assert_eq!(advance_revision(0), 1);
        assert_eq!(advance_revision(u64::MAX), 1);
    }

    #[test]
    fn converts_windows_datetime_to_unix_milliseconds() {
        assert_eq!(
            windows_datetime_to_unix_ms(WINDOWS_TO_UNIX_EPOCH_TICKS + 12_340_000),
            Some(1234)
        );
        assert_eq!(windows_datetime_to_unix_ms(0), None);
    }

    #[test]
    fn normalizes_timeline_and_clamps_position() {
        assert_eq!(
            normalize_timeline(50_000, 1_050_000, 550_000),
            Some((50, 100))
        );
        assert_eq!(
            normalize_timeline(50_000, 1_050_000, 2_000_000),
            Some((100, 100))
        );
        assert_eq!(normalize_timeline(100, 100, 100), None);
        assert_eq!(normalize_timeline(200, 100, 150), None);
    }

    #[test]
    fn maps_known_media_sources() {
        assert_eq!(friendly_source("QQMusic.exe"), "QQ Music");
        assert_eq!(
            friendly_source("C:\\Apps\\cloudmusic.exe"),
            "NetEase Cloud Music"
        );
        assert_eq!(friendly_source("SpotifyAB.SpotifyMusic!App"), "Spotify");
    }
}
