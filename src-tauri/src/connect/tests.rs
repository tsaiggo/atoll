use std::{
    sync::mpsc::{self, Receiver, RecvTimeoutError, Sender},
    time::{Duration, Instant},
};

use serde_json::json;

use super::{
    contract::{
        HubMessage, MediaAction, MediaConnectState, MediaConnectStatus, MediaSnapshot,
        ProviderDescriptor, ProviderRequest, ProviderSource, ProviderState,
    },
    hub,
    provider::{ConnectProvider, ProviderEventSink, ProviderMailbox},
};

const TEST_TIMEOUT: Duration = Duration::from_secs(2);

#[derive(Debug)]
enum FakeControl {
    Publish(Box<ProviderState>),
    Stop,
}

#[derive(Debug, PartialEq, Eq)]
struct RoutedCommand {
    action: MediaAction,
    target_id: String,
    generation: u64,
}

#[derive(Debug, PartialEq, Eq)]
struct RoutedSeek {
    position_ms: u64,
    target_id: String,
    generation: u64,
}

#[derive(Debug, PartialEq, Eq)]
struct RoutedSourceSelection {
    source_id: Option<String>,
}

struct FakeProvider {
    descriptor: ProviderDescriptor,
    initial_state: ProviderState,
    controls: Receiver<FakeControl>,
    commands: Sender<RoutedCommand>,
    seeks: Sender<RoutedSeek>,
    source_selections: Sender<RoutedSourceSelection>,
    stopped: Sender<()>,
}

struct StopSignal(Sender<()>);

impl Drop for StopSignal {
    fn drop(&mut self) {
        let _ = self.0.send(());
    }
}

impl ConnectProvider for FakeProvider {
    fn descriptor(&self) -> ProviderDescriptor {
        self.descriptor
    }

    fn run(self: Box<Self>, events: ProviderEventSink, mailbox: ProviderMailbox) {
        let _stopped = StopSignal(self.stopped.clone());
        if !events.publish(self.initial_state) {
            return;
        }

        loop {
            match self.controls.try_recv() {
                Ok(FakeControl::Publish(state)) => {
                    if !events.publish(*state) {
                        return;
                    }
                }
                Ok(FakeControl::Stop) | Err(mpsc::TryRecvError::Disconnected) => return,
                Err(mpsc::TryRecvError::Empty) => {}
            }

            match mailbox.receiver.recv_timeout(Duration::from_millis(5)) {
                Ok(ProviderRequest::Command {
                    action,
                    target_id,
                    generation,
                    deadline,
                    reply,
                }) => {
                    if Instant::now() >= deadline {
                        let _ = reply.send(Err(
                            "The media command expired before it could run".to_string()
                        ));
                        continue;
                    }
                    let routed = RoutedCommand {
                        action,
                        target_id,
                        generation,
                    };
                    let handled = self.commands.send(routed).is_ok();
                    let _ = reply.send(Ok(handled));
                }
                Ok(ProviderRequest::Seek {
                    position_ms,
                    target_id,
                    generation,
                    deadline,
                    reply,
                }) => {
                    if Instant::now() >= deadline {
                        let _ = reply
                            .send(Err("The media seek expired before it could run".to_string()));
                        continue;
                    }
                    let routed = RoutedSeek {
                        position_ms,
                        target_id,
                        generation,
                    };
                    let handled = self.seeks.send(routed).is_ok();
                    let _ = reply.send(Ok(handled));
                }
                Ok(ProviderRequest::SelectSource {
                    source_id,
                    deadline,
                    reply,
                }) => {
                    if Instant::now() >= deadline {
                        let _ = reply.send(Err(
                            "The media source selection expired before it could run".to_string(),
                        ));
                        continue;
                    }
                    let handled = self
                        .source_selections
                        .send(RoutedSourceSelection { source_id })
                        .is_ok();
                    let _ = reply.send(Ok(handled));
                }
                Ok(ProviderRequest::Refresh) => {}
                Ok(ProviderRequest::Shutdown) | Err(RecvTimeoutError::Disconnected) => return,
                Err(RecvTimeoutError::Timeout) => {}
            }
        }
    }
}

struct FakeHandle {
    controls: Sender<FakeControl>,
    commands: Receiver<RoutedCommand>,
    seeks: Receiver<RoutedSeek>,
    source_selections: Receiver<RoutedSourceSelection>,
    stopped: Receiver<()>,
}

