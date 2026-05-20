use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Connectivity {
    Connected,
    Limited,
    Disconnected,
}

#[derive(Debug, Clone)]
pub struct Thresholds {
    pub fail: u32,
    pub recover: u32,
    pub intercept: u32,
}

#[derive(Debug, Clone)]
pub struct StreakState {
    pub connectivity: Connectivity,
    pub streak_success: u32,
    pub streak_limited: u32,
    pub streak_fail: u32,
}

impl StreakState {
    pub fn new() -> Self {
        Self {
            connectivity: Connectivity::Connected,
            streak_success: 0,
            streak_limited: 0,
            streak_fail: 0,
        }
    }
}

/// What kind of probe outcome happened. Numeric details (rtt, http code) are
/// orthogonal to the state machine — passed in separately by main.rs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutcomeKind {
    Connected,
    Limited,
    Disconnected,
}

/// Optional state change for logging.
#[derive(Debug, Clone)]
pub struct StateChange {
    pub from: Connectivity,
    pub to: Connectivity,
}

/// Apply one probe outcome. Returns Some(StateChange) if connectivity flipped.
pub fn tick(s: &mut StreakState, outcome: OutcomeKind, t: &Thresholds) -> Option<StateChange> {
    match outcome {
        OutcomeKind::Connected => {
            s.streak_success = s.streak_success.saturating_add(1);
            s.streak_limited = 0;
            s.streak_fail = 0;
        }
        OutcomeKind::Limited => {
            s.streak_success = 0;
            s.streak_limited = s.streak_limited.saturating_add(1);
            s.streak_fail = 0;
        }
        OutcomeKind::Disconnected => {
            s.streak_success = 0;
            s.streak_limited = 0;
            s.streak_fail = s.streak_fail.saturating_add(1);
        }
    }

    let prev = s.connectivity;
    let next = match s.connectivity {
        Connectivity::Connected => {
            if s.streak_fail >= t.fail {
                Connectivity::Disconnected
            } else if s.streak_limited >= t.intercept {
                Connectivity::Limited
            } else {
                prev
            }
        }
        Connectivity::Limited => {
            if s.streak_success >= t.recover {
                Connectivity::Connected
            } else if s.streak_fail >= t.fail {
                Connectivity::Disconnected
            } else {
                prev
            }
        }
        Connectivity::Disconnected => {
            if s.streak_success >= t.recover {
                Connectivity::Connected
            } else if s.streak_limited >= t.intercept {
                Connectivity::Limited
            } else {
                prev
            }
        }
    };

    if next != prev {
        s.connectivity = next;
        Some(StateChange { from: prev, to: next })
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn t() -> Thresholds {
        // Realistic regular-profile thresholds:
        // fail_secs=10, recover_secs=6, intercept_secs=8 at interval_sec=2
        Thresholds { fail: 5, recover: 3, intercept: 4 }
    }

    #[test]
    fn cold_start_is_connected_by_design() {
        let s = StreakState::new();
        assert_eq!(s.connectivity, Connectivity::Connected);
    }

    #[test]
    fn fail_threshold_must_be_consecutive() {
        let mut s = StreakState::new();
        let th = t();
        // 4 fails — not enough
        for _ in 0..4 {
            tick(&mut s, OutcomeKind::Disconnected, &th);
        }
        assert_eq!(s.connectivity, Connectivity::Connected);
        // 5th fail — flip
        let chg = tick(&mut s, OutcomeKind::Disconnected, &th);
        assert!(chg.is_some());
        assert_eq!(s.connectivity, Connectivity::Disconnected);
    }

    #[test]
    fn one_success_resets_fail_streak() {
        let mut s = StreakState::new();
        let th = t();
        for _ in 0..4 { tick(&mut s, OutcomeKind::Disconnected, &th); }
        tick(&mut s, OutcomeKind::Connected, &th);
        assert_eq!(s.streak_fail, 0);
        assert_eq!(s.streak_success, 1);
        assert_eq!(s.connectivity, Connectivity::Connected);
    }

    #[test]
    fn limited_resets_fail_streak_and_success_streak() {
        let mut s = StreakState::new();
        let th = t();
        tick(&mut s, OutcomeKind::Disconnected, &th);
        tick(&mut s, OutcomeKind::Disconnected, &th);
        tick(&mut s, OutcomeKind::Limited, &th);
        assert_eq!(s.streak_fail, 0);
        assert_eq!(s.streak_success, 0);
        assert_eq!(s.streak_limited, 1);
    }

    #[test]
    fn intercept_threshold_flips_to_limited() {
        let mut s = StreakState::new();
        let th = t();
        for _ in 0..3 { tick(&mut s, OutcomeKind::Limited, &th); }
        assert_eq!(s.connectivity, Connectivity::Connected);
        let chg = tick(&mut s, OutcomeKind::Limited, &th);
        assert!(chg.is_some());
        assert_eq!(chg.unwrap().to, Connectivity::Limited);
    }

    #[test]
    fn limited_to_connected_via_recover_threshold() {
        let mut s = StreakState::new();
        let th = t();
        for _ in 0..4 { tick(&mut s, OutcomeKind::Limited, &th); }
        assert_eq!(s.connectivity, Connectivity::Limited);
        for _ in 0..2 { tick(&mut s, OutcomeKind::Connected, &th); }
        assert_eq!(s.connectivity, Connectivity::Limited);
        let chg = tick(&mut s, OutcomeKind::Connected, &th);
        assert_eq!(chg.unwrap().to, Connectivity::Connected);
    }

    #[test]
    fn disconnected_to_limited_when_carrier_intercepts_after_outage() {
        let mut s = StreakState::new();
        let th = t();
        for _ in 0..5 { tick(&mut s, OutcomeKind::Disconnected, &th); }
        assert_eq!(s.connectivity, Connectivity::Disconnected);
        for _ in 0..4 { tick(&mut s, OutcomeKind::Limited, &th); }
        assert_eq!(s.connectivity, Connectivity::Limited);
    }

    #[test]
    fn limited_to_disconnected_on_link_drop() {
        let mut s = StreakState::new();
        let th = t();
        for _ in 0..4 { tick(&mut s, OutcomeKind::Limited, &th); }
        assert_eq!(s.connectivity, Connectivity::Limited);
        for _ in 0..5 { tick(&mut s, OutcomeKind::Disconnected, &th); }
        assert_eq!(s.connectivity, Connectivity::Disconnected);
    }

    #[test]
    fn no_state_change_returns_none() {
        let mut s = StreakState::new();
        let th = t();
        let chg = tick(&mut s, OutcomeKind::Connected, &th);
        assert!(chg.is_none());
    }

    #[test]
    fn streak_counters_saturate_not_overflow() {
        let mut s = StreakState::new();
        s.streak_success = u32::MAX - 1;
        let th = t();
        tick(&mut s, OutcomeKind::Connected, &th);
        tick(&mut s, OutcomeKind::Connected, &th);
        // Did not panic on overflow
        assert_eq!(s.streak_success, u32::MAX);
    }
}
