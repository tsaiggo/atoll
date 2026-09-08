use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex, MutexGuard,
};

use serde::Deserialize;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum NotchEdge {
    Top,
    Bottom,
    Left,
    Right,
}

#[derive(Clone, Copy, Debug, Deserialize)]
pub(crate) struct RegionPoint {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct ShellRegion {
    pub points: Vec<RegionPoint>,
}

/// Final logical geometry is retained while hidden and throughout animation.
/// Display recovery restores this target, never a partially animated frame.
#[derive(Clone, Debug)]
pub(crate) struct ShellLayout {
    pub width: f64,
    pub height: f64,
    pub edge: NotchEdge,
    pub regions: Vec<ShellRegion>,
    pub transition_id: u64,
}

#[derive(Default)]
pub(crate) struct RuntimeState {
    transition_epoch: AtomicU64,
    window_mutation: Mutex<()>,
    shell_layout: Mutex<Option<ShellLayout>>,
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

pub(crate) fn set_shell_layout(state: &RuntimeState, layout: ShellLayout) {
    *state
        .shell_layout
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(layout);
}

pub(crate) fn shell_layout(state: &RuntimeState) -> Option<ShellLayout> {
    state
        .shell_layout
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .clone()
}
