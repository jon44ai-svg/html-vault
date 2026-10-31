# Worklog (append-only)

Newest entries at the **bottom**. Format:

```
## YYYY-MM-DDTHH:MM±ZZ:ZZ — short title
- notes…
```

---

## 2026-10-30T23:11+02:00 — Prior commits (handoff baseline)

- `12b91af` gitignore for Vite/node
- `a490abd` monolith moved to `legacy/html-vault-v3.html`
- Scaffold files existed uncommitted; install blocked on audit gate

## 2026-10-30T23:17+02:00 — User: commit and continue

- Agent presented package table; waited on install approval per then-current `.cursorrules`

## 2026-10-30T23:22+02:00 — User: continue; then “install audit is pnpm audit”

- Corrected gate: audit = `pnpm audit`
- Updated `.cursorrules` + `AGENTS.md`

## 2026-10-30T23:26+02:00 — User: lockfile-only before audit; install only if clean

- Gate order locked: purpose blurb → `--lockfile-only` → `pnpm audit` → `pnpm install` only if no vulns
- Ran `pnpm add --lockfile-only bootstrap bootstrap-icons jszip file-saver`
- **`pnpm audit`:** No known vulnerabilities found
- Then `pnpm install`; `pnpm approve-builds --all` for esbuild (Vite)
- Commit `de41551` scaffold (deps folded; `pnpm-workspace.yaml` allowBuilds esbuild)

## 2026-10-30T23:30+02:00 — User: continue until everything migrated

- Started port sequence
- Commit `2ea1a55` UI shell + styles (Bootstrap CSS/icons via imports)
- Generated full module `src/main.js` from legacy (JSZip + file-saver imports); **`pnpm build` succeeded**
- Attempted to split remaining logic into atomic commits via temp v2/v3/v4 snapshots; interrupted by user for memory work
- **Working tree:** `src/main.js` modified (full port, uncommitted); remaining feat commits + docs still open on T1

## 2026-10-30T23:33+02:00 — User: project memory (tasks / Q&A / worklog)

- Created `memory/` (TASKS, QA, WORKLOG, README)
- Seeded T1 (migration) and T2 (this memory system) with provenance
- Logged Q&A from this session
- Added Cursor always-apply rule + pointers in AGENTS / `.cursorrules`

## 2026-10-30T23:34+02:00 — Progressive main.js split check (background)
- `node --check` on /tmp/main-v{2,3,4}.js: all exit 0 (syntax OK)
- v2 still references removed helpers (`log`/`describe`/`importFiles`/`scheduleSave`/`commit`, etc.) — mechanical strip is incomplete; prefer committing the full working `src/main.js` in ordered feat commits with honest content, or rewrite intermediates carefully before using those snapshots

## 2026-10-30T23:39+02:00 — Clarified: in-Vault “projects”, not code repos
- User corrected “each project of mine”: means Vault contents on phone, AI-authored HTML/JSX imported for reliable use
- Cross-repo PWA-scaffold branch closed for this ask
- Grill continues; no product changes until shared understanding

## 2026-10-30T23:45+02:00 — Grill round 1 settled

- Vault-shell PWA only; Vercel hosts Vault; no per-File public deploys
- JSX = React-ish (runtime + maybe multi-file); "full stack" = multi-file frontends, not backends
- T1 parity before PWA/JSX work
- Open tension: Q1=C (flat Files) vs Q2/Q3 (multi-file React apps) — next grill round


## 2026-10-30T23:50+02:00 — Grill round 2 answers

- Bundle/Project grouping chosen (Q6=A); ZIP = reliable multi-file import; PWA fully offline incl. runtime
- Explaining WebContainer-class Preview costs before locking Q7


## 2026-10-30T23:53+02:00 — Bundle named; CONTEXT updated

- Q7=A; WebContainer (C) remembered as future-only
- Q10=Bundle; Q11=convention+override; convention-miss must explain + manual Kind/Entry
- CONTEXT.md: Bundle, Entry, Kind; File/Vault/Import/Export sharpened


