#!/bin/sh
# check.sh — Auth status check (used by login page for setup detection).
_SKIP_AUTH=1
. /usr/lib/qmanager/cgi_base.sh

qlog_init "cgi_auth_check"
cgi_headers

if is_setup_required; then
    jq -n '{"authenticated":false,"setup_required":true}'
    exit 0
fi

_token=$(qm_get_cookie "$COOKIE_SESSION")
if [ -n "$_token" ] && qm_validate_session "$_token"; then
    jq -n '{"authenticated":true}'
else
    jq -n '{"authenticated":false}'
fi
