use std::{sync::mpsc::SyncSender, time::Instant};

use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum MediaAction {
    Previous,
    Toggle,
    Next,
}

impl MediaAction {
    pub(crate) fn parse(command: &str) -> Result<Self, String> {
        match command {
            "previous" => Ok(Self::Previous),
            "toggle" => Ok(Self::Toggle),
            "next" => Ok(Self::Next),
            _ => Err("Unsupported media command".to_string()),
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum MediaConnectStatus {
    #[default]
    Checking,
    Ready,
    NoSession,
    MetadataUnavailable,
    Unavailable,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize)]
pub(crate) struct MediaConnectState {
    pub(crate) status: MediaConnectStatus,
    pub(crate) session_count: u32,
    pub(crate) media: Option<MediaSnapshot>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub(crate) struct MediaSnapshot {
    pub(crate) title: String,
    pub(crate) artist: String,
    pub(crate) source: String,
    pub(crate) playing: bool,
    pub(crate) can_previous: bool,
    pub(crate) can_play_pause: bool,
    pub(crate) can_next: bool,
    pub(crate) can_seek: bool,
    pub(crate) position_ms: Option<u64>,
    pub(crate) duration_ms: Option<u64>,
    pub(crate) position_updated_at_ms: Option<i64>,
    pub(crate) session_revision: u64,
    pub(crate) artwork_data_url: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct ProviderDescriptor {
    pub(crate) id: &'static str,
    pub(crate) priority: i16,
}

impl ProviderDescriptor {
    pub(crate) const fn new(id: &'static str, priority: i16) -> Self {
        Self { id, priority }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct ProviderState {
    pub(crate) status: MediaConnectStatus,
    pub(crate) target_count: u32,
    pub(crate) target_id: Option<String>,
    pub(crate) generation: u64,
    pub(crate) media: Option<MediaSnapshot>,
}

impl ProviderState {
    pub(crate) fn checking() -> Self {
        Self {
            status: MediaConnectStatus::Checking,
            target_count: 0,
            target_id: None,
            generation: 0,
            media: None,
        }
    }

    pub(crate) fn unavailable() -> Self {
        Self {
            status: MediaConnectStatus::Unavailable,
            ..Self::checking()
        }
    }
}

pub(crate) enum ProviderRequest {
    Command {
        action: MediaAction,
        target_id: String,
        generation: u64,
        deadline: Instant,
        reply: SyncSender<Result<bool, String>>,
    },
    Refresh,
    Shutdown,
}

pub(crate) enum HubMessage {
    ProviderState {
        provider_id: &'static str,
        sequence: u64,
        state: ProviderState,
    },
    ProviderStopped(&'static str),
    Command {
        command: String,
        session_revision: u64,
        deadline: Instant,
        reply: SyncSender<Result<bool, String>>,
    },
    Shutdown,
}
