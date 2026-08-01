use std::sync::{
    atomic::{AtomicU64, Ordering},
    mpsc::{Receiver, Sender},
    Arc,
};

use super::contract::{HubMessage, ProviderDescriptor, ProviderRequest, ProviderState};

#[derive(Clone)]
pub(crate) struct ProviderEventSink {
    sender: Sender<HubMessage>,
    provider_id: &'static str,
    sequence: Arc<AtomicU64>,
}

impl ProviderEventSink {
    pub(crate) fn new(sender: Sender<HubMessage>, provider_id: &'static str) -> Self {
        Self {
            sender,
            provider_id,
            sequence: Arc::new(AtomicU64::new(0)),
        }
    }

    pub(crate) fn publish(&self, state: ProviderState) -> bool {
        self.sender
            .send(HubMessage::ProviderState {
                provider_id: self.provider_id,
                sequence: self.next_sequence(),
                state,
            })
            .is_ok()
    }

    pub(crate) fn stopped(&self) {
        let _ = self
            .sender
            .send(HubMessage::ProviderStopped(self.provider_id));
    }

    fn next_sequence(&self) -> u64 {
        let previous = self
            .sequence
            .fetch_update(Ordering::AcqRel, Ordering::Acquire, |current| {
                let next = current.wrapping_add(1);
                Some(if next == 0 { 1 } else { next })
            })
            .expect("the Provider event sequence update cannot fail");
        let next = previous.wrapping_add(1);
        if next == 0 {
            1
        } else {
            next
        }
    }
}

pub(crate) struct ProviderMailbox {
    pub(crate) sender: Sender<ProviderRequest>,
    pub(crate) receiver: Receiver<ProviderRequest>,
}

pub(crate) trait ConnectProvider: Send + 'static {
    fn descriptor(&self) -> ProviderDescriptor;

    fn run(self: Box<Self>, events: ProviderEventSink, mailbox: ProviderMailbox);
}
