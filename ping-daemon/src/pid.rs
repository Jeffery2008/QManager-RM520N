use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

pub struct PidGuard {
    path: PathBuf,
}

#[derive(Debug)]
pub enum PidError {
    AlreadyRunning(i32),
    Io(std::io::Error),
}

impl std::fmt::Display for PidError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PidError::AlreadyRunning(p) => write!(f, "another instance is running (PID {})", p),
            PidError::Io(e) => write!(f, "{}", e),
        }
    }
}

impl From<std::io::Error> for PidError {
    fn from(e: std::io::Error) -> Self { PidError::Io(e) }
}

impl PidGuard {
    /// Acquire the PID file, refusing if a live PID owns it.
    pub fn acquire(path: &Path) -> Result<Self, PidError> {
        if let Ok(s) = fs::read_to_string(path) {
            if let Ok(old_pid) = s.trim().parse::<i32>() {
                if pid_alive(old_pid) {
                    return Err(PidError::AlreadyRunning(old_pid));
                }
            }
        }
        let mut f = fs::File::create(path)?;
        let me = std::process::id();
        write!(f, "{}", me)?;
        Ok(PidGuard { path: path.to_path_buf() })
    }
}

impl Drop for PidGuard {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

/// Cross-user PID liveness check via kill(pid, 0) — sends no signal,
/// returns 0 if process exists. Matches platform.sh's pid_alive() helper.
fn pid_alive(pid: i32) -> bool {
    if pid <= 0 { return false; }
    unsafe { libc::kill(pid, 0) == 0 || std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM) }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        std::env::temp_dir().join(format!("qping-pid-{}-{}-{}", std::process::id(), nanos, name))
    }

    #[test]
    fn acquire_writes_own_pid() {
        let p = temp_path("own");
        let _guard = PidGuard::acquire(&p).unwrap();
        let body = std::fs::read_to_string(&p).unwrap();
        assert_eq!(body.trim().parse::<u32>().unwrap(), std::process::id());
    }

    #[test]
    fn drop_removes_pid_file() {
        let p = temp_path("drop");
        {
            let _guard = PidGuard::acquire(&p).unwrap();
            assert!(p.exists());
        }
        assert!(!p.exists());
    }

    #[test]
    fn acquire_succeeds_when_stale_pid_present() {
        let p = temp_path("stale");
        // Write an absurdly high PID that almost certainly does not exist.
        // Cannot guarantee, but on a dev box with PID 4_000_000 free this is reliable.
        std::fs::write(&p, "4000000").unwrap();
        let _guard = PidGuard::acquire(&p).unwrap();
    }

    #[test]
    fn acquire_fails_when_self_holds_pid() {
        let p = temp_path("self");
        let me = std::process::id().to_string();
        std::fs::write(&p, &me).unwrap();
        let result = PidGuard::acquire(&p);
        assert!(matches!(result, Err(PidError::AlreadyRunning(_))));
        // Cleanup since no guard was created
        let _ = std::fs::remove_file(&p);
    }
}
