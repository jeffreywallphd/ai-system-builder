#!/usr/bin/env bash
set -euo pipefail

export PYTHON_RUNTIME_MODE="${PYTHON_RUNTIME_MODE:-local-http}"
export PYTHON_RUNTIME_BASE_URL="${PYTHON_RUNTIME_BASE_URL:-http://localhost:8100}"
export MCP_RUNTIME_ENABLED="${MCP_RUNTIME_ENABLED:-true}"

cd /app/python-runtime
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8100 &
RUNTIME_PID=$!

cleanup() {
  kill "$RUNTIME_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd /app
npm run dev -- --host 0.0.0.0 --port 4173
