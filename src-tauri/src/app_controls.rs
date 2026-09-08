#[cfg(debug_assertions)]
use tauri::menu::Submenu;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    Emitter, Runtime,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[derive(Clone, Copy)]
enum MenuLanguage {
    English,
    SimplifiedChinese,
}

impl MenuLanguage {
    fn parse(language: &str) -> Result<Self, String> {
        match language {
            "en" => Ok(Self::English),
            "zh-CN" => Ok(Self::SimplifiedChinese),
            _ => Err(format!(
                "Unsupported menu language '{language}'. Expected 'en' or 'zh-CN'."
            )),
        }
    }

    fn labels(self) -> MenuLabels {
        match self {
            Self::English => MenuLabels {
                toggle: "Show or hide Atoll",
                codex: "Codex usage",
                settings: "Settings",
                quit: "Exit Atoll",
                tooltip: "Atoll — Your status, surfaced.",
                #[cfg(debug_assertions)]
                demo: "Demo",
                #[cfg(debug_assertions)]
                demo_idle: "Idle",
                #[cfg(debug_assertions)]
                demo_media: "Media playing",
                #[cfg(debug_assertions)]
                demo_volume: "Volume",
            },
            Self::SimplifiedChinese => MenuLabels {
                toggle: "显示或隐藏 Atoll",
                codex: "Codex 用量",
                settings: "设置",
                quit: "退出 Atoll",
                tooltip: "Atoll — 重要状态，浮现于顶端。",
                #[cfg(debug_assertions)]
                demo: "演示",
                #[cfg(debug_assertions)]
                demo_idle: "空闲",
                #[cfg(debug_assertions)]
                demo_media: "媒体播放",
                #[cfg(debug_assertions)]
                demo_volume: "音量",
            },
        }
    }
}

#[derive(Clone, Copy)]
struct MenuLabels {
    toggle: &'static str,
    codex: &'static str,
    settings: &'static str,
    quit: &'static str,
    tooltip: &'static str,
    #[cfg(debug_assertions)]
    demo: &'static str,
    #[cfg(debug_assertions)]
    demo_idle: &'static str,
    #[cfg(debug_assertions)]
    demo_media: &'static str,
    #[cfg(debug_assertions)]
    demo_volume: &'static str,
}

#[cfg(debug_assertions)]
struct DebugMenuItems<R: Runtime> {
    submenu: Submenu<R>,
    idle: MenuItem<R>,
    media: MenuItem<R>,
    volume: MenuItem<R>,
}

struct LocalizedMenu<R: Runtime> {
    menu: Menu<R>,
    toggle: MenuItem<R>,
    codex: MenuItem<R>,
    settings: MenuItem<R>,
    quit: MenuItem<R>,
    #[cfg(debug_assertions)]
    debug: DebugMenuItems<R>,
}

impl<R: Runtime> LocalizedMenu<R> {
    fn set_labels(&self, labels: MenuLabels) -> tauri::Result<()> {
        self.toggle.set_text(labels.toggle)?;
        self.codex.set_text(labels.codex)?;
        self.settings.set_text(labels.settings)?;
        self.quit.set_text(labels.quit)?;

        #[cfg(debug_assertions)]
        {
            self.debug.submenu.set_text(labels.demo)?;
            self.debug.idle.set_text(labels.demo_idle)?;
            self.debug.media.set_text(labels.demo_media)?;
            self.debug.volume.set_text(labels.demo_volume)?;
        }

        Ok(())
    }
}

pub(crate) struct QuickMenu {
    tray_menu: LocalizedMenu<tauri::Wry>,
    context_menu: LocalizedMenu<tauri::Wry>,
    tray_icon: TrayIcon<tauri::Wry>,
}

#[tauri::command]
pub(crate) fn show_context_menu(
    window: tauri::WebviewWindow,
    menu: tauri::State<'_, QuickMenu>,
) -> Result<(), String> {
    use tauri::menu::ContextMenu;
    menu.context_menu
        .menu
        .popup(window.as_ref().window())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn set_menu_language(
    language: String,
    menu: tauri::State<'_, QuickMenu>,
) -> Result<(), String> {
    let labels = MenuLanguage::parse(&language)?.labels();
    menu.tray_menu
        .set_labels(labels)
        .and_then(|_| menu.context_menu.set_labels(labels))
        .and_then(|_| menu.tray_icon.set_tooltip(Some(labels.tooltip)))
        .map_err(|error| error.to_string())
}

pub(crate) fn emit_action(app: &tauri::AppHandle, action: &str) {
    if let Err(error) = app.emit("atoll-action", action) {
        log::warn!("Unable to emit Atoll action '{action}': {error}");
    }
}

fn create_menu<R: Runtime>(
    app: &tauri::AppHandle<R>,
    labels: MenuLabels,
) -> tauri::Result<LocalizedMenu<R>> {
    let toggle = MenuItem::with_id(app, "toggle", labels.toggle, true, None::<&str>)?;
    let codex = MenuItem::with_id(app, "codex", labels.codex, true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", labels.settings, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", labels.quit, true, None::<&str>)?;

    #[cfg(debug_assertions)]
    let debug = {
        let idle = MenuItem::with_id(app, "demo:idle", labels.demo_idle, true, None::<&str>)?;
        let media = MenuItem::with_id(app, "demo:media", labels.demo_media, true, None::<&str>)?;
        let volume = MenuItem::with_id(app, "demo:volume", labels.demo_volume, true, None::<&str>)?;
        let submenu = Submenu::with_items(app, labels.demo, true, &[&idle, &media, &volume])?;

        DebugMenuItems {
            submenu,
            idle,
            media,
            volume,
        }
    };

    let separator_one = PredefinedMenuItem::separator(app)?;
    let separator_two = PredefinedMenuItem::separator(app)?;

    #[cfg(debug_assertions)]
    let menu = Menu::with_items(
        app,
        &[
            &toggle,
            &separator_one,
            &debug.submenu,
            &codex,
            &settings,
            &separator_two,
            &quit,
        ],
    )?;

    #[cfg(not(debug_assertions))]
    let menu = Menu::with_items(
        app,
        &[
            &toggle,
            &separator_one,
            &codex,
            &settings,
            &separator_two,
            &quit,
        ],
    )?;

    Ok(LocalizedMenu {
        menu,
        toggle,
        codex,
        settings,
        quit,
        #[cfg(debug_assertions)]
        debug,
    })
}

pub(crate) fn setup_tray(app: &tauri::App) -> tauri::Result<QuickMenu> {
    let labels = MenuLanguage::English.labels();
    let tray_menu = create_menu(app.handle(), labels)?;
    let context_menu = create_menu(app.handle(), labels)?;

    let mut builder = TrayIconBuilder::with_id("atoll-tray")
        .menu(&tray_menu.menu)
        .show_menu_on_left_click(false)
        .tooltip(labels.tooltip)
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

    builder = builder.icon(tauri::include_image!("./icons/tray-32.png"));
    let tray_icon = builder.build(app)?;
    Ok(QuickMenu {
        tray_menu,
        context_menu,
        tray_icon,
    })
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