fn fake_provider(
    id: &'static str,
    priority: i16,
    initial_state: ProviderState,
) -> (Box<dyn ConnectProvider>, FakeHandle) {
    let (control_sender, controls) = mpsc::channel();
    let (commands, command_receiver) = mpsc::channel();
    let (seeks, seek_receiver) = mpsc::channel();
    let (source_selections, source_selection_receiver) = mpsc::channel();
    let (stopped, stopped_receiver) = mpsc::channel();
    (
        Box::new(FakeProvider {
            descriptor: ProviderDescriptor::new(id, priority),
            initial_state,
            controls,
            commands,
            seeks,
            source_selections,
            stopped,
        }),
        FakeHandle {
            controls: control_sender,
            commands: command_receiver,
            seeks: seek_receiver,
            source_selections: source_selection_receiver,
            stopped: stopped_receiver,
        },
    )
}

fn provider_state(
    _provider_id: &'static str,
    target_id: &str,
    generation: u64,
    target_count: u32,
    title: &str,
    playing: bool,
) -> ProviderState {
    ProviderState {
        status: MediaConnectStatus::Ready,
        target_count,
        target_id: Some(target_id.to_string()),
        sources: vec![ProviderSource {
            source_id: target_id.to_string(),
            label: "Test Player".to_string(),
            session_count: target_count,
        }],
        active_source: Some(target_id.to_string()),
        generation,
        media: Some(MediaSnapshot {
            title: title.to_string(),
            artist: "Test Artist".to_string(),
            source: "Test Player".to_string(),
            playing,
            can_previous: true,
            can_play_pause: true,
            can_next: true,
            can_seek: false,
            position_ms: Some(42_000),
            duration_ms: Some(180_000),
            position_updated_at_ms: Some(1_700_000_000_000),
            // The hub owns the public revision and must replace this provider-local value.
            session_revision: 999,
            artwork_data_url: Some("data:image/png;base64,dGVzdA==".to_string()),
        }),
    }
}

fn provider_state_with_seek(
    provider_id: &'static str,
    target_id: &str,
    generation: u64,
    target_count: u32,
    title: &str,
    playing: bool,
) -> ProviderState {
    let mut state = provider_state(
        provider_id,
        target_id,
        generation,
        target_count,
        title,
        playing,
    );
    state
        .media
        .as_mut()
        .expect("test provider state should contain media")
        .can_seek = true;
    state
}

fn provider_state_with_sources(
    provider_id: &'static str,
    target_id: &str,
    generation: u64,
    target_count: u32,
    title: &str,
    playing: bool,
    sources: &[(&str, &str, u32)],
) -> ProviderState {
    let mut state = provider_state(
        provider_id,
        target_id,
        generation,
        target_count,
        title,
        playing,
    );
    state.sources = sources
        .iter()
        .map(|(source_id, label, session_count)| ProviderSource {
            source_id: (*source_id).to_string(),
            label: (*label).to_string(),
            session_count: *session_count,
        })
        .collect();
    state.active_source = Some(target_id.to_string());
    state
}

fn recv_state_until(
    states: &Receiver<MediaConnectState>,
    predicate: impl Fn(&MediaConnectState) -> bool,
) -> MediaConnectState {
    let deadline = Instant::now() + TEST_TIMEOUT;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        let state = states
            .recv_timeout(remaining)
            .expect("the Connect hub did not publish the expected state");
        if predicate(&state) {
            return state;
        }
    }
}

fn send_command(
    hub: &hub::HubHandle,
    command: &str,
    session_revision: u64,
    deadline: Instant,
) -> Result<bool, String> {
    let (reply, response) = mpsc::sync_channel(1);
    hub.send(HubMessage::Command {
        command: command.to_string(),
        session_revision,
        deadline,
        reply,
    })
    .expect("the Connect hub should accept a command");
    response
        .recv_timeout(TEST_TIMEOUT)
        .expect("the Connect hub should answer a command")
}

fn send_seek(
    hub: &hub::HubHandle,
    position_ms: u64,
    session_revision: u64,
    deadline: Instant,
) -> Result<bool, String> {
    let (reply, response) = mpsc::sync_channel(1);
    hub.send(HubMessage::Seek {
        position_ms,
        session_revision,
        deadline,
        reply,
    })
    .expect("the Connect hub should accept a seek request");
    response
        .recv_timeout(TEST_TIMEOUT)
        .expect("the Connect hub should answer a seek request")
}

