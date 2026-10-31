# Agent handoff — HTML Vault

Read first: `memory/TASKS.md`, `CONTEXT.md`, `.cursorrules`. Skim `memory/WORKLOG.md` / `memory/QA.md` when resuming.

## Settled (init + grill freeze 2026-10-31)

| Decision | Choice |
|---|---|
| Horizon | Long-term personal tool (phone-first Vault) |
| Now | **T3** Bundle + JSX/TSX Preview (PWA shell live on Vercel) |
| Stack (T1) | Vite + vanilla JS + pnpm; npm deps not CDN |
| Storage | Keep / extend `htmlvault.v1` |
| Parity bar | Behavioral parity (T1 done) |
| Legacy | Removed after parity (`baadde3`) |
| Host | Vercel project `html-vault` — https://html-vault-psi.vercel.app |
| Commits | Atomic when practical |

Grill detail and parked WebContainer: `memory/QA.md`, `memory/FUTURE.md`. Bundle contracts: `memory/contracts-t3-bundle.md`.

## Done

1. T1 Vite parity + smoke; legacy removed
2. T3 PWA (`vite-plugin-pwa`) + prod deploy (pnpm@11.9.0 pin)
3. shell-log MCP; deepmerge patch + audit ignore

## Next

1. Wire `feat/t3-bundle` modules into thin `main.js` + DOM (Files\|Bundles, Kind miss, JSX deps)
2. Phone Add-to-Home-Screen smoke on production URL
3. Merge `feat/t3-pwa-vercel` / Bundle branch → `main` when smoke OK

## Guardrails

- Install gate: lockfile-only → `pnpm audit` → install only if clean (`.cursorrules`)
- Maintain `memory/` (tasks / Q&A / worklog)
- pnpm only; no product scope beyond settled tasks without a new grill or task entry
- `CONTEXT.md` = glossary only
- Vercel link: `.vercel/project.json` → jon44ai team `team_qsPbAWYLrRYwR3vHjdVzBewr` / `prj_YmCvkLfJcSD0cz4kqkrNC58EZwFN`
