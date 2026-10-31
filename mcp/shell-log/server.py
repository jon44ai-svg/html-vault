"""MCP server (official `mcp` SDK via uv): log shell output, then search it."""

from __future__ import annotations

import asyncio
import os
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from mcp.server.mcpserver import MCPServer

mcp = MCPServer(
    "shell-log",
    version="0.1.0",
    instructions=(
        "Use log_run to capture full command output to memory/logs/, then "
        "log_search / log_tail on that file. Do not pipe live commands to grep."
    ),
)


def repo_root() -> Path:
    env = os.environ.get("SHELL_LOG_ROOT")
    if env:
        return Path(env).resolve()
    return Path(__file__).resolve().parents[2]


def logs_dir() -> Path:
    path = repo_root() / "memory" / "logs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def resolve_log(name: str | None) -> Path:
    base = logs_dir()
    if not name:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        return base / f"run-{stamp}.log"
    p = Path(name)
    if p.is_absolute():
        resolved = p.resolve()
        if base not in resolved.parents and resolved.parent != base:
            raise ValueError(f"log path must be under {base}")
        return resolved
    if name.startswith("memory/logs/"):
        return (repo_root() / name).resolve()
    return (base / Path(name).name).resolve()


def rel_to_repo(path: Path) -> str:
    try:
        return str(path.relative_to(repo_root()))
    except ValueError:
        return str(path)


@mcp.tool()
def log_run(
    command: str,
    log: str | None = None,
    cwd: str | None = None,
    timeout_sec: float | None = None,
) -> str:
    """Run a shell command; append full stdout/stderr to a logfile under memory/logs/.

    Prefer this over piping to grep so output is not discarded. Returns log path,
    exit code, and a short tail — use log_search for full-file search.
    """
    log_path = resolve_log(log)
    workdir = Path(cwd).resolve() if cwd else repo_root()
    started = datetime.now(timezone.utc).isoformat()
    header = f"=== {started} ===\ncwd: {workdir}\ncommand: {command}\n---\n"
    t0 = time.monotonic()
    try:
        proc = subprocess.run(
            ["bash", "-lc", command],
            cwd=str(workdir),
            capture_output=True,
            text=True,
            timeout=None if timeout_sec is None else float(timeout_sec),
        )
        body = proc.stdout or ""
        if proc.stderr:
            body = body + ("\n" if body and not body.endswith("\n") else "") + proc.stderr
        exit_code = proc.returncode
    except subprocess.TimeoutExpired as exc:
        out = exc.stdout or ""
        err = exc.stderr or ""
        if isinstance(out, bytes):
            out = out.decode("utf-8", "replace")
        if isinstance(err, bytes):
            err = err.decode("utf-8", "replace")
        body = f"{out}\n{err}\n[timeout after {timeout_sec}s]\n"
        exit_code = 124

    elapsed = time.monotonic() - t0
    footer = f"\n---\nEXIT:{exit_code} elapsed_sec:{elapsed:.3f}\n"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as fh:
        fh.write(header)
        fh.write(body)
        if body and not body.endswith("\n"):
            fh.write("\n")
        fh.write(footer)

    lines = body.splitlines()
    tail = "\n".join(lines[-20:])
    return (
        f"log: {rel_to_repo(log_path)}\n"
        f"exit: {exit_code}\n"
        f"elapsed_sec: {elapsed:.3f}\n"
        f"tail (last {min(20, len(lines))} lines):\n{tail}"
    )


@mcp.tool()
def log_search(
    log: str,
    pattern: str,
    ignore_case: bool = False,
    max_matches: int = 100,
) -> str:
    """Regex-search a logfile (Python re). Returns matching lines with 1-based numbers."""
    log_path = resolve_log(log)
    if not log_path.is_file():
        raise FileNotFoundError(f"log not found: {log_path}")
    flags = re.I if ignore_case else 0
    rx = re.compile(pattern, flags)
    matches: list[str] = []
    with log_path.open("r", encoding="utf-8", errors="replace") as fh:
        for i, line in enumerate(fh, 1):
            if rx.search(line):
                matches.append(f"{i}: {line.rstrip(chr(10))}")
                if len(matches) >= max_matches:
                    break
    rel = rel_to_repo(log_path)
    if not matches:
        return f"log: {rel}\nmatches: 0"
    capped = f" (capped at {max_matches})" if len(matches) >= max_matches else ""
    return f"log: {rel}\nmatches: {len(matches)}{capped}\n" + "\n".join(matches)


@mcp.tool()
def log_tail(log: str, lines: int = 40) -> str:
    """Return the last N lines of a logfile."""
    log_path = resolve_log(log)
    if not log_path.is_file():
        raise FileNotFoundError(f"log not found: {log_path}")
    all_lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
    tail = all_lines[-lines:]
    return f"log: {rel_to_repo(log_path)}\nlines: {len(tail)} of {len(all_lines)}\n" + "\n".join(
        tail
    )


@mcp.tool()
def log_list() -> str:
    """List log files in memory/logs/ (newest first)."""
    files = sorted(logs_dir().glob("*.log"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not files:
        return f"No logs in {rel_to_repo(logs_dir())}"
    rows: list[str] = []
    for path in files:
        st = path.stat()
        mtime = datetime.fromtimestamp(st.st_mtime, timezone.utc).isoformat()
        rows.append(f"{rel_to_repo(path)}  {st.st_size}B  {mtime}")
    return "\n".join(rows)


def main() -> None:
    asyncio.run(mcp.run_stdio_async())


if __name__ == "__main__":
    main()
