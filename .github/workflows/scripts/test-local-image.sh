#!/usr/bin/env bash
set -Eeuo pipefail

image=${1:?image required}
expected_version=${2:?version required}
: "${SMOKE_VOLUME:?isolated test volume required}"
setup_token=$(openssl rand -hex 32)
echo "::add-mask::$setup_token"
endpoint=http://127.0.0.1:18080
trap 'docker logs bifrost-zh-smoke >&2 || true' ERR

start_gateway() {
  docker run -d --name bifrost-zh-smoke \
    -p 127.0.0.1:18080:8080 \
    -v "$SMOKE_VOLUME:/app/data" \
    -e "BIFROST_SETUP_TOKEN=$setup_token" \
    "$1" > /dev/null
  curl --fail --silent --show-error --retry 60 --retry-connrefused \
    --retry-delay 2 --retry-max-time 150 "$endpoint/health" > /dev/null
}

docker volume create "$SMOKE_VOLUME" > /dev/null
start_gateway maximhq/bifrost:v2.4.0
curl --fail --silent --show-error \
  -H "X-Bifrost-Setup-Token: $setup_token" -H 'Content-Type: application/json' \
  -d '{"upgrade_probe":"preserved","onboarding_dismissed":true}' \
  "$endpoint/api/config/metadata" > /dev/null
docker stop bifrost-zh-smoke > /dev/null
docker rm bifrost-zh-smoke > /dev/null

start_gateway "$image"
actual_version=$(curl --fail --silent --show-error \
  -H "X-Bifrost-Setup-Token: $setup_token" "$endpoint/api/version")
test "$actual_version" = "\"$expected_version\""
curl --fail --silent --show-error \
  -H "X-Bifrost-Setup-Token: $setup_token" "$endpoint/api/config?from_db=true" \
  | node -e 'let text=""; process.stdin.on("data",chunk=>text+=chunk); process.stdin.on("end",()=>{const config=JSON.parse(text); if(!config.is_db_connected || config.metadata?.upgrade_probe!=="preserved" || config.metadata?.onboarding_dismissed!==true) process.exit(1);});'
html=$(curl --fail --silent --show-error "$endpoint/login")
grep -q '__bfBootText' <<< "$html"
printf 'Verified %s and persisted configuration from v2.4.0\n' "$expected_version"
