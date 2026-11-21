#!/bin/sh
set -eu

: "${TURN_SECRET:?TURN_SECRET is required}"
: "${TURN_REALM:?TURN_REALM is required}"
: "${TURN_EXTERNAL_IP:?TURN_EXTERNAL_IP must be PUBLIC_IP/LAN_IP}"
: "${TURN_MIN_PORT:=49160}"
: "${TURN_MAX_PORT:=49200}"

case "$TURN_SECRET" in *REPLACE*|*CHANGE_ME*|'') echo "TURN_SECRET is a placeholder or empty" >&2; exit 1;; esac
case "$TURN_EXTERNAL_IP" in */*) ;; *) echo "TURN_EXTERNAL_IP must use PUBLIC_IP/LAN_IP" >&2; exit 1;; esac

export TURN_SECRET TURN_REALM TURN_EXTERNAL_IP TURN_MIN_PORT TURN_MAX_PORT
envsubst '${TURN_SECRET} ${TURN_REALM} ${TURN_EXTERNAL_IP} ${TURN_MIN_PORT} ${TURN_MAX_PORT}' \
  </etc/coturn/turnserver.conf.template >/run/turnserver.conf
chmod 0600 /run/turnserver.conf
exec turnserver --no-cli -c /run/turnserver.conf --log-file=stdout
