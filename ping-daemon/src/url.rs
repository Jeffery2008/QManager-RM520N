#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Scheme { Http, Https }

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedUrl {
    pub scheme: Scheme,
    pub host: String,
    pub port: u16,
    pub path: String,
    /// True when path matches a known captive-portal probe endpoint
    /// (`/generate_204` or `/hotspot-detect.html`, case-insensitive).
    /// When true, response interpretation is strict (204=Connected, 200=Limited).
    /// When false, any 2xx/3xx/4xx/5xx response = Connected (custom URL semantics).
    pub is_canonical_204: bool,
}

/// Parse a target URL. Bare hostnames are normalized to https://.
/// Returns None for unparseable / unsupported-scheme inputs.
pub fn parse(input: &str) -> Option<ParsedUrl> {
    let trimmed = input.trim();
    if trimmed.is_empty() { return None; }

    let (scheme, rest) = if let Some(r) = trimmed.strip_prefix("https://") {
        (Scheme::Https, r)
    } else if let Some(r) = trimmed.strip_prefix("http://") {
        (Scheme::Http, r)
    } else if trimmed.contains("://") {
        // Unsupported scheme like ftp://
        return None;
    } else {
        // Bare hostname or host/path — default to https
        (Scheme::Https, trimmed)
    };

    let (host_part, path) = match rest.find('/') {
        Some(i) => (&rest[..i], rest[i..].to_string()),
        None => (rest, "/".to_string()),
    };

    let (host, port) = match host_part.rsplit_once(':') {
        Some((h, p)) => {
            let port: u16 = p.parse().ok()?;
            (h.to_string(), port)
        }
        None => (
            host_part.to_string(),
            match scheme { Scheme::Http => 80, Scheme::Https => 443 },
        ),
    };

    if host.is_empty() { return None; }

    let path_lower = path.to_ascii_lowercase();
    let is_canonical_204 =
        path_lower == "/generate_204" || path_lower == "/hotspot-detect.html";

    Some(ParsedUrl { scheme, host, port, path, is_canonical_204 })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn https_explicit() {
        let p = parse("https://example.com/x").unwrap();
        assert_eq!(p.scheme, Scheme::Https);
        assert_eq!(p.host, "example.com");
        assert_eq!(p.port, 443);
        assert_eq!(p.path, "/x");
        assert!(!p.is_canonical_204);
    }

    #[test]
    fn http_explicit_gstatic_is_canonical() {
        let p = parse("http://www.gstatic.com/generate_204").unwrap();
        assert_eq!(p.scheme, Scheme::Http);
        assert_eq!(p.port, 80);
        assert!(p.is_canonical_204);
    }

    #[test]
    fn apple_hotspot_is_canonical() {
        let p = parse("http://captive.apple.com/hotspot-detect.html").unwrap();
        assert!(p.is_canonical_204);
    }

    #[test]
    fn bare_hostname_defaults_https_and_root_path() {
        let p = parse("youtube.com").unwrap();
        assert_eq!(p.scheme, Scheme::Https);
        assert_eq!(p.host, "youtube.com");
        assert_eq!(p.port, 443);
        assert_eq!(p.path, "/");
    }

    #[test]
    fn bare_hostname_with_path() {
        let p = parse("youtube.com/foo").unwrap();
        assert_eq!(p.scheme, Scheme::Https);
        assert_eq!(p.path, "/foo");
    }

    #[test]
    fn bare_hostname_with_explicit_port() {
        let p = parse("example.com:8443/x").unwrap();
        assert_eq!(p.port, 8443);
        assert_eq!(p.scheme, Scheme::Https);
    }

    #[test]
    fn whitespace_trimmed() {
        let p = parse("  youtube.com  ").unwrap();
        assert_eq!(p.host, "youtube.com");
    }

    #[test]
    fn empty_returns_none() {
        assert!(parse("").is_none());
        assert!(parse("   ").is_none());
    }

    #[test]
    fn unsupported_scheme_returns_none() {
        assert!(parse("ftp://x").is_none());
        assert!(parse("file:///etc/passwd").is_none());
    }

    #[test]
    fn invalid_port_returns_none() {
        assert!(parse("example.com:abc").is_none());
    }

    #[test]
    fn canonical_match_is_case_insensitive() {
        let p = parse("http://x.com/Generate_204").unwrap();
        assert!(p.is_canonical_204);
    }
}
