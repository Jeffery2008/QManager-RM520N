#!/bin/sh
# platform.sh — Service control abstraction (RM520N-GL / systemd)
# Replaces direct /etc/init.d/* calls with systemctl equivalents.
# Adds sudo for privileged operations (lighttpd runs as www-data).

[ -n "$_PLATFORM_LOADED" ] && return 0
_PLATFORM_LOADED=1

# Detect sudo path — Entware (/opt/bin/sudo) or system (/usr/bin/sudo)
# When running as root (daemons), sudo is skipped entirely.
if [ "$(id -u)" -eq 0 ]; then
    _SUDO=""
elif [ -x /opt/bin/sudo ]; then
    _SUDO="/opt/bin/sudo"
elif [ -x /usr/bin/sudo ]; then
    _SUDO="/usr/bin/sudo"
else
    _SUDO="sudo"
fi

# Map QManager service names to systemd unit names.
# Input: procd-style name (e.g., "qmanager_watchcat")
# Output: systemd unit name (e.g., "qmanager-watchcat")
_svc_unit() {
    printf '%s' "$1" | sed 's/_/-/g'
}

# Start a service
svc_start() {
    $_SUDO systemctl start "$(_svc_unit "$1")" 2>/dev/null
}

# Stop a service
svc_stop() {
    $_SUDO systemctl stop "$(_svc_unit "$1")" 2>/dev/null
}

# Restart a service
svc_restart() {
    $_SUDO systemctl restart "$(_svc_unit "$1")" 2>/dev/null
}

# Enable a service (start on boot)
svc_enable() {
    $_SUDO systemctl enable "$(_svc_unit "$1")" 2>/dev/null
}

# Disable a service (don't start on boot)
svc_disable() {
    $_SUDO systemctl disable "$(_svc_unit "$1")" 2>/dev/null
}

# Check if a service is enabled (boot-start)
svc_is_enabled() {
    $_SUDO systemctl is-enabled "$(_svc_unit "$1")" >/dev/null 2>&1
}

# Check if a service is currently running
svc_is_running() {
    $_SUDO systemctl is-active "$(_svc_unit "$1")" >/dev/null 2>&1
}

# Privileged command helpers — add sudo prefix for www-data context
run_iptables() {
    $_SUDO iptables "$@"
}

run_ip6tables() {
    $_SUDO ip6tables "$@"
}

run_reboot() {
    $_SUDO reboot "$@"
}
