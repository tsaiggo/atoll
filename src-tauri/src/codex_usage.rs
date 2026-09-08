use std::{
    collections::BTreeMap,
    io::{self, BufRead, BufReader, Read, Write},
    process::{Child, ChildStderr, ChildStdin, ChildStdout, Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        mpsc::{self, Receiver, RecvTimeoutError, SyncSender},
        Arc, Mutex,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, State};

const EVENT_NAME: &str = "codex-usage-update";
const APP_SERVER_COMMAND: &str = "codex";
const APP_SERVER_ARGS: [&str; 2] = ["app-server", "--stdio"];
const STARTUP_TIMEOUT: Duration = Duration::from_secs(8);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
const IDLE_REFRESH_INTERVAL: Duration = Duration::from_secs(10 * 60);
const COMMAND_QUEUE_CAPACITY: usize = 8;
const INBOUND_QUEUE_CAPACITY: usize = 64;
const MAX_MESSAGE_BYTES: usize = 512 * 1024;
const MAX_WINDOWS: usize = 16;
const MAX_DAILY_USAGE_BUCKETS: usize = 31;
const MAX_IDENTIFIER_LENGTH: usize = 160;
const MAX_LABEL_LENGTH: usize = 160;
const MAX_SAFE_JS_INTEGER: u64 = 9_007_199_254_740_991;
const CHILD_SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(2);

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum CodexUsageStatus {
    Disabled,
    Checking,
    Ready,
    SignedOut,
    UnsupportedAuth,
    CliMissing,
    Unavailable,
    ProtocolError,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub(crate) struct CodexUsageWindow {
    id: String,
    label: Option<String>,
    used_percent: f64,
    window_duration_mins: u32,
    resets_at_ms: u64,
    reached: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub(crate) struct CodexDailyUsage {
    day_key: String,
    tokens: u64,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub(crate) struct CodexUsageState {
    enabled: bool,
    status: CodexUsageStatus,
    windows: Vec<CodexUsageWindow>,
    daily_usage: Vec<CodexDailyUsage>,
    activity_available: bool,
    updated_at_ms: Option<u64>,
    source: &'static str,
}

impl Default for CodexUsageState {
    fn default() -> Self {
        Self::disabled()
    }
}

impl CodexUsageState {
    fn disabled() -> Self {
        Self {
            enabled: false,
            status: CodexUsageStatus::Disabled,
            windows: Vec::new(),
            daily_usage: Vec::new(),
            activity_available: false,
            updated_at_ms: None,
            source: "codex_app_server",
        }
    }

    fn checking() -> Self {
        Self {
            enabled: true,
            status: CodexUsageStatus::Checking,
            windows: Vec::new(),
            daily_usage: Vec::new(),
            activity_available: false,
            updated_at_ms: None,
            source: "codex_app_server",
        }
    }

    fn with_status(&self, status: CodexUsageStatus) -> Self {
        Self {
            enabled: true,
            status,
            windows: self.windows.clone(),
            daily_usage: self.daily_usage.clone(),
            activity_available: self.activity_available,
            updated_at_ms: self.updated_at_ms,
            source: "codex_app_server",
        }
    }
}

#[derive(Default)]
struct CodexUsageInner {
    state: Mutex<CodexUsageState>,
    worker: Mutex<Option<WorkerHandle>>,
    generation: AtomicU64,
}

#[derive(Clone, Default)]
pub(crate) struct CodexUsageRuntime {
    inner: Arc<CodexUsageInner>,
}

struct WorkerHandle {
    sender: SyncSender<WorkerCommand>,
    running: Arc<AtomicBool>,
    cancelled: Arc<AtomicBool>,
}

enum WorkerCommand {
    Refresh,
    Shutdown,
}

enum InboundMessage {
    Frame(Value),
    ProtocolError,
    EndOfStream,
}

#[derive(Debug)]
enum WorkerFault {
    Shutdown,
    Unavailable,
    Protocol,
    Rejected,
}

enum AccountEligibility {
    Eligible,
    SignedOut,
    UnsupportedAuth,
}

pub(crate) fn start(_app: AppHandle) {
    // This integration is deliberately opt-in. The App Server child is only
    // started after the user enables the module through the Tauri command.
}

#[tauri::command]
pub(crate) fn codex_usage_status(runtime: State<'_, CodexUsageRuntime>) -> CodexUsageState {
    runtime.current_state()
}

#[tauri::command]
pub(crate) fn codex_usage_set_enabled(
    enabled: bool,
    app: AppHandle,
    runtime: State<'_, CodexUsageRuntime>,
) -> CodexUsageState {
    runtime.set_enabled(&app, enabled)
}

#[tauri::command]
pub(crate) fn codex_usage_refresh(
    app: AppHandle,
    runtime: State<'_, CodexUsageRuntime>,
) -> CodexUsageState {
    runtime.request_refresh(&app)
}

impl CodexUsageRuntime {
    fn current_state(&self) -> CodexUsageState {
        self.inner
            .state
            .lock()
            .map(|state| state.clone())
            .unwrap_or_default()
    }

    fn set_enabled(&self, app: &AppHandle, enabled: bool) -> CodexUsageState {
        if !enabled {
            self.inner.generation.fetch_add(1, Ordering::AcqRel);
            let worker = self
                .inner
                .worker
                .lock()
                .ok()
                .and_then(|mut worker| worker.take());
            if let Some(worker) = worker {
                worker.cancelled.store(true, Ordering::Release);
                let _ = worker.sender.try_send(WorkerCommand::Shutdown);
            }
            return self.replace_state(app, None, CodexUsageState::disabled());
        }

        self.ensure_worker(app)
    }

    fn request_refresh(&self, app: &AppHandle) -> CodexUsageState {
        let current = self.current_state();
        if !current.enabled {
            return current;
        }

        let state = self.ensure_worker(app);
        let sender = self
            .inner
            .worker
            .lock()
            .ok()
            .and_then(|worker| worker.as_ref().map(|worker| worker.sender.clone()));
        if let Some(sender) = sender {
            if matches!(
                sender.try_send(WorkerCommand::Refresh),
                Err(mpsc::TrySendError::Disconnected(_))
            ) {
                return self.replace_state(
                    app,
                    None,
                    state.with_status(CodexUsageStatus::Unavailable),
                );
            }
        }
        self.current_state()
    }

    fn ensure_worker(&self, app: &AppHandle) -> CodexUsageState {
        let mut worker_slot = match self.inner.worker.lock() {
            Ok(worker) => worker,
            Err(_) => {
                return self.replace_state(
                    app,
                    None,
                    self.current_state()
                        .with_status(CodexUsageStatus::Unavailable),
                )
            }
        };

        if worker_slot
            .as_ref()
            .is_some_and(|worker| worker.running.load(Ordering::Acquire))
        {
            return self.current_state();
        }
        *worker_slot = None;

        let generation = next_generation(&self.inner.generation);
        let checking = CodexUsageState::checking();
        let state = self.replace_state(app, Some(generation), checking);
        let (sender, receiver) = mpsc::sync_channel(COMMAND_QUEUE_CAPACITY);
        let running = Arc::new(AtomicBool::new(true));
        let cancelled = Arc::new(AtomicBool::new(false));
        let worker_running = running.clone();
        let worker_cancelled = cancelled.clone();
        let inner = self.inner.clone();
        let worker_app = app.clone();
        let spawn = thread::Builder::new()
            .name("atoll-codex-usage".to_string())
            .spawn(move || {
                run_worker(worker_app, inner, generation, receiver, worker_cancelled);
                worker_running.store(false, Ordering::Release);
            });

        match spawn {
            Ok(_) => {
                *worker_slot = Some(WorkerHandle {
                    sender,
                    running,
                    cancelled,
                });
                state
            }
            Err(_) => {
                running.store(false, Ordering::Release);
                self.replace_state(
                    app,
                    Some(generation),
                    state.with_status(CodexUsageStatus::Unavailable),
                )
            }
        }
    }

    fn replace_state(
        &self,
        app: &AppHandle,
        generation: Option<u64>,
        next: CodexUsageState,
    ) -> CodexUsageState {
        replace_state(&self.inner, app, generation, next)
    }
}

fn next_generation(generation: &AtomicU64) -> u64 {
    let previous = generation
        .fetch_update(Ordering::AcqRel, Ordering::Acquire, |current| {
            let next = current.wrapping_add(1);
            Some(if next == 0 { 1 } else { next })
        })
        .expect("Codex usage generation update cannot fail");
    let next = previous.wrapping_add(1);
    if next == 0 {
        1
    } else {
        next
    }
}

fn replace_state(
    inner: &Arc<CodexUsageInner>,
    app: &AppHandle,
    generation: Option<u64>,
    next: CodexUsageState,
) -> CodexUsageState {
    if generation.is_some_and(|generation| inner.generation.load(Ordering::Acquire) != generation) {
        return inner
            .state
            .lock()
            .map(|state| state.clone())
            .unwrap_or_default();
    }

    let changed = match inner.state.lock() {
        Ok(mut state) => {
            if *state == next {
                false
            } else {
                *state = next.clone();
                true
            }
        }
        Err(_) => false,
    };
    if changed {
        let _ = app.emit(EVENT_NAME, next.clone());
    }
    next
}

fn run_worker(
    app: AppHandle,
    inner: Arc<CodexUsageInner>,
    generation: u64,
    commands: Receiver<WorkerCommand>,
    cancelled: Arc<AtomicBool>,
) {
    let mut process = match AppServerProcess::spawn() {
        Ok(process) => process,
        Err(SpawnError::CliMissing) => {
            publish_status(&app, &inner, generation, CodexUsageStatus::CliMissing);
            return;
        }
        Err(SpawnError::Unavailable) => {
            publish_status(&app, &inner, generation, CodexUsageStatus::Unavailable);
            return;
        }
    };

    let mut next_id = 1_u64;
    let startup = initialize(&mut process, &commands, &cancelled, &mut next_id);
    match startup {
        Ok(()) => {}
        Err(WorkerFault::Shutdown) => return,
        Err(WorkerFault::Protocol) => {
            publish_status(&app, &inner, generation, CodexUsageStatus::ProtocolError);
            return;
        }
        Err(WorkerFault::Unavailable) => {
            publish_status(&app, &inner, generation, CodexUsageStatus::Unavailable);
            return;
        }
        Err(WorkerFault::Rejected) => {
            publish_status(&app, &inner, generation, CodexUsageStatus::Unavailable);
            return;
        }
    }

    let mut next_refresh = Instant::now();
    loop {
        if cancelled.load(Ordering::Acquire)
            || inner.generation.load(Ordering::Acquire) != generation
        {
            return;
        }

        if Instant::now() >= next_refresh {
            match refresh_snapshot(
                &mut process,
                &commands,
                &app,
                &inner,
                generation,
                &cancelled,
                &mut next_id,
            ) {
                Ok(()) => {}
                Err(WorkerFault::Shutdown) => return,
                Err(WorkerFault::Protocol) => {
                    publish_status(&app, &inner, generation, CodexUsageStatus::ProtocolError);
                    return;
                }
                Err(WorkerFault::Unavailable) => {
                    publish_status(&app, &inner, generation, CodexUsageStatus::Unavailable);
                    return;
                }
                Err(WorkerFault::Rejected) => {
                    publish_status(&app, &inner, generation, CodexUsageStatus::Unavailable);
                    return;
                }
            }
            next_refresh = Instant::now() + IDLE_REFRESH_INTERVAL;
            continue;
        }

        match commands.try_recv() {
            Ok(WorkerCommand::Shutdown) | Err(mpsc::TryRecvError::Disconnected) => return,
            Ok(WorkerCommand::Refresh) => {
                next_refresh = Instant::now();
                continue;
            }
            Err(mpsc::TryRecvError::Empty) => {}
        }

        let timeout = next_refresh
            .saturating_duration_since(Instant::now())
            .min(Duration::from_millis(250));
        match process.inbound.recv_timeout(timeout) {
            Ok(InboundMessage::Frame(frame)) => {
                if let Err(fault) = handle_notification(&frame, &app, &inner, generation) {
                    match fault {
                        WorkerFault::Protocol => {
                            publish_status(
                                &app,
                                &inner,
                                generation,
                                CodexUsageStatus::ProtocolError,
                            );
                            return;
                        }
                        WorkerFault::Shutdown => return,
                        WorkerFault::Unavailable | WorkerFault::Rejected => {}
                    }
                }
            }
            Ok(InboundMessage::ProtocolError) => {
                publish_status(&app, &inner, generation, CodexUsageStatus::ProtocolError);
                return;
            }
            Ok(InboundMessage::EndOfStream) | Err(RecvTimeoutError::Disconnected) => {
                publish_status(&app, &inner, generation, CodexUsageStatus::Unavailable);
                return;
            }
            Err(RecvTimeoutError::Timeout) => {}
        }
    }
}

fn initialize(
    process: &mut AppServerProcess,
    commands: &Receiver<WorkerCommand>,
    cancelled: &AtomicBool,
    next_id: &mut u64,
) -> Result<(), WorkerFault> {
    let id = allocate_id(next_id);
    process.send_request(
        id,
        "initialize",
        json!({
            "clientInfo": {
                "name": "atoll",
                "title": "Atoll",
                "version": env!("CARGO_PKG_VERSION"),
            }
        }),
    )?;
    let _ = wait_for_response(process, commands, cancelled, id, STARTUP_TIMEOUT, None)?;
    process.send_notification("initialized", json!({}))?;
    Ok(())
}

fn refresh_snapshot(
    process: &mut AppServerProcess,
    commands: &Receiver<WorkerCommand>,
    app: &AppHandle,
    inner: &Arc<CodexUsageInner>,
    generation: u64,
    cancelled: &AtomicBool,
    next_id: &mut u64,
) -> Result<(), WorkerFault> {
    let account_id = allocate_id(next_id);
    process.send_request(account_id, "account/read", json!({ "refreshToken": false }))?;
    let account = wait_for_response(
        process,
        commands,
        cancelled,
        account_id,
        REQUEST_TIMEOUT,
        None,
    )?;
    match parse_account_eligibility(&account)? {
        AccountEligibility::Eligible => {}
        AccountEligibility::SignedOut => {
            publish_status(app, inner, generation, CodexUsageStatus::SignedOut);
            return Ok(());
        }
        AccountEligibility::UnsupportedAuth => {
            publish_status(app, inner, generation, CodexUsageStatus::UnsupportedAuth);
            return Ok(());
        }
    }

    let rate_limit_id = allocate_id(next_id);
    process.send_request(rate_limit_id, "account/rateLimits/read", json!({}))?;
    let rate_limits = wait_for_response(
        process,
        commands,
        cancelled,
        rate_limit_id,
        REQUEST_TIMEOUT,
        Some((app, inner, generation)),
    )?;
    let windows = parse_rate_limits(&rate_limits)?;
    let previous = current_state(inner);
    let rate_state = CodexUsageState {
        enabled: true,
        status: CodexUsageStatus::Ready,
        windows,
        daily_usage: previous.daily_usage,
        activity_available: previous.activity_available,
        updated_at_ms: Some(unix_timestamp_ms()),
        source: "codex_app_server",
    };
    replace_state(inner, app, Some(generation), rate_state);

    let usage_id = allocate_id(next_id);
    process.send_request(usage_id, "account/usage/read", json!({}))?;
    match wait_for_response(
        process,
        commands,
        cancelled,
        usage_id,
        REQUEST_TIMEOUT,
        Some((app, inner, generation)),
    ) {
        Ok(usage) => {
            let (daily_usage, activity_available) = parse_daily_usage(&usage)?;
            let previous = current_state(inner);
            let usage_state = CodexUsageState {
                enabled: true,
                status: CodexUsageStatus::Ready,
                windows: previous.windows,
                daily_usage,
                activity_available,
                updated_at_ms: previous.updated_at_ms,
                source: "codex_app_server",
            };
            replace_state(inner, app, Some(generation), usage_state);
        }
        Err(WorkerFault::Protocol | WorkerFault::Rejected) => {
            // Quota data is still safe to present when optional activity data
            // is absent or unsupported by this App Server version.
            let previous = current_state(inner);
            let unavailable_activity = CodexUsageState {
                enabled: true,
                status: CodexUsageStatus::Ready,
                windows: previous.windows,
                daily_usage: Vec::new(),
                activity_available: false,
                updated_at_ms: previous.updated_at_ms,
                source: "codex_app_server",
            };
            replace_state(inner, app, Some(generation), unavailable_activity);
        }
        Err(other) => return Err(other),
    }
    Ok(())
}

fn wait_for_response(
    process: &mut AppServerProcess,
    commands: &Receiver<WorkerCommand>,
    cancelled: &AtomicBool,
    expected_id: u64,
    timeout: Duration,
    notification_target: Option<(&AppHandle, &Arc<CodexUsageInner>, u64)>,
) -> Result<Value, WorkerFault> {
    let deadline = Instant::now() + timeout;
    loop {
        if cancelled.load(Ordering::Acquire) {
            return Err(WorkerFault::Shutdown);
        }
        match commands.try_recv() {
            Ok(WorkerCommand::Shutdown) | Err(mpsc::TryRecvError::Disconnected) => {
                return Err(WorkerFault::Shutdown)
            }
            Ok(WorkerCommand::Refresh) | Err(mpsc::TryRecvError::Empty) => {}
        }

        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Err(WorkerFault::Unavailable);
        }
        match process
            .inbound
            .recv_timeout(remaining.min(Duration::from_millis(250)))
        {
            Ok(InboundMessage::Frame(frame)) => {
                if let Some(response) = response_for_id(&frame, expected_id)? {
                    return response;
                }
                if let Some((app, inner, generation)) = notification_target {
                    handle_notification(&frame, app, inner, generation)?;
                }
            }
            Ok(InboundMessage::ProtocolError) => return Err(WorkerFault::Protocol),
            Ok(InboundMessage::EndOfStream) | Err(RecvTimeoutError::Disconnected) => {
                return Err(WorkerFault::Unavailable)
            }
            Err(RecvTimeoutError::Timeout) => {}
        }
    }
}

fn handle_notification(
    frame: &Value,
    app: &AppHandle,
    inner: &Arc<CodexUsageInner>,
    generation: u64,
) -> Result<(), WorkerFault> {
    let Some(method) = frame.get("method").and_then(Value::as_str) else {
        return Ok(());
    };
    if method != "account/rateLimits/updated" {
        return Ok(());
    }
    let params = frame.get("params").ok_or(WorkerFault::Protocol)?;
    let windows = parse_rate_limits(params)?;
    let previous = current_state(inner);
    let next = CodexUsageState {
        enabled: true,
        status: CodexUsageStatus::Ready,
        windows,
        daily_usage: previous.daily_usage,
        activity_available: previous.activity_available,
        updated_at_ms: Some(unix_timestamp_ms()),
        source: "codex_app_server",
    };
    replace_state(inner, app, Some(generation), next);
    Ok(())
}

fn response_for_id(
    frame: &Value,
    expected_id: u64,
) -> Result<Option<Result<Value, WorkerFault>>, WorkerFault> {
    let Some(id) = frame.get("id") else {
        return Ok(None);
    };
    if id.as_u64() != Some(expected_id) {
        return Ok(None);
    }
    if frame.get("error").is_some() {
        return Ok(Some(Err(WorkerFault::Rejected)));
    }
    let result = frame.get("result").cloned().ok_or(WorkerFault::Protocol)?;
    Ok(Some(Ok(result)))
}

fn parse_account_eligibility(value: &Value) -> Result<AccountEligibility, WorkerFault> {
    let account = value.get("account").ok_or(WorkerFault::Protocol)?;
    if account.is_null() {
        return Ok(AccountEligibility::SignedOut);
    }
    let account_type = account
        .as_object()
        .and_then(|account| account.get("type"))
        .and_then(Value::as_str)
        .ok_or(WorkerFault::Protocol)?;
    match account_type {
        "chatgpt" | "chatgptAuthTokens" | "agentIdentity" | "personalAccessToken" => {
            Ok(AccountEligibility::Eligible)
        }
        _ => Ok(AccountEligibility::UnsupportedAuth),
    }
}

fn parse_rate_limits(value: &Value) -> Result<Vec<CodexUsageWindow>, WorkerFault> {
    let mut buckets = BTreeMap::new();
    if let Some(by_limit_id) = value.get("rateLimitsByLimitId") {
        let by_limit_id = by_limit_id.as_object().ok_or(WorkerFault::Protocol)?;
        for (fallback_id, limit) in by_limit_id {
            if buckets.len() >= MAX_WINDOWS {
                break;
            }
            collect_rate_limit_windows(&mut buckets, fallback_id, limit)?;
        }
    } else if let Some(rate_limits) = value.get("rateLimits") {
        if !rate_limits.is_null() {
            collect_rate_limit_windows(&mut buckets, "codex", rate_limits)?;
        }
    } else {
        return Err(WorkerFault::Protocol);
    }

    Ok(buckets
        .into_values()
        .take(MAX_WINDOWS)
        .collect::<Vec<CodexUsageWindow>>())
}

fn collect_rate_limit_windows(
    windows: &mut BTreeMap<String, CodexUsageWindow>,
    fallback_id: &str,
    value: &Value,
) -> Result<(), WorkerFault> {
    let limit = value.as_object().ok_or(WorkerFault::Protocol)?;
    let base_id = sanitize_identifier(
        limit
            .get("limitId")
            .and_then(Value::as_str)
            .unwrap_or(fallback_id),
    )
    .ok_or(WorkerFault::Protocol)?;
    let label = limit
        .get("limitName")
        .and_then(Value::as_str)
        .and_then(sanitize_label);
    let reached = !limit.get("rateLimitReachedType").is_none_or(Value::is_null);

    if let Some(primary) = limit.get("primary") {
        if !primary.is_null() {
            let window = parse_usage_window(base_id.clone(), label.clone(), reached, primary)?;
            insert_usage_window(windows, window);
        }
    }
    if let Some(secondary) = limit.get("secondary") {
        if !secondary.is_null() {
            let secondary_id = format!("{base_id}:secondary");
            let secondary_label = label
                .as_deref()
                .map(|label| format!("{label} (secondary)"))
                .and_then(|label| sanitize_label(&label))
                .or_else(|| Some("Secondary".to_string()));
            let window = parse_usage_window(secondary_id, secondary_label, reached, secondary)?;
            insert_usage_window(windows, window);
        }
    }
    Ok(())
}

fn insert_usage_window(windows: &mut BTreeMap<String, CodexUsageWindow>, window: CodexUsageWindow) {
    if windows.len() < MAX_WINDOWS || windows.contains_key(&window.id) {
        windows.insert(window.id.clone(), window);
    }
}

fn parse_usage_window(
    id: String,
    label: Option<String>,
    reached: bool,
    value: &Value,
) -> Result<CodexUsageWindow, WorkerFault> {
    let window = value.as_object().ok_or(WorkerFault::Protocol)?;
    let used_percent = finite_number(window.get("usedPercent")).ok_or(WorkerFault::Protocol)?;
    if !(0.0..=100.0).contains(&used_percent) {
        return Err(WorkerFault::Protocol);
    }
    let window_duration_mins =
        bounded_u32(window.get("windowDurationMins"), 1, 525_600).ok_or(WorkerFault::Protocol)?;
    let resets_at_seconds = bounded_u64(window.get("resetsAt"), 1, MAX_SAFE_JS_INTEGER / 1_000)
        .ok_or(WorkerFault::Protocol)?;
    Ok(CodexUsageWindow {
        id,
        label,
        used_percent,
        window_duration_mins,
        resets_at_ms: resets_at_seconds.saturating_mul(1_000),
        reached,
    })
}

fn parse_daily_usage(value: &Value) -> Result<(Vec<CodexDailyUsage>, bool), WorkerFault> {
    let Some(buckets) = value.get("dailyUsageBuckets") else {
        return Err(WorkerFault::Protocol);
    };
    if buckets.is_null() {
        return Ok((Vec::new(), false));
    }
    let buckets = buckets.as_array().ok_or(WorkerFault::Protocol)?;
    let mut days = BTreeMap::new();
    for bucket in buckets {
        let Some(bucket) = bucket.as_object() else {
            continue;
        };
        let Some(day_key) = bucket
            .get("startDate")
            .and_then(Value::as_str)
            .and_then(sanitize_day_key)
        else {
            continue;
        };
        let Some(tokens) = bounded_u64(bucket.get("tokens"), 0, MAX_SAFE_JS_INTEGER) else {
            continue;
        };
        days.insert(day_key.clone(), CodexDailyUsage { day_key, tokens });
        while days.len() > MAX_DAILY_USAGE_BUCKETS {
            let Some(oldest_day) = days.keys().next().cloned() else {
                break;
            };
            days.remove(&oldest_day);
        }
    }
    let mut days = days.into_values().collect::<Vec<_>>();
    days.reverse();
    Ok((days, true))
}

fn finite_number(value: Option<&Value>) -> Option<f64> {
    value
        .and_then(Value::as_f64)
        .filter(|value| value.is_finite())
}

fn bounded_u64(value: Option<&Value>, minimum: u64, maximum: u64) -> Option<u64> {
    let value = value.and_then(Value::as_u64)?;
    (minimum..=maximum).contains(&value).then_some(value)
}

fn bounded_u32(value: Option<&Value>, minimum: u32, maximum: u32) -> Option<u32> {
    let value = value.and_then(Value::as_u64)?;
    let value = u32::try_from(value).ok()?;
    (minimum..=maximum).contains(&value).then_some(value)
}

fn sanitize_identifier(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty() || value.len() > MAX_IDENTIFIER_LENGTH || value.contains(char::is_control) {
        return None;
    }
    Some(value.to_string())
}

fn sanitize_label(value: &str) -> Option<String> {
    let value = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if value.is_empty() || value.len() > MAX_LABEL_LENGTH || value.contains(char::is_control) {
        return None;
    }
    Some(value)
}

fn sanitize_day_key(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    if bytes.len() != 10
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || !bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| index == 4 || index == 7 || byte.is_ascii_digit())
    {
        return None;
    }
    let year = value.get(0..4)?.parse::<u32>().ok()?;
    let month = value.get(5..7)?.parse::<u32>().ok()?;
    let day = value.get(8..10)?.parse::<u32>().ok()?;
    let days_in_month = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if year % 400 == 0 || (year % 4 == 0 && year % 100 != 0) => 29,
        2 => 28,
        _ => return None,
    };
    if day == 0 || day > days_in_month {
        return None;
    }
    Some(value.to_string())
}

fn publish_status(
    app: &AppHandle,
    inner: &Arc<CodexUsageInner>,
    generation: u64,
    status: CodexUsageStatus,
) {
    let current = current_state(inner);
    replace_state(inner, app, Some(generation), current.with_status(status));
}

fn current_state(inner: &Arc<CodexUsageInner>) -> CodexUsageState {
    inner
        .state
        .lock()
        .map(|state| state.clone())
        .unwrap_or_default()
}

fn allocate_id(next_id: &mut u64) -> u64 {
    let id = *next_id;
    *next_id = next_id.wrapping_add(1);
    if *next_id == 0 {
        *next_id = 1;
    }
    id
}

fn unix_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

enum SpawnError {
    CliMissing,
    Unavailable,
}

fn terminate_child(child: &mut Child) {
    let _ = child.kill();
    let _ = child.wait();
}

struct AppServerProcess {
    child: Child,
    stdin: Option<ChildStdin>,
    inbound: Receiver<InboundMessage>,
    stdout_reader: Option<JoinHandle<()>>,
    stderr_reader: Option<JoinHandle<()>>,
}

impl AppServerProcess {
    fn spawn() -> Result<Self, SpawnError> {
        let mut command = Command::new(APP_SERVER_COMMAND);
        command
            .args(APP_SERVER_ARGS)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        // This feature only supports Codex service-backed account usage. Do
        // not forward API-key or remote-server credentials from Atoll's own
        // environment into the child process.
        command
            .env_remove("OPENAI_API_KEY")
            .env_remove("CODEX_API_KEY")
            .env_remove("CODEX_REMOTE_TOKEN");
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);

        let mut child = command.spawn().map_err(|error| {
            if error.kind() == io::ErrorKind::NotFound {
                SpawnError::CliMissing
            } else {
                SpawnError::Unavailable
            }
        })?;
        let stdin = match child.stdin.take() {
            Some(stdin) => stdin,
            None => {
                terminate_child(&mut child);
                return Err(SpawnError::Unavailable);
            }
        };
        let stdout = match child.stdout.take() {
            Some(stdout) => stdout,
            None => {
                terminate_child(&mut child);
                return Err(SpawnError::Unavailable);
            }
        };
        let stderr = match child.stderr.take() {
            Some(stderr) => stderr,
            None => {
                terminate_child(&mut child);
                return Err(SpawnError::Unavailable);
            }
        };
        let (sender, inbound) = mpsc::sync_channel(INBOUND_QUEUE_CAPACITY);
        let stdout_reader = match spawn_stdout_reader(stdout, sender) {
            Ok(reader) => reader,
            Err(_) => {
                terminate_child(&mut child);
                return Err(SpawnError::Unavailable);
            }
        };
        let stderr_reader = match spawn_stderr_drain(stderr) {
            Ok(reader) => reader,
            Err(_) => {
                terminate_child(&mut child);
                let _ = stdout_reader.join();
                return Err(SpawnError::Unavailable);
            }
        };
        Ok(Self {
            child,
            stdin: Some(stdin),
            inbound,
            stdout_reader: Some(stdout_reader),
            stderr_reader: Some(stderr_reader),
        })
    }

    fn send_request(&mut self, id: u64, method: &str, params: Value) -> Result<(), WorkerFault> {
        self.send(json!({ "method": method, "id": id, "params": params }))
    }

    fn send_notification(&mut self, method: &str, params: Value) -> Result<(), WorkerFault> {
        self.send(json!({ "method": method, "params": params }))
    }

    fn send(&mut self, message: Value) -> Result<(), WorkerFault> {
        let stdin = self.stdin.as_mut().ok_or(WorkerFault::Unavailable)?;
        let encoded = serde_json::to_vec(&message).map_err(|_| WorkerFault::Protocol)?;
        if encoded.len() > MAX_MESSAGE_BYTES {
            return Err(WorkerFault::Protocol);
        }
        stdin
            .write_all(&encoded)
            .map_err(|_| WorkerFault::Unavailable)?;
        stdin
            .write_all(b"\n")
            .map_err(|_| WorkerFault::Unavailable)?;
        stdin.flush().map_err(|_| WorkerFault::Unavailable)
    }

    fn shutdown(&mut self) {
        self.stdin.take();
        let deadline = Instant::now() + CHILD_SHUTDOWN_TIMEOUT;
        loop {
            match self.child.try_wait() {
                Ok(Some(_)) | Err(_) => break,
                Ok(None) if Instant::now() >= deadline => {
                    let _ = self.child.kill();
                    let _ = self.child.wait();
                    break;
                }
                Ok(None) => thread::sleep(Duration::from_millis(25)),
            }
        }
        if let Some(reader) = self.stdout_reader.take() {
            let _ = reader.join();
        }
        if let Some(reader) = self.stderr_reader.take() {
            let _ = reader.join();
        }
    }
}

