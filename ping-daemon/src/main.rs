mod cache;
mod config;
mod history;
mod pid;
mod probe;
mod qlog;
mod reload;
mod state;
mod tls_dial;
mod url;

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use cache::{CacheWriter, PingCache};
use history::History;
use pid::PidGuard;
use probe::{KeepAliveClient, ProbeOutcome};
use qlog::Logger;
use reload::ReloadWatcher;
use state::{tick, Connectivity, OutcomeKind, StreakState, Thresholds};

const PROFILE_JSON: &str = "/etc/qmanager/ping_profile.json";
const CACHE_PATH: &str = "/tmp/qmanager_ping.json";
const HISTORY_PATH: &str = "/tmp/qmanager_ping_history";
const PID_PATH: &str = "/tmp/qmanager_ping.pid";
const RELOAD_FLAG: &str = "/tmp/qmanager_ping_reload";
const RECOVERY_FLAG: &str = "/tmp/qmanager_recovery_active";
const QLOG_PATH: &str = "/tmp/qmanager.log";
const PROBE_TIMEOUT: Duration = Duration::from_secs(2);

fn main() {
    let log = Arc::new(Logger::new("ping", Path::new(QLOG_PATH)));

    let _pid_guard = match PidGuard::acquire(Path::new(PID_PATH)) {
        Ok(g) => g,
        Err(e) => {
            log.error(&format!("Cannot start: {}", e));
            std::process::exit(1);
        }
    };

    let stop = Arc::new(AtomicBool::new(false));
    install_signal_handlers(Arc::clone(&stop), Arc::clone(&log));

    let mut cfg = config::load(Path::new(PROFILE_JSON));
    log.info("========================================");
    log.info(&format!("QManager Ping Daemon starting (PID {})", std::process::id()));
    log.info(&format!("Profile: {}", cfg.profile));
    log.info(&format!("Targets: {}, {}", cfg.target_1, cfg.target_2));
    log.info(&format!(
        "Interval: {}s, fail/recover/intercept: {}s/{}s/{}s, history: {}s",
        cfg.interval_sec, cfg.fail_secs, cfg.recover_secs, cfg.intercept_secs, cfg.history_secs
    ));
    log.info("========================================");

    let cache = CacheWriter::new(Path::new(CACHE_PATH), Path::new(RECOVERY_FLAG));
    let mut history = History::new(Path::new(HISTORY_PATH), cfg.history_size());
    let reload = ReloadWatcher::new(Path::new(RELOAD_FLAG));
    let mut client = KeepAliveClient::new(PROBE_TIMEOUT);
    let mut streaks = StreakState::new();

    while !stop.load(Ordering::SeqCst) {
        if reload.pending() {
            let new_cfg = config::load(Path::new(PROFILE_JSON));
            if new_cfg.profile != cfg.profile
                || new_cfg.interval_sec != cfg.interval_sec
                || new_cfg.fail_secs != cfg.fail_secs
                || new_cfg.recover_secs != cfg.recover_secs
                || new_cfg.intercept_secs != cfg.intercept_secs
                || new_cfg.history_secs != cfg.history_secs
            {
                log.state_change("profile", &cfg.profile, &new_cfg.profile);
                history.resize(new_cfg.history_size());
            }
            cfg = new_cfg;
            if let Err(e) = reload.clear() {
                log.error(&format!("Failed to clear reload flag: {}", e));
            }
        }

        // Primary first; if Disconnected, fallback to secondary in the same tick.
        // Limited / Connected from primary skips the secondary probe (saves data).
        let primary_outcome = client.probe(&cfg.target_1);
        let (target, outcome) = match &primary_outcome {
            ProbeOutcome::Disconnected { .. } => {
                log.debug(&format!(
                    "primary {} failed, trying secondary {}",
                    cfg.target_1, cfg.target_2,
                ));
                let secondary_outcome = client.probe(&cfg.target_2);
                match &secondary_outcome {
                    ProbeOutcome::Connected { .. } | ProbeOutcome::Limited { .. } => {
                        (Some(cfg.target_2.clone()), secondary_outcome)
                    }
                    ProbeOutcome::Disconnected { .. } => {
                        // Both failed — report primary's reason for clearer debugging.
                        (Some(cfg.target_1.clone()), primary_outcome)
                    }
                }
            }
            _ => (Some(cfg.target_1.clone()), primary_outcome),
        };

        let kind = match &outcome {
            ProbeOutcome::Connected { .. } => OutcomeKind::Connected,
            ProbeOutcome::Limited { .. } => OutcomeKind::Limited,
            ProbeOutcome::Disconnected { .. } => OutcomeKind::Disconnected,
        };

        let thresholds = Thresholds {
            fail: cfg.fail_threshold_cycles(),
            recover: cfg.recover_threshold_cycles(),
            intercept: cfg.intercept_threshold_cycles(),
        };
        if let Some(chg) = tick(&mut streaks, kind, &thresholds) {
            log.state_change(
                "connectivity",
                conn_label(chg.from),
                conn_label(chg.to),
            );
            if matches!(chg.to, Connectivity::Disconnected) {
                log.warn("Internet unreachable");
            }
        }

        let (rtt, http_code, tcp_reused, limited_reason, down_reason) = match &outcome {
            ProbeOutcome::Connected { rtt_ms, tcp_reused } => {
                (Some(*rtt_ms), Some(204u16), *tcp_reused, None, None)
            }
            ProbeOutcome::Limited { rtt_ms, http_code, tcp_reused } => {
                (Some(*rtt_ms), Some(*http_code), *tcp_reused, Some(*http_code), None)
            }
            ProbeOutcome::Disconnected { reason } => {
                (None, None, false, None, Some(reason.as_str().to_string()))
            }
        };

        history.push(rtt);
        if let Err(e) = history.flush() {
            log.error(&format!("history flush failed: {}", e));
        }

        let snap = PingCache {
            timestamp: now_secs(),
            targets: [cfg.target_1.clone(), cfg.target_2.clone()],
            interval_sec: cfg.interval_sec,
            last_rtt_ms: rtt,
            reachable: streaks.connectivity == Connectivity::Connected,
            streak_success: streaks.streak_success,
            streak_fail: streaks.streak_fail,
            during_recovery: cache.during_recovery(),
            connectivity: streaks.connectivity,
            limited_reason,
            down_reason,
            streak_limited: streaks.streak_limited,
            probe_target_used: target,
            http_code_seen: http_code,
            tcp_reused,
            fail_secs: cfg.fail_secs,
            recover_secs: cfg.recover_secs,
            intercept_secs: cfg.intercept_secs,
            profile: cfg.profile.clone(),
        };
        if let Err(e) = cache.write(&snap) {
            log.error(&format!("cache write failed: {}", e));
        }

        sleep_interruptibly(&stop, Duration::from_secs(cfg.interval_sec));
    }

    log.info("SIGTERM/SIGINT received, exiting cleanly");
}

fn conn_label(c: Connectivity) -> &'static str {
    match c {
        Connectivity::Connected => "connected",
        Connectivity::Limited => "limited",
        Connectivity::Disconnected => "disconnected",
    }
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn install_signal_handlers(stop: Arc<AtomicBool>, log: Arc<Logger>) {
    use signal_hook::consts::{SIGINT, SIGTERM};
    use signal_hook::iterator::Signals;
    let mut signals = match Signals::new([SIGTERM, SIGINT]) {
        Ok(s) => s,
        Err(e) => {
            log.error(&format!("Failed to install signal handlers: {}", e));
            return;
        }
    };
    std::thread::spawn(move || {
        for _ in signals.forever() {
            stop.store(true, Ordering::SeqCst);
            break;
        }
    });
}

/// Sleep up to `total`, waking early if shutdown was signaled.
fn sleep_interruptibly(stop: &AtomicBool, total: Duration) {
    let step = Duration::from_millis(100);
    let mut elapsed = Duration::ZERO;
    while elapsed < total {
        if stop.load(Ordering::SeqCst) { return; }
        let remaining = total - elapsed;
        let nap = if remaining < step { remaining } else { step };
        std::thread::sleep(nap);
        elapsed += nap;
    }
}
