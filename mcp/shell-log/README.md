# shell-log MCP

Official **`mcp`** Python SDK (via **uv**). Captures full command output to `memory/logs/`, then searches it — so agents don’t pipe to grep and discard output.

## Tools

| Tool | Purpose |
|---|---|
| `log_run` | Run a shell command; append full stdout/stderr under `memory/logs/` |
| `log_search` | Regex-search a logfile |
| `log_tail` | Last N lines |
| `log_list` | List logs |

## Setup

```bash
cd mcp/shell-log
uv sync
```

## Run (stdio)

Cursor often has no `uv` on PATH (`spawn uv ENOENT`). Config uses `run.sh`, which prefers `.venv/bin/python`.

```bash
cd mcp/shell-log && uv sync
./run.sh   # stdio MCP
```

Registered in `.mcp.json` / `.cursor/mcp.json` as `shell-log`. Reload MCP after changes.