impl Drop for AppServerProcess {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn spawn_stdout_reader(
    stdout: ChildStdout,
    sender: SyncSender<InboundMessage>,
) -> io::Result<JoinHandle<()>> {
    thread::Builder::new()
        .name("atoll-codex-usage-stdout".to_string())
        .spawn(move || {
            let mut reader = BufReader::new(stdout);
            loop {
                match read_json_line(&mut reader) {
                    Ok(Some(line)) => match serde_json::from_slice::<Value>(&line) {
                        Ok(frame) if frame.is_object() => {
                            if sender.try_send(InboundMessage::Frame(frame)).is_err() {
                                return;
                            }
                        }
                        _ => {
                            let _ = sender.try_send(InboundMessage::ProtocolError);
                            return;
                        }
                    },
                    Ok(None) => {
                        let _ = sender.try_send(InboundMessage::EndOfStream);
                        return;
                    }
                    Err(_) => {
                        let _ = sender.try_send(InboundMessage::ProtocolError);
                        return;
                    }
                }
            }
        })
}

fn spawn_stderr_drain(stderr: ChildStderr) -> io::Result<JoinHandle<()>> {
    thread::Builder::new()
        .name("atoll-codex-usage-stderr".to_string())
        .spawn(move || {
            let mut stderr = BufReader::new(stderr);
            let mut buffer = [0_u8; 4_096];
            while stderr.read(&mut buffer).unwrap_or(0) > 0 {}
        })
}

fn read_json_line<R: BufRead>(reader: &mut R) -> io::Result<Option<Vec<u8>>> {
    let mut line = Vec::new();
    loop {
        let buffer = reader.fill_buf()?;
        if buffer.is_empty() {
            return if line.is_empty() {
                Ok(None)
            } else {
                Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "unterminated JSONL frame",
                ))
            };
        }
        let newline = buffer.iter().position(|byte| *byte == b'\n');
        let take = newline.map_or(buffer.len(), |index| index + 1);
        if line.len().saturating_add(take) > MAX_MESSAGE_BYTES {
            reader.consume(take);
            if newline.is_none() {
                drain_to_newline(reader)?;
            }
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "JSONL frame exceeds limit",
            ));
        }
        line.extend_from_slice(&buffer[..take]);
        reader.consume(take);
        if newline.is_some() {
            while line.last() == Some(&b'\n') || line.last() == Some(&b'\r') {
                line.pop();
            }
            return Ok(Some(line));
        }
    }
}

