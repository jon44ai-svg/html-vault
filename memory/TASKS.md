# Tasks

Each task records **added by**, **added at**, **aim** (how we plan to fulfill it), and **subtasks**.

Status: `todo` | `doing` | `blocked` | `done` | `dropped`

---

## T1 — Vite lift-and-shift (behavioral parity)

| Field | Value |
|---|---|
| Status | `doing` |
| Added by | user (grilled init → `AGENTS.md` handoff) |
| Added at | 2026-10-30 (session; formalized in handoff before memory/) |
| Aim | Port `legacy/html-vault-v3.html` into Vite + vanilla JS + pnpm with **behavioral parity**, atomic commits, npm deps (not CDN). Docs after parity. Delete `legacy/` only after user confirms. |

### Subtasks

- [x] `chore: add gitignore for Vite/node` — `12b91af`
- [x] `chore: move monolith to legacy/html-vault-v3.html` — `a490abd`
- [x] Install gate: lockfile-only → `pnpm audit` (clean) → `pnpm install`
- [x] `chore: scaffold Vite + pnpm (vanilla JS)` — `de41551` (deps folded in)
- [x] `feat: port UI shell and styles from legacy` — `2ea1a55`
- [ ] `feat: port Vault state, persistence, and file list`
- [ ] `feat: port editor, preview, compile, and history`
- [ ] `feat: port import/export and clipboard flows`
- [ ] `docs: minimal README (dev/build) + track CONTEXT.md`
- [ ] Smoke: new/edit/preview/compile/checkpoint/history/import/export/theme
- [ ] Ask before deleting `legacy/`

**Note (2026-10-30):** Working tree has an uncommitted full `src/main.js` port (~994 lines, `pnpm build` succeeded) started while finishing remaining feat commits; not yet split/committed atomically.

---

## T2 — Project memory (tasks / Q&A / worklog)

| Field | Value |
|---|---|
| Status | `doing` |
| Added by | user |
| Added at | 2026-10-30T23:33+02:00 |
| Aim | Keep durable, agent-updated records of tasks (with provenance), Q&A, and an append-only worklog so sessions continue without re-deriving history. |

### Subtasks

- [x] Create `memory/` layout + seed from this chat
- [x] Add always-apply Cursor rule to maintain memory
- [x] Point `AGENTS.md` / `.cursorrules` at memory
- [ ] Confirm with user: track `memory/` in git (recommended) vs local-only
- [ ] After first review, mark T2 `done` if structure accepted

---


---

## T3 — Phone Vault: JSX + PWA + reliable AI imports (grilling)

| Field | Value |
|---|---|
| Status | `todo` |
| Added by | user |
| Added at | 2026-10-30T23:36+02:00 |
| Aim | After grill + T1 parity: Vault-shell PWA on Vercel; Import AI HTML/JSX; JSX as React-ish (multi-file frontends OK, no real backends). **Not** per-File installs or cross-repo scaffolds. Multi-file model still being grilled. |

### Subtasks

- [x] Grill rounds 1–2: Vault-shell PWA, Vercel hosts Vault, Bundle + JSX React-ish, T1 first
- [x] Update CONTEXT.md (Bundle, Entry, Kind)
- [x] Finish grill → shared understanding frozen (2026-10-31)
- [ ] Blocked on **T1 parity** before any T3 implementation
- [ ] Then: PWA + Vercel host
- [ ] Then: Bundle + JSX/TSX Preview + ZIP; image caps; `.txt` content-sniff Kind
- [ ] Convention miss UX: explain why + manual Kind/Entry choice
- [ ] Parked: WebContainer Preview — see `memory/FUTURE.md`

## Backlog (not started)

_None yet. New user-asked work gets a new `T#` here with provenance before execution._
