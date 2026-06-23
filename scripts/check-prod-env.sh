#!/usr/bin/env sh
# Check .env for production: presence and non-default JWT secrets.
# Used in make prod-check / prod-deploy.

set -e
ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Copy .env.docker.example to .env and set values."
  exit 1
fi


get_var() {
  grep -E "^${1}=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r'
}

JWT_SECRET=$(get_var JWT_SECRET)
JWT_REFRESH=$(get_var JWT_REFRESH_SECRET)
FRONTEND_BASE_URL=$(get_var FRONTEND_BASE_URL)
PUBLIC_SITE_URL=$(get_var PUBLIC_SITE_URL)

fail() {
  echo "ERROR: $1"
  exit 1
}

[ -n "$JWT_SECRET" ] || fail "JWT_SECRET is not set in .env"
[ -n "$JWT_REFRESH" ] || fail "JWT_REFRESH_SECRET is not set in .env"
[ -n "$FRONTEND_BASE_URL" ] || fail "FRONTEND_BASE_URL is not set in .env"
[ -n "$PUBLIC_SITE_URL" ] || fail "PUBLIC_SITE_URL is not set in .env"

case "$JWT_SECRET" in
  *change-me*|*change-in-production*) fail "Replace default JWT_SECRET in .env for production" ;;
esac
case "$JWT_REFRESH" in
  *change-in-production*) fail "Replace default JWT_REFRESH_SECRET in .env for production" ;;
esac

echo "OK: .env present, JWT secrets are set and not default."