fn drain_to_newline<R: BufRead>(reader: &mut R) -> io::Result<()> {
    loop {
        let buffer = reader.fill_buf()?;
        if buffer.is_empty() {
            return Ok(());
        }
        if let Some(index) = buffer.iter().position(|byte| *byte == b'\n') {
            reader.consume(index + 1);
            return Ok(());
        }
        let length = buffer.len();
        reader.consume(length);
    }
}

#[cfg(test)]
mod tests {
    use std::io::Cursor;

    use serde_json::json;

    use super::{
        parse_account_eligibility, parse_daily_usage, parse_rate_limits, read_json_line,
        AccountEligibility, CodexUsageState, CodexUsageStatus, MAX_MESSAGE_BYTES,
    };

    #[test]
    fn chatgpt_backed_auth_is_eligible_without_exposing_account_fields() {
        let value = json!({
            "account": { "type": "chatgpt", "email": "private@example.com", "planType": "pro" },
            "requiresOpenaiAuth": true,
        });
        assert!(matches!(
            parse_account_eligibility(&value),
            Ok(AccountEligibility::Eligible)
        ));
    }

    #[test]
    fn missing_or_api_key_accounts_do_not_attempt_login() {
        assert!(matches!(
            parse_account_eligibility(&json!({ "account": null, "requiresOpenaiAuth": true })),
            Ok(AccountEligibility::SignedOut)
        ));
        assert!(matches!(
            parse_account_eligibility(&json!({ "account": { "type": "apiKey" } })),
            Ok(AccountEligibility::UnsupportedAuth)
        ));
    }

