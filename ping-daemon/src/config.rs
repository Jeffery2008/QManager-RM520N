use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProfileConfig {
    pub profile: String,
    pub interval_sec: u64,
    pub fail_secs: u64,
    pub recover_secs: u64,
    pub intercept_secs: u64,
    pub history_secs: u64,
    pub target_1: String,
    pub target_2: String,
}

impl ProfileConfig {
    pub fn relaxed() -> Self {
        Self {
            profile: "relaxed".into(),
            interval_sec: 5,
            fail_secs: 15,
            recover_secs: 10,
            intercept_secs: 8,
            history_secs: 300,
            target_1: "http://cp.cloudflare.com/".into(),
            target_2: "http://www.gstatic.com/generate_204".into(),
        }
    }

    pub fn for_profile(name: &str) -> Self {
        let mut cfg = Self::relaxed();
        match name {
            "sensitive" => {
                cfg.profile = "sensitive".into();
                cfg.interval_sec = 1;
                cfg.fail_secs = 6;
                cfg.recover_secs = 3;
                cfg.intercept_secs = 8;
                cfg.history_secs = 300;
            }
            "regular" => {
                cfg.profile = "regular".into();
                cfg.interval_sec = 2;
                cfg.fail_secs = 10;
                cfg.recover_secs = 6;
                cfg.intercept_secs = 8;
                cfg.history_secs = 300;
            }
            "relaxed" => {} // already set
            "quiet" => {
                cfg.profile = "quiet".into();
                cfg.interval_sec = 10;
                cfg.fail_secs = 30;
                cfg.recover_secs = 20;
                cfg.intercept_secs = 8;
                cfg.history_secs = 600;
            }
            _ => {} // unknown name — fall through with relaxed defaults
        }
        cfg
    }

    /// Compute fail-threshold cycle count from time-based fail_secs.
    pub fn fail_threshold_cycles(&self) -> u32 {
        max1(div_ceil(self.fail_secs, self.interval_sec))
    }

    pub fn recover_threshold_cycles(&self) -> u32 {
        max1(div_ceil(self.recover_secs, self.interval_sec))
    }

    pub fn intercept_threshold_cycles(&self) -> u32 {
        max1(div_ceil(self.intercept_secs, self.interval_sec))
    }

    pub fn history_size(&self) -> usize {
        let n = div_ceil(self.history_secs, self.interval_sec);
        n.max(1) as usize
    }
}

#[derive(Debug, Deserialize)]
struct ProfileJson {
    profile: Option<String>,
    interval_sec: Option<u64>,
    fail_secs: Option<u64>,
    recover_secs: Option<u64>,
    intercept_secs: Option<u64>,
    history_secs: Option<u64>,
    target_1: Option<String>,
    target_2: Option<String>,
}

/// Resolution order: env vars > JSON > hardcoded defaults.
/// If any time-based env var is set, profile is reported as "custom".
pub fn load(json_path: &Path) -> ProfileConfig {
    let json: Option<ProfileJson> = std::fs::read_to_string(json_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok());

    let profile_name = std::env::var("PING_PROFILE")
        .ok()
        .or_else(|| json.as_ref().and_then(|j| j.profile.clone()))
        .unwrap_or_else(|| "relaxed".into());

    let mut cfg = ProfileConfig::for_profile(&profile_name);

    if let Some(j) = json.as_ref() {
        if let Some(v) = j.interval_sec { cfg.interval_sec = v; }
        if let Some(v) = j.fail_secs { cfg.fail_secs = v; }
        if let Some(v) = j.recover_secs { cfg.recover_secs = v; }
        if let Some(v) = j.intercept_secs { cfg.intercept_secs = v; }
        if let Some(v) = j.history_secs { cfg.history_secs = v; }
        if let Some(v) = j.target_1.as_ref() { cfg.target_1 = v.clone(); }
        if let Some(v) = j.target_2.as_ref() { cfg.target_2 = v.clone(); }
    }

    let mut env_override = false;
    if let Ok(v) = std::env::var("PING_INTERVAL") {
        if let Ok(n) = v.parse() { cfg.interval_sec = n; env_override = true; }
    }
    if let Ok(v) = std::env::var("FAIL_SECS") {
        if let Ok(n) = v.parse() { cfg.fail_secs = n; env_override = true; }
    }
    if let Ok(v) = std::env::var("RECOVER_SECS") {
        if let Ok(n) = v.parse() { cfg.recover_secs = n; env_override = true; }
    }
    if let Ok(v) = std::env::var("INTERCEPT_SECS") {
        if let Ok(n) = v.parse() { cfg.intercept_secs = n; env_override = true; }
    }
    if let Ok(v) = std::env::var("HISTORY_SECS") {
        if let Ok(n) = v.parse() { cfg.history_secs = n; env_override = true; }
    }
    if let Ok(v) = std::env::var("PING_TARGET_1") { cfg.target_1 = v; }
    if let Ok(v) = std::env::var("PING_TARGET_2") { cfg.target_2 = v; }

    if env_override {
        cfg.profile = "custom".into();
    }

    if cfg.interval_sec == 0 { cfg.interval_sec = 1; }

    cfg
}

