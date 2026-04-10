#!/bin/bash
# QManager Console — Shell startup for ttyd sessions
# Sets up PATH for Entware tools and drops into an interactive bash shell.

export PATH=/opt/bin:/opt/sbin:/usrdata/root/bin:/usr/bin:/usr/sbin:/bin:/sbin
export HOME=/usrdata/root
export TERM=xterm-256color

cd "$HOME" 2>/dev/null || cd /

printf '\033[1;36m'
printf '  QManager Console\n'
printf '  Type "exit" to close this session.\n'
printf '\033[0m\n'

exec /bin/bash --login