    #[test]
    fn rate_limits_include_multiple_buckets_and_secondary_windows() {
        let windows = parse_rate_limits(&json!({
            "rateLimitsByLimitId": {
                "codex": {
                    "limitId": "codex",
                    "limitName": null,
                    "primary": { "usedPercent": 25, "windowDurationMins": 15, "resetsAt": 1730947200 },
                    "secondary": { "usedPercent": 42.5, "windowDurationMins": 60, "resetsAt": 1730950800 },
                    "rateLimitReachedType": null
                },
                "codex_other": {
                    "limitId": "codex_other",
                    "limitName": "Other",
                    "primary": { "usedPercent": 100, "windowDurationMins": 120, "resetsAt": 1730954400 },
                    "secondary": null,
                    "rateLimitReachedType": "limit"
                }
            }
        }))
        .expect("valid quota response should parse");

        assert_eq!(windows.len(), 3);
        assert_eq!(windows[0].id, "codex");
        assert_eq!(windows[1].id, "codex:secondary");
        assert_eq!(windows[1].resets_at_ms, 1_730_950_800_000);
        assert!(windows[2].reached);
    }

    #[test]
    fn invalid_quota_values_are_rejected_instead_of_rendered_as_zero() {
        let parsed = parse_rate_limits(&json!({
            "rateLimits": {
                "limitId": "codex",
                "primary": { "usedPercent": 101, "windowDurationMins": 15, "resetsAt": 1 },
                "secondary": null,
                "rateLimitReachedType": null
            }
        }));
        assert!(parsed.is_err());
    }

