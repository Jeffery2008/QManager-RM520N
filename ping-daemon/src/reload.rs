use std::path::{Path, PathBuf};

pub struct ReloadWatcher {
    flag_path: PathBuf,
}

impl ReloadWatcher {
    pub fn new(flag_path: &Path) -> Self {
        Self { flag_path: flag_path.to_path_buf() }
    }

    /// Returns true if the flag file exists. Caller must clear() afterwards.
    pub fn pending(&self) -> bool {
        self.flag_path.exists()
    }

    /// Removes the flag. Silently ignores ENOENT (already gone) but logs nothing here —
    /// caller does the logging.
    pub fn clear(&self) -> std::io::Result<()> {
        match std::fs::remove_file(&self.flag_path) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        std::env::temp_dir().join(format!("qping-reload-{}-{}-{}", std::process::id(), nanos, name))
    }

    #[test]
    fn pending_false_when_flag_absent() {
        let p = temp_path("absent");
        let w = ReloadWatcher::new(&p);
        assert!(!w.pending());
    }

    #[test]
    fn pending_true_when_flag_present() {
        let p = temp_path("present");
        let w = ReloadWatcher::new(&p);
        std::fs::write(&p, "").unwrap();
        assert!(w.pending());
    }

    #[test]
    fn clear_removes_flag() {
        let p = temp_path("clear");
        let w = ReloadWatcher::new(&p);
        std::fs::write(&p, "").unwrap();
        w.clear().unwrap();
        assert!(!p.exists());
    }

    #[test]
    fn clear_is_idempotent_when_flag_missing() {
        let p = temp_path("missing");
        let w = ReloadWatcher::new(&p);
        // Should not error
        w.clear().unwrap();
    }
}
