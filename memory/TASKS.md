# Tasks

Each task records **added by**, **added at**, **aim** (how we plan to fulfill it), and **subtasks**.

Status: `todo` | `doing` | `blocked` | `done` | `dropped`

---

## T1 — Vite lift-and-shift (behavioral parity)

| Field | Value |
|---|---|
| Status | `done` |
| Added by | user (grilled init → `AGENTS.md` handoff) |
| Added at | 2026-10-30 |
| Aim | Port legacy Vault to Vite + pnpm with behavioral parity. |

### Subtasks

- [x] Scaffold, UI shell, behavior port, docs
- [x] Manual smoke passed (2026-10-31)
- [ ] Ask before deleting `legacy/` (still pending user OK)

---

## T2 — Project memory

| Field | Value |
|---|---|
| Status | `done` |
| Added by | user |
| Added at | 2026-10-30T23:33+02:00 |
| Aim | Durable tasks / Q&A / worklog. |

### Subtasks

- [x] memory/ + rule + git-tracked

---

## T3 — Phone Vault: Bundle + PWA + JSX

| Field | Value |
|---|---|
| Status | `doing` |
| Added by | user |
| Added at | 2026-10-30T23:36+02:00 |
| Aim | Vault-shell PWA on Vercel; then Bundles + JSX/TSX Preview + ZIP; image caps; `.txt` Kind sniff. |

### Subtasks

- [x] Grill frozen
- [x] deepmerge patch + vite-plugin-pwa (branch `feat/t3-pwa-vercel`)
- [x] PWA manifest/SW + vercel.json; `pnpm build` emits sw + webmanifest
- [x] shell-log MCP (uv)
- [ ] Deploy / link Vercel project and verify phone install
- [ ] Bundle model + JSX/TSX Preview + ZIP; image caps; `.txt` sniff
- [ ] Convention-miss UX

---

## T4 — shell-log MCP

| Field | Value |
|---|---|
| Status | `done` |
| Added by | user |
| Added at | 2026-10-31T00:20+02:00 |
| Aim | MCP to log command output and search logs (uv + official mcp). |

### Subtasks

- [x] Server + run.sh PATH fix + committed

---

## Backlog

_None._
