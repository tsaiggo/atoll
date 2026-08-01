use std::{sync::mpsc::Receiver, thread};

use tauri::{AppHandle, Emitter};

use super::{contract::MediaConnectState, runtime::ConnectStateStore};

pub(crate) fn start(
    app: AppHandle,
    state_store: ConnectStateStore,
    receiver: Receiver<MediaConnectState>,
) {
    thread::Builder::new()
        .name("atoll-connect-publisher".to_string())
        .spawn(move || {
            while let Ok(state) = receiver.recv() {
                publish_state(&app, &state_store, state);
            }
        })
        .expect("Atoll Connect publisher could not start");
}

fn publish_state(app: &AppHandle, state_store: &ConnectStateStore, state: MediaConnectState) {
    let (connection_changed, event_state) = state_store.prepare_update(state);
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
