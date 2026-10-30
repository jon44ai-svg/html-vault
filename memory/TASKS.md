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
| Aim | Port `legacy/html-vault-v3.html` into Vite + vanilla JS + pnpm with **behavioral parity**. Docs after parity. Delete `legacy/` only after user confirms. |

### Subtasks

- [x] `chore: add gitignore for Vite/node` — `12b91af`
- [x] `chore: move monolith to legacy/html-vault-v3.html` — `a490abd`
- [x] Install gate: lockfile-only → `pnpm audit` (clean) → `pnpm install`
- [x] `chore: scaffold Vite + pnpm (vanilla JS)` — `de41551`
- [x] `feat: port UI shell and styles from legacy` — `2ea1a55`
- [x] `feat: port Vault behavior from legacy` (state→import/export folded) — `336ee26`
- [x] `docs: README, domain glossary, and project memory` — `ef7f853`
- [ ] Manual smoke: new/edit/preview/compile/checkpoint/history/import/export/theme
- [ ] Ask before deleting `legacy/`

---

## T2 — Project memory (tasks / Q&A / worklog)

| Field | Value |
|---|---|
| Status | `done` |
| Added by | user |
| Added at | 2026-10-30T23:33+02:00 |
| Aim | Durable agent-updated tasks (provenance), Q&A, append-only worklog. |

### Subtasks

- [x] Create `memory/` + always-apply rule
- [x] Track in git (included in `ef7f853`)

---

## T3 — Phone Vault: Bundle + PWA + JSX (post-T1)

| Field | Value |
|---|---|
| Status | `todo` |
| Added by | user |
| Added at | 2026-10-30T23:36+02:00 |
| Aim | After T1: Vault-shell PWA on Vercel; Bundles; JSX/TSX Preview (transform+React); ZIP Import; image caps; `.txt` content-sniff Kind; convention-miss explain + manual Kind/Entry. Not per-Bundle install. WebContainer parked in FUTURE.md. |

### Subtasks

- [x] Grill frozen 2026-10-31 (see `memory/QA.md`)
- [ ] Wait for T1 smoke + legacy decision
- [ ] PWA + Vercel host
- [ ] Bundle model + JSX/TSX Preview + ZIP; image caps; `.txt` sniff
- [ ] Convention-miss UX

---

## Backlog (not started)

_None._