fn select_source(
    hub: &hub::HubHandle,
    provider_id: Option<&str>,
    source_id: Option<&str>,
    deadline: Instant,
) -> Result<bool, String> {
    let (reply, response) = mpsc::sync_channel(1);
    hub.send(HubMessage::SelectSource {
        provider_id: provider_id.map(str::to_string),
        source_id: source_id.map(str::to_string),
        deadline,
        reply,
    })
    .expect("the Connect hub should accept a source selection");
    response
        .recv_timeout(TEST_TIMEOUT)
        .expect("the Connect hub should answer a source selection")
}

#[test]
fn provider_exit_clears_selected_media() {
    const PROVIDER: &str = "test.exit";
    let (provider, fake) = fake_provider(
        PROVIDER,
        10,
        provider_state(PROVIDER, "exit-target", 4, 1, "Before exit", true),
    );
    let (publisher, states) = mpsc::channel();
    let hub = hub::start(vec![provider], publisher);
    let _ = recv_state_until(&states, |state| state.media.is_some());

    fake.controls
        .send(FakeControl::Stop)
        .expect("fake provider should stop");
    fake.stopped
        .recv_timeout(TEST_TIMEOUT)
        .expect("the provider thread should return");
    let stopped_state = recv_state_until(&states, |state| {
        state.status == MediaConnectStatus::Unavailable && state.media.is_none()
    });
    assert_eq!(stopped_state.session_count, 0);

    drop(hub);
}

#[test]
fn out_of_order_provider_state_cannot_roll_selection_back() {
    const PROVIDER: &str = "test.sequence";
    let (provider, fake) = fake_provider(
        PROVIDER,
        10,
        provider_state(PROVIDER, "first-target", 1, 1, "First", false),
    );
    let (publisher, states) = mpsc::channel();
    let hub = hub::start(vec![provider], publisher);
    let _ = recv_state_until(&states, |state| {
        state
            .media
            .as_ref()
            .is_some_and(|media| media.title == "First")
    });

    hub.send(HubMessage::ProviderState {
        provider_id: PROVIDER,
        sequence: 3,
        state: provider_state(PROVIDER, "latest-target", 3, 1, "Latest", true),
    })
    .expect("the Hub should accept a newer provider state");
    let latest = recv_state_until(&states, |state| {
        state
            .media
            .as_ref()
            .is_some_and(|media| media.title == "Latest")
    });

    fake.controls
        .send(FakeControl::Publish(Box::new(provider_state(
            PROVIDER,
            "stale-target",
            2,
            1,
            "Stale",
            false,
        ))))
        .expect("fake provider should publish its delayed state");
    assert!(
        states.recv_timeout(Duration::from_millis(100)).is_err(),
        "a delayed lower-sequence state must not be published"
    );
    assert_eq!(
        latest.media.expect("latest media").title,
        "Latest",
        "the latest accepted selection should remain visible"
    );

    let _ = fake.controls.send(FakeControl::Stop);
    drop(hub);
}

#[test]
fn dropping_last_hub_handle_shuts_provider_down() {
    const PROVIDER: &str = "test.shutdown";
    let (provider, fake) = fake_provider(
        PROVIDER,
        10,
        provider_state(PROVIDER, "shutdown-target", 2, 1, "Shutdown", false),
    );
    let (publisher, states) = mpsc::channel();
    let hub = hub::start(vec![provider], publisher);
    let _ = recv_state_until(&states, |state| state.media.is_some());

    drop(hub);

    fake.stopped
        .recv_timeout(TEST_TIMEOUT)
        .expect("dropping the Hub handle should stop its providers");
}

