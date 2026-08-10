use std::{
    collections::BTreeMap,
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use windows::{
    Devices::Power::Battery,
    Win32::{
        Storage::FileSystem::{MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH},
        System::{
            SystemInformation::GetLocalTime,
            WinRT::{RoInitialize, RoUninitialize, RO_INIT_MULTITHREADED},
        },
    },
};
use windows_core::HSTRING;

const SAMPLE_INTERVAL: Duration = Duration::from_secs(60);
const MAX_RATE_INTEGRATION_GAP_MS: u64 = 3 * 60 * 1_000;
const MILLI_MWH_PER_MWH: u64 = 1_000;
const STATE_FILE_NAME: &str = "energy-state.json";
const STATE_VERSION: u8 = 3;
const LEGACY_STATE_VERSION: u8 = 2;
const MAX_HISTORY_DAYS: usize = 30;
const ENERGY_SOURCE: &str = "battery_discharge";

/// A completed local day of battery-discharge telemetry.
///
/// The tracker intentionally keeps this in whole mWh because the public
/// payload already reports the current-day total at that precision. `partial`
/// stays attached to the day so consumers do not treat a coverage gap as a
/// complete measurement.
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
pub(crate) struct DailyEnergyRecord {
    pub(crate) day_key: String,
    pub(crate) total_mwh: u64,
    pub(crate) partial: bool,
}

/// The battery-backed energy estimate currently available to the frontend.
///
/// `today_mwh` is accumulated from reported battery discharge. It uses the
/// signed charge rate when available and falls back to a remaining-capacity
/// decrease only when a driver omits that rate. It is not a wall-power reading.
#[derive(Clone, PartialEq, Eq, Serialize)]
pub(crate) struct EnergyStatus {
    pub(crate) available: bool,
    pub(crate) today_mwh: u64,
    pub(crate) day_key: String,
    pub(crate) history: Vec<DailyEnergyRecord>,
    pub(crate) tracking_since_ms: Option<u64>,
    pub(crate) source: &'static str,
    pub(crate) remaining_mwh: Option<u32>,
    pub(crate) full_charge_capacity_mwh: Option<u32>,
    pub(crate) partial: bool,
}

impl EnergyStatus {
    fn unavailable(day_key: String, history: Vec<DailyEnergyRecord>) -> Self {
        Self {
            available: false,
            today_mwh: 0,
            day_key,
            history,
            tracking_since_ms: None,
            source: ENERGY_SOURCE,
            remaining_mwh: None,
            full_charge_capacity_mwh: None,
            partial: true,
        }
    }
}

#[derive(Clone)]
pub(crate) struct EnergyRuntime {
    latest_status: Arc<Mutex<EnergyStatus>>,
}

impl Default for EnergyRuntime {
    fn default() -> Self {
        Self {
            latest_status: Arc::new(Mutex::new(EnergyStatus::unavailable(
                local_day_key(),
                Vec::new(),
            ))),
        }
    }
}

impl EnergyRuntime {
    fn replace_status(&self, next: EnergyStatus) -> bool {
        let mut latest = self
            .latest_status
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if *latest == next {
            return false;
        }
        *latest = next;
        true
    }

    fn status(&self) -> EnergyStatus {
        self.latest_status
            .lock()
            .map(|status| status.clone())
            .unwrap_or_else(|poisoned| poisoned.into_inner().clone())
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct PersistedEnergyState {
    version: u8,
    day_key: String,
    today_milli_mwh: u64,
    tracking_since_ms: Option<u64>,
    last_sample: Option<CapacitySample>,
    partial: bool,
    #[serde(default)]
    history: Vec<DailyEnergyRecord>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct CapacitySample {
    day_key: String,
    captured_at_ms: u64,
    remaining_mwh: u32,
    full_charge_capacity_mwh: u32,
    device_id: Option<String>,
    charge_rate_mw: Option<i32>,
}

struct EnergyTracker {
    day_key: String,
    today_milli_mwh: u64,
    tracking_since_ms: Option<u64>,
    last_sample: Option<CapacitySample>,
    partial: bool,
    history: Vec<DailyEnergyRecord>,
}

impl EnergyTracker {
    fn new(day_key: String) -> Self {
        Self {
            day_key,
            today_milli_mwh: 0,
            tracking_since_ms: None,
            last_sample: None,
            // A fresh process has no sample from the start of the local day.
            // Persisting this makes the coverage caveat explicit rather than
            // making a partial total look like a full-day measurement.
            partial: true,
            history: Vec::new(),
        }
    }

    fn from_persisted(state: PersistedEnergyState, current_day_key: String) -> Self {
        if !matches!(state.version, LEGACY_STATE_VERSION | STATE_VERSION) {
            return Self::new(current_day_key);
        }

        let PersistedEnergyState {
            day_key,
            today_milli_mwh,
            tracking_since_ms,
            last_sample,
            partial,
            history,
            ..
        } = state;
        let mut history = normalize_history(history, &current_day_key);

        if day_key == current_day_key {
            return Self {
                day_key,
                today_milli_mwh,
                tracking_since_ms,
                last_sample: last_sample.filter(|sample| sample.day_key == current_day_key),
                partial,
                history,
            };
        }

        // A state file can be loaded after midnight, before the first usable
        // battery report. Archive the previous local day here rather than
        // silently dropping it. A backwards system-clock jump does not create
        // a history record, because that would invent a completed day.
        if is_completed_day(&day_key, &current_day_key) {
            history.push(DailyEnergyRecord {
                day_key,
                total_mwh: today_milli_mwh / MILLI_MWH_PER_MWH,
                partial,
            });
            history = normalize_history(history, &current_day_key);
        }

        let mut tracker = Self::new(current_day_key);
        tracker.history = history;
        tracker
    }

    fn observe(&mut self, sample: CapacitySample) -> EnergyStatus {
        if self.day_key != sample.day_key {
            self.rollover_to(sample.day_key.clone(), Some(sample.clone()));
            return self.available_status(&sample);
        }

        if self.tracking_since_ms.is_none() {
            self.tracking_since_ms = Some(sample.captured_at_ms);
        }

        if let Some(previous) = self.last_sample.as_ref() {
            if same_battery(previous, &sample) {
                if sample.captured_at_ms <= previous.captured_at_ms {
                    // Time moving backwards makes the sampled interval unknown.
                    self.partial = true;
                } else {
                    let elapsed_ms = sample.captured_at_ms - previous.captured_at_ms;
                    if elapsed_ms > MAX_RATE_INTEGRATION_GAP_MS {
                        // A long interval normally means sleep, a suspended worker,
                        // or a system clock discontinuity. Do not extrapolate an
                        // instantaneous rate across it.
                        self.partial = true;
                    } else if let Some(rate_mw) = previous.charge_rate_mw {
                        // A reported rate is authoritative for this interval. Never
                        // also add a capacity delta, or the same discharge is counted
                        // twice. Positive rates are charging and therefore add zero.
                        self.today_milli_mwh = self
                            .today_milli_mwh
                            .saturating_add(discharge_from_rate_milli_mwh(rate_mw, elapsed_ms));
                    } else if sample.remaining_mwh < previous.remaining_mwh {
                        // Older/limited battery drivers can omit ChargeRate. The
                        // capacity fall remains a truthful fallback for that interval.
                        self.today_milli_mwh = self.today_milli_mwh.saturating_add(
                            u64::from(previous.remaining_mwh - sample.remaining_mwh)
                                .saturating_mul(MILLI_MWH_PER_MWH),
                        );
                    }
                }
            }
        }

        self.last_sample = Some(sample.clone());
        self.available_status(&sample)
    }

    fn mark_unavailable(&mut self, current_day_key: String) -> EnergyStatus {
        if self.day_key != current_day_key {
            // Day rollover must not depend on the next successful capacity
            // read. Otherwise a machine that is asleep, unplugged, or backed
            // by an intermittent driver would lose the completed day.
            self.rollover_to(current_day_key, None);
        }

        // Without a valid capacity reading, a later reading must establish a new
        // baseline. Counting across the missing interval would turn an unknown
        // transition into a fabricated discharge value.
        self.last_sample = None;
        self.partial = true;
        EnergyStatus::unavailable(self.day_key.clone(), self.history.clone())
    }

    fn persisted_state(&self) -> PersistedEnergyState {
        PersistedEnergyState {
            version: STATE_VERSION,
            day_key: self.day_key.clone(),
            today_milli_mwh: self.today_milli_mwh,
            tracking_since_ms: self.tracking_since_ms,
            last_sample: self.last_sample.clone(),
            partial: self.partial,
            history: normalize_history(self.history.clone(), &self.day_key),
        }
    }

    fn available_status(&self, sample: &CapacitySample) -> EnergyStatus {
        EnergyStatus {
            available: true,
            today_mwh: self.today_milli_mwh / MILLI_MWH_PER_MWH,
            day_key: self.day_key.clone(),
            history: self.history.clone(),
            tracking_since_ms: self.tracking_since_ms,
            source: ENERGY_SOURCE,
            remaining_mwh: Some(sample.remaining_mwh),
            full_charge_capacity_mwh: Some(sample.full_charge_capacity_mwh),
            partial: self.partial,
        }
    }

    fn rollover_to(&mut self, next_day_key: String, sample: Option<CapacitySample>) {
        if is_completed_day(&self.day_key, &next_day_key) {
            self.history.push(DailyEnergyRecord {
                day_key: self.day_key.clone(),
                total_mwh: self.today_milli_mwh / MILLI_MWH_PER_MWH,
                partial: self.partial,
            });
        }

        self.day_key = next_day_key;
        self.today_milli_mwh = 0;
        self.tracking_since_ms = sample.as_ref().map(|sample| sample.captured_at_ms);
        self.last_sample = sample;
        self.partial = true;
        self.history = normalize_history(std::mem::take(&mut self.history), &self.day_key);
    }
}

fn normalize_history(
    records: Vec<DailyEnergyRecord>,
    current_day_key: &str,
) -> Vec<DailyEnergyRecord> {
    let mut deduplicated: BTreeMap<String, DailyEnergyRecord> = BTreeMap::new();

    for record in records {
        if !is_completed_day(&record.day_key, current_day_key) {
            continue;
        }

        match deduplicated.get_mut(&record.day_key) {
            Some(existing) => {
                // Never add duplicate snapshots for a day. The larger total is
                // the only non-fabricated candidate, and any partial source
                // keeps the merged record explicitly caveated.
                existing.total_mwh = existing.total_mwh.max(record.total_mwh);
                existing.partial |= record.partial;
            }
            None => {
                deduplicated.insert(record.day_key.clone(), record);
            }
        }
    }

    let mut history: Vec<_> = deduplicated.into_values().collect();
    let overflow = history.len().saturating_sub(MAX_HISTORY_DAYS);
    if overflow > 0 {
        history.drain(..overflow);
    }
    history
}

fn is_completed_day(day_key: &str, current_day_key: &str) -> bool {
    is_day_key(day_key) && is_day_key(current_day_key) && day_key < current_day_key
}

fn is_day_key(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| matches!(index, 4 | 7) || byte.is_ascii_digit())
}

fn same_battery(previous: &CapacitySample, next: &CapacitySample) -> bool {
    match (&previous.device_id, &next.device_id) {
        (Some(previous), Some(next)) => previous == next,
        // AggregateBattery does not guarantee a device ID on every machine. In
        // that case, use a matching full-charge capacity as the conservative
        // continuity signal rather than assuming any battery is interchangeable.
        (None, None) => previous.full_charge_capacity_mwh == next.full_charge_capacity_mwh,
        _ => false,
    }
}

fn discharge_from_rate_milli_mwh(rate_mw: i32, elapsed_ms: u64) -> u64 {
    if rate_mw >= 0 {
        return 0;
    }

    let discharge_mw = u64::try_from(-(i64::from(rate_mw))).unwrap_or(u64::MAX);
    // mW * ms / 3_600 produces milli-mWh. Keep the sub-mWh precision in the
    // persisted accumulator, then expose whole mWh in the public payload.
    discharge_mw
        .saturating_mul(elapsed_ms)
        .saturating_div(3_600)
}

pub(crate) fn start_watcher(app: AppHandle) {
    let runtime = app.state::<EnergyRuntime>().inner().clone();
    let storage_path = energy_state_path(&app);

    thread::Builder::new()
        .name("atoll-energy-watcher".to_string())
        .spawn(move || {
            let _winrt = WinRtApartment::initialize();
            let mut tracker = load_tracker(storage_path.as_deref(), local_day_key());
            let mut initial = true;

            loop {
                let day_key = local_day_key();
                let captured_at_ms = unix_timestamp_ms();
                let status = match read_capacity_sample(day_key.clone(), captured_at_ms) {
                    Ok(Some(sample)) => tracker.observe(sample),
                    Ok(None) => tracker.mark_unavailable(day_key),
                    Err(error) => {
                        log::debug!("Battery energy monitoring is unavailable: {error}");
                        tracker.mark_unavailable(day_key)
                    }
                };

                // Persist after every observation, including unavailable/error
                // samples. Those paths can advance the local day and archive
                // the prior one before a valid battery report is available.
                if let Some(path) = storage_path.as_deref() {
                    if let Err(error) = persist_tracker(path, &tracker) {
                        log::warn!("Unable to persist Atoll energy history: {error}");
                    }
                }

                let changed = runtime.replace_status(status.clone());
                if initial || changed {
                    if let Err(error) = app.emit("energy-update", status) {
                        log::debug!("Unable to emit energy status: {error}");
                    }
                }
                initial = false;
                thread::sleep(SAMPLE_INTERVAL);
            }
        })
        .expect("Atoll energy watcher could not start");
}

#[tauri::command]
pub(crate) fn energy_status(runtime: State<'_, EnergyRuntime>) -> EnergyStatus {
    runtime.status()
}

struct WinRtApartment {
    should_uninitialize: bool,
}

impl WinRtApartment {
    fn initialize() -> Self {
        Self {
            should_uninitialize: unsafe { RoInitialize(RO_INIT_MULTITHREADED) }.is_ok(),
        }
    }
}

impl Drop for WinRtApartment {
    fn drop(&mut self) {
        if self.should_uninitialize {
            unsafe { RoUninitialize() };
        }
    }
}

fn read_capacity_sample(
    day_key: String,
    captured_at_ms: u64,
) -> Result<Option<CapacitySample>, String> {
    let battery = Battery::AggregateBattery()
        .map_err(|error| format!("Aggregate battery is not available: {error}"))?;
    let report = battery
        .GetReport()
        .map_err(|error| format!("Aggregate battery report is not available: {error}"))?;
    let Some(remaining_mwh) = reported_capacity(report.RemainingCapacityInMilliwattHours()) else {
        return Ok(None);
    };
    let Some(full_charge_capacity_mwh) =
        reported_capacity(report.FullChargeCapacityInMilliwattHours())
    else {
        return Ok(None);
    };

    if full_charge_capacity_mwh == 0 || remaining_mwh > full_charge_capacity_mwh {
        return Ok(None);
    }

    let device_id = battery
        .DeviceId()
        .ok()
        .map(|id| id.to_string())
        .filter(|id| !id.is_empty());
    let charge_rate_mw = reported_signed_value(report.ChargeRateInMilliwatts());
    Ok(Some(CapacitySample {
        day_key,
        captured_at_ms,
        remaining_mwh,
        full_charge_capacity_mwh,
        device_id,
        charge_rate_mw,
    }))
}

fn reported_capacity(
    value: windows::core::Result<windows::Foundation::IReference<i32>>,
) -> Option<u32> {
    value
        .ok()
        .and_then(|reference| reference.Value().ok())
        .and_then(|value| u32::try_from(value).ok())
}

fn reported_signed_value(
    value: windows::core::Result<windows::Foundation::IReference<i32>>,
) -> Option<i32> {
    value.ok().and_then(|reference| reference.Value().ok())
}

fn energy_state_path(app: &AppHandle) -> Option<PathBuf> {
    match app.path().app_local_data_dir() {
        Ok(directory) => Some(directory.join(STATE_FILE_NAME)),
        Err(error) => {
            log::warn!("Atoll energy history will not persist: {error}");
            None
        }
    }
}

fn load_tracker(path: Option<&Path>, current_day_key: String) -> EnergyTracker {
    let Some(path) = path else {
        return EnergyTracker::new(current_day_key);
    };

    match fs::read_to_string(path) {
        Ok(contents) => match serde_json::from_str::<PersistedEnergyState>(&contents) {
            Ok(state) => EnergyTracker::from_persisted(state, current_day_key),
            Err(error) => {
                log::warn!("Ignoring unreadable Atoll energy history: {error}");
                EnergyTracker::new(current_day_key)
            }
        },
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            EnergyTracker::new(current_day_key)
        }
        Err(error) => {
            log::warn!("Unable to read Atoll energy history: {error}");
            EnergyTracker::new(current_day_key)
        }
    }
}

fn persist_tracker(path: &Path, tracker: &EnergyTracker) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Energy state file has no parent directory".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let contents =
        serde_json::to_vec(&tracker.persisted_state()).map_err(|error| error.to_string())?;
    let temporary_path = parent.join(format!(
        ".{STATE_FILE_NAME}.{}-{}.tmp",
        std::process::id(),
        unix_timestamp_ms()
    ));

    let write_result = (|| -> Result<(), String> {
        let mut temporary = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary_path)
            .map_err(|error| error.to_string())?;
        temporary
            .write_all(&contents)
            .map_err(|error| error.to_string())?;
        temporary.sync_all().map_err(|error| error.to_string())?;
        drop(temporary);
        replace_file(&temporary_path, path)
    })();

    if write_result.is_err() {
        let _ = fs::remove_file(&temporary_path);
    }
    write_result
}

