use std::{thread, time::Duration};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use windows::Win32::{
    Foundation::{HWND, RECT},
    Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST},
    UI::WindowsAndMessaging::{
        GetClassNameW, GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId,
        IsWindowVisible,
    },
};

use crate::runtime::{set_fullscreen, RuntimeState};

#[derive(Clone, Serialize)]
struct FullscreenPayload {
    fullscreen: bool,
}

pub fn start_watcher(app: AppHandle) {
    thread::spawn(move || {
        let mut previous = false;
        loop {
            let fullscreen = is_foreground_fullscreen();
            set_fullscreen(&app.state::<RuntimeState>(), fullscreen);
            if fullscreen != previous {
                previous = fullscreen;
                let _ = app.emit("fullscreen-changed", FullscreenPayload { fullscreen });
            }
            thread::sleep(Duration::from_millis(750));
        }
    });
}

#[tauri::command]
pub(crate) fn is_fullscreen_active() -> bool {
    is_foreground_fullscreen()
}

pub(crate) fn is_foreground_fullscreen() -> bool {
    unsafe {
        let window = GetForegroundWindow();
        if window == HWND::default() || !IsWindowVisible(window).as_bool() {
            return false;
        }

        let mut process_id = 0_u32;
        GetWindowThreadProcessId(window, Some(&mut process_id));
        if process_id == std::process::id() {
            return false;
        }

        let mut class_name = [0_u16; 96];
        let class_length = GetClassNameW(window, &mut class_name);
        if class_length > 0 {
            let class = String::from_utf16_lossy(&class_name[..class_length as usize]);
            if matches!(class.as_str(), "Progman" | "WorkerW" | "Shell_TrayWnd") {
                return false;
            }
        }

        let mut window_rect = RECT::default();
        if GetWindowRect(window, &mut window_rect).is_err() {
            return false;
        }
        let monitor = MonitorFromWindow(window, MONITOR_DEFAULTTONEAREST);
        if monitor.is_invalid() {
            return false;
        }
        let mut monitor_info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if !GetMonitorInfoW(monitor, &mut monitor_info).as_bool() {
            return false;
        }

        let bounds = monitor_info.rcMonitor;
        let tolerance = 2;
        (window_rect.left - bounds.left).abs() <= tolerance
            && (window_rect.top - bounds.top).abs() <= tolerance
            && (window_rect.right - bounds.right).abs() <= tolerance
            && (window_rect.bottom - bounds.bottom).abs() <= tolerance
    }
}

#[cfg(test)]
mod tests {
    use windows::Win32::Foundation::RECT;

    fn same_bounds(left: RECT, right: RECT, tolerance: i32) -> bool {
        (left.left - right.left).abs() <= tolerance
            && (left.top - right.top).abs() <= tolerance
            && (left.right - right.right).abs() <= tolerance
            && (left.bottom - right.bottom).abs() <= tolerance
    }

    #[test]
    fn maximized_work_area_is_not_monitor_fullscreen() {
        let monitor = RECT {
            left: 0,
            top: 0,
            right: 1920,
            bottom: 1080,
        };
        let maximized = RECT {
            left: 0,
            top: 0,
            right: 1920,
            bottom: 1040,
        };
        assert!(!same_bounds(maximized, monitor, 2));
    }

    #[test]
    fn negative_coordinate_monitor_can_match() {
        let bounds = RECT {
            left: -2560,
            top: 0,
            right: 0,
            bottom: 1440,
        };
        assert!(same_bounds(bounds, bounds, 2));
    }
}