#[test]
fn public_media_state_json_remains_compatible() {
    const PROVIDER: &str = "test.json";
    let (provider, fake) = fake_provider(
        PROVIDER,
        10,
        provider_state(PROVIDER, "json-target", 7, 2, "Compatibility", true),
    );
    let (publisher, states) = mpsc::channel();
    let hub = hub::start(vec![provider], publisher);

    let state = recv_state_until(&states, |state| state.media.is_some());
    let serialized = serde_json::to_value(state).expect("media state should serialize");
    assert_eq!(
        serialized,
        json!({
            "status": "ready",
            "session_count": 2,
            "sources": [{
                "provider_id": PROVIDER,
                "source_id": "json-target",
                "label": "Test Player",
                "session_count": 2
            }],
            "manual_source": null,
            "media": {
                "title": "Compatibility",
                "artist": "Test Artist",
                "source": "Test Player",
                "playing": true,
                "can_previous": true,
                "can_play_pause": true,
                "can_next": true,
                "can_seek": false,
                "position_ms": 42_000,
                "duration_ms": 180_000,
                "position_updated_at_ms": 1_700_000_000_000_i64,
                "session_revision": 1,
                "artwork_data_url": "data:image/png;base64,dGVzdA=="
            }
        })
    );

    let _ = fake.controls.send(FakeControl::Stop);
    drop(hub);
}

#[test]
fn command_routes_to_selected_provider_target_and_local_generation() {
    const PROVIDER: &str = "test.routing";
    let (provider, fake) = fake_provider(
        PROVIDER,
        10,
        provider_state(PROVIDER, "player-window-42", 37, 1, "Routing", false),
    );
    let (publisher, states) = mpsc::channel();
    let hub = hub::start(vec![provider], publisher);
    let state = recv_state_until(&states, |state| state.media.is_some());
    let public_revision = state.media.expect("selected media").session_revision;

    assert_eq!(
        send_command(&hub, "next", public_revision, Instant::now() + TEST_TIMEOUT,),
        Ok(true)
    );
    assert_eq!(
        fake.commands
            .recv_timeout(TEST_TIMEOUT)
            .expect("the provider should receive the routed command"),
        RoutedCommand {
            action: MediaAction::Next,
            target_id: "player-window-42".to_string(),
            generation: 37,
        }
    );

    let _ = fake.controls.send(FakeControl::Stop);
    drop(hub);
}

#[test]
fn seek_routes_to_selected_provider_target_and_local_generation() {
    const PROVIDER: &str = "test.seek-routing";
    let (provider, fake) = fake_provider(
        PROVIDER,
        10,
        provider_state_with_seek(PROVIDER, "player-window-42", 37, 1, "Routing", false),
    );
    let (publisher, states) = mpsc::channel();
    let hub = hub::start(vec![provider], publisher);
    let state = recv_state_until(&states, |state| state.media.is_some());
    let public_revision = state.media.expect("selected media").session_revision;

    assert_eq!(
        send_seek(&hub, 90_000, public_revision, Instant::now() + TEST_TIMEOUT),
        Ok(true)
    );
    assert_eq!(
        fake.seeks
            .recv_timeout(TEST_TIMEOUT)
            .expect("the provider should receive the routed seek"),
        RoutedSeek {
            position_ms: 90_000,
            target_id: "player-window-42".to_string(),
            generation: 37,
        }
    );

    let _ = fake.controls.send(FakeControl::Stop);
    drop(hub);
}

#[test]
fn seek_rejects_unsupported_or_stale_sessions_before_provider_dispatch() {
    const PROVIDER: &str = "test.seek-validation";
    let (provider, fake) = fake_provider(
        PROVIDER,
        10,
        provider_state(PROVIDER, "first-target", 11, 1, "First", false),
    );
    let (publisher, states) = mpsc::channel();
    let hub = hub::start(vec![provider], publisher);
    let first = recv_state_until(&states, |state| state.media.is_some());
    let old_revision = first.media.expect("first selected media").session_revision;

    assert_eq!(
        send_seek(&hub, 90_000, old_revision, Instant::now() + TEST_TIMEOUT),
        Err("The selected media session does not support seeking".to_string())
    );
    assert!(
        fake.seeks.recv_timeout(Duration::from_millis(100)).is_err(),
        "an unsupported seek must not reach the provider"
    );

    fake.controls
        .send(FakeControl::Publish(Box::new(provider_state_with_seek(
            PROVIDER,
            "second-target",
            12,
            1,
            "Second",
            false,
        ))))
        .expect("fake provider should accept a state update");
    let second = recv_state_until(&states, |state| {
        state
            .media
            .as_ref()
            .is_some_and(|media| media.title == "Second")
    });
    let current_revision = second
        .media
        .expect("second selected media")
        .session_revision;
    assert_ne!(old_revision, current_revision);

    assert_eq!(
        send_seek(&hub, 90_000, old_revision, Instant::now() + TEST_TIMEOUT),
        Err("The selected media session changed".to_string())
    );
    assert!(
        fake.seeks.recv_timeout(Duration::from_millis(100)).is_err(),
        "a stale seek must not reach the provider after a source change"
    );

    let _ = fake.controls.send(FakeControl::Stop);
    drop(hub);
}

