use std::{
    cmp::Ordering,
    collections::BTreeMap,
    panic::{catch_unwind, AssertUnwindSafe},
    sync::{
        mpsc::{self, Receiver, Sender},
        Arc,
    },
    thread::{self, JoinHandle},
    time::Instant,
};

use super::{
    contract::{
        HubMessage, ManualMediaSource, MediaConnectState, MediaConnectStatus, MediaSource,
        ProviderDescriptor, ProviderRequest, ProviderState,
    },
    provider::{ConnectProvider, ProviderEventSink, ProviderMailbox},
};

struct ProviderSlot {
    descriptor: ProviderDescriptor,
    requests: Sender<ProviderRequest>,
    state: ProviderState,
    last_sequence: u64,
    running: bool,
    worker: Option<JoinHandle<()>>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct Selection {
    provider_id: &'static str,
    target_id: String,
    provider_generation: u64,
}

#[derive(Clone)]
pub(crate) struct HubHandle {
    sender: Sender<HubMessage>,
    _shutdown: Arc<HubShutdown>,
}

struct HubShutdown {
    sender: Sender<HubMessage>,
}

impl Drop for HubShutdown {
    fn drop(&mut self) {
        let _ = self.sender.send(HubMessage::Shutdown);
    }
}

impl HubHandle {
    fn new(sender: Sender<HubMessage>) -> Self {
        Self {
            _shutdown: Arc::new(HubShutdown {
                sender: sender.clone(),
            }),
            sender,
        }
    }

    pub(crate) fn send(&self, message: HubMessage) -> Result<(), ()> {
        self.sender.send(message).map_err(|_| ())
    }
}

pub(crate) fn start(
    providers: Vec<Box<dyn ConnectProvider>>,
    publisher: Sender<MediaConnectState>,
) -> HubHandle {
    let (input, receiver) = mpsc::channel();
    let mut slots = BTreeMap::new();

    for provider in providers {
        let descriptor = provider.descriptor();
        if slots.contains_key(descriptor.id) {
            log::warn!(
                "Ignoring duplicate Atoll Connect provider {}",
                descriptor.id
            );
            continue;
        }

        let (requests, request_receiver) = mpsc::channel();
        let mailbox = ProviderMailbox {
            sender: requests.clone(),
            receiver: request_receiver,
        };
        let events = ProviderEventSink::new(input.clone(), descriptor.id);
        let stopped_events = events.clone();
        let provider_id = descriptor.id;
        let thread_name = format!("atoll-provider-{}", descriptor.id);
        let spawn_result = thread::Builder::new().name(thread_name).spawn(move || {
            let result = catch_unwind(AssertUnwindSafe(|| provider.run(events, mailbox)));
            if result.is_err() {
                log::error!("Atoll Connect provider {provider_id} panicked");
            }
            stopped_events.stopped();
        });
        let (state, running, worker) = match spawn_result {
            Ok(worker) => (ProviderState::checking(), true, Some(worker)),
            Err(error) => {
                log::warn!(
                    "Atoll Connect provider {} could not start: {error}",
                    descriptor.id
                );
                (ProviderState::unavailable(), false, None)
            }
        };
        slots.insert(
            descriptor.id,
            ProviderSlot {
                descriptor,
                requests,
                state,
                last_sequence: 0,
                running,
                worker,
            },
        );
    }

    thread::Builder::new()
        .name("atoll-connect-hub".to_string())
        .spawn(move || ConnectHub::new(slots, publisher).run(receiver))
        .expect("Atoll Connect hub could not start");

    HubHandle::new(input)
}

struct ConnectHub {
    providers: BTreeMap<&'static str, ProviderSlot>,
    publisher: Sender<MediaConnectState>,
    selection: Option<Selection>,
    manual_source: Option<ManualMediaSource>,
    generation: u64,
    last_published: MediaConnectState,
    publisher_connected: bool,
}

impl ConnectHub {
    fn new(
        providers: BTreeMap<&'static str, ProviderSlot>,
        publisher: Sender<MediaConnectState>,
    ) -> Self {
        Self {
            providers,
            publisher,
            selection: None,
            manual_source: None,
            generation: 0,
            last_published: MediaConnectState::default(),
            publisher_connected: true,
        }
    }

