mod contract;
mod hub;
mod provider;
mod providers;
mod publisher;
mod runtime;

#[cfg(test)]
mod tests;

use std::sync::mpsc;

use tauri::{AppHandle, Manager, State};

pub(crate) use runtime::ConnectRuntime;

use contract::MediaConnectState;

pub(crate) fn start(app: AppHandle) {
    let runtime = app.state::<ConnectRuntime>().inner().clone();
    let (publisher_sender, publisher_receiver) = mpsc::channel();
    publisher::start(app, runtime.publisher_store(), publisher_receiver);
    let hub_sender = hub::start(providers::builtins(), publisher_sender);
    runtime.install_hub(hub_sender);
}

#[tauri::command]
pub(crate) async fn media_command(
    command: String,
    session_revision: u64,
    runtime: State<'_, ConnectRuntime>,
) -> Result<bool, String> {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || runtime.send_command(&command, session_revision))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub(crate) async fn media_seek(
    position_ms: u64,
    session_revision: u64,
    runtime: State<'_, ConnectRuntime>,
) -> Result<bool, String> {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || runtime.seek(position_ms, session_revision))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub(crate) async fn media_select_source(
    provider_id: Option<String>,
    source_id: Option<String>,
    runtime: State<'_, ConnectRuntime>,
) -> Result<bool, String> {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || runtime.select_source(provider_id, source_id))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub(crate) fn media_status(runtime: State<'_, ConnectRuntime>) -> MediaConnectState {
    runtime.current_state()
}
