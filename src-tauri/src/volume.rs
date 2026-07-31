use std::{thread, time::Duration};

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use windows::{
    core::implement,
    Win32::{
        Media::Audio::{
            eMultimedia, eRender,
            Endpoints::{
                IAudioEndpointVolume, IAudioEndpointVolumeCallback,
                IAudioEndpointVolumeCallback_Impl,
            },
            IMMDeviceEnumerator, MMDeviceEnumerator, AUDIO_VOLUME_NOTIFICATION_DATA,
        },
        System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED},
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
    let enumerator: IMMDeviceEnumerator =
        unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)? };
    let device = unsafe { enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia)? };
    let endpoint: IAudioEndpointVolume = unsafe { device.Activate(CLSCTX_ALL, None)? };
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
