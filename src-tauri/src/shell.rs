use std::{thread, time::Duration};

use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, State, WebviewWindow};

use crate::{
    is_current_transition, next_transition_epoch, set_top_margin, top_margin, RuntimeState,
};

#[derive(Clone, Copy, PartialEq)]
struct MonitorSignature {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    scale_bits: u64,
}

#[cfg(target_os = "windows")]
pub fn apply_native_window_policy(window: &WebviewWindow) -> Result<(), String> {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, SWP_FRAMECHANGED,
        SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WS_EX_APPWINDOW,
        WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
    };

    let hwnd = window.hwnd().map_err(|error| error.to_string())?;
    unsafe {
        let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let style = (style & !WS_EX_APPWINDOW.0) | WS_EX_TOOLWINDOW.0 | WS_EX_NOACTIVATE.0;
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style as isize);
        SetWindowPos(
            hwnd,
            None,
            0,
            0,
            0,
            0,
            SWP_FRAMECHANGED | SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER,
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn apply_native_window_policy(_window: &WebviewWindow) -> Result<(), String> {
    Ok(())
}

pub fn show_without_focus(window: &WebviewWindow) -> Result<(), String> {
    window.show().map_err(|error| error.to_string())?;
    apply_native_window_policy(window)
}

pub fn start_display_watcher(app: AppHandle) {
    thread::spawn(move || {
        let mut previous: Option<MonitorSignature> = None;
        loop {
            if let Some(window) = app.get_webview_window("main") {
                let signature = window
                    .primary_monitor()
                    .ok()
                    .flatten()
                    .map(|monitor| MonitorSignature {
                        x: monitor.position().x,
                        y: monitor.position().y,
                        width: monitor.size().width,
                        height: monitor.size().height,
                        scale_bits: monitor.scale_factor().to_bits(),
                    });

                if previous.is_some() && signature != previous {
                    if let (Ok(size), Ok(scale)) = (window.inner_size(), window.scale_factor()) {
                        let logical = size.to_logical::<f64>(scale);
                        let margin = top_margin(&window.state::<RuntimeState>());
                        if let Err(error) =
                            resize_and_position(&window, logical.width, logical.height, margin)
                        {
                            log::warn!("Unable to reposition Atoll after a display change: {error}");
                        }
                    }
                }
                previous = signature;
            }
            thread::sleep(Duration::from_secs(2));
        }
    });
}

#[tauri::command]
pub fn set_window_shell(
    window: WebviewWindow,
    state: State<'_, RuntimeState>,
    shell: String,
    width: f64,
    height: f64,
    animated: bool,
    top_margin: f64,
) -> Result<(), String> {
    let epoch = next_transition_epoch(&state);
    set_top_margin(&state, top_margin);
    if shell == "hidden" {
        return window.hide().map_err(|error| error.to_string());
    }

    let current = window
        .inner_size()
        .map_err(|error| error.to_string())?
        .to_logical::<f64>(window.scale_factor().map_err(|error| error.to_string())?);
    let start_width = current.width.max(1.0);
    let start_height = current.height.max(1.0);
    let steps = if animated { 12 } else { 1 };
    let cloned_window = window.clone();

    thread::spawn(move || {
        for step in 1..=steps {
            if !is_current_transition(&cloned_window.state::<RuntimeState>(), epoch) {
                return;
            }
            let progress = step as f64 / steps as f64;
            let eased = 1.0 - (1.0 - progress).powi(4);
            let frame_width = start_width + (width - start_width) * eased;
            let frame_height = start_height + (height - start_height) * eased;
            if resize_and_position(&cloned_window, frame_width, frame_height, top_margin).is_err() {
                return;
            }
            if step == 1 {
                let _ = show_without_focus(&cloned_window);
            }
            if animated && step < steps {
                thread::sleep(Duration::from_millis(16));
            }
        }
    });
    Ok(())
}

fn resize_and_position(
    window: &WebviewWindow,
    width: f64,
    height: f64,
    top_margin: f64,
) -> Result<(), String> {
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|error| error.to_string())?;

    let monitor = window
        .primary_monitor()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "No primary display is available".to_string())?;
    let scale = monitor.scale_factor();
    let monitor_position = monitor.position();
    let monitor_size = monitor.size();
    let monitor_x = monitor_position.x as f64 / scale;
    let monitor_y = monitor_position.y as f64 / scale;
    let monitor_width = monitor_size.width as f64 / scale;
    let x = monitor_x + (monitor_width - width) / 2.0;
    let y = monitor_y + top_margin;

    window
        .set_position(LogicalPosition::new(x, y))
        .map_err(|error| error.to_string())?;
    apply_window_region(window, width, height)?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn apply_window_region(window: &WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    use windows::Win32::Graphics::Gdi::{
        CombineRgn, CreateRectRgn, CreateRoundRectRgn, DeleteObject, SetWindowRgn, RGN_OR,
    };

    let scale = window.scale_factor().map_err(|error| error.to_string())?;
    let physical_width = (width * scale).round() as i32;
    let physical_height = (height * scale).round() as i32;
    let radius = (physical_height.min((24.0 * scale) as i32) * 2).max(2);
    let hwnd = window.hwnd().map_err(|error| error.to_string())?;

    unsafe {
        let rounded = CreateRoundRectRgn(
            0,
            0,
            physical_width + 1,
            physical_height + 1,
            radius,
            radius,
        );
        let top = CreateRectRgn(0, 0, physical_width + 1, (radius / 2).max(1));
        if rounded.is_invalid() || top.is_invalid() {
            return Err("Unable to create the Atoll click region".to_string());
        }
        CombineRgn(Some(rounded), Some(rounded), Some(top), RGN_OR);
        let _ = DeleteObject(top.into());
        if SetWindowRgn(hwnd, Some(rounded), true) == 0 {
            let _ = DeleteObject(rounded.into());
            return Err("Unable to apply the Atoll click region".to_string());
        }
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn apply_window_region(_window: &WebviewWindow, _width: f64, _height: f64) -> Result<(), String> {
    Ok(())
}
