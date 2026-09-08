use std::{
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

#[cfg(not(target_os = "windows"))]
use tauri::{LogicalPosition, LogicalSize};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::HWND;

#[cfg(target_os = "windows")]
use crate::runtime::update_shell_dark_mode;
use crate::runtime::{
    is_current_transition, lock_window_mutation, next_transition_epoch, set_shell_layout,
    shell_layout, NotchEdge, RuntimeState, ShellLayout, ShellRegion,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct WorkArea {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[derive(Clone, Copy, PartialEq, Eq)]
struct MonitorSignature {
    bounds: WorkArea,
    work_area: WorkArea,
    scale_bits: u64,
}

const SHELL_FRAME_INTERVAL: Duration = Duration::from_millis(16);
const MAX_SHELL_DIMENSION: f64 = 4096.0;
const MAX_REGIONS: usize = 6;
const MAX_REGION_POINTS: usize = 64;
const POINT_TOLERANCE: f64 = 0.000_001;

#[derive(Clone, Copy)]
struct WindowPlacement {
    bounds: WorkArea,
    work_area: WorkArea,
    scale: f64,
    #[cfg(target_os = "windows")]
    // HWND itself is not Send. Rehydrate this integer only at the Win32 boundary.
    hwnd: isize,
}

impl WindowPlacement {
    fn signature(self) -> MonitorSignature {
        MonitorSignature {
            bounds: self.bounds,
            work_area: self.work_area,
            scale_bits: self.scale.to_bits(),
        }
    }
}

// SVG and the native region consume the same frontend polygons. Their union
// includes only painted surfaces and explicit pointer corridors.

#[cfg(target_os = "windows")]
fn apply_dwm_frame_policy(hwnd: windows::Win32::Foundation::HWND, dark_mode: bool) {
    use std::ffi::c_void;

    use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWINDOWATTRIBUTE};

    const DWMWA_WINDOW_CORNER_PREFERENCE: DWMWINDOWATTRIBUTE = DWMWINDOWATTRIBUTE(33);
    const DWMWA_BORDER_COLOR: DWMWINDOWATTRIBUTE = DWMWINDOWATTRIBUTE(34);
    const DWMWA_SYSTEMBACKDROP_TYPE: DWMWINDOWATTRIBUTE = DWMWINDOWATTRIBUTE(38);
    const DWMWA_USE_IMMERSIVE_DARK_MODE: DWMWINDOWATTRIBUTE = DWMWINDOWATTRIBUTE(20);
    const DWMWCP_DONOTROUND: i32 = 1;
    const DWMWA_COLOR_NONE: u32 = 0xFFFF_FFFE;
    // System backdrops (DWMWA_SYSTEMBACKDROP_TYPE) are painted by DWM into an
    // opaque window frame; a transparent WebView window is composed as a layered
    // surface instead and would render its default white page over the backdrop.
    // The WebView's own CSS material (backdrop-filter + translucent fallback)
    // carries the acrylic surface, clipped by the CSS radius and matching HRGN.
    const DWMSBT_NONE: i32 = 1;

    fn set_attribute<T>(
        hwnd: windows::Win32::Foundation::HWND,
        attribute: DWMWINDOWATTRIBUTE,
        value: &T,
    ) {
        let result = unsafe {
            DwmSetWindowAttribute(
                hwnd,
                attribute,
                (value as *const T).cast::<c_void>(),
                std::mem::size_of::<T>() as u32,
            )
        };
        if let Err(error) = result {
            log::debug!("Unable to apply DWM frame attribute {attribute:?}: {error}");
        }
    }

    let immersive_dark_mode: i32 = if dark_mode { 1 } else { 0 };

    set_attribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, &DWMWCP_DONOTROUND);
    set_attribute(hwnd, DWMWA_BORDER_COLOR, &DWMWA_COLOR_NONE);
    set_attribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, &immersive_dark_mode);
    set_attribute(hwnd, DWMWA_SYSTEMBACKDROP_TYPE, &DWMSBT_NONE);
}