#[test]
fn source_selection_routes_to_the_provider_and_stales_the_previous_command() {
    const PROVIDER: &str = "test.source-routing";
    let sources = [("source-a", "Player A", 1), ("source-b", "Player B", 1)];
    let (provider, fake) = fake_provider(
        PROVIDER,
        10,
        provider_state_with_sources(PROVIDER, "source-a", 17, 2, "Source A", false, &sources),
    );
    let (publisher, states) = mpsc::channel();
    let hub = hub::start(vec![provider], publisher);
    let first = recv_state_until(&states, |state| state.media.is_some());
    let old_revision = first.media.expect("first selected media").session_revision;

    assert_eq!(
        select_source(
            &hub,
            Some(PROVIDER),
            Some("source-b"),
            Instant::now() + TEST_TIMEOUT,
        ),
        Ok(true)
    );
    assert_eq!(
        fake.source_selections
            .recv_timeout(TEST_TIMEOUT)
            .expect("the provider should receive the selected source"),
        RoutedSourceSelection {
            source_id: Some("source-b".to_string()),
        }
    );
    let manually_selected = recv_state_until(&states, |state| {
        state
            .manual_source
            .as_ref()
            .is_some_and(|source| source.provider_id == PROVIDER && source.source_id == "source-b")
    });
    assert_eq!(manually_selected.sources.len(), 2);
    assert!(
        manually_selected.media.is_none(),
        "the previously active source must not remain visible while the requested source changes"
    );
    assert_eq!(manually_selected.status, MediaConnectStatus::Checking);
    assert_eq!(
        send_command(&hub, "next", old_revision, Instant::now() + TEST_TIMEOUT,),
        Err("The selected media source is changing".to_string())
    );
    assert!(
        fake.commands
            .recv_timeout(Duration::from_millis(100))
            .is_err(),
        "the previous source must not receive a command while a new source is pending"
    );
    assert_eq!(
        send_seek(&hub, 90_000, old_revision, Instant::now() + TEST_TIMEOUT,),
        Err("The selected media source is changing".to_string())
    );
    assert!(
        fake.seeks.recv_timeout(Duration::from_millis(100)).is_err(),
        "the previous source must not receive a seek while a new source is pending"
    );

    fake.controls
        .send(FakeControl::Publish(Box::new(provider_state_with_sources(
            PROVIDER, "source-b", 18, 2, "Source B", false, &sources,
        ))))
        .expect("fake provider should publish the selected source");
    let second = recv_state_until(&states, |state| {
        state
            .media
            .as_ref()
            .is_some_and(|media| media.title == "Source B")
    });
    let current_revision = second
        .media
        .expect("second selected media")
        .session_revision;
    assert_ne!(old_revision, current_revision);
    assert_eq!(
        send_command(&hub, "next", old_revision, Instant::now() + TEST_TIMEOUT,),
        Err("The selected media session changed".to_string())
    );
    assert!(
        fake.commands
            .recv_timeout(Duration::from_millis(100))
            .is_err(),
        "a stale command must not reach the provider after a source change"
    );

    fake.controls
        .send(FakeControl::Publish(Box::new(provider_state_with_sources(
            PROVIDER,
            "source-a",
            19,
            1,
            "Source A again",
            false,
            &[("source-a", "Player A", 1)],
        ))))
        .expect("fake provider should publish a source disappearance");
    let automatic_fallback = recv_state_until(&states, |state| {
        state.manual_source.is_none()
            && state
                .media
                .as_ref()
                .is_some_and(|media| media.title == "Source A again")
    });
    assert_eq!(automatic_fallback.sources.len(), 1);

    let _ = fake.controls.send(FakeControl::Stop);
    drop(hub);
}

