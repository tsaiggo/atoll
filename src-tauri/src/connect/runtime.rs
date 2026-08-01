use std::{
    sync::{mpsc, Arc, Mutex},
    time::{Duration, Instant},
};

use super::contract::{HubMessage, MediaConnectState, MediaSnapshot};
use super::hub::HubHandle;

const COMMAND_TIMEOUT: Duration = Duration::from_secs(4);
const COMMAND_REPLY_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Clone, Default)]
pub(crate) struct ConnectRuntime {
    hub_sender: Arc<Mutex<Option<HubHandle>>>,
    state_store: ConnectStateStore,
}

#[derive(Clone, Default)]
pub(crate) struct ConnectStateStore {
    latest_state: Arc<Mutex<MediaConnectState>>,
}

impl ConnectRuntime {
    pub(crate) fn install_hub(&self, sender: HubHandle) {
        if let Ok(mut current) = self.hub_sender.lock() {
            *current = Some(sender);
        }
    }

    pub(crate) fn current_state(&self) -> MediaConnectState {
        self.state_store
            .latest_state
            .lock()
            .map(|state| state.clone())
            .unwrap_or_default()
    }

    pub(crate) fn send_command(
        &self,
        command: &str,
        session_revision: u64,
    ) -> Result<bool, String> {
        let sender = self
            .hub_sender
            .lock()
            .map_err(|_| "Media controls are unavailable".to_string())?
            .clone()
            .ok_or_else(|| "Windows media sessions are not ready".to_string())?;
        let (reply_sender, reply_receiver) = mpsc::sync_channel(1);
        sender
            .send(HubMessage::Command {
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

    pub(crate) fn publisher_store(&self) -> ConnectStateStore {
        self.state_store.clone()
    }
}

impl ConnectStateStore {
    pub(crate) fn prepare_update(
        &self,
        state: MediaConnectState,
    ) -> (bool, Option<MediaConnectState>) {
        match self.latest_state.lock() {
            Ok(latest) if *latest == state => (false, None),
            Ok(mut latest) => {
                let previous_source = latest.media.as_ref().map(|media| media.source.as_str());
                let next_source = state.media.as_ref().map(|media| media.source.as_str());
                let connection_changed = latest.status != state.status
                    || latest.session_count != state.session_count
                    || previous_source != next_source;
                let preserve_artwork =
                    same_media_identity(latest.media.as_ref(), state.media.as_ref());
                let artwork_unchanged = preserve_artwork
                    && latest
                        .media
                        .as_ref()
                        .and_then(|media| media.artwork_data_url.as_deref())
                        == state
                            .media
                            .as_ref()
                            .and_then(|media| media.artwork_data_url.as_deref());
                *latest = state;
                let cached_artwork = if artwork_unchanged {
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
