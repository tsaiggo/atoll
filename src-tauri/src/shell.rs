use std::{thread, time::Duration};

use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewWindow};

use crate::runtime::{
    corner_radius, is_current_transition, lock_window_mutation, next_transition_epoch,
    set_corner_radius, set_top_margin, top_margin, RuntimeState,
};

#[derive(Clone, Copy, PartialEq)]
struct MonitorSignature {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    scale_bits: u64,
}

// The Fluent Card surface is rendered inside the webview. Native code owns only
// the exact-fit HWND policy and region so no rectangular compositor layer can
// appear outside the CSS lower-corner silhouette.

#[cfg(target_os = "windows")]
fn apply_dwm_frame_policy(hwnd: windows::Win32::Foundation::HWND) {
    use std::ffi::c_void;

    use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWINDOWATTRIBUTE};

    const DWMWA_WINDOW_CORNER_PREFERENCE: DWMWINDOWATTRIBUTE = DWMWINDOWATTRIBUTE(33);
    const DWMWA_BORDER_COLOR: DWMWINDOWATTRIBUTE = DWMWINDOWATTRIBUTE(34);
    const DWMWA_SYSTEMBACKDROP_TYPE: DWMWINDOWATTRIBUTE = DWMWINDOWATTRIBUTE(38);
    const DWMWCP_DONOTROUND: i32 = 1;
    const DWMWA_COLOR_NONE: u32 = 0xFFFF_FFFE;
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

    set_attribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, &DWMWCP_DONOTROUND);
    set_attribute(hwnd, DWMWA_BORDER_COLOR, &DWMWA_COLOR_NONE);
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
    apply_dwm_frame_policy(hwnd);
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn apply_native_window_policy(_window: &WebviewWindow) -> Result<(), String> {
    Ok(())
}

fn show_without_focus(window: &WebviewWindow) -> Result<(), String> {
    window.show().map_err(|error| error.to_string())
}

pub fn start_display_watcher(app: AppHandle) {
    thread::spawn(move || {
        let mut previous: Option<MonitorSignature> = None;
        loop {
            if let Some(window) = app.get_webview_window("main") {
                let signature =
                    window
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
                    let runtime = window.state::<RuntimeState>();
                    let _mutation = lock_window_mutation(&runtime);
                    if let (Ok(size), Ok(scale)) = (window.inner_size(), window.scale_factor()) {
                        let logical = size.to_logical::<f64>(scale);
                        let margin = top_margin(&runtime);
                        let target_radius = corner_radius(&runtime);
                        if let Err(error) = resize_and_position(
                            &window,
                            logical.width,
                            logical.height,
                            margin,
                            target_radius,
                        ) {
                            log::warn!(
                                "Unable to reposition Atoll after a display change: {error}"
                            );
                        }
                    }
                }
                previous = signature;
            }
            thread::sleep(Duration::from_secs(2));
        }
    });
}

struct ShellRequest {
    shell: String,
    width: f64,
    height: f64,
    corner_radius: f64,
    animated: bool,
    top_margin: f64,
}

// Tauri exposes command arguments as a flat IPC contract, so this boundary intentionally
// mirrors the seven values sent by src/platform/native.ts.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn set_window_shell(
    window: WebviewWindow,
    shell: String,
    width: f64,
    height: f64,
    corner_radius: f64,
    animated: bool,
    top_margin: f64,
    theme: String,
) -> Result<(), String> {
    let request = ShellRequest {
        shell,
        width,
        height,
        corner_radius,
        animated,
        top_margin,
    };
    let _ = theme;
    tauri::async_runtime::spawn_blocking(move || accept_window_shell(window, request))
        .await
        .map_err(|error| error.to_string())?
}

