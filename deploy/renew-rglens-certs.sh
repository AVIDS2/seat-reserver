#!/usr/bin/env bash
set -euo pipefail

WEBROOT=/opt/1panel/apps/openresty/openresty/root
OPENRESTY_CONTAINER=1Panel-openresty-i08D
SSL_BASE=/opt/1panel/apps/openresty/openresty/conf/ssl
CERTBOT_IMAGE=certbot/certbot:latest
DRY_RUN=0
EXTRA_ARGS=()
FAILED=0

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  EXTRA_ARGS+=(--dry-run)
fi

renew_store() {
  local store_dir="$1"
  if [[ ! -d "${store_dir}/certbot/conf" ]]; then
    printf '[%s] skip missing certbot store: %s\n' "$(date -Is)" "${store_dir}"
    return 0
  fi
  if ! docker run --rm \
    -v "${store_dir}/certbot/conf:/etc/letsencrypt" \
    -v "${WEBROOT}:/var/www/certbot" \
    "${CERTBOT_IMAGE}" renew --webroot -w /var/www/certbot --no-random-sleep-on-renew --non-interactive "${EXTRA_ARGS[@]}" --quiet; then
    printf '[%s] renew failed for store: %s\n' "$(date -Is)" "${store_dir}"
    FAILED=1
  fi
}

copy_cert() {
  local store_dir="$1"
  local domain="$2"
  local live_dir="${store_dir}/certbot/conf/live/${domain}"
  if [[ ! -f "${live_dir}/fullchain.pem" || ! -f "${live_dir}/privkey.pem" ]]; then
    printf '[%s] skip missing live cert: %s\n' "$(date -Is)" "${domain}"
    return 0
  fi
  local target="${SSL_BASE}/${domain}"
  mkdir -p "${target}"
  cp -L "${live_dir}/fullchain.pem" "${target}/fullchain.pem"
  cp -L "${live_dir}/privkey.pem" "${target}/privkey.pem"
  chmod 644 "${target}/fullchain.pem"
  chmod 600 "${target}/privkey.pem"
}

renew_store /app/blog
renew_store /app/ghost
renew_store /app/bidpilot
renew_store /app/bidpilot-api
renew_store /app/seat-reservation-platform

if [[ "${DRY_RUN}" -eq 0 ]]; then
  copy_cert /app/blog rglens.com
  copy_cert /app/ghost ghost.rglens.com
  copy_cert /app/bidpilot bidpilot.rglens.com
  copy_cert /app/bidpilot-api bidpilot-api.rglens.com
  copy_cert /app/seat-reservation-platform seat.rglens.com
  docker exec "${OPENRESTY_CONTAINER}" openresty -t
  docker kill -s HUP "${OPENRESTY_CONTAINER}" >/dev/null
fi

printf '[%s] rglens certificate renew check completed%s\n' "$(date -Is)" "$(if [[ "${DRY_RUN}" -eq 1 ]]; then printf ' (dry-run)'; fi)"
exit "${FAILED}"