    fn run(&mut self, receiver: Receiver<HubMessage>) {
        self.recompute();
        while self.publisher_connected {
            let Ok(message) = receiver.recv() else {
                break;
            };
            match message {
                HubMessage::ProviderState {
                    provider_id,
                    sequence,
                    state,
                } => self.apply_provider_state(provider_id, sequence, state),
                HubMessage::ProviderStopped(provider_id) => self.provider_stopped(provider_id),
                HubMessage::Command {
                    command,
                    session_revision,
                    deadline,
                    reply,
                } => self.route_command(command, session_revision, deadline, reply),
                HubMessage::Seek {
                    position_ms,
                    session_revision,
                    deadline,
                    reply,
                } => self.route_seek(position_ms, session_revision, deadline, reply),
                HubMessage::SelectSource {
                    provider_id,
                    source_id,
                    deadline,
                    reply,
                } => self.route_source_selection(provider_id, source_id, deadline, reply),
                HubMessage::Shutdown => break,
            }
        }

        for slot in self.providers.values() {
            let _ = slot.requests.send(ProviderRequest::Shutdown);
        }
        for slot in self.providers.values_mut() {
            if let Some(worker) = slot.worker.take() {
                let _ = worker.join();
            }
        }
    }

    fn apply_provider_state(
        &mut self,
        provider_id: &'static str,
        sequence: u64,
        state: ProviderState,
    ) {
        let Some(slot) = self.providers.get_mut(provider_id) else {
            log::warn!(
                "Ignoring state from unknown Atoll Connect provider {}",
                provider_id
            );
            return;
        };
        if !slot.running || !is_newer_sequence(sequence, slot.last_sequence) {
            return;
        }
        if state.media.is_some() && (state.target_id.is_none() || state.generation == 0) {
            log::warn!(
                "Ignoring invalid media state from Atoll Connect provider {}",
                provider_id
            );
            return;
        }
        if state.active_source.as_ref().is_some_and(|active_source| {
            !state
                .sources
                .iter()
                .any(|source| source.source_id == *active_source)
        }) {
            log::warn!(
                "Ignoring invalid active source from Atoll Connect provider {}",
                provider_id
            );
            return;
        }
        slot.last_sequence = sequence;
        slot.state = state;
        self.recompute();
    }

    fn provider_stopped(&mut self, provider_id: &'static str) {
        let Some(slot) = self.providers.get_mut(provider_id) else {
            return;
        };
        if !slot.running {
            return;
        }
        slot.running = false;
        slot.state = ProviderState::unavailable();
        self.recompute();
    }