#[cfg(target_os = "windows")]
pub fn apply_native_window_policy(window: &WebviewWindow) -> Result<(), String> {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, SWP_FRAMECHANGED,
        SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WS_EX_APPWINDOW, WS_EX_NOACTIVATE,
        WS_EX_TOOLWINDOW,
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
    // The window starts hidden; the first shell request immediately replaces
    // this provisional dark mode with the system theme reported by the WebView.
    apply_dwm_frame_policy(hwnd, true);
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn apply_native_window_policy(_window: &WebviewWindow) -> Result<(), String> {
    Ok(())
}

fn show_without_focus(window: &WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::WindowsAndMessaging::{
            GetWindowLongPtrW, SetWindowLongPtrW, ShowWindow, GWL_EXSTYLE, SW_SHOWNOACTIVATE,
            WS_EX_APPWINDOW, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
        };
        let hwnd = window.hwnd().map_err(|error| error.to_string())?;
        unsafe {
            // Wry's generic show rebuilds styles from its own flags and drops
            // our tool-window bit. Keep the edge surface out of Alt-Tab while
            // presenting compositor frames without activating it.
            let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
            let wanted = (style & !WS_EX_APPWINDOW.0) | WS_EX_NOACTIVATE.0 | WS_EX_TOOLWINDOW.0;
            if style != wanted {
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, wanted as isize);
            }
            let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    window.show().map_err(|error| error.to_string())
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShellSettledPayload {
    transition_id: u64,
}

fn emit_shell_settled(window: &WebviewWindow, transition_id: u64) {
    if let Err(error) = window.emit("atoll-shell-settled", ShellSettledPayload { transition_id }) {
        log::debug!("Unable to report a settled Atoll shell: {error}");
    }
}

pub fn start_display_watcher(app: AppHandle) {
    thread::spawn(move || {
        let mut previous: Option<MonitorSignature> = None;
        loop {
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(placement) = capture_window_placement(&window) {
                    let signature = placement.signature();
                    if previous.is_some() && previous != Some(signature) {
                        let runtime = window.state::<RuntimeState>();
                        let _mutation = lock_window_mutation(&runtime);
                        if let Some(layout) = shell_layout(&runtime) {
                            // Cancel workers holding the old monitor/scale snapshot before
                            // restoring the final layout. Resizing never shows a hidden HWND.
                            next_transition_epoch(&runtime);
                            match resize_and_position_at(
                                &window,
                                placement,
                                layout.width,
                                layout.height,
                                &layout,
                            ) {
                                Ok(()) => emit_shell_settled(&window, layout.transition_id),
                                Err(error) => log::warn!(
                                    "Unable to reposition Atoll after a display change: {error}"
                                ),
                            }
                        }
                    }
                    previous = Some(signature);
                }
            }
            thread::sleep(Duration::from_secs(2));
        }
    });
}

// Leaving an HRGN can stop WebView2 mouse delivery before it sends a DOM
// pointerleave. Reconcile against the real desktop cursor and installed region.
pub fn start_pointer_watcher(app: AppHandle) {
    #[cfg(target_os = "windows")]
    thread::spawn(move || loop {
        if let Some(window) = app.get_webview_window("main") {
            if let Ok(inside) = cursor_inside_window(&window) {
                let _ = window.emit("atoll-pointer-presence", inside);
            }
        }
        thread::sleep(Duration::from_millis(100));
    });
    #[cfg(not(target_os = "windows"))]
    let _ = app;
}

#[cfg(target_os = "windows")]
fn cursor_inside_window(window: &WebviewWindow) -> Result<bool, String> {
    use windows::Win32::{
        Foundation::{POINT, RECT},
        Graphics::Gdi::{CreateRectRgn, DeleteObject, GetWindowRgn, PtInRegion},
        UI::WindowsAndMessaging::{GetCursorPos, GetWindowRect, IsWindowVisible},
    };
    let hwnd = window.hwnd().map_err(|e| e.to_string())?;
    unsafe {
        if !IsWindowVisible(hwnd).as_bool() {
            return Ok(false);
        }
        let mut cursor = POINT::default();
        let mut rect = RECT::default();
        GetCursorPos(&mut cursor).map_err(|e| e.to_string())?;
        GetWindowRect(hwnd, &mut rect).map_err(|e| e.to_string())?;
        if cursor.x < rect.left
            || cursor.x >= rect.right
            || cursor.y < rect.top
            || cursor.y >= rect.bottom
        {
            return Ok(false);
        }
        let region = CreateRectRgn(0, 0, 0, 0);
        if region.is_invalid() {
            return Err("Unable to inspect cursor region".to_string());
        }
        let kind = GetWindowRgn(hwnd, region);
        let inside =
            kind.0 > 0 && PtInRegion(region, cursor.x - rect.left, cursor.y - rect.top).as_bool();
        let _ = DeleteObject(region.into());
        Ok(inside)
    }
}

struct ShellRequest {
    shell: String,
    layout: ShellLayout,
    animated: bool,
    theme: String,
}

// Tauri maps camelCase frontend properties to these flat snake_case arguments.
// corner_radius and top_margin are accepted for IPC compatibility; the supplied
// polygons and selected work-area edge now own the contour and positioning.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub(crate) async fn set_window_shell(
    window: WebviewWindow,
    shell: String,
    width: f64,
    height: f64,
    corner_radius: f64,
    animated: bool,
    top_margin: f64,
    edge: NotchEdge,
    regions: Vec<ShellRegion>,
    theme: String,
    transition_id: u64,
) -> Result<(), String> {
    if !matches!(shell.as_str(), "hidden" | "reef" | "compact" | "expanded") {
        return Err("Unknown Atoll shell state".to_string());
    }
    if !corner_radius.is_finite() || !top_margin.is_finite() {
        return Err("Shell compatibility dimensions must be finite".to_string());
    }
    let layout = ShellLayout {
        width,
        height,
        edge,
        regions,
        transition_id,
    };
    validate_shell_layout(&layout)?;
    let request = ShellRequest {
        shell,
        layout,
        animated,
        theme,
    };
    tauri::async_runtime::spawn_blocking(move || accept_window_shell(window, request))
        .await
        .map_err(|error| error.to_string())?
}

