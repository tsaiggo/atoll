mod app_controls;
mod connect;
mod fullscreen;
mod runtime;
mod shell;
mod timer;
mod volume;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            app_controls::emit_action(app, "single-instance");
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .max_file_size(250_000)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(connect::ConnectRuntime::default())
        .manage(runtime::RuntimeState::default())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                shell::apply_native_window_policy(&window)?;
            }
            let quick_menu = app_controls::setup_tray(app)?;
            app.manage(quick_menu);
            app_controls::setup_shortcut(app)?;
            connect::start(app.handle().clone());
            volume::start_watcher(app.handle().clone());
            fullscreen::start_watcher(app.handle().clone());
            shell::start_display_watcher(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            shell::set_window_shell,
            app_controls::show_context_menu,
            app_controls::set_menu_language,
            connect::media_command,
            connect::media_status,
            fullscreen::is_fullscreen_active,
            timer::schedule_timer
        ])
        .run(tauri::generate_context!())
        .expect("Atoll could not start");
}