fn div_ceil(a: u64, b: u64) -> u64 {
    if b == 0 { return a; }
    (a + b - 1) / b
}

fn max1(n: u64) -> u32 {
    n.max(1) as u32
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn defaults_match_relaxed_when_no_json_no_env() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        let cfg = load(Path::new("/nonexistent/no_such_file.json"));
        assert_eq!(cfg.profile, "relaxed");
        assert_eq!(cfg.interval_sec, 5);
        assert_eq!(cfg.fail_secs, 15);
        assert_eq!(cfg.recover_secs, 10);
        assert_eq!(cfg.intercept_secs, 8);
    }

    #[test]
    fn json_profile_overrides_default() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        let p = write_temp_json(r#"{"profile":"regular"}"#);
        let cfg = load(&p);
        assert_eq!(cfg.profile, "regular");
        assert_eq!(cfg.interval_sec, 2);
        assert_eq!(cfg.fail_secs, 10);
    }

    #[test]
    fn json_field_overrides_profile_default() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        let p = write_temp_json(r#"{"profile":"regular","fail_secs":99}"#);
        let cfg = load(&p);
        assert_eq!(cfg.fail_secs, 99);
    }

    #[test]
    fn env_overrides_json_and_marks_custom() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        let p = write_temp_json(r#"{"profile":"regular","fail_secs":99}"#);
        std::env::set_var("FAIL_SECS", "42");
        let cfg = load(&p);
        assert_eq!(cfg.fail_secs, 42);
        assert_eq!(cfg.profile, "custom");
        std::env::remove_var("FAIL_SECS");
    }

    #[test]
    fn malformed_json_falls_back_to_defaults() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        let p = write_temp_json("{ this is not valid json }");
        let cfg = load(&p);
        assert_eq!(cfg.profile, "relaxed");
        assert_eq!(cfg.interval_sec, 5);
    }

    #[test]
    fn threshold_cycles_round_up() {
        let mut cfg = ProfileConfig::for_profile("relaxed");
        cfg.intercept_secs = 8;
        cfg.interval_sec = 5;
        // ceil(8/5) == 2
        assert_eq!(cfg.intercept_threshold_cycles(), 2);
    }

    #[test]
    fn threshold_cycles_at_least_one() {
        let mut cfg = ProfileConfig::for_profile("relaxed");
        cfg.fail_secs = 0;
        cfg.interval_sec = 10;
        assert_eq!(cfg.fail_threshold_cycles(), 1);
    }

    #[test]
    fn history_size_scales_with_interval() {
        let mut cfg = ProfileConfig::for_profile("regular");
        cfg.history_secs = 300;
        cfg.interval_sec = 2;
        assert_eq!(cfg.history_size(), 150);
    }

    #[test]
    fn quiet_profile_intercept_one_cycle() {
        let cfg = ProfileConfig::for_profile("quiet");
        assert_eq!(cfg.interval_sec, 10);
        assert_eq!(cfg.intercept_secs, 8);
        assert_eq!(cfg.intercept_threshold_cycles(), 1);
    }

    #[test]
    fn json_targets_override_defaults() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        let p = write_temp_json(
            r#"{"profile":"relaxed","target_1":"https://1.1.1.1/","target_2":"http://example.com/"}"#,
        );
        let cfg = load(&p);
        assert_eq!(cfg.target_1, "https://1.1.1.1/");
        assert_eq!(cfg.target_2, "http://example.com/");
    }

    #[test]
    fn missing_json_targets_keep_hardcoded_defaults() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        let p = write_temp_json(r#"{"profile":"regular"}"#);
        let cfg = load(&p);
        // Hardcoded defaults from ProfileConfig::relaxed() (swapped in Task 6).
        assert_eq!(cfg.target_1, "http://cp.cloudflare.com/");
        assert_eq!(cfg.target_2, "http://www.gstatic.com/generate_204");
    }

    #[test]
    fn env_target_still_beats_json() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        let p = write_temp_json(r#"{"target_1":"https://json.example/"}"#);
        std::env::set_var("PING_TARGET_1", "https://env.example/");
        let cfg = load(&p);
        assert_eq!(cfg.target_1, "https://env.example/");
        std::env::remove_var("PING_TARGET_1");
    }

    fn clear_env() {
        for k in &["PING_PROFILE","PING_INTERVAL","FAIL_SECS","RECOVER_SECS",
                   "INTERCEPT_SECS","HISTORY_SECS","PING_TARGET_1","PING_TARGET_2"] {
            std::env::remove_var(k);
        }
    }

    fn write_temp_json(body: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let p = std::env::temp_dir().join(format!("qping-cfg-{}-{}.json", std::process::id(), nanos));
        std::fs::write(&p, body).unwrap();
        p
    }
}