fn validate_shell_layout(layout: &ShellLayout) -> Result<(), String> {
    for dimension in [layout.width, layout.height] {
        if !dimension.is_finite() || !(1.0..=MAX_SHELL_DIMENSION).contains(&dimension) {
            return Err("Shell dimensions must be finite and between 1 and 4096 DIP".to_string());
        }
    }
    if layout.regions.is_empty() || layout.regions.len() > MAX_REGIONS {
        return Err("Shell geometry requires between 1 and 6 polygon regions".to_string());
    }
    for region in &layout.regions {
        if !(3..=MAX_REGION_POINTS).contains(&region.points.len()) {
            return Err("Each shell polygon requires between 3 and 64 points".to_string());
        }
        for point in &region.points {
            if !point.x.is_finite()
                || !point.y.is_finite()
                || point.x < -POINT_TOLERANCE
                || point.y < -POINT_TOLERANCE
                || point.x > layout.width + POINT_TOLERANCE
                || point.y > layout.height + POINT_TOLERANCE
            {
                return Err(
                    "Shell polygon coordinates must be finite and inside the host".to_string(),
                );
            }
        }
        let twice_area: f64 = region
            .points
            .iter()
            .zip(region.points.iter().cycle().skip(1))
            .map(|(a, b)| a.x * b.y - b.x * a.y)
            .sum();
        if twice_area.abs() <= POINT_TOLERANCE {
            return Err("Shell polygons must enclose a nonzero area".to_string());
        }
    }
    Ok(())
}