fn accept_window_shell(window: WebviewWindow, request: ShellRequest) -> Result<(), String> {
    let ShellRequest {
        shell,
        width,
        height,
        corner_radius,
        animated,
        top_margin,
    } = request;
    let target_corner_radius = corner_radius.max(0.0);
    let (epoch, start_width, start_height) = {
        // Keep accepting a newer request and each native mutation mutually ordered.
        // An older frame can finish before this block, but it can never write after it.
        let runtime = window.state::<RuntimeState>();
        let _mutation = lock_window_mutation(&runtime);
        let epoch = next_transition_epoch(&runtime);
        set_top_margin(&runtime, top_margin);
        set_corner_radius(&runtime, target_corner_radius);
        if shell == "hidden" {
            window.hide().map_err(|error| error.to_string())?;
            return Ok(());
        }

        let current = window
            .inner_size()
            .map_err(|error| error.to_string())?
            .to_logical::<f64>(window.scale_factor().map_err(|error| error.to_string())?);
        (epoch, current.width.max(1.0), current.height.max(1.0))
    };
    let steps = if animated { 12 } else { 1 };
    let (first_width, first_height) =
        shell_frame_geometry(1, steps, start_width, start_height, width, height);

    {
        let runtime = window.state::<RuntimeState>();
        let _mutation = lock_window_mutation(&runtime);
        if !is_current_transition(&runtime, epoch) {
            return Ok(());
        }

        resize_and_position(
            &window,
            first_width,
            first_height,
            top_margin,
            target_corner_radius,
        )?;
        show_without_focus(&window)?;
        // ShowWindow is queued by the runtime. apply_shell_region starts with a
        // synchronous scale-factor query, which drains that queue before SetWindowRgn.
        // Reapplying here also makes a non-animated first frame safe.
        apply_shell_region(&window, first_width, first_height, target_corner_radius)?;
    }

    if steps > 1 {
        let cloned_window = window.clone();
        thread::spawn(move || {
            for step in 2..=steps {
                thread::sleep(Duration::from_millis(16));
                let (frame_width, frame_height) =
                    shell_frame_geometry(step, steps, start_width, start_height, width, height);
                let runtime = cloned_window.state::<RuntimeState>();
                let _mutation = lock_window_mutation(&runtime);
                if !is_current_transition(&runtime, epoch) {
                    return;
                }
                if let Err(error) = resize_and_position(
                    &cloned_window,
                    frame_width,
                    frame_height,
                    top_margin,
                    target_corner_radius,
                ) {
                    log::warn!("Unable to resize Atoll to the {shell} shell: {error}");
                    return;
                }
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
    let progress = step as f64 / steps.max(1) as f64;
    let eased = 1.0 - (1.0 - progress).powi(4);
    (
        start_width + (target_width - start_width) * eased,
        start_height + (target_height - start_height) * eased,
    )
}

fn resize_and_position(
    window: &WebviewWindow,
    width: f64,
    height: f64,
    top_margin: f64,
    target_corner_radius: f64,
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
    apply_shell_region(window, width, height, target_corner_radius)?;
    Ok(())
}

fn apply_shell_region(
    window: &WebviewWindow,
    width: f64,
    height: f64,
    target_corner_radius: f64,
) -> Result<(), String> {
    let effective_radius = effective_corner_radius(target_corner_radius, width, height);
    apply_window_region(window, width, height, effective_radius)
}

fn effective_corner_radius(target_radius: f64, width: f64, height: f64) -> f64 {
    target_radius
        .max(0.0)
        .min(height.max(0.0))
        .min((width.max(0.0) / 2.0).max(0.0))
}

#[cfg(target_os = "windows")]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct WindowRegionBand {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[cfg(target_os = "windows")]
#[derive(Debug, PartialEq, Eq)]
struct WindowRegionBands {
    physical_width: i32,
    physical_height: i32,
    bands: Vec<WindowRegionBand>,
}

#[cfg(target_os = "windows")]
fn corner_pixel_coverage(radius: f64, center_y: f64, x: i32, y: i32) -> f64 {
    const SAMPLES: usize = 32;

    let mut coverage = 0.0;
    for sample in 0..SAMPLES {
        let sample_y = y as f64 + (sample as f64 + 0.5) / SAMPLES as f64;
        let dy = (sample_y - center_y).clamp(0.0, radius);
        let boundary_x = radius - (radius * radius - dy * dy).max(0.0).sqrt();
        coverage += (x as f64 + 1.0 - boundary_x).clamp(0.0, 1.0);
    }
    coverage / SAMPLES as f64
}

#[cfg(target_os = "windows")]
fn window_region_bands(
    width: f64,
    height: f64,
    logical_radius: f64,
    scale: f64,
) -> WindowRegionBands {
    let physical_width = (width * scale).round().max(1.0) as i32;
    let physical_height = (height * scale).round().max(1.0) as i32;
    let physical_radius = (logical_radius * scale)
        .max(0.0)
        .min(physical_height as f64)
        .min(physical_width as f64 / 2.0);
    let curve_top = physical_height as f64 - physical_radius;
    const MIN_VISIBLE_COVERAGE: f64 = 0.05;
    let mut bands: Vec<WindowRegionBand> = Vec::new();

    for y in 0..physical_height {
        let inset = if physical_radius <= f64::EPSILON || (y as f64) < curve_top {
            0
        } else {
            // Chromium discards subpixel fragments below roughly five percent
            // coverage. Mirroring that threshold avoids both clipping the visible
            // contour and exposing Acrylic in fully transparent CSS pixels.
            (0..=physical_radius.ceil() as i32)
                .find(|x| {
                    corner_pixel_coverage(physical_radius, curve_top, *x, y) >= MIN_VISIBLE_COVERAGE
                })
                .unwrap_or_else(|| physical_radius.ceil() as i32)
        }
        .min(physical_width / 2);
        let right = physical_width - inset;

        if let Some(previous) = bands.last_mut() {
            if previous.left == inset && previous.right == right && previous.bottom == y {
                previous.bottom = y + 1;
                continue;
            }
        }
        bands.push(WindowRegionBand {
            left: inset,
            top: y,
            right,
            bottom: y + 1,
        });
    }

    WindowRegionBands {
        physical_width,
        physical_height,
        bands,
    }
}

#[cfg(target_os = "windows")]
fn apply_window_region(
    window: &WebviewWindow,
    width: f64,
    height: f64,
    logical_radius: f64,
) -> Result<(), String> {
    use windows::Win32::Graphics::Gdi::{
        CombineRgn, CreateRectRgn, DeleteObject, SetWindowRgn, RGN_ERROR, RGN_OR,
    };

    let scale = window.scale_factor().map_err(|error| error.to_string())?;
    let geometry = window_region_bands(width, height, logical_radius, scale);
    let hwnd = window.hwnd().map_err(|error| error.to_string())?;
    let first = geometry
        .bands
        .first()
        .ok_or_else(|| "Unable to create an empty Atoll click region".to_string())?;

    unsafe {
        let region = CreateRectRgn(first.left, first.top, first.right, first.bottom);
        if region.is_invalid() {
            return Err("Unable to create the Atoll click region".to_string());
        }

        for band in geometry.bands.iter().skip(1) {
            let part = CreateRectRgn(band.left, band.top, band.right, band.bottom);
            if part.is_invalid() {
                let _ = DeleteObject(region.into());
                return Err("Unable to create an Atoll corner band".to_string());
            }
            let combined = CombineRgn(Some(region), Some(region), Some(part), RGN_OR);
            let _ = DeleteObject(part.into());
            if combined == RGN_ERROR {
                let _ = DeleteObject(region.into());
                return Err("Unable to combine the Atoll corner region".to_string());
            }
        }

        if SetWindowRgn(hwnd, Some(region), true) == 0 {
            let _ = DeleteObject(region.into());
            return Err("Unable to apply the Atoll click region".to_string());
        }
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn apply_window_region(
    _window: &WebviewWindow,
    _width: f64,
    _height: f64,
    _logical_radius: f64,
) -> Result<(), String> {
    Ok(())
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::{
        effective_corner_radius, shell_frame_geometry, window_region_bands, WindowRegionBands,
    };

    fn contains(region: &WindowRegionBands, x: i32, y: i32) -> bool {
        region
            .bands
            .iter()
            .any(|band| x >= band.left && x < band.right && y >= band.top && y < band.bottom)
    }

    #[test]
    fn effective_corner_radius_matches_css_constraints() {
        assert_eq!(effective_corner_radius(12.0, 80.0, 12.0), 12.0);
        assert_eq!(effective_corner_radius(22.0, 188.0, 12.0), 12.0);
        assert_eq!(effective_corner_radius(22.0, 188.0, 44.0), 22.0);
        assert_eq!(effective_corner_radius(12.0, 384.0, 148.0), 12.0);
        assert_eq!(effective_corner_radius(30.0, 40.0, 80.0), 20.0);
    }

    #[test]
    fn target_radius_stays_css_synchronized_during_animation() {
        for frame_height in 44..=148 {
            assert_eq!(
                effective_corner_radius(12.0, 384.0, f64::from(frame_height)),
                12.0
            );
            assert_eq!(
                effective_corner_radius(22.0, 188.0, f64::from(frame_height)),
                22.0
            );
        }
        for frame_height in 12..=44 {
            assert_eq!(
                effective_corner_radius(22.0, 188.0, f64::from(frame_height)),
                f64::from(frame_height).min(22.0)
            );
        }
    }

    #[test]
    fn shell_animation_reaches_the_exact_target() {
        let first = shell_frame_geometry(1, 12, 188.0, 44.0, 384.0, 148.0);
        assert!(first.0 > 188.0 && first.0 < 384.0);
        assert!(first.1 > 44.0 && first.1 < 148.0);
        assert_eq!(
            shell_frame_geometry(12, 12, 188.0, 44.0, 384.0, 148.0),
            (384.0, 148.0)
        );
        assert_eq!(
            shell_frame_geometry(1, 1, 188.0, 44.0, 384.0, 148.0),
            (384.0, 148.0)
        );
    }

    #[test]
    fn region_bands_are_symmetric_at_supported_scales() {
        let cases = [
            (384.0, 148.0, 12.0, 1.0),
            (384.0, 148.0, 12.0, 1.25),
            (384.0, 148.0, 12.0, 1.5),
            (384.0, 148.0, 12.0, 2.0),
            (188.0, 44.0, 22.0, 1.0),
            (188.0, 44.0, 22.0, 1.25),
            (188.0, 44.0, 22.0, 1.5),
            (188.0, 44.0, 22.0, 2.0),
        ];

        for (width, height, radius, scale) in cases {
            let region = window_region_bands(width, height, radius, scale);
            assert_eq!(region.bands.first().map(|band| band.top), Some(0));
            assert_eq!(
                region.bands.last().map(|band| band.bottom),
                Some(region.physical_height)
            );
            let mut previous_left = 0;
            for band in &region.bands {
                assert_eq!(band.left + band.right, region.physical_width);
                assert!(band.left >= previous_left);
                assert!(band.top < band.bottom);
                previous_left = band.left;
            }
        }
    }

    #[test]
    fn expanded_region_contains_visible_css_edge_at_150_percent() {
        let region = window_region_bands(384.0, 148.0, 12.0, 1.5);
        let left_edge = [
            (0, 209),
            (1, 211),
            (2, 213),
            (3, 214),
            (4, 216),
            (5, 217),
            (7, 218),
            (10, 220),
            (12, 221),
        ];
        for (x, y) in left_edge {
            assert!(contains(&region, x, y));
            assert!(contains(&region, region.physical_width - 1 - x, y));
        }
        let transparent_points = [
            (0, 210),
            (1, 212),
            (2, 214),
            (3, 215),
            (4, 217),
            (6, 218),
            (9, 220),
            (11, 221),
        ];
        for (x, y) in transparent_points {
            assert!(!contains(&region, x, y));
            assert!(!contains(&region, region.physical_width - 1 - x, y));
        }
    }

    #[test]
    fn compact_region_contains_visible_css_edge_at_150_percent() {
        let region = window_region_bands(188.0, 44.0, 22.0, 1.5);
        let left_edge = [
            (0, 37),
            (1, 43),
            (2, 46),
            (3, 48),
            (4, 50),
            (7, 53),
            (7, 54),
            (13, 59),
            (25, 65),
        ];
        for (x, y) in left_edge {
            assert!(contains(&region, x, y));
            assert!(contains(&region, region.physical_width - 1 - x, y));
        }
        let transparent_points = [(0, 41), (1, 44), (6, 53), (12, 59), (21, 64), (24, 65)];
        for (x, y) in transparent_points {
            assert!(!contains(&region, x, y));
            assert!(!contains(&region, region.physical_width - 1 - x, y));
        }
    }
}
