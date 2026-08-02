use std::{
    thread,
    time::{Duration, Instant},
};

use tauri::{AppHandle, Manager, WebviewWindow};

#[cfg(not(target_os = "windows"))]
use tauri::{LogicalPosition, LogicalSize};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::HWND;

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

const SHELL_FRAME_INTERVAL: Duration = Duration::from_millis(16);

#[derive(Clone, Copy)]
struct WindowPlacement {
    monitor_x: i32,
    monitor_y: i32,
    monitor_width: u32,
    scale: f64,
    #[cfg(target_os = "windows")]
    // HWND is a raw pointer and therefore not Send. The frame worker owns the
    // integer handle value and rehydrates it only at the Win32 call boundary.
    hwnd: isize,
}

// The Status Island surface is rendered inside the webview. Native code owns
// the exact-fit HWND policy and four-corner region so no rectangular compositor
// layer can appear outside the CSS silhouette.

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
        corner_radius: requested_corner_radius,
        animated,
        top_margin,
    } = request;
    let target_corner_radius = requested_corner_radius.max(0.0);
    let (epoch, start_width, start_height, start_corner_radius, placement) = {
        // Keep accepting a newer request and each native mutation mutually ordered.
        // An older frame can finish before this block, but it can never write after it.
        let runtime = window.state::<RuntimeState>();
        let _mutation = lock_window_mutation(&runtime);
        let epoch = next_transition_epoch(&runtime);
        let start_corner_radius = corner_radius(&runtime);
        set_top_margin(&runtime, top_margin);
        if shell == "hidden" {
            window.hide().map_err(|error| error.to_string())?;
            return Ok(());
        }

        let placement = capture_window_placement(&window)?;
        let current = window
            .inner_size()
            .map_err(|error| error.to_string())?
            .to_logical::<f64>(placement.scale);
        (
            epoch,
            current.width.max(1.0),
            current.height.max(1.0),
            start_corner_radius,
            placement,
        )
    };
    let steps = if animated {
        if width * height < start_width * start_height {
            11
        } else {
            15
        }
    } else {
        1
    };
    let (first_width, first_height, first_corner_radius) = if animated {
        (start_width, start_height, start_corner_radius)
    } else {
        (width, height, target_corner_radius)
    };

    {
        let runtime = window.state::<RuntimeState>();
        let _mutation = lock_window_mutation(&runtime);
        if !is_current_transition(&runtime, epoch) {
            return Ok(());
        }
        set_corner_radius(&runtime, first_corner_radius);

        resize_and_position_at(
            &window,
            placement,
            first_width,
            first_height,
            top_margin,
            first_corner_radius,
        )?;
        show_without_focus(&window)?;
    }

    if steps > 1 {
        let cloned_window = window.clone();
        thread::spawn(move || {
            let transition_started = Instant::now();
            for step in 1..=steps {
                // Anchor each frame to the original deadline instead of sleeping
                // after work. Window and region updates therefore cannot stretch
                // the transition into a visibly uneven 20ms+ cadence.
                let deadline = transition_started
                    + Duration::from_millis(SHELL_FRAME_INTERVAL.as_millis() as u64 * step as u64);
                if let Some(remaining) = deadline.checked_duration_since(Instant::now()) {
                    thread::sleep(remaining);
                }
                let (frame_width, frame_height) =
                    shell_frame_geometry(step, steps, start_width, start_height, width, height);
                let frame_corner_radius = shell_frame_corner_radius(
                    step,
                    steps,
                    start_corner_radius,
                    target_corner_radius,
                );
                let runtime = cloned_window.state::<RuntimeState>();
                let _mutation = lock_window_mutation(&runtime);
                if !is_current_transition(&runtime, epoch) {
                    return;
                }
                set_corner_radius(&runtime, frame_corner_radius);
                if let Err(error) = resize_and_position_at(
                    &cloned_window,
                    placement,
                    frame_width,
                    frame_height,
                    top_margin,
                    frame_corner_radius,
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
    let eased = progress * progress * (3.0 - 2.0 * progress);
    (
        start_width + (target_width - start_width) * eased,
        start_height + (target_height - start_height) * eased,
    )
}

fn shell_frame_corner_radius(
    step: u32,
    steps: u32,
    start_corner_radius: f64,
    target_corner_radius: f64,
) -> f64 {
    let progress = step as f64 / steps.max(1) as f64;
    let eased = progress * progress * (3.0 - 2.0 * progress);
    start_corner_radius + (target_corner_radius - start_corner_radius) * eased
}

fn capture_window_placement(window: &WebviewWindow) -> Result<WindowPlacement, String> {
    let monitor = window
        .primary_monitor()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "No primary display is available".to_string())?;
    let position = monitor.position();
    let size = monitor.size();
    #[cfg(target_os = "windows")]
    let hwnd = window.hwnd().map_err(|error| error.to_string())?.0 as isize;

    Ok(WindowPlacement {
        monitor_x: position.x,
        monitor_y: position.y,
        monitor_width: size.width,
        scale: monitor.scale_factor(),
        #[cfg(target_os = "windows")]
        hwnd,
    })
}

fn physical_window_frame(
    monitor_x: i32,
    monitor_y: i32,
    monitor_width: u32,
    scale: f64,
    width: f64,
    height: f64,
    top_margin: f64,
) -> (i32, i32, i32, i32) {
    let physical_width = (width * scale).round().max(1.0) as i32;
    let physical_height = (height * scale).round().max(1.0) as i32;
    let x = monitor_x + ((monitor_width as f64 - physical_width as f64) / 2.0).round() as i32;
    let y = monitor_y + (top_margin * scale).round() as i32;
    (x, y, physical_width, physical_height)
}

fn resize_and_position(
    window: &WebviewWindow,
    width: f64,
    height: f64,
    top_margin: f64,
    target_corner_radius: f64,
) -> Result<(), String> {
    let placement = capture_window_placement(window)?;
    resize_and_position_at(
        window,
        placement,
        width,
        height,
        top_margin,
        target_corner_radius,
    )
}

fn resize_and_position_at(
    window: &WebviewWindow,
    placement: WindowPlacement,
    width: f64,
    height: f64,
    top_margin: f64,
    target_corner_radius: f64,
) -> Result<(), String> {
    let (x, y, physical_width, physical_height) = physical_window_frame(
        placement.monitor_x,
        placement.monitor_y,
        placement.monitor_width,
        placement.scale,
        width,
        height,
        top_margin,
    );

    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::WindowsAndMessaging::{
            SetWindowPos, SWP_NOACTIVATE, SWP_NOOWNERZORDER, SWP_NOZORDER,
        };

        // One SetWindowPos keeps position and size in the same compositor
        // transaction. The supported Tauri calls previously dispatched them
        // separately for every frame, which is especially noticeable on a
        // transparent WebView while Windows is rebuilding its surface.
        unsafe {
            SetWindowPos(
                HWND(placement.hwnd as *mut std::ffi::c_void),
                None,
                x,
                y,
                physical_width,
                physical_height,
                SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOZORDER,
            )
            .map_err(|error| error.to_string())?;
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
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

    apply_shell_region_at(window, placement, width, height, target_corner_radius)?;
    Ok(())
}

fn apply_shell_region_at(
    window: &WebviewWindow,
    placement: WindowPlacement,
    width: f64,
    height: f64,
    target_corner_radius: f64,
) -> Result<(), String> {
    let effective_radius = effective_corner_radius(target_corner_radius, width, height);
    #[cfg(target_os = "windows")]
    {
        let _ = window;
        apply_window_region(
            placement.hwnd,
            placement.scale,
            width,
            height,
            effective_radius,
        )
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = placement;
        apply_window_region(window, width, height, effective_radius)
    }
}

fn effective_corner_radius(target_radius: f64, width: f64, height: f64) -> f64 {
    target_radius
        .max(0.0)
        .min((height.max(0.0) / 2.0).max(0.0))
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
fn corner_pixel_coverage(radius: f64, center_y: f64, x: i32, y: i32, top_corner: bool) -> f64 {
    const SAMPLES: usize = 32;

    let mut coverage = 0.0;
    for sample in 0..SAMPLES {
        let sample_y = y as f64 + (sample as f64 + 0.5) / SAMPLES as f64;
        let dy = if top_corner {
            (center_y - sample_y).clamp(0.0, radius)
        } else {
            (sample_y - center_y).clamp(0.0, radius)
        };
        let boundary_x = radius - (radius * radius - dy * dy).max(0.0).sqrt();
        coverage += (x as f64 + 1.0 - boundary_x).clamp(0.0, 1.0);
    }
    coverage / SAMPLES as f64
}

#[cfg(target_os = "windows")]
fn rounded_rect_row_inset(radius: f64, physical_height: i32, y: i32) -> i32 {
    const MIN_VISIBLE_COVERAGE: f64 = 0.05;

    if radius <= f64::EPSILON {
        return 0;
    }
    let top_corner = (y as f64) < radius;
    let bottom_corner = (y as f64) >= physical_height as f64 - radius;
    if !top_corner && !bottom_corner {
        return 0;
    }

    let use_top_corner = top_corner;
    let center_y = if use_top_corner {
        radius
    } else {
        physical_height as f64 - radius
    };
    (0..=radius.ceil() as i32)
        .find(|x| {
            corner_pixel_coverage(radius, center_y, *x, y, use_top_corner) >= MIN_VISIBLE_COVERAGE
        })
        .unwrap_or_else(|| radius.ceil() as i32)
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
        .min(physical_height as f64 / 2.0)
        .min(physical_width as f64 / 2.0);
    let mut bands: Vec<WindowRegionBand> = Vec::new();

    for y in 0..physical_height {
        // Chromium discards subpixel fragments below roughly five percent
        // coverage. Mirroring that threshold keeps CSS's visible contour and the
        // native hit region aligned at all four Island corners.
        let inset =
            rounded_rect_row_inset(physical_radius, physical_height, y).min(physical_width / 2);
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
    hwnd: isize,
    scale: f64,
    width: f64,
    height: f64,
    logical_radius: f64,
) -> Result<(), String> {
    use windows::Win32::Graphics::Gdi::{
        CombineRgn, CreateRectRgn, DeleteObject, SetWindowRgn, RGN_ERROR, RGN_OR,
    };

    let geometry = window_region_bands(width, height, logical_radius, scale);
    let first = geometry
        .bands
        .first()
        .ok_or_else(|| "Unable to create an empty Atoll click region".to_string())?;

    unsafe {
        let hwnd = HWND(hwnd as *mut std::ffi::c_void);
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

        // SetWindowPos has already invalidated this frame. Avoid asking GDI for
        // a second synchronous repaint solely for the hit-test contour.
        if SetWindowRgn(hwnd, Some(region), false) == 0 {
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
        effective_corner_radius, physical_window_frame, shell_frame_corner_radius,
        shell_frame_geometry, window_region_bands, WindowRegionBands,
    };

    fn contains(region: &WindowRegionBands, x: i32, y: i32) -> bool {
        region
            .bands
            .iter()
            .any(|band| x >= band.left && x < band.right && y >= band.top && y < band.bottom)
    }

    fn row_inset(region: &WindowRegionBands, y: i32) -> i32 {
        region
            .bands
            .iter()
            .find(|band| y >= band.top && y < band.bottom)
            .map(|band| band.left)
            .expect("every physical row should have a hit region band")
    }

    #[test]
    fn effective_corner_radius_matches_css_constraints() {
        assert_eq!(effective_corner_radius(16.0, 96.0, 32.0), 16.0);
        assert_eq!(effective_corner_radius(28.0, 256.0, 56.0), 28.0);
        assert_eq!(effective_corner_radius(28.0, 400.0, 176.0), 28.0);
        assert_eq!(effective_corner_radius(28.0, 256.0, 28.0), 14.0);
        assert_eq!(effective_corner_radius(30.0, 40.0, 80.0), 20.0);
    }

    #[test]
    fn shell_animation_morphs_geometry_and_radius_on_the_same_curve() {
        let start = (96.0, 32.0, 16.0);
        let target = (400.0, 176.0, 28.0);
        let steps = 12;
        let mut previous = start;
        for step in 0..=steps {
            let (width, height) =
                shell_frame_geometry(step, steps, start.0, start.1, target.0, target.1);
            let radius = shell_frame_corner_radius(step, steps, start.2, target.2);
            assert!(width >= previous.0);
            assert!(height >= previous.1);
            assert!(radius >= previous.2);
            assert!(radius <= height / 2.0);
            previous = (width, height, radius);
        }
        assert_eq!(previous, target);
    }

    #[test]
    fn shell_frames_stay_centered_in_physical_pixels() {
        for (width, height) in [(96.0, 32.0), (256.0, 56.0), (400.0, 176.0)] {
            let (x, y, physical_width, physical_height) =
                physical_window_frame(-1920, 0, 2880, 1.5, width, height, 8.0);
            assert_eq!(x * 2 + physical_width, -1920 * 2 + 2880);
            assert_eq!(y, 12);
            assert_eq!(physical_width, (width * 1.5) as i32);
            assert_eq!(physical_height, (height * 1.5) as i32);
        }
    }

    #[test]
    fn island_region_bands_are_symmetric_at_supported_scales() {
        let cases = [
            (96.0, 32.0, 16.0, 1.0),
            (96.0, 32.0, 16.0, 1.25),
            (96.0, 32.0, 16.0, 1.5),
            (96.0, 32.0, 16.0, 2.0),
            (256.0, 56.0, 28.0, 1.0),
            (256.0, 56.0, 28.0, 1.25),
            (256.0, 56.0, 28.0, 1.5),
            (256.0, 56.0, 28.0, 2.0),
            (400.0, 176.0, 28.0, 1.0),
            (400.0, 176.0, 28.0, 1.25),
            (400.0, 176.0, 28.0, 1.5),
            (400.0, 176.0, 28.0, 2.0),
        ];

        for (width, height, radius, scale) in cases {
            let region = window_region_bands(width, height, radius, scale);
            assert_eq!(region.bands.first().map(|band| band.top), Some(0));
            assert_eq!(
                region.bands.last().map(|band| band.bottom),
                Some(region.physical_height)
            );
            for band in &region.bands {
                assert_eq!(band.left + band.right, region.physical_width);
                assert!(band.top < band.bottom);
            }
            for y in 0..region.physical_height {
                assert_eq!(
                    row_inset(&region, y),
                    row_inset(&region, region.physical_height - 1 - y)
                );
            }
        }
    }

    #[test]
    fn island_regions_exclude_all_transparent_corners_at_150_percent() {
        for (width, height, radius) in [
            (96.0, 32.0, 16.0),
            (256.0, 56.0, 28.0),
            (400.0, 176.0, 28.0),
        ] {
            let region = window_region_bands(width, height, radius, 1.5);
            let middle_x = region.physical_width / 2;
            let last_x = region.physical_width - 1;
            let last_y = region.physical_height - 1;
            assert!(!contains(&region, 0, 0));
            assert!(!contains(&region, last_x, 0));
            assert!(!contains(&region, 0, last_y));
            assert!(!contains(&region, last_x, last_y));
            assert!(contains(&region, middle_x, 0));
            assert!(contains(&region, middle_x, last_y));
        }
    }
}