fn accept_window_shell(window: WebviewWindow, request: ShellRequest) -> Result<(), String> {
    let ShellRequest {
        shell,
        layout,
        animated,
        theme,
    } = request;
    let (epoch, start_width, start_height, placement) = {
        let runtime = window.state::<RuntimeState>();
        let _mutation = lock_window_mutation(&runtime);
        let epoch = next_transition_epoch(&runtime);
        #[cfg(target_os = "windows")]
        let previous = shell_layout(&runtime);
        set_shell_layout(&runtime, layout.clone());
        if shell == "hidden" {
            window.hide().map_err(|error| error.to_string())?;
            return Ok(());
        }

        #[cfg(target_os = "windows")]
        {
            use windows::Win32::{
                Foundation::RECT,
                UI::WindowsAndMessaging::{GetWindowRect, IsWindowVisible},
            };
            let hwnd = window.hwnd().map_err(|error| error.to_string())?;
            let dark = !theme.eq_ignore_ascii_case("light");
            if update_shell_dark_mode(&runtime, dark) {
                apply_dwm_frame_policy(hwnd, dark);
            }
            // The compositor keeps one host size throughout a fold/glide. A
            // frame only changes its region: no monitor query, window sizing,
            // ShowWindow, or redundant settled event on the UI thread.
            if !animated
                && previous.as_ref().is_some_and(|old| {
                    old.width == layout.width
                        && old.height == layout.height
                        && old.edge == layout.edge
                })
                && unsafe { IsWindowVisible(hwnd).as_bool() }
            {
                let mut rect = RECT::default();
                unsafe {
                    GetWindowRect(hwnd, &mut rect).map_err(|error| error.to_string())?;
                    apply_window_region(
                        hwnd,
                        rect.right - rect.left,
                        rect.bottom - rect.top,
                        &layout,
                    )?;
                }
                return Ok(());
            }
        }
        #[cfg(not(target_os = "windows"))]
        let _ = theme;

        let placement = capture_window_placement(&window)?;
        let current = window
            .inner_size()
            .map_err(|error| error.to_string())?
            .to_logical::<f64>(placement.scale);
        (
            epoch,
            current.width.max(1.0),
            current.height.max(1.0),
            placement,
        )
    };
    let changed_size =
        (layout.width - start_width).abs() > 0.5 || (layout.height - start_height).abs() > 0.5;
    let steps = if animated && changed_size {
        if layout.width * layout.height < start_width * start_height {
            16
        } else {
            26
        }
    } else {
        1
    };
    let (first_width, first_height) = if steps > 1 {
        (start_width, start_height)
    } else {
        (layout.width, layout.height)
    };

    {
        let runtime = window.state::<RuntimeState>();
        let _mutation = lock_window_mutation(&runtime);
        if !is_current_transition(&runtime, epoch) {
            return Ok(());
        }
        resize_and_position_at(&window, placement, first_width, first_height, &layout)?;
        show_without_focus(&window)?;
        if steps == 1 {
            emit_shell_settled(&window, layout.transition_id);
        }
    }

    if steps > 1 {
        thread::spawn(move || {
            let transition_started = Instant::now();
            for step in 1..=steps {
                let deadline = transition_started + SHELL_FRAME_INTERVAL * step;
                if let Some(remaining) = deadline.checked_duration_since(Instant::now()) {
                    thread::sleep(remaining);
                }
                let (width, height) = shell_frame_geometry(
                    step,
                    steps,
                    start_width,
                    start_height,
                    layout.width,
                    layout.height,
                );
                let runtime = window.state::<RuntimeState>();
                let _mutation = lock_window_mutation(&runtime);
                if !is_current_transition(&runtime, epoch) {
                    return;
                }
                if let Err(error) =
                    resize_and_position_at(&window, placement, width, height, &layout)
                {
                    log::warn!("Unable to resize Atoll to the {shell} shell: {error}");
                    return;
                }
            }
            let runtime = window.state::<RuntimeState>();
            let _mutation = lock_window_mutation(&runtime);
            if is_current_transition(&runtime, epoch) {
                emit_shell_settled(&window, layout.transition_id);
            }
        });
    }
    Ok(())
}

fn shell_frame_geometry(
    step: u32,
    steps: u32,
    start_width: f64,
    start_height: f64,
    target_width: f64,
    target_height: f64,
) -> (f64, f64) {
    let progress = (step as f64 / steps.max(1) as f64).clamp(0.0, 1.0);
    // A damped spring approximates Codenotch's response 0.42 / damping 0.78.
    // Normalization lands exactly on the final geometry at the last deadline.
    let response = |t: f64| {
        let damping = 0.78_f64;
        let frequency = std::f64::consts::TAU;
        let ratio = (1.0 - damping * damping).sqrt();
        let phase = frequency * ratio * t;
        1.0 - (-damping * frequency * t).exp() * (phase.cos() + damping / ratio * phase.sin())
    };
    let eased = response(progress) / response(1.0);
    (
        (start_width + (target_width - start_width) * eased).max(1.0),
        (start_height + (target_height - start_height) * eased).max(1.0),
    )
}

