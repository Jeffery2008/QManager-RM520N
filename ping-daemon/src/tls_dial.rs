use std::io;
use std::net::TcpStream;
use std::sync::Arc;
use std::time::Duration;

use rustls::pki_types::ServerName;
use rustls::{ClientConfig, ClientConnection, RootCertStore, StreamOwned};

/// Lazy global TLS config. Built once with webpki-roots trust anchors.
fn tls_config() -> Arc<ClientConfig> {
    use std::sync::OnceLock;
    static CFG: OnceLock<Arc<ClientConfig>> = OnceLock::new();
    CFG.get_or_init(|| {
        let mut roots = RootCertStore::empty();
        roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
        let config = ClientConfig::builder()
            .with_root_certificates(roots)
            .with_no_client_auth();
        Arc::new(config)
    })
    .clone()
}

/// Establish TLS over an existing TcpStream. Caller has already set R/W timeouts on `tcp`.
pub fn handshake(
    tcp: TcpStream,
    host: &str,
    timeout: Duration,
) -> io::Result<StreamOwned<ClientConnection, TcpStream>> {
    let server_name = ServerName::try_from(host.to_string())
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "bad SNI host"))?;
    let conn = ClientConnection::new(tls_config(), server_name)
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;
    // StreamOwned drives the handshake on first read/write — but we want to bound it.
    // The TcpStream's existing read/write timeout is what enforces the bound.
    let _ = timeout; // already enforced via tcp timeouts; param kept for symmetry with future tunables.
    Ok(StreamOwned::new(conn, tcp))
}
