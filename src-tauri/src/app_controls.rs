#[cfg(debug_assertions)]
use tauri::menu::Submenu;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub(crate) struct QuickMenu(Menu<tauri::Wry>);

#[tauri::command]
pub(crate) fn show_context_menu(
    window: tauri::WebviewWindow,
    menu: tauri::State<'_, QuickMenu>,
) -> Result<(), String> {
    use tauri::menu::ContextMenu;
    menu.0
        .popup(window.as_ref().window())
        .map_err(|error| error.to_string())
}

pub(crate) fn emit_action(app: &tauri::AppHandle, action: &str) {
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
        let demo_media = MenuItem::with_id(app, "demo:media", "Media playing", true, None::<&str>)?;
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

pub(crate) fn setup_tray(app: &tauri::App) -> tauri::Result<QuickMenu> {
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

pub(crate) fn setup_shortcut(app: &tauri::App) -> tauri::Result<()> {
    let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
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
