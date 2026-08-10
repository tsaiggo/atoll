use std::{thread, time::Duration};

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use windows::{
    core::implement,
    Win32::{
        Foundation::RPC_E_CHANGED_MODE,
        Media::Audio::{
            eMultimedia, eRender,
            Endpoints::{
                IAudioEndpointVolume, IAudioEndpointVolumeCallback,
                IAudioEndpointVolumeCallback_Impl,
            },
            IMMDeviceEnumerator, MMDeviceEnumerator, AUDIO_VOLUME_NOTIFICATION_DATA,
        },
        System::Com::{
            CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
        },
    },
};

#[derive(Clone, Serialize)]
struct VolumePayload {
    level: f32,
    muted: bool,
    initial: bool,
}

#[implement(IAudioEndpointVolumeCallback)]
struct VolumeCallback {
    app: AppHandle,
}

/// Holds the COM initialization reference acquired by a volume command.
///
/// Tauri's blocking worker threads are reused, so each command must initialize
/// COM for the current thread and balance that initialization before returning.
/// If the worker was already initialized for a different apartment model, its
/// existing COM apartment can still be used; it just must not be uninitialized
/// by this command.
struct ComApartment {
    should_uninitialize: bool,
}

impl ComApartment {
    fn initialize() -> Result<Self, String> {
        let result = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        if result.is_ok() {
            return Ok(Self {
                should_uninitialize: true,
            });
        }

        if result == RPC_E_CHANGED_MODE {
            return Ok(Self {
                should_uninitialize: false,
            });
        }

        Err(format!(
            "Unable to initialize COM for system volume control: {result}"
        ))
    }
}

impl Drop for ComApartment {
    fn drop(&mut self) {
        if self.should_uninitialize {
            unsafe { CoUninitialize() };
        }
    }
}

impl IAudioEndpointVolumeCallback_Impl for VolumeCallback_Impl {
    fn OnNotify(
        &self,
        notification: *mut AUDIO_VOLUME_NOTIFICATION_DATA,
    ) -> windows::core::Result<()> {
        if notification.is_null() {
            return Ok(());
        }
        let data = unsafe { &*notification };
        let payload = VolumePayload {
            level: data.fMasterVolume.clamp(0.0, 1.0),
            muted: data.bMuted.as_bool(),
            initial: false,
        };
        let _ = self.app.emit("system-volume", payload);
        Ok(())
    }
}

pub fn start_watcher(app: AppHandle) {
    thread::spawn(move || {
        let _ = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        loop {
            if let Err(error) = watch_current_endpoint(&app) {
                log::debug!("System volume monitoring will retry: {error}");
                thread::sleep(Duration::from_secs(8));
            }
        }
    });
}

fn watch_current_endpoint(app: &AppHandle) -> windows::core::Result<()> {
    let endpoint = default_render_endpoint()?;
    let callback: IAudioEndpointVolumeCallback = VolumeCallback { app: app.clone() }.into();

    let initial = VolumePayload {
        level: unsafe { endpoint.GetMasterVolumeLevelScalar()? }.clamp(0.0, 1.0),
        muted: unsafe { endpoint.GetMute()? }.as_bool(),
        initial: true,
    };
    let _ = app.emit("system-volume", initial);
    unsafe { endpoint.RegisterControlChangeNotify(&callback)? };

    // Reconnect periodically so a newly selected default output device is picked up
    // without requiring a process restart.
    thread::sleep(Duration::from_secs(20));
    unsafe { endpoint.UnregisterControlChangeNotify(&callback)? };
    Ok(())
}

#[tauri::command]
pub(crate) async fn set_system_volume(level: f32) -> Result<bool, String> {
    let level = normalize_volume_level(level)?;
    tauri::async_runtime::spawn_blocking(move || {
        let _com = ComApartment::initialize()?;
        let endpoint = default_render_endpoint()
            .map_err(|error| format!("System volume control is unavailable: {error}"))?;
        unsafe { endpoint.SetMasterVolumeLevelScalar(level, std::ptr::null()) }
            .map_err(|error| format!("Unable to set system volume: {error}"))?;
        Ok(true)
    })
    .await
    .map_err(|error| format!("System volume control did not complete: {error}"))?
}

#[tauri::command]
pub(crate) async fn set_system_mute(muted: bool) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _com = ComApartment::initialize()?;
        let endpoint = default_render_endpoint()
            .map_err(|error| format!("System volume control is unavailable: {error}"))?;
        unsafe { endpoint.SetMute(muted, std::ptr::null()) }
            .map_err(|error| format!("Unable to change system mute: {error}"))?;
        Ok(true)
    })
    .await
    .map_err(|error| format!("System volume control did not complete: {error}"))?
}

fn default_render_endpoint() -> windows::core::Result<IAudioEndpointVolume> {
    let enumerator: IMMDeviceEnumerator =
        unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)? };
    let device = unsafe { enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia)? };
    unsafe { device.Activate(CLSCTX_ALL, None) }
}

fn normalize_volume_level(level: f32) -> Result<f32, String> {
    if !level.is_finite() {
        return Err("System volume must be a finite number.".to_string());
    }

    Ok(level.clamp(0.0, 1.0))
}

#[cfg(test)]
mod tests {
    use super::normalize_volume_level;

    #[test]
    fn volume_level_is_clamped_to_the_supported_scalar_range() {
        assert_eq!(normalize_volume_level(-0.25), Ok(0.0));
        assert_eq!(normalize_volume_level(0.42), Ok(0.42));
        assert_eq!(normalize_volume_level(1.25), Ok(1.0));
    }

    #[test]
    fn volume_level_rejects_non_finite_values() {
        assert!(normalize_volume_level(f32::NAN).is_err());
        assert!(normalize_volume_level(f32::INFINITY).is_err());
        assert!(normalize_volume_level(f32::NEG_INFINITY).is_err());
    }
}
