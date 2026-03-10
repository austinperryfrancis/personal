#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-4173}"
OPEN_BROWSER=0

for arg in "$@"; do
  case "$arg" in
    --open)
      OPEN_BROWSER=1
      ;;
    --host=*)
      HOST="${arg#--host=}"
      ;;
    --port=*)
      PORT="${arg#--port=}"
      ;;
    *)
      echo "Usage: ./serve.sh [--open] [--host=127.0.0.1] [--port=4173]" >&2
      exit 1
      ;;
  esac
done

URL="http://${HOST}:${PORT}/"

echo "Serving /Users/austinfrancis/personal_website at ${URL}"
echo "Press Ctrl+C to stop."

if [[ "$OPEN_BROWSER" -eq 1 ]]; then
  (
    sleep 1
    open "$URL"
  ) &
fi

cd "$ROOT_DIR"
exec python3 -m http.server "$PORT" --bind "$HOST"
