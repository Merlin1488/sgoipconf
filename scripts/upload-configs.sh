#!/bin/bash
#
# upload-configs.sh — залить все .conf файлы из Asterisk в Cloudflare
#
# Использование:
#   ./scripts/upload-configs.sh <server-id> <auth-token> [asterisk-dir] [worker-url]
#
# Пример:
#   ./scripts/upload-configs.sh pbx-01 my-secret-token /etc/asterisk https://config.sgoip.com
#

set -e

SERVER_ID="${1:?Укажи server-id: ./upload-configs.sh <server-id> <token>}"
AUTH_TOKEN="${2:?Укажи auth token}"
ASTERISK_DIR="${3:-/etc/asterisk}"
WORKER_URL="${4:-https://config.sgoip.com}"

if [ ! -d "$ASTERISK_DIR" ]; then
  echo "Директория $ASTERISK_DIR не найдена"
  exit 1
fi

echo "=== Uploading configs from $ASTERISK_DIR for server $SERVER_ID ==="
echo "    Worker: $WORKER_URL"
echo ""

UPLOADED=()

for conf_file in "$ASTERISK_DIR"/*.conf; do
  [ -f "$conf_file" ] || continue

  filename=$(basename "$conf_file")
  config_type="${filename%.conf}"

  content=$(cat "$conf_file")

  echo -n "  $filename -> $config_type ... "

  # Escape content for JSON
  json_content=$(printf '%s' "$content" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')

  response=$(curl -s -w "\n%{http_code}" -X PUT \
    "$WORKER_URL/config/$SERVER_ID/$config_type" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"content\": $json_content}")

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -n -1)

  if [ "$http_code" = "200" ]; then
    version=$(echo "$body" | python3 -c 'import sys,json; print(json.loads(sys.stdin.read())["data"]["version"])' 2>/dev/null || echo "?")
    echo "OK (v$version)"
    UPLOADED+=("$config_type")
  else
    echo "FAIL ($http_code)"
    echo "    $body"
  fi
done

echo ""

if [ ${#UPLOADED[@]} -eq 0 ]; then
  echo "Ничего не загружено."
  exit 1
fi

# Назначить все загруженные конфиги серверу
configs_json=$(printf '%s\n' "${UPLOADED[@]}" | python3 -c 'import sys,json; print(json.dumps([l.strip() for l in sys.stdin]))')

echo "=== Assigning ${#UPLOADED[@]} configs to $SERVER_ID ==="
echo "    $configs_json"

response=$(curl -s -w "\n%{http_code}" -X PUT \
  "$WORKER_URL/assignment/$SERVER_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"configs\": $configs_json}")

http_code=$(echo "$response" | tail -1)

if [ "$http_code" = "200" ]; then
  echo "    OK"
else
  echo "    FAIL ($http_code)"
  echo "    $(echo "$response" | head -n -1)"
fi

echo ""
echo "Done! ${#UPLOADED[@]} configs uploaded."
