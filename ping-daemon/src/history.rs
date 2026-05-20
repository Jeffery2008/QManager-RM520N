use std::collections::VecDeque;
use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};

pub struct History {
    entries: VecDeque<Option<f32>>,
    capacity: usize,
    path: PathBuf,
    tmp: PathBuf,
}

impl History {
    pub fn new(path: &Path, capacity: usize) -> Self {
        let tmp = path_with_suffix(path, ".tmp");
        Self {
            entries: VecDeque::with_capacity(capacity),
            capacity,
            path: path.to_path_buf(),
            tmp,
        }
    }

    pub fn push(&mut self, rtt_ms: Option<f32>) {
        if self.entries.len() >= self.capacity {
            self.entries.pop_front();
        }
        self.entries.push_back(rtt_ms);
    }

    /// Resize on profile change. Keeps the newest entries when shrinking.
    pub fn resize(&mut self, new_capacity: usize) {
        self.capacity = new_capacity.max(1);
        while self.entries.len() > self.capacity {
            self.entries.pop_front();
        }
    }

    /// Atomic write: serialize to <path>.tmp, then rename to <path>.
    /// Returns Err on I/O failure — caller should log and continue.
    pub fn flush(&self) -> std::io::Result<()> {
        let mut f = File::create(&self.tmp)?;
        for entry in &self.entries {
            match entry {
                Some(rtt) => writeln!(f, "{:.1}", rtt)?,
                None => writeln!(f, "null")?,
            }
        }
        f.sync_all().ok();
        std::fs::rename(&self.tmp, &self.path)?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn len(&self) -> usize {
        self.entries.len()
    }
}

fn path_with_suffix(p: &Path, suffix: &str) -> PathBuf {
    let mut s = p.as_os_str().to_owned();
    s.push(suffix);
    PathBuf::from(s)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::read_to_string;

    fn temp_path(name: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        std::env::temp_dir().join(format!("qping-hist-{}-{}-{}", std::process::id(), nanos, name))
    }

    #[test]
    fn push_and_evict_oldest() {
        let mut h = History::new(&temp_path("evict"), 3);
        h.push(Some(1.0));
        h.push(Some(2.0));
        h.push(Some(3.0));
        h.push(Some(4.0));
        assert_eq!(h.len(), 3);
    }

    #[test]
    fn flush_writes_one_per_line_with_one_decimal() {
        let p = temp_path("flush");
        let mut h = History::new(&p, 5);
        h.push(Some(34.2));
        h.push(None);
        h.push(Some(38.15)); // should round to 38.1 or 38.2
        h.flush().unwrap();
        let body = read_to_string(&p).unwrap();
        let lines: Vec<&str> = body.lines().collect();
        assert_eq!(lines.len(), 3);
        assert_eq!(lines[0], "34.2");
        assert_eq!(lines[1], "null");
        assert!(lines[2] == "38.1" || lines[2] == "38.2", "got: {}", lines[2]);
    }

    #[test]
    fn flush_is_atomic_via_rename() {
        let p = temp_path("atomic");
        let tmp = path_with_suffix(&p, ".tmp");
        let mut h = History::new(&p, 5);
        h.push(Some(1.0));
        h.flush().unwrap();
        // Tmp should not exist after flush
        assert!(!tmp.exists());
        assert!(p.exists());
    }

    #[test]
    fn resize_smaller_keeps_newest() {
        let mut h = History::new(&temp_path("resize_smaller"), 5);
        for i in 0..5 { h.push(Some(i as f32)); }
        h.resize(2);
        assert_eq!(h.len(), 2);
        // Newest two are 3.0 and 4.0
        assert_eq!(h.entries[0], Some(3.0));
        assert_eq!(h.entries[1], Some(4.0));
    }

    #[test]
    fn resize_larger_preserves_existing() {
        let mut h = History::new(&temp_path("resize_larger"), 3);
        h.push(Some(1.0));
        h.push(Some(2.0));
        h.resize(10);
        assert_eq!(h.len(), 2);
        assert_eq!(h.capacity, 10);
    }
}
