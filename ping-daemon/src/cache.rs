use crate::state::Connectivity;
use serde::Serialize;
use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};

/// Full daemon snapshot written to /tmp/qmanager_ping.json every cycle.
/// Field order matches the design spec — backwards-compat fields first,
/// new optional fields after.
#[derive(Debug, Serialize)]
pub struct PingCache {
    // Backwards-compat (existing consumers depend on these)
    pub timestamp: u64,
    pub targets: [String; 2],
    pub interval_sec: u64,
    pub last_rtt_ms: Option<f32>,
    pub reachable: bool,
    pub streak_success: u32,
    pub streak_fail: u32,
    pub during_recovery: bool,

    // New optional fields
    pub connectivity: Connectivity,
    pub limited_reason: Option<u16>,
    pub down_reason: Option<String>,
    pub streak_limited: u32,
    pub probe_target_used: Option<String>,
    pub http_code_seen: Option<u16>,
    pub tcp_reused: bool,
    pub fail_secs: u64,
    pub recover_secs: u64,
    pub intercept_secs: u64,
    pub profile: String,
}

pub struct CacheWriter {
    path: PathBuf,
    tmp: PathBuf,
    recovery_flag_path: PathBuf,
}

impl CacheWriter {
    pub fn new(path: &Path, recovery_flag_path: &Path) -> Self {
        let tmp = path_with_suffix(path, ".tmp");
        Self {
            path: path.to_path_buf(),
            tmp,
            recovery_flag_path: recovery_flag_path.to_path_buf(),
        }
    }

    pub fn during_recovery(&self) -> bool {
        self.recovery_flag_path.exists()
    }

    pub fn write(&self, snap: &PingCache) -> std::io::Result<()> {
        let body = serde_json::to_vec(snap).map_err(io_err)?;
        let mut f = File::create(&self.tmp)?;
        f.write_all(&body)?;
        f.write_all(b"\n")?;
        f.sync_all().ok();
        std::fs::rename(&self.tmp, &self.path)?;
        Ok(())
    }
}

fn io_err(e: serde_json::Error) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::Other, e)
}

fn path_with_suffix(p: &Path, suffix: &str) -> PathBuf {
    let mut s = p.as_os_str().to_owned();
    s.push(suffix);
    PathBuf::from(s)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use std::fs::read_to_string;

    fn temp_path(name: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        std::env::temp_dir().join(format!("qping-cache-{}-{}-{}", std::process::id(), nanos, name))
    }

    fn fixture(connectivity: Connectivity, rtt: Option<f32>) -> PingCache {
        PingCache {
            timestamp: 1_700_000_000,
            targets: ["http://a/204".into(), "http://b/204".into()],
            interval_sec: 2,
            last_rtt_ms: rtt,
            reachable: matches!(connectivity, Connectivity::Connected),
            streak_success: 5,
            streak_fail: 0,
            during_recovery: false,
            connectivity,
            limited_reason: None,
            down_reason: None,
            streak_limited: 0,
            probe_target_used: Some("http://a/204".into()),
            http_code_seen: Some(204),
            tcp_reused: true,
            fail_secs: 10,
            recover_secs: 6,
            intercept_secs: 8,
            profile: "regular".into(),
        }
    }

    #[test]
    fn writes_valid_json_with_all_fields() {
        let p = temp_path("valid");
        let flag = temp_path("flag");
        let w = CacheWriter::new(&p, &flag);
        w.write(&fixture(Connectivity::Connected, Some(34.2))).unwrap();
        let body = read_to_string(&p).unwrap();
        let v: Value = serde_json::from_str(&body).unwrap();
        // Backwards-compat fields
        for k in ["timestamp","targets","interval_sec","last_rtt_ms","reachable",
                  "streak_success","streak_fail","during_recovery"] {
            assert!(v.get(k).is_some(), "missing field {}", k);
        }
        // New fields
        for k in ["connectivity","limited_reason","down_reason","streak_limited",
                  "probe_target_used","http_code_seen","tcp_reused",
                  "fail_secs","recover_secs","intercept_secs","profile"] {
            assert!(v.get(k).is_some(), "missing field {}", k);
        }
    }

    #[test]
    fn last_rtt_is_json_null_not_string_when_none() {
        let p = temp_path("rtt_null");
        let flag = temp_path("flag2");
        let w = CacheWriter::new(&p, &flag);
        w.write(&fixture(Connectivity::Disconnected, None)).unwrap();
        let v: Value = serde_json::from_str(&read_to_string(&p).unwrap()).unwrap();
        assert!(v.get("last_rtt_ms").unwrap().is_null());
    }

    #[test]
    fn connectivity_serializes_lowercase() {
        let p = temp_path("conn");
        let flag = temp_path("flag3");
        let w = CacheWriter::new(&p, &flag);
        w.write(&fixture(Connectivity::Limited, Some(50.0))).unwrap();
        let v: Value = serde_json::from_str(&read_to_string(&p).unwrap()).unwrap();
        assert_eq!(v.get("connectivity").unwrap().as_str().unwrap(), "limited");
    }

    #[test]
    fn during_recovery_reflects_flag_file() {
        let p = temp_path("rec");
        let flag = temp_path("rec_flag");
        let w = CacheWriter::new(&p, &flag);
        assert!(!w.during_recovery());
        std::fs::write(&flag, "").unwrap();
        assert!(w.during_recovery());
        std::fs::remove_file(&flag).unwrap();
    }

    #[test]
    fn write_is_atomic_via_rename() {
        let p = temp_path("atomic");
        let flag = temp_path("flag4");
        let tmp = path_with_suffix(&p, ".tmp");
        let w = CacheWriter::new(&p, &flag);
        w.write(&fixture(Connectivity::Connected, Some(1.0))).unwrap();
        assert!(!tmp.exists());
        assert!(p.exists());
    }
}
