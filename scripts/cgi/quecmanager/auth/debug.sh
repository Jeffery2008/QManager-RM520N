#!/bin/sh
# debug.sh — Temporary diagnostic endpoint to check auth header delivery.
# DELETE THIS FILE after debugging is complete.
_SKIP_AUTH=1
. /usr/lib/qmanager/cgi_base.sh

cgi_headers

# Dump what uhttpd passes to us
jq -n \
    --arg http_auth "${HTTP_AUTHORIZATION:-<not set>}" \
    --arg request_method "${REQUEST_METHOD:-<not set>}" \
    --arg auth_config_exists "$([ -f /etc/qmanager/auth.json ] && echo 'yes' || echo 'no')" \
    --arg session_exists "$([ -f /tmp/qmanager_session.json ] && echo 'yes' || echo 'no')" \
    --arg session_content "$(cat /tmp/qmanager_session.json 2>/dev/null || echo '<none>')" \
    '{
        http_authorization: $http_auth,
        request_method: $request_method,
        auth_config_exists: $auth_config_exists,
        session_exists: $session_exists,
        session_content: $session_content
    }'
