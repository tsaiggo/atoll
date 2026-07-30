mod fullscreen;
mod media;
mod shell;
mod timer;
mod volume;

use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Mutex, MutexGuard,
};

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
#[cfg(debug_assertions)]
use tauri::menu::Submenu;
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

pub struct RuntimeState {
    transition_epoch: AtomicU64,
    window_mutation: Mutex<()>,
    timer_epoch: AtomicU64,
    fullscreen: AtomicBool,
    top_margin_bits: AtomicU64,
}

impl Default for RuntimeState {
    fn default() -> Self {
        Self {
            transition_epoch: AtomicU64::new(0),
            window_mutation: Mutex::new(()),
            timer_epoch: AtomicU64::new(0),
            fullscreen: AtomicBool::new(false),
            top_margin_bits: AtomicU64::new(0.0_f64.to_bits()),
        }
    }
}

#[tauri::command]
fn show_context_menu(
    window: tauri::WebviewWindow,
    menu: tauri::State<'_, QuickMenu>,
) -> Result<(), String> {
    use tauri::menu::ContextMenu;
    menu.0
        .popup(window.as_ref().window())
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn media_command(
    command: String,
    session_revision: u64,
    runtime: tauri::State<'_, media::MediaRuntime>,
) -> Result<bool, String> {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        media::send_command(&runtime, &command, session_revision)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
fn media_status(runtime: tauri::State<'_, media::MediaRuntime>) -> media::MediaConnectState {
    media::current_state(&runtime)
}

#[tauri::command]
fn is_fullscreen_active() -> bool {
    fullscreen::is_foreground_fullscreen()
}

struct QuickMenu(Menu<tauri::Wry>);

fn emit_action(app: &tauri::AppHandle, action: &str) {
    if let Err(error) = app.emit("atoll-action", action) {
        log::warn!("Unable to emit Atoll action '{action}': {error}");
    }
}

fn create_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
    let toggle = MenuItem::with_id(app, "toggle", "Show / hide Atoll", true, None::<&str>)?;
    let expand = MenuItem::with_id(app, "expand", "Expand / collapse", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Exit Atoll", true, None::<&str>)?;

    #[cfg(debug_assertions)]
    {
        let demo_idle = MenuItem::with_id(app, "demo:idle", "Idle", true, None::<&str>)?;
        let demo_media =
            MenuItem::with_id(app, "demo:media", "Media playing", true, None::<&str>)?;
        let demo_volume = MenuItem::with_id(app, "demo:volume", "Volume", true, None::<&str>)?;
        let demo_timer = MenuItem::with_id(
            app,
            "demo:timer-running",
            "Timer running",
            true,
            None::<&str>,
        )?;
        let demo_finished = MenuItem::with_id(
            app,
            "demo:timer-finished",
            "Timer finished",
            true,
            None::<&str>,
        )?;
        let demo = Submenu::with_items(
            app,
            "Demo",
            true,
            &[
                &demo_idle,
                &demo_media,
                &demo_volume,
                &demo_timer,
                &demo_finished,
            ],
        )?;
        let separator_one = PredefinedMenuItem::separator(app)?;
        let separator_two = PredefinedMenuItem::separator(app)?;

        Menu::with_items(
            app,
            &[
                &toggle,
                &expand,
                &separator_one,
                &demo,
                &settings,
                &separator_two,
                &quit,
            ],
        )
    }

    #[cfg(not(debug_assertions))]
    {
        let separator_one = PredefinedMenuItem::separator(app)?;
        let separator_two = PredefinedMenuItem::separator(app)?;
        Menu::with_items(
            app,
            &[
                &toggle,
                &expand,
                &separator_one,
                &settings,
                &separator_two,
                &quit,
            ],
        )
    }
}

fn setup_tray(app: &tauri::App) -> tauri::Result<QuickMenu> {
    let tray_menu = create_menu(app.handle())?;
    let context_menu = create_menu(app.handle())?;

    let mut builder = TrayIconBuilder::with_id("atoll-tray")
        .menu(&tray_menu)
        .show_menu_on_left_click(false)
        .tooltip("Atoll — Your status, surfaced.")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "quit" => app.exit(0),
            action => emit_action(app, action),
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                emit_action(tray.app_handle(), "toggle");
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(QuickMenu(context_menu))
}

fn setup_shortcut(app: &tauri::App) -> tauri::Result<()> {
    let shortcut = Shortcut::new(
        Some(Modifiers::CONTROL | Modifiers::SHIFT),
        Code::Space,
    );
    let handler_shortcut = shortcut;
    app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |app, pressed, event| {
                if pressed == &handler_shortcut && event.state == ShortcutState::Pressed {
                    emit_action(app, "toggle");
                }
            })
            .build(),
    )?;

    if let Err(error) = app.global_shortcut().register(shortcut) {
        log::warn!("Ctrl+Shift+Space could not be registered: {error}");
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            emit_action(app, "single-instance");
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .max_file_size(250_000)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(media::MediaRuntime::default())
        .manage(RuntimeState::default())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                shell::apply_native_window_policy(&window)?;
            }
            let quick_menu = setup_tray(app)?;
            app.manage(quick_menu);
            setup_shortcut(app)?;
            media::start_watcher(app.handle().clone());
            volume::start_watcher(app.handle().clone());
            fullscreen::start_watcher(app.handle().clone());
            shell::start_display_watcher(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            shell::set_window_shell,
            show_context_menu,
            media_command,
            media_status,
            is_fullscreen_active,
            timer::schedule_timer
        ])
        .run(tauri::generate_context!())
        .expect("Atoll could not start");
}

pub(crate) fn next_transition_epoch(state: &RuntimeState) -> u64 {
    state.transition_epoch.fetch_add(1, Ordering::SeqCst) + 1
}

pub(crate) fn is_current_transition(state: &RuntimeState, epoch: u64) -> bool {
    state.transition_epoch.load(Ordering::SeqCst) == epoch
}

pub(crate) fn lock_window_mutation(state: &RuntimeState) -> MutexGuard<'_, ()> {
    state
        .window_mutation
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

pub(crate) fn next_timer_epoch(state: &RuntimeState) -> u64 {
    state.timer_epoch.fetch_add(1, Ordering::SeqCst) + 1
}

pub(crate) fn is_current_timer(state: &RuntimeState, epoch: u64) -> bool {
    state.timer_epoch.load(Ordering::SeqCst) == epoch
}

pub(crate) fn set_fullscreen(state: &RuntimeState, fullscreen: bool) {
    state.fullscreen.store(fullscreen, Ordering::SeqCst);
}

pub(crate) fn is_fullscreen(state: &RuntimeState) -> bool {
    state.fullscreen.load(Ordering::SeqCst)
}

pub(crate) fn set_top_margin(state: &RuntimeState, top_margin: f64) {
    state
        .top_margin_bits
        .store(top_margin.to_bits(), Ordering::SeqCst);
}

pub(crate) fn top_margin(state: &RuntimeState) -> f64 {
    f64::from_bits(state.top_margin_bits.load(Ordering::SeqCst))
}