    fn recompute(&mut self) {
        self.clear_missing_manual_source();

        let manual_source_state = self.manual_source.as_ref().and_then(|manual_source| {
            self.providers
                .values()
                .find(|slot| slot.running && slot.descriptor.id == manual_source.provider_id)
                .map(|slot| {
                    (
                        slot.descriptor.id,
                        slot.state.active_source.as_deref()
                            == Some(manual_source.source_id.as_str()),
                        slot.state.media.is_some(),
                        slot.state.status.clone(),
                    )
                })
        });
        let manually_selected_provider = manual_source_state.as_ref().and_then(
            |(provider_id, source_is_active, has_media, _)| {
                (*source_is_active && *has_media).then_some(*provider_id)
            },
        );
        let automatically_selected_provider = self.manual_source.is_none().then(|| {
            self.providers
                .values()
                .filter(|slot| slot.state.media.is_some())
                .max_by(|left, right| compare_candidates(left, right, self.selection.as_ref()))
                .map(|slot| slot.descriptor.id)
        });
        let best_provider =
            manually_selected_provider.or(automatically_selected_provider.flatten());

        let next_selection = best_provider.map(|provider_id| {
            let state = &self
                .providers
                .get(provider_id)
                .expect("selected provider must exist")
                .state;
            Selection {
                provider_id,
                target_id: state
                    .target_id
                    .clone()
                    .expect("selected provider state must have a target"),
                provider_generation: state.generation,
            }
        });
        if self.selection != next_selection {
            self.generation = advance_generation(self.generation);
        }
        self.selection = next_selection;

        let session_count = self.providers.values().fold(0_u32, |total, slot| {
            total.saturating_add(slot.state.target_count)
        });
        let media = best_provider.and_then(|provider_id| {
            self.providers
                .get(provider_id)
                .and_then(|slot| slot.state.media.clone())
                .map(|mut media| {
                    media.session_revision = self.generation;
                    media
                })
        });
        let status = if media.is_some() {
            MediaConnectStatus::Ready
        } else if let Some((_, source_is_active, _, provider_status)) = manual_source_state {
            if source_is_active {
                provider_status
            } else {
                MediaConnectStatus::Checking
            }
        } else {
            aggregate_status(self.providers.values().map(|slot| &slot.state.status))
        };
        let mut sources = self
            .providers
            .values()
            .flat_map(|slot| {
                slot.state.sources.iter().map(move |source| MediaSource {
                    provider_id: slot.descriptor.id.to_string(),
                    source_id: source.source_id.clone(),
                    label: source.label.clone(),
                    session_count: source.session_count,
                })
            })
            .collect::<Vec<_>>();
        sources.sort_by(|left, right| {
            left.label
                .cmp(&right.label)
                .then_with(|| left.provider_id.cmp(&right.provider_id))
                .then_with(|| left.source_id.cmp(&right.source_id))
        });

        self.publish(MediaConnectState {
            status,
            session_count,
            sources,
            manual_source: self.manual_source.clone(),
            media,
        });
    }

    fn clear_missing_manual_source(&mut self) {
        let available = self.manual_source.as_ref().is_none_or(|manual_source| {
            self.providers.values().any(|slot| {
                slot.running
                    && slot.descriptor.id == manual_source.provider_id
                    && slot
                        .state
                        .sources
                        .iter()
                        .any(|source| source.source_id == manual_source.source_id)
            })
        });
        if !available {
            self.manual_source = None;
        }
    }

    fn publish(&mut self, state: MediaConnectState) {
        if self.last_published == state {
            return;
        }
        self.last_published = state.clone();
        if self.publisher.send(state).is_err() {
            self.publisher_connected = false;
        }
    }

    fn route_command(
        &self,
        command: String,
        session_revision: u64,
        deadline: Instant,
        reply: std::sync::mpsc::SyncSender<Result<bool, String>>,
    ) {
        if Instant::now() >= deadline {
            let _ = reply.send(Err(
                "The media command expired before it could run".to_string()
            ));
            return;
        }
        if self.manual_source.as_ref().is_some_and(|manual_source| {
            self.selection.as_ref().is_none_or(|selection| {
                selection.provider_id != manual_source.provider_id
                    || selection.target_id != manual_source.source_id
            })
        }) {
            let _ = reply.send(Err("The selected media source is changing".to_string()));
            return;
        }
        if session_revision != self.generation {
            let _ = reply.send(Err("The selected media session changed".to_string()));
            return;
        }
        let Some(selection) = self.selection.as_ref() else {
            let _ = reply.send(Err("There is no selected media session".to_string()));
            return;
        };
        let action = match super::contract::MediaAction::parse(&command) {
            Ok(action) => action,
            Err(error) => {
                let _ = reply.send(Err(error));
                return;
            }
        };
        let Some(slot) = self.providers.get(selection.provider_id) else {
            let _ = reply.send(Err("The media provider is unavailable".to_string()));
            return;
        };
        let failure_reply = reply.clone();
        if slot
            .requests
            .send(ProviderRequest::Command {
                action,
                target_id: selection.target_id.clone(),
                generation: selection.provider_generation,
                deadline,
                reply,
            })
            .is_err()
        {
            let _ = failure_reply.send(Err("The media worker is unavailable".to_string()));
        }
    }

