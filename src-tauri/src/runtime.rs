use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex, MutexGuard,
};

pub(crate) struct RuntimeState {
    transition_epoch: AtomicU64,
    window_mutation: Mutex<()>,
    top_margin_bits: AtomicU64,
    corner_radius_bits: AtomicU64,
}

impl Default for RuntimeState {
    fn default() -> Self {
        Self {
            transition_epoch: AtomicU64::new(0),
            window_mutation: Mutex::new(()),
            top_margin_bits: AtomicU64::new(8.0_f64.to_bits()),
            corner_radius_bits: AtomicU64::new(16.0_f64.to_bits()),
        }
    }
}

pub(crate) fn next_transition_epoch(state: &RuntimeState) -> u64 {
    state.transition_epoch.fetch_add(1, Ordering::SeqCst) + 1
}

pub(crate) fn is_current_transition(state: &RuntimeState, epoch: u64) -> bool {
    state.transition_epoch.load(Ordering::SeqCst) == epoch
}

pub(crate) fn lock_window_mutation(state: &RuntimeState) -> MutexGuard<'_, ()> {
    state
        .window_mutation
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

pub(crate) fn set_top_margin(state: &RuntimeState, top_margin: f64) {
    state
        .top_margin_bits
        .store(top_margin.to_bits(), Ordering::SeqCst);
}

pub(crate) fn top_margin(state: &RuntimeState) -> f64 {
    f64::from_bits(state.top_margin_bits.load(Ordering::SeqCst))
}

pub(crate) fn set_corner_radius(state: &RuntimeState, corner_radius: f64) {
    state
        .corner_radius_bits
        .store(corner_radius.to_bits(), Ordering::SeqCst);
}

pub(crate) fn corner_radius(state: &RuntimeState) -> f64 {
    f64::from_bits(state.corner_radius_bits.load(Ordering::SeqCst))
}
