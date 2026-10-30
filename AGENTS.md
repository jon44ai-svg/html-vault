# Agent handoff — HTML Vault

Read first: `memory/TASKS.md`, `CONTEXT.md`, `.cursorrules`, `legacy/html-vault-v3.html` (frozen reference until user says delete). Skim `memory/WORKLOG.md` / `memory/QA.md` when resuming.

## Settled (init + grill freeze 2026-10-31)

| Decision | Choice |
|---|---|
| Horizon | Long-term personal tool (phone-first Vault) |
| Now | Finish **T1 behavioral parity** with legacy |
| Next (T3) | PWA + Vercel host Vault shell → then Bundle + JSX/TSX Preview + ZIP; image caps; `.txt` Kind sniff |
| Stack (T1) | Vite + vanilla JS + pnpm; npm deps not CDN |
| Storage | Keep / extend `htmlvault.v1` |
| Parity bar | Behavioral parity |
| Legacy | `legacy/html-vault-v3.html` until user confirms delete |
| Commits | Atomic when practical; remaining T1 logic may be one port commit if splits are unsafe |

Grill detail and parked WebContainer: `memory/QA.md`, `memory/FUTURE.md`.

## Done (T1)

1. gitignore, legacy move, Vite scaffold + audited deps
2. UI shell/styles port — `2ea1a55`
3. App logic port (state → import/export) — see latest commit
4. README + CONTEXT

## Next

1. Complete any remaining T1 smoke; ask before deleting `legacy/`
2. T3: PWA + Vercel, then Bundles/JSX (do not start until T1 closed)

## Guardrails

- Install gate: lockfile-only → `pnpm audit` → install only if clean (`.cursorrules`)
- Maintain `memory/` (tasks / Q&A / worklog)
- pnpm only; no product scope beyond settled tasks without a new grill or task entry
- `CONTEXT.md` = glossary only