    fn route_seek(
        &self,
        position_ms: u64,
        session_revision: u64,
        deadline: Instant,
        reply: std::sync::mpsc::SyncSender<Result<bool, String>>,
    ) {
        if Instant::now() >= deadline {
            let _ = reply.send(Err("The media seek expired before it could run".to_string()));
            return;
        }
        if self.manual_source.as_ref().is_some_and(|manual_source| {
            self.selection.as_ref().is_none_or(|selection| {
                selection.provider_id != manual_source.provider_id
                    || selection.target_id != manual_source.source_id
            })
        }) {
            let _ = reply.send(Err("The selected media source is changing".to_string()));
            return;
        }
        if session_revision != self.generation {
            let _ = reply.send(Err("The selected media session changed".to_string()));
            return;
        }
        let Some(selection) = self.selection.as_ref() else {
            let _ = reply.send(Err("There is no selected media session".to_string()));
            return;
        };
        let Some(slot) = self.providers.get(selection.provider_id) else {
            let _ = reply.send(Err("The media provider is unavailable".to_string()));
            return;
        };
        let Some(media) = slot.state.media.as_ref() else {
            let _ = reply.send(Err("There is no selected media session".to_string()));
            return;
        };
        if !media.can_seek {
            let _ = reply.send(Err(
                "The selected media session does not support seeking".to_string()
            ));
            return;
        }
        if media
            .duration_ms
            .is_some_and(|duration_ms| position_ms > duration_ms)
        {
            let _ = reply.send(Err(
                "The requested media position is outside the selected timeline".to_string(),
            ));
            return;
        }

        let failure_reply = reply.clone();
        if slot
            .requests
            .send(ProviderRequest::Seek {
                position_ms,
                target_id: selection.target_id.clone(),
                generation: selection.provider_generation,
                deadline,
                reply,
            })
            .is_err()
        {
            let _ = failure_reply.send(Err("The media worker is unavailable".to_string()));
        }
    }

