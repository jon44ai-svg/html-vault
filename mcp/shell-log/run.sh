#!/usr/bin/env bash
# MCP entrypoint: prefer project venv, else uv (absolute mise path fallback).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export SHELL_LOG_ROOT="${SHELL_LOG_ROOT:-$(cd "$ROOT/../.." && pwd)}"

if [[ -x "$ROOT/.venv/bin/python" ]]; then
  exec "$ROOT/.venv/bin/python" "$ROOT/server.py"
fi

UV=""
if command -v uv >/dev/null 2>&1; then
  UV="$(command -v uv)"
elif [[ -x "${HOME}/.local/share/mise/installs/uv/latest/uv-x86_64-unknown-linux-musl/uv" ]]; then
  UV="${HOME}/.local/share/mise/installs/uv/latest/uv-x86_64-unknown-linux-musl/uv"
elif [[ -x "${HOME}/.local/bin/uv" ]]; then
  UV="${HOME}/.local/bin/uv"
else
  echo "shell-log MCP: uv not found and .venv missing; run: cd mcp/shell-log && uv sync" >&2
  exit 127
fi

exec "$UV" run --directory "$ROOT" python server.py
