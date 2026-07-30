use std::{
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use tauri::{AppHandle, Emitter, Manager, State};

use crate::{
    is_current_timer, is_fullscreen, next_timer_epoch, RuntimeState,
};

#[tauri::command]
pub fn schedule_timer(
    app: AppHandle,
    state: State<'_, RuntimeState>,
    end_at_ms: Option<u64>,
    break_fullscreen: bool,
) -> Result<(), String> {
    let epoch = next_timer_epoch(&state);
    let Some(end_at_ms) = end_at_ms else {
        return Ok(());
    };

    thread::spawn(move || loop {
        let runtime = app.state::<RuntimeState>();
        if !is_current_timer(&runtime, epoch) {
            return;
        }

        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        if now_ms >= end_at_ms {
            if !is_fullscreen(&runtime) || break_fullscreen {
                if let Some(window) = app.get_webview_window("main") {
                    // The window is non-focusable, so surfacing a completed timer
                    // does not steal focus from the user's current application.
                    let _ = crate::shell::show_without_focus(&window);
                }
            }
            let _ = app.emit("timer-elapsed", ());
            return;
        }

        let remaining_ms = end_at_ms.saturating_sub(now_ms);
        thread::sleep(Duration::from_millis(remaining_ms.min(1_000)));
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wall_clock_is_expressed_in_unix_milliseconds() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock predates Unix epoch")
            .as_millis() as u64;
        assert!(now > 1_700_000_000_000);
    }
}