    fn route_source_selection(
        &mut self,
        provider_id: Option<String>,
        source_id: Option<String>,
        deadline: Instant,
        reply: std::sync::mpsc::SyncSender<Result<bool, String>>,
    ) {
        if Instant::now() >= deadline {
            let _ = reply.send(Err(
                "The media source selection expired before it could run".to_string(),
            ));
            return;
        }

        match (provider_id, source_id) {
            (None, None) => {
                let reset_sender = self.manual_source.as_ref().and_then(|manual_source| {
                    self.providers
                        .values()
                        .find(|slot| {
                            slot.running && slot.descriptor.id == manual_source.provider_id
                        })
                        .map(|slot| slot.requests.clone())
                });
                self.manual_source = None;
                self.recompute();

                if let Some(requests) = reset_sender {
                    // The hub has already safely returned to automatic selection. A
                    // stopped worker cannot make that state unsafe, but an available
                    // worker still receives the reset so its local preference agrees.
                    let _ = request_source_selection(&requests, None, deadline);
                    let _ = reply.send(Ok(true));
                } else {
                    let _ = reply.send(Ok(true));
                }
            }
            (Some(provider_id), Some(source_id)) => {
                let selection = ManualMediaSource {
                    provider_id,
                    source_id,
                };
                let requests = match self
                    .providers
                    .values()
                    .find(|slot| slot.running && slot.descriptor.id == selection.provider_id)
                {
                    Some(slot)
                        if slot
                            .state
                            .sources
                            .iter()
                            .any(|source| source.source_id == selection.source_id) =>
                    {
                        slot.requests.clone()
                    }
                    Some(_) => {
                        let _ =
                            reply.send(Err("The selected media source is unavailable".to_string()));
                        return;
                    }
                    None => {
                        let _ = reply
                            .send(Err("The selected media provider is unavailable".to_string()));
                        return;
                    }
                };

                match request_source_selection(
                    &requests,
                    Some(selection.source_id.clone()),
                    deadline,
                ) {
                    Ok(true) => {
                        self.manual_source = Some(selection);
                        self.recompute();
                        let _ = reply.send(Ok(true));
                    }
                    Ok(false) => {
                        let _ = reply.send(Ok(false));
                    }
                    Err(error) => {
                        let _ = reply.send(Err(error));
                    }
                }
            }
            _ => {
                let _ = reply.send(Err(
                    "A media provider and source must be selected together".to_string()
                ));
            }
        }
    }
}

fn request_source_selection(
    requests: &Sender<ProviderRequest>,
    source_id: Option<String>,
    deadline: Instant,
) -> Result<bool, String> {
    if Instant::now() >= deadline {
        return Err("The media source selection expired before it could run".to_string());
    }
    let (reply_sender, reply_receiver) = mpsc::sync_channel(1);
    requests
        .send(ProviderRequest::SelectSource {
            source_id,
            deadline,
            reply: reply_sender,
        })
        .map_err(|_| "The media worker is unavailable".to_string())?;
    let remaining = deadline.saturating_duration_since(Instant::now());
    if remaining.is_zero() {
        return Err("The media source selection expired before it could run".to_string());
    }
    reply_receiver
        .recv_timeout(remaining)
        .map_err(|error| match error {
            mpsc::RecvTimeoutError::Timeout => "The media source did not respond".to_string(),
            mpsc::RecvTimeoutError::Disconnected => "The media worker is unavailable".to_string(),
        })?
}

fn compare_candidates(
    left: &ProviderSlot,
    right: &ProviderSlot,
    previous: Option<&Selection>,
) -> Ordering {
    let left_media = left
        .state
        .media
        .as_ref()
        .expect("candidate must have media");
    let right_media = right
        .state
        .media
        .as_ref()
        .expect("candidate must have media");
    let left_previous = previous.is_some_and(|selection| {
        selection.provider_id == left.descriptor.id
            && left.state.target_id.as_deref() == Some(selection.target_id.as_str())
    });
    let right_previous = previous.is_some_and(|selection| {
        selection.provider_id == right.descriptor.id
            && right.state.target_id.as_deref() == Some(selection.target_id.as_str())
    });

    left_media
        .playing
        .cmp(&right_media.playing)
        .then_with(|| left_previous.cmp(&right_previous))
        .then_with(|| left.descriptor.priority.cmp(&right.descriptor.priority))
        .then_with(|| right.descriptor.id.cmp(left.descriptor.id))
}

fn aggregate_status<'a>(
    statuses: impl Iterator<Item = &'a MediaConnectStatus>,
) -> MediaConnectStatus {
    let mut count = 0_usize;
    let mut has_metadata_unavailable = false;
    let mut has_checking = false;
    let mut all_unavailable = true;
    for status in statuses {
        count += 1;
        has_metadata_unavailable |= *status == MediaConnectStatus::MetadataUnavailable;
        has_checking |= *status == MediaConnectStatus::Checking;
        all_unavailable &= *status == MediaConnectStatus::Unavailable;
    }
    if count == 0 {
        return MediaConnectStatus::Unavailable;
    }
    if has_metadata_unavailable {
        MediaConnectStatus::MetadataUnavailable
    } else if has_checking {
        MediaConnectStatus::Checking
    } else if all_unavailable {
        MediaConnectStatus::Unavailable
    } else {
        MediaConnectStatus::NoSession
    }
}

fn advance_generation(current: u64) -> u64 {
    let next = current.wrapping_add(1);
    if next == 0 {
        1
    } else {
        next
    }
}

fn is_newer_sequence(next: u64, previous: u64) -> bool {
    next != previous && next.wrapping_sub(previous) < (1_u64 << 63)
}