## 2026-10-30T23:57+02:00 — Grill round 3 settled

- Kinds: html/jsx/css/js/json + images; Versions per-File; htmlvault.v1 extended; PWA/Vercel before Bundle/JSX
- Next: image quota / formats; TSX?; confirm shared understanding


## 2026-10-31T00:00+02:00 — Grill frozen; resume T1

- Design tree settled (Bundle/PWA/JSX/Vercel/order). Implementation of T3 waits until T1 parity done.
- Extra rule: `.txt` Imports → content-sniff Kind; ambiguous → explain + manual choice.
- Next action: finish T1 remaining feat commits + docs from uncommitted full `src/main.js`.


## 2026-10-31T00:05+02:00 — T1 port + docs committed; grill frozen

- Shared understanding frozen (Q16=A caps, Q17=B TSX-as-JSX, `.txt` content-sniff, Q18=A)
- `336ee26` full Vault behavior port; `ef7f853` README/CONTEXT/memory
- T1 left: manual smoke + legacy delete ask
- T3 not started until T1 closed


## 2026-10-31T00:26+02:00 — shell-log MCP on official SDK
- Replaced hand-rolled stdio with `mcp` 2.x `MCPServer` via uv
- Smoke: log_run/search OK; reload Cursor MCP to pick up server

## 2026-10-31T00:29+02:00 — Commits + PWA build green

- Branch `feat/t3-pwa-vercel`: patch, PWA, MCP, docs commits; then workbox-window fix
- `pnpm build` OK: dist/sw.js + manifest.webmanifest
- Next: Vercel deploy/link; then Bundle/JSX. Still need user OK to delete legacy/


## 2026-10-31T00:30+02:00 — Vercel deploy blocked on team auth
- MCP get_auth_user OK; list_projects 403 — need authorize_team_access for team_qsPbAWYLrRYwR3vHjdVzBewr
- PWA build green on feat/t3-pwa-vercel; awaiting user approve + then create project/deploy

## 2026-10-31T22:43+02:00 — Resume handoff; prod deploy Ready
- User: read `/tmp/html-vault-handoff.md`; Vercel CLI fixed; priority deploy then Bundle/JSX
- Restored `.vercel` link to jon44ai project `prj_YmCvkLfJcSD0cz4kqkrNC58EZwFN` (wrong local link pointed at unauthorized team)
- Prior ERROR: empty upload (0 files) then `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` (Vercel pnpm 10 vs local 11 + workspace patchedDependencies)
- Fix: `packageManager: pnpm@11.9.0` in package.json
- Prod Ready: https://html-vault-psi.vercel.app (alias); inspect `dpl_39XwaijRkNHdLHTLBZRjKjmY5VRW`; index/manifest/sw HTTP 200
- Branch `feat/t3-bundle` has untracked Phase 1/2 modules; monolith `main.js` still live — next: wire thin main + DOM + react/sucrase

## 2026-10-31T22:46+02:00 — JSX deps via install gate
- Purpose: `react`/`react-dom` (Preview iframe runtime); `sucrase` (JSX/TSX transform)
- Lockfile-only add; audit had 2 moderate (glob/minimatch via workbox-build)
- User: `pnpm audit --fix override` (not hand overrides); plain `pnpm`
- Audit clean (1 low ignored); `pnpm install` landed react 19.3.1, react-dom 19.3.1, sucrase 3.35.1
- Next: thin `main.js` + Bundle/Kind DOM hooks

## 2026-10-31T22:50+02:00 — Bundle modules wired + redeployed
- Thin `main.js` binds modules; index: Files|Bundles, Kind miss modal, dlBundle, wider Import accept
- `pnpm build` green; prod Ready again at https://html-vault-psi.vercel.app (`dpl_CRYitmtMN4izsTVqPSTyLAZsMZQC`)
- Uncommitted: modules, packageManager pin, audit overrides, Bundle wiring
- Pending: phone A2HS smoke; user commit