fn capture_window_placement(window: &WebviewWindow) -> Result<WindowPlacement, String> {
    let monitor = window
        .primary_monitor()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "No primary display is available".to_string())?;
    let scale = monitor.scale_factor();
    if !scale.is_finite() || !(0.1..=16.0).contains(&scale) {
        return Err("Primary display has an invalid scale factor".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::{
            Foundation::POINT,
            Graphics::Gdi::{
                GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTOPRIMARY,
            },
        };
        let position = monitor.position();
        let handle = unsafe {
            MonitorFromPoint(
                POINT {
                    x: position.x,
                    y: position.y,
                },
                MONITOR_DEFAULTTOPRIMARY,
            )
        };
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if handle.is_invalid() || !unsafe { GetMonitorInfoW(handle, &mut info) }.as_bool() {
            return Err("Unable to read the primary display work area".to_string());
        }
        let bounds = WorkArea {
            left: info.rcMonitor.left,
            top: info.rcMonitor.top,
            right: info.rcMonitor.right,
            bottom: info.rcMonitor.bottom,
        };
        let work_area = WorkArea {
            left: info.rcWork.left,
            top: info.rcWork.top,
            right: info.rcWork.right,
            bottom: info.rcWork.bottom,
        };
        validate_work_area(work_area)?;
        Ok(WindowPlacement {
            bounds,
            work_area,
            scale,
            hwnd: window.hwnd().map_err(|error| error.to_string())?.0 as isize,
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        let position = monitor.position();
        let size = monitor.size();
        let bounds = WorkArea {
            left: position.x,
            top: position.y,
            right: (i64::from(position.x) + i64::from(size.width))
                .try_into()
                .map_err(|_| "Display width is out of range".to_string())?,
            bottom: (i64::from(position.y) + i64::from(size.height))
                .try_into()
                .map_err(|_| "Display height is out of range".to_string())?,
        };
        validate_work_area(bounds)?;
        Ok(WindowPlacement {
            bounds,
            work_area: bounds,
            scale,
        })
    }
}

fn validate_work_area(area: WorkArea) -> Result<(), String> {
    if area.right <= area.left || area.bottom <= area.top {
        Err("Primary display has an empty work area".to_string())
    } else {
        Ok(())
    }
}

fn physical_window_frame(
    work_area: WorkArea,
    scale: f64,
    width: f64,
    height: f64,
    edge: NotchEdge,
) -> Result<(i32, i32, i32, i32), String> {
    validate_work_area(work_area)?;
    let physical_width = (width * scale).round().max(1.0) as i32;
    let physical_height = (height * scale).round().max(1.0) as i32;
    let left = i64::from(work_area.left);
    let top = i64::from(work_area.top);
    let available_width = i64::from(work_area.right) - left;
    let available_height = i64::from(work_area.bottom) - top;
    let center_x =
        left + ((available_width - i64::from(physical_width)) as f64 / 2.0).round() as i64;
    let center_y =
        top + ((available_height - i64::from(physical_height)) as f64 / 2.0).round() as i64;
    let (x, y) = match edge {
        NotchEdge::Top => (center_x, top),
        NotchEdge::Bottom => (
            center_x,
            i64::from(work_area.bottom) - i64::from(physical_height),
        ),
        NotchEdge::Left => (left, center_y),
        NotchEdge::Right => (
            i64::from(work_area.right) - i64::from(physical_width),
            center_y,
        ),
    };
    Ok((
        x.try_into()
            .map_err(|_| "Shell x position is out of range".to_string())?,
        y.try_into()
            .map_err(|_| "Shell y position is out of range".to_string())?,
        physical_width,
        physical_height,
    ))
}

fn resize_and_position_at(
    window: &WebviewWindow,
    placement: WindowPlacement,
    width: f64,
    height: f64,
    layout: &ShellLayout,
) -> Result<(), String> {
    let (x, y, physical_width, physical_height) = physical_window_frame(
        placement.work_area,
        placement.scale,
        width,
        height,
        layout.edge,
    )?;

    #[cfg(target_os = "windows")]
    {
        use windows::Win32::{
            Foundation::RECT,
            UI::WindowsAndMessaging::{
                GetWindowRect, SetWindowPos, SWP_NOACTIVATE, SWP_NOOWNERZORDER, SWP_NOZORDER,
            },
        };
        let _ = window;
        let hwnd = HWND(placement.hwnd as *mut std::ffi::c_void);
        unsafe {
            SetWindowPos(
                hwnd,
                None,
                x,
                y,
                physical_width,
                physical_height,
                SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOZORDER,
            )
            .map_err(|error| error.to_string())?;
            let mut actual = RECT::default();
            GetWindowRect(hwnd, &mut actual).map_err(|error| error.to_string())?;
            apply_window_region(
                hwnd,
                actual.right - actual.left,
                actual.bottom - actual.top,
                layout,
            )?;
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (physical_width, physical_height);
        window
            .set_size(LogicalSize::new(width, height))
            .map_err(|error| error.to_string())?;
        window
            .set_position(LogicalPosition::new(
                x as f64 / placement.scale,
                y as f64 / placement.scale,
            ))
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn physical_region_points(
    region: &ShellRegion,
    physical_width: i32,
    physical_height: i32,
    target_width: f64,
    target_height: f64,
) -> Vec<(i32, i32)> {
    region
        .points
        .iter()
        .map(|point| {
            (
                (point.x.clamp(0.0, target_width) * f64::from(physical_width) / target_width)
                    .round() as i32,
                (point.y.clamp(0.0, target_height) * f64::from(physical_height) / target_height)
                    .round() as i32,
            )
        })
        .collect()
}

#[cfg(target_os = "windows")]
unsafe fn apply_window_region(
    hwnd: HWND,
    physical_width: i32,
    physical_height: i32,
    layout: &ShellLayout,
) -> Result<(), String> {
    use windows::Win32::{
        Foundation::POINT,
        Graphics::Gdi::{
            CombineRgn, CreatePolygonRgn, CreateRectRgn, DeleteObject, OffsetRgn, SetWindowRgn,
            RGN_COPY, RGN_ERROR, RGN_OR, WINDING,
        },
    };
    if physical_width <= 0 || physical_height <= 0 {
        return Err("Cannot apply polygons to an empty native host".to_string());
    }
    let region = CreateRectRgn(0, 0, 0, 0);
    if region.is_invalid() {
        return Err("Unable to create the Atoll click region".to_string());
    }
    for polygon in &layout.regions {
        let points: Vec<POINT> = physical_region_points(
            polygon,
            physical_width,
            physical_height,
            layout.width,
            layout.height,
        )
        .into_iter()
        .map(|(x, y)| POINT { x, y })
        .collect();
        let part = CreatePolygonRgn(&points, WINDING);
        if part.is_invalid() {
            let _ = DeleteObject(region.into());
            return Err("Unable to create an Atoll polygon region".to_string());
        }
        let combined = CombineRgn(Some(region), Some(region), Some(part), RGN_OR);
        let _ = DeleteObject(part.into());
        if combined == RGN_ERROR {
            let _ = DeleteObject(region.into());
            return Err("Unable to combine Atoll polygon regions".to_string());
        }
    }
    // HRGN is a binary pixel mask. Clipping at the exact rounded sample removes
    // WebView2's antialiased fringe and produces staircase edges. Keep two
    // physical pixels of transparent breathing room around the input contour.
    let fringe = CreateRectRgn(0, 0, 0, 0);
    let shifted = CreateRectRgn(0, 0, 0, 0);
    if fringe.is_invalid() || shifted.is_invalid() {
        let _ = DeleteObject(fringe.into());
        let _ = DeleteObject(shifted.into());
        let _ = DeleteObject(region.into());
        return Err("Unable to create the contour antialias margin".to_string());
    }
    let mut margin_ok = CombineRgn(Some(fringe), Some(region), None, RGN_COPY) != RGN_ERROR;
    for (dx, dy) in [
        (-2, -2),
        (0, -2),
        (2, -2),
        (-2, 0),
        (2, 0),
        (-2, 2),
        (0, 2),
        (2, 2),
    ] {
        margin_ok &= CombineRgn(Some(shifted), Some(region), None, RGN_COPY) != RGN_ERROR;
        margin_ok &= OffsetRgn(shifted, dx, dy) != RGN_ERROR;
        margin_ok &= CombineRgn(Some(fringe), Some(fringe), Some(shifted), RGN_OR) != RGN_ERROR;
    }
    margin_ok &= CombineRgn(Some(region), Some(fringe), None, RGN_COPY) != RGN_ERROR;
    let _ = DeleteObject(fringe.into());
    let _ = DeleteObject(shifted.into());
    if !margin_ok {
        let _ = DeleteObject(region.into());
        return Err("Unable to preserve the contour antialias margin".to_string());
    }
    // The OS owns the HRGN after success. On failure we still own and free it.
    // Unused transparent host space remains outside this union and click-through.
    if SetWindowRgn(hwnd, Some(region), false) == 0 {
        let _ = DeleteObject(region.into());
        return Err("Unable to apply the Atoll click region".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::RegionPoint;

    fn rectangle(x: f64, y: f64, width: f64, height: f64) -> ShellRegion {
        ShellRegion {
            points: vec![
                RegionPoint { x, y },
                RegionPoint { x: x + width, y },
                RegionPoint {
                    x: x + width,
                    y: y + height,
                },
                RegionPoint { x, y: y + height },
            ],
        }
    }

    fn layout() -> ShellLayout {
        ShellLayout {
            width: 400.0,
            height: 332.0,
            edge: NotchEdge::Top,
            regions: vec![
                rectangle(22.0, 0.0, 306.0, 90.0),
                rectangle(340.0, 10.0, 34.0, 34.0),
                rectangle(0.0, 102.0, 400.0, 230.0),
                rectangle(120.0, 80.0, 54.0, 30.0),
            ],
            transition_id: 7,
        }
    }

    #[test]
    fn four_edges_use_the_work_area_at_all_supported_scales() {
        let area = WorkArea {
            left: -1880,
            top: 40,
            right: 0,
            bottom: 1400,
        };
        for scale in [1.0, 1.25, 1.5, 2.0] {
            for edge in [
                NotchEdge::Top,
                NotchEdge::Bottom,
                NotchEdge::Left,
                NotchEdge::Right,
            ] {
                let (x, y, width, height) =
                    physical_window_frame(area, scale, 400.0, 332.0, edge).unwrap();
                assert!(x >= area.left && y >= area.top);
                assert!(x + width <= area.right && y + height <= area.bottom);
                match edge {
                    NotchEdge::Top => assert_eq!(y, area.top),
                    NotchEdge::Bottom => assert_eq!(y + height, area.bottom),
                    NotchEdge::Left => assert_eq!(x, area.left),
                    NotchEdge::Right => assert_eq!(x + width, area.right),
                }
                if matches!(edge, NotchEdge::Top | NotchEdge::Bottom) {
                    assert!(
                        (i64::from(x) * 2 + i64::from(width)
                            - i64::from(area.left)
                            - i64::from(area.right))
                        .abs()
                            <= 1
                    );
                } else {
                    assert!(
                        (i64::from(y) * 2 + i64::from(height)
                            - i64::from(area.top)
                            - i64::from(area.bottom))
                        .abs()
                            <= 1
                    );
                }
            }
        }
    }

    #[test]
    fn taskbar_move_changes_display_signature_without_resolution_change() {
        let bounds = WorkArea {
            left: 0,
            top: 0,
            right: 1920,
            bottom: 1080,
        };
        let bottom = WindowPlacement {
            bounds,
            work_area: WorkArea {
                bottom: 1040,
                ..bounds
            },
            scale: 1.0,
            #[cfg(target_os = "windows")]
            hwnd: 0,
        };
        let top = WindowPlacement {
            work_area: WorkArea { top: 40, ..bounds },
            ..bottom
        };
        assert!(bottom.signature() != top.signature());
        assert!(
            bottom.signature()
                != WindowPlacement {
                    scale: 1.25,
                    ..bottom
                }
                .signature()
        );
    }

    #[test]
    fn polygon_coordinates_scale_with_actual_animation_host_size() {
        let polygon = rectangle(100.0, 80.0, 200.0, 120.0);
        assert_eq!(
            physical_region_points(&polygon, 200, 166, 400.0, 332.0),
            vec![(50, 40), (150, 40), (150, 100), (50, 100)]
        );
        let full = rectangle(0.0, 0.0, 400.0, 332.0);
        assert_eq!(
            physical_region_points(&full, 501, 415, 400.0, 332.0),
            vec![(0, 0), (501, 0), (501, 415), (0, 415)]
        );
    }

    #[test]
    fn valid_disjoint_shapes_and_explicit_corridors_are_accepted() {
        assert!(validate_shell_layout(&layout()).is_ok());
        let mut polygon = rectangle(0.0, 0.0, 80.0, 10.0);
        // Shared rounded-rectangle sampling includes repeated points at radius 0.
        polygon.points.insert(0, polygon.points[0]);
        assert!(validate_shell_layout(&ShellLayout {
            width: 80.0,
            height: 10.0,
            regions: vec![polygon],
            ..layout()
        })
        .is_ok());
    }

    #[test]
    fn malformed_geometry_is_rejected_before_native_mutation() {
        for dimension in [f64::NAN, f64::INFINITY, -1.0, 0.0, 4097.0] {
            assert!(validate_shell_layout(&ShellLayout {
                width: dimension,
                ..layout()
            })
            .is_err());
            assert!(validate_shell_layout(&ShellLayout {
                height: dimension,
                ..layout()
            })
            .is_err());
        }
        for regions in [
            vec![],
            vec![rectangle(0.0, 0.0, 1.0, 1.0); MAX_REGIONS + 1],
            vec![ShellRegion {
                points: vec![RegionPoint { x: 0.0, y: 0.0 }; MAX_REGION_POINTS + 1],
            }],
            vec![rectangle(-1.0, 0.0, 1.0, 1.0)],
            vec![rectangle(400.0, 0.0, 1.0, 1.0)],
            vec![rectangle(0.0, 332.0, 1.0, 1.0)],
            vec![rectangle(0.0, 0.0, 0.0, 10.0)],
            vec![ShellRegion {
                points: vec![
                    RegionPoint {
                        x: f64::NAN,
                        y: 0.0
                    };
                    3
                ],
            }],
            vec![ShellRegion {
                points: vec![RegionPoint { x: 0.0, y: 0.0 }; 2],
            }],
        ] {
            assert!(validate_shell_layout(&ShellLayout {
                regions,
                ..layout()
            })
            .is_err());
        }
    }

    #[test]
    fn floating_point_contour_noise_is_clamped_only_at_host_boundary() {
        let polygon = rectangle(-0.000_000_01, 0.0, 400.000_000_02, 332.0);
        let target = ShellLayout {
            regions: vec![polygon.clone()],
            ..layout()
        };
        assert!(validate_shell_layout(&target).is_ok());
        assert_eq!(
            physical_region_points(&polygon, 400, 332, 400.0, 332.0),
            vec![(0, 0), (400, 0), (400, 332), (0, 332)]
        );
    }

    #[test]
    fn spring_animation_finishes_exactly_and_has_bounded_overshoot() {
        for (start, target, steps) in [
            ((80.0, 10.0), (400.0, 332.0), 26),
            ((502.0, 356.0), (10.0, 80.0), 16),
        ] {
            assert_eq!(
                shell_frame_geometry(0, steps, start.0, start.1, target.0, target.1),
                start
            );
            assert_eq!(
                shell_frame_geometry(steps, steps, start.0, start.1, target.0, target.1),
                target
            );
            for step in 0..=steps {
                let (width, height) =
                    shell_frame_geometry(step, steps, start.0, start.1, target.0, target.1);
                assert!(width >= 1.0 && height >= 1.0);
                assert!(width <= start.0.max(target.0) * 1.03);
                assert!(height <= start.1.max(target.1) * 1.03);
            }
        }
    }

    #[test]
    fn runtime_retains_final_target_and_new_epochs_cancel_old_frames() {
        let state = RuntimeState::default();
        let first = next_transition_epoch(&state);
        set_shell_layout(&state, layout());
        assert!(is_current_transition(&state, first));
        let second = next_transition_epoch(&state);
        assert!(!is_current_transition(&state, first));
        assert!(is_current_transition(&state, second));
        let saved = shell_layout(&state).unwrap();
        assert_eq!(
            (saved.width, saved.height, saved.edge, saved.transition_id),
            (400.0, 332.0, NotchEdge::Top, 7)
        );
        assert_eq!(saved.regions.len(), 4);
    }
}