fn replace_file(temporary_path: &Path, destination_path: &Path) -> Result<(), String> {
    let temporary = HSTRING::from(temporary_path.as_os_str().to_string_lossy().as_ref());
    let destination = HSTRING::from(destination_path.as_os_str().to_string_lossy().as_ref());
    unsafe {
        MoveFileExW(
            &temporary,
            &destination,
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    }
    .map_err(|error| error.to_string())
}

fn local_day_key() -> String {
    let local_time = unsafe { GetLocalTime() };
    format!(
        "{:04}-{:02}-{:02}",
        local_time.wYear, local_time.wMonth, local_time.wDay
    )
}

fn unix_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::{
        discharge_from_rate_milli_mwh, load_tracker, persist_tracker, unix_timestamp_ms,
        CapacitySample, DailyEnergyRecord, EnergyTracker, STATE_VERSION,
    };

    fn sample(day_key: &str, captured_at_ms: u64, remaining_mwh: u32) -> CapacitySample {
        CapacitySample {
            day_key: day_key.to_string(),
            captured_at_ms,
            remaining_mwh,
            full_charge_capacity_mwh: 50_000,
            device_id: Some("aggregate-battery".to_string()),
            charge_rate_mw: None,
        }
    }

    #[test]
    fn counts_only_capacity_drops_within_the_same_day() {
        let mut tracker = EnergyTracker::new("2026-08-08".to_string());

        assert_eq!(
            tracker.observe(sample("2026-08-08", 1, 45_000)).today_mwh,
            0
        );
        assert_eq!(
            tracker.observe(sample("2026-08-08", 2, 44_625)).today_mwh,
            375
        );
        assert_eq!(
            tracker.observe(sample("2026-08-08", 3, 44_500)).today_mwh,
            500
        );
    }

    #[test]
    fn charging_increases_do_not_reduce_or_add_to_today_discharge() {
        let mut tracker = EnergyTracker::new("2026-08-08".to_string());
        tracker.observe(sample("2026-08-08", 1, 30_000));
        tracker.observe(sample("2026-08-08", 2, 29_400));
        tracker.observe(sample("2026-08-08", 3, 31_000));

        let status = tracker.observe(sample("2026-08-08", 4, 30_750));

        assert_eq!(status.today_mwh, 850);
    }

    #[test]
    fn a_new_local_day_resets_the_total_and_establishes_a_fresh_baseline() {
        let mut tracker = EnergyTracker::new("2026-08-08".to_string());
        tracker.observe(sample("2026-08-08", 1, 20_000));
        tracker.observe(sample("2026-08-08", 2, 19_000));

        let midnight_status = tracker.observe(sample("2026-08-09", 3, 18_000));
        let next_status = tracker.observe(sample("2026-08-09", 4, 17_750));

        assert_eq!(midnight_status.today_mwh, 0);
        assert_eq!(midnight_status.tracking_since_ms, Some(3));
        assert_eq!(
            midnight_status.history,
            vec![DailyEnergyRecord {
                day_key: "2026-08-08".to_string(),
                total_mwh: 1_000,
                partial: true,
            }]
        );
        assert_eq!(next_status.today_mwh, 250);
    }

    #[test]
    fn unavailable_rollover_archives_the_prior_day_before_a_new_sample_arrives() {
        let mut tracker = EnergyTracker::new("2026-08-08".to_string());
        tracker.observe(sample("2026-08-08", 1, 20_000));
        tracker.observe(sample("2026-08-08", 2, 19_500));

        let status = tracker.mark_unavailable("2026-08-09".to_string());

        assert!(!status.available);
        assert_eq!(status.day_key, "2026-08-09");
        assert_eq!(
            status.history,
            vec![DailyEnergyRecord {
                day_key: "2026-08-08".to_string(),
                total_mwh: 500,
                partial: true,
            }]
        );
        assert!(tracker.last_sample.is_none());
    }

    #[test]
    fn an_unavailable_interval_requires_a_new_baseline() {
        let mut tracker = EnergyTracker::new("2026-08-08".to_string());
        tracker.observe(sample("2026-08-08", 1, 20_000));
        tracker.observe(sample("2026-08-08", 2, 19_500));
        tracker.mark_unavailable("2026-08-08".to_string());

        let status = tracker.observe(sample("2026-08-08", 3, 19_000));

        assert_eq!(status.today_mwh, 500);
    }

    #[test]
    fn persisted_state_keeps_a_same_day_baseline_across_restart() {
        let mut tracker = EnergyTracker::new("2026-08-08".to_string());
        tracker.observe(sample("2026-08-08", 1, 20_000));
        tracker.observe(sample("2026-08-08", 2, 19_500));
        let mut restored =
            EnergyTracker::from_persisted(tracker.persisted_state(), "2026-08-08".to_string());

        let status = restored.observe(sample("2026-08-08", 3, 19_250));

        assert_eq!(status.today_mwh, 750);
    }

    #[test]
    fn persisted_file_reloads_after_an_atomic_replacement() {
        let directory = std::env::temp_dir().join(format!(
            "atoll-energy-test-{}-{}",
            std::process::id(),
            unix_timestamp_ms()
        ));
        let path = directory.join("energy-state.json");
        let day = "2026-08-08";
        let mut tracker = EnergyTracker::new(day.to_string());
        tracker.observe(sample(day, 1, 20_000));
        tracker.observe(sample(day, 2, 19_500));
        persist_tracker(&path, &tracker).expect("first energy state write should succeed");

        tracker.observe(sample(day, 3, 19_250));
        persist_tracker(&path, &tracker).expect("replacement energy state write should succeed");
        let mut restored = load_tracker(Some(&path), day.to_string());
        let status = restored.observe(sample(day, 4, 19_000));

        let _ = fs::remove_dir_all(&directory);
        assert_eq!(status.today_mwh, 1_000);
    }

    #[test]
    fn history_is_sorted_and_trimmed_to_the_newest_thirty_completed_days() {
        let mut tracker = EnergyTracker::new("2026-02-01".to_string());
        tracker.history = (1_u64..=31)
            .rev()
            .map(|day| DailyEnergyRecord {
                day_key: format!("2026-01-{day:02}"),
                total_mwh: day,
                partial: day % 2 == 0,
            })
            .collect();

        let history = tracker.persisted_state().history;

        assert_eq!(history.len(), 30);
        assert_eq!(
            history.first().map(|record| record.day_key.as_str()),
            Some("2026-01-02")
        );
        assert_eq!(
            history.last().map(|record| record.day_key.as_str()),
            Some("2026-01-31")
        );
        assert!(history
            .windows(2)
            .all(|days| days[0].day_key < days[1].day_key));
    }

    #[test]
    fn legacy_v2_same_day_accumulator_migrates_and_reloads_as_v3() {
        let directory = std::env::temp_dir().join(format!(
            "atoll-energy-migration-test-{}-{}",
            std::process::id(),
            unix_timestamp_ms()
        ));
        let path = directory.join("energy-state.json");
        fs::create_dir_all(&directory).expect("migration test directory should be created");
        fs::write(
            &path,
            r#"{
              "version": 2,
              "day_key": "2026-08-08",
              "today_milli_mwh": 500000,
              "tracking_since_ms": 1,
              "last_sample": {
                "day_key": "2026-08-08",
                "captured_at_ms": 2,
                "remaining_mwh": 19500,
                "full_charge_capacity_mwh": 50000,
                "device_id": "aggregate-battery",
                "charge_rate_mw": null
              },
              "partial": true
            }"#,
        )
        .expect("legacy state should be written");

        let mut tracker = load_tracker(Some(&path), "2026-08-08".to_string());
        let status = tracker.observe(sample("2026-08-08", 3, 19_250));
        persist_tracker(&path, &tracker).expect("migrated state should persist");
        let contents = fs::read_to_string(&path).expect("migrated state should be readable");
        let persisted: serde_json::Value =
            serde_json::from_str(&contents).expect("migrated state should be valid JSON");

        let _ = fs::remove_dir_all(&directory);
        assert_eq!(status.today_mwh, 750);
        assert!(status.history.is_empty());
        assert_eq!(persisted["version"], STATE_VERSION);
        assert_eq!(persisted["history"], serde_json::json!([]));
    }

    #[test]
    fn reloading_a_prior_day_legacy_state_archives_it_before_starting_today() {
        let directory = std::env::temp_dir().join(format!(
            "atoll-energy-prior-day-test-{}-{}",
            std::process::id(),
            unix_timestamp_ms()
        ));
        let path = directory.join("energy-state.json");
        fs::create_dir_all(&directory).expect("prior-day test directory should be created");
        fs::write(
            &path,
            r#"{
              "version": 2,
              "day_key": "2026-08-08",
              "today_milli_mwh": 1234000,
              "tracking_since_ms": 1,
              "last_sample": null,
              "partial": false
            }"#,
        )
        .expect("legacy state should be written");

        let tracker = load_tracker(Some(&path), "2026-08-09".to_string());
        persist_tracker(&path, &tracker).expect("archived state should persist");
        let restored = load_tracker(Some(&path), "2026-08-09".to_string());

        let _ = fs::remove_dir_all(&directory);
        assert_eq!(tracker.today_milli_mwh, 0);
        assert_eq!(
            restored.history,
            vec![DailyEnergyRecord {
                day_key: "2026-08-08".to_string(),
                total_mwh: 1_234,
                partial: false,
            }]
        );
    }

    #[test]
    fn integrates_a_negative_charge_rate_without_double_counting_capacity() {
        let mut tracker = EnergyTracker::new("2026-08-08".to_string());
        let mut first = sample("2026-08-08", 0, 20_000);
        first.charge_rate_mw = Some(-9_000);
        tracker.observe(first);
        let mut next = sample("2026-08-08", 60_000, 19_850);
        next.charge_rate_mw = Some(-9_000);

        let status = tracker.observe(next);

        // 9 W for one minute is 150 mWh, not 150 mWh + the 150 mWh capacity fall.
        assert_eq!(status.today_mwh, 150);
    }

    #[test]
    fn skips_long_rate_intervals_and_marks_the_daily_total_partial() {
        let mut tracker = EnergyTracker::new("2026-08-08".to_string());
        let mut first = sample("2026-08-08", 0, 20_000);
        first.charge_rate_mw = Some(-9_000);
        tracker.observe(first);

        let status = tracker.observe(sample("2026-08-08", 10 * 60 * 1_000, 18_500));

        assert_eq!(status.today_mwh, 0);
        assert!(status.partial);
    }

    #[test]
    fn rate_integration_keeps_sub_mwh_precision_between_samples() {
        assert_eq!(discharge_from_rate_milli_mwh(-60, 60_000), 1_000);
        assert_eq!(discharge_from_rate_milli_mwh(60, 60_000), 0);
    }
}
