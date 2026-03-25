#!/bin/sh
# masq_helper.sh — Traffic Masquerade shared functions
# Sourced by: video_optimizer.sh (CGI)
#
# Both Video Optimizer and Traffic Masquerade share the same nfqws instance,
# queue number, nftables rules, and PID file. They are mutually exclusive —
# only one mode can be active at a time.
#
# This helper provides masquerade-specific status functions that read from
# the shared dpi_helper state. It exists as a thin wrapper for CGI readability.

[ -n "$_MASQ_HELPER_LOADED" ] && return 0
_MASQ_HELPER_LOADED=1

# Source dpi_helper for all shared constants and functions
. /usr/lib/qmanager/dpi_helper.sh

# Masquerade uses the same nfqws instance as video optimizer.
# Status/uptime/packet count all come from the shared dpi_helper functions.
# These wrappers exist so the CGI can call masq_* consistently.

masq_get_status() {
    dpi_get_status
}

masq_get_uptime() {
    dpi_get_uptime
}

masq_get_packet_count() {
    dpi_get_packet_count
}