#[test]
fn source_selection_rejects_an_unknown_source_before_provider_dispatch() {
    const PROVIDER: &str = "test.source-validation";
    let (provider, fake) = fake_provider(
        PROVIDER,
        10,
        provider_state(PROVIDER, "only-source", 2, 1, "Only source", false),
    );
    let (publisher, states) = mpsc::channel();
    let hub = hub::start(vec![provider], publisher);
    let _ = recv_state_until(&states, |state| state.media.is_some());

    assert_eq!(
        select_source(
            &hub,
            Some(PROVIDER),
            Some("missing-source"),
            Instant::now() + TEST_TIMEOUT,
        ),
        Err("The selected media source is unavailable".to_string())
    );
    assert!(
        fake.source_selections
            .recv_timeout(Duration::from_millis(100))
            .is_err(),
        "an invalid source must not reach the provider"
    );

    let _ = fake.controls.send(FakeControl::Stop);
    drop(hub);
}

#[test]
fn stale_and_expired_commands_are_rejected_before_provider_dispatch() {
    const PROVIDER: &str = "test.stale";
    let (provider, fake) = fake_provider(
        PROVIDER,
        10,
        provider_state(PROVIDER, "first-target", 11, 1, "First", false),
    );
    let (publisher, states) = mpsc::channel();
    let hub = hub::start(vec![provider], publisher);
    let first = recv_state_until(&states, |state| state.media.is_some());
    let old_revision = first.media.expect("first selection").session_revision;

    fake.controls
        .send(FakeControl::Publish(Box::new(provider_state(
            PROVIDER,
            "second-target",
            12,
            1,
            "Second",
            false,
        ))))
        .expect("fake provider should accept a state update");
    let second = recv_state_until(&states, |state| {
        state
            .media
            .as_ref()
            .is_some_and(|media| media.title == "Second")
    });
    let current_revision = second.media.expect("second selection").session_revision;
    assert_ne!(old_revision, current_revision);

    let stale = send_command(
        &hub,
        "previous",
        old_revision,
        Instant::now() + TEST_TIMEOUT,
    );
    assert_eq!(stale, Err("The selected media session changed".to_string()));

    let expired = send_command(
        &hub,
        "toggle",
        current_revision,
        Instant::now() - Duration::from_millis(1),
    );
    assert_eq!(
        expired,
        Err("The media command expired before it could run".to_string())
    );
    let unsupported = send_command(
        &hub,
        "shuffle",
        current_revision,
        Instant::now() + TEST_TIMEOUT,
    );
    assert_eq!(unsupported, Err("Unsupported media command".to_string()));
    assert!(
        fake.commands
            .recv_timeout(Duration::from_millis(100))
            .is_err(),
        "rejected commands must not reach the provider"
    );

    let _ = fake.controls.send(FakeControl::Stop);
    drop(hub);
}

#[test]
fn playing_provider_wins_and_selection_stays_stable_when_both_pause() {
    const PROVIDER_A: &str = "test.provider-a";
    const PROVIDER_B: &str = "test.provider-b";
    let (provider_a, fake_a) = fake_provider(
        PROVIDER_A,
        100,
        provider_state(PROVIDER_A, "target-a", 3, 1, "Provider A", false),
    );
    let (provider_b, fake_b) = fake_provider(
        PROVIDER_B,
        1,
        provider_state(PROVIDER_B, "target-b", 8, 1, "Provider B", true),
    );
    let (publisher, states) = mpsc::channel();
    let hub = hub::start(vec![provider_a, provider_b], publisher);

    let playing_selection = recv_state_until(&states, |state| {
        state.session_count == 2
            && state
                .media
                .as_ref()
                .is_some_and(|media| media.title == "Provider B" && media.playing)
    });
    let stable_revision = playing_selection
        .media
        .expect("playing provider should be selected")
        .session_revision;

    fake_b
        .controls
        .send(FakeControl::Publish(Box::new(provider_state(
            PROVIDER_B,
            "target-b",
            8,
            1,
            "Provider B",
            false,
        ))))
        .expect("fake provider should accept a state update");
    let paused_selection = recv_state_until(&states, |state| {
        state.session_count == 2
            && state
                .media
                .as_ref()
                .is_some_and(|media| media.title == "Provider B" && !media.playing)
    });
    let paused_media = paused_selection.media.expect("stable provider selection");
    assert_eq!(paused_media.title, "Provider B");
    assert_eq!(paused_media.session_revision, stable_revision);

    let _ = fake_a.controls.send(FakeControl::Stop);
    let _ = fake_b.controls.send(FakeControl::Stop);
    drop(hub);
}