    #[test]
    fn daily_usage_is_bounded_sanitized_and_newest_first() {
        let (daily_usage, available) = parse_daily_usage(&json!({
            "dailyUsageBuckets": [
                { "startDate": "2026-08-08", "tokens": 12 },
                { "startDate": "bad", "tokens": 900 },
                { "startDate": "2026-08-09", "tokens": 24 },
                { "startDate": "2026-08-08", "tokens": 18 }
            ]
        }))
        .expect("daily usage shape should parse");
        assert!(available);
        assert_eq!(daily_usage.len(), 2);
        assert_eq!(daily_usage[0].day_key, "2026-08-09");
        assert_eq!(daily_usage[1].tokens, 18);
    }

    #[test]
    fn null_daily_usage_is_unavailable_not_a_fake_zero() {
        let (daily_usage, available) = parse_daily_usage(&json!({ "dailyUsageBuckets": null }))
            .expect("null activity is a documented response");
        assert!(!available);
        assert!(daily_usage.is_empty());
    }

    #[test]
    fn jsonl_reader_rejects_unbounded_frames() {
        let mut source = vec![b'x'; MAX_MESSAGE_BYTES + 1];
        source.push(b'\n');
        let mut reader = std::io::BufReader::new(Cursor::new(source));
        assert!(read_json_line(&mut reader).is_err());
    }

    #[test]
    fn public_status_names_remain_snake_case() {
        assert_eq!(
            serde_json::to_value(CodexUsageStatus::UnsupportedAuth)
                .expect("status should serialize"),
            json!("unsupported_auth")
        );
    }

    #[test]
    fn default_snapshot_matches_the_public_contract() {
        assert_eq!(
            serde_json::to_value(CodexUsageState::default())
                .expect("default Codex state should serialize"),
            json!({
                "enabled": false,
                "status": "disabled",
                "windows": [],
                "daily_usage": [],
                "activity_available": false,
                "updated_at_ms": null,
                "source": "codex_app_server",
            })
        );
    }
}
