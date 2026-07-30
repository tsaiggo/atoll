use std::{
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use windows::{
    Media::Control::{
        GlobalSystemMediaTransportControlsSession,
        GlobalSystemMediaTransportControlsSessionManager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus,
    },
    Storage::Streams::DataReader,
    Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED},
};

#[derive(Default)]
pub struct MediaRuntime {
    manager: Mutex<Option<GlobalSystemMediaTransportControlsSessionManager>>,
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
    artwork_data_url: Option<String>,
}

#[derive(Default)]
struct ArtworkCache {
    identity: String,
    data_url: Option<String>,
}

pub fn start_watcher(app: AppHandle) {
    thread::spawn(move || {
        let _winrt = unsafe { RoInitialize(RO_INIT_MULTITHREADED) };
        let mut last_snapshot: Option<MediaSnapshot> = None;
        let mut cache = ArtworkCache::default();
        let mut next_manager_retry = Instant::now();

        loop {
            let manager = app
                .state::<MediaRuntime>()
                .manager
                .lock()
                .ok()
                .and_then(|guard| guard.clone());

            let manager = match manager {
                Some(manager) => manager,
                None if Instant::now() >= next_manager_retry => {
                    match GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
                        .and_then(|operation| operation.get())
                    {
                        Ok(manager) => {
                            if let Ok(mut guard) = app.state::<MediaRuntime>().manager.lock() {
                                *guard = Some(manager.clone());
                            }
                            manager
                        }
                        Err(error) => {
                            log::warn!("Windows media sessions are temporarily unavailable: {error}");
                            next_manager_retry = Instant::now() + Duration::from_secs(10);
                            thread::sleep(Duration::from_secs(2));
                            continue;
                        }
                    }
                }
                None => {
                    thread::sleep(Duration::from_secs(2));
                    continue;
                }
            };

            let snapshot = capture_snapshot(&manager, &mut cache).unwrap_or_else(|error| {
                log::debug!("Unable to read the current media session: {error}");
                None
            });
            if snapshot != last_snapshot {
                if let Err(error) = app.emit("media-update", snapshot.clone()) {
                    log::debug!("Unable to emit media state: {error}");
                }
                last_snapshot = snapshot;
            }
            thread::sleep(Duration::from_millis(1200));
        }
    });
}

pub fn send_command(
    runtime: &MediaRuntime,
    command: &str,
) -> Result<bool, String> {
    let manager = runtime
        .manager
        .lock()
        .map_err(|_| "Media state is unavailable".to_string())?
        .clone()
        .ok_or_else(|| "Windows media sessions are not ready".to_string())?;
    let session = manager
        .GetCurrentSession()
        .map_err(|_| "There is no active media session".to_string())?;
    let operation = match command {
        "previous" => session.TrySkipPreviousAsync(),
        "toggle" => session.TryTogglePlayPauseAsync(),
        "next" => session.TrySkipNextAsync(),
        _ => return Err("Unsupported media command".to_string()),
    }
    .map_err(|error| error.to_string())?;
    operation.get().map_err(|error| error.to_string())
}

fn capture_snapshot(
    manager: &GlobalSystemMediaTransportControlsSessionManager,
    cache: &mut ArtworkCache,
) -> windows::core::Result<Option<MediaSnapshot>> {
    let session = match manager.GetCurrentSession() {
        Ok(session) => session,
        Err(_) => {
            cache.identity.clear();
            cache.data_url = None;
            return Ok(None);
        }
    };
    snapshot_from_session(&session, cache).map(Some)
}

fn snapshot_from_session(
    session: &GlobalSystemMediaTransportControlsSession,
    cache: &mut ArtworkCache,
) -> windows::core::Result<MediaSnapshot> {
    let properties = session.TryGetMediaPropertiesAsync()?.get()?;
    let title = properties.Title()?.to_string();
    let artist = properties.Artist()?.to_string();
    let source_id = session.SourceAppUserModelId()?.to_string();
    let source = friendly_source(&source_id);
    let identity = format!("{source_id}\u{1f}{title}\u{1f}{artist}");

    if cache.identity != identity {
        cache.identity = identity;
        cache.data_url = read_artwork_data_url(&properties).ok().flatten();
    }

    let playback = session.GetPlaybackInfo()?;
    let controls = playback.Controls()?;
    let playing =
        playback.PlaybackStatus()? == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;

    Ok(MediaSnapshot {
        title,
        artist,
        source,
        playing,
        can_previous: controls.IsPreviousEnabled().unwrap_or(false),
        can_play_pause: controls.IsPlayPauseToggleEnabled().unwrap_or(false)
            || controls.IsPlayEnabled().unwrap_or(false)
            || controls.IsPauseEnabled().unwrap_or(false),
        can_next: controls.IsNextEnabled().unwrap_or(false),
        artwork_data_url: cache.data_url.clone(),
    })
}

fn read_artwork_data_url(
    properties: &windows::Media::Control::GlobalSystemMediaTransportControlsSessionMediaProperties,
) -> windows::core::Result<Option<String>> {
    let thumbnail = properties.Thumbnail()?;
    let stream = thumbnail.OpenReadAsync()?.get()?;
    let size = stream.Size()?;
    if size == 0 || size > 4 * 1024 * 1024 {
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
    } else {
        source_id
            .split(['!', '\\', '/'])
            .rfind(|part| !part.is_empty())
            .unwrap_or("Windows media")
            .trim_end_matches(".exe")
            .to_string()
    }
}
