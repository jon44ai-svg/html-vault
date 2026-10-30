# Q&A log (append-only)

Add new entries at the bottom. Do not edit prior answers; if something changes, add a follow-up entry.

---

### 2026-10-30T23:17+02:00 — Install gate before scaffold

**Q (agent):** Presented a manual package table and asked for “approve install” before `pnpm install`.

**A (user):** Continue (treated as proceed). Later clarified the intended audit mechanism (see next).

---

### 2026-10-30T23:22+02:00 — What “install audit” means

**Q (implied):** What counts as the install audit?

**A (user):** The install audit is **`pnpm audit`**, not a free-form package review table.

---

### 2026-10-30T23:26+02:00 — Lockfile vs node_modules order

**Q (implied):** When relative to audit may we install?

**A (user):** Install **lockfile only** before audit. Run **`pnpm install` into `node_modules` only afterwards if audit passes without vulnerabilities.**

---

### 2026-10-30T23:30+02:00 — How far to continue migration

**Q (agent):** Offer to start UI shell port after scaffold.

**A (user):** Yes — continue until everything is migrated (parity + remaining port/docs work).

---

### 2026-10-30T23:33+02:00 — Project memory

**Q (user):** Separate tasks into subtasks; remember which tasks were added, when, and how we aim to fulfill them; keep Q&A; keep an append-only worklog with timestamps and agent notes.

**A (agent):** Introduced `memory/TASKS.md`, `memory/QA.md`, `memory/WORKLOG.md`, plus an always-apply rule so agents maintain them. Seeded from this session. Open confirm: git-track `memory/` vs local-only.

### 2026-10-30T23:39+02:00 — What “projects” means

**Q (agent, implied):** Cross-repo PWA scaffolds for every codebase under `~/code`?

**A (user):** No. **Projects = things inside HTML Vault on the phone.** Workflow: create HTML/JSX in ChatGPT/Gemini apps → **Import** into the Vault → use them reliably (installable/offline-friendly).

---

### 2026-10-30T23:45+02:00 — Grill round 1 answers (phone Vault)

**Q1** Project vs File vs Vault-only PWA → **C** (user: "1yes" = accept recommendation): only the **Vault shell** is the installable PWA; Files stay documents used/previewed inside it.

**Q2** Handle JSX → **C**: JSX as React-ish app entry (React runtime + possibly multiple files).

**Q3** Full stack → **C**: not real backends; meant richer multi-file frontends.

**Q4** Vercel → **A** (user: "4yes"): host the **Vault app** (HTTPS / installable), not deploy each File as its own site.

**Q5** Order → **A**: finish **T1 parity** first, then layer PWA + JSX.


### 2026-10-30T23:50+02:00 — Grill round 2 (partial)

**Q6** Multi-file shape → **A**: introduce a named group of Files that Preview as one app (**Bundle** / **Project** — name still open).

**Q7** JSX Preview runtime → **open**: user asked why avoid in-browser full bundler (WebContainer-class); choice pending after explanation.

**Q8** Import path → **C**: Paste for one-offs; **ZIP Import** as the reliable multi-file path.

**Q9** PWA offline → **C**: shell + stored Vault data + cached React/transpile (or bundler) runtime offline.


### 2026-10-30T23:53+02:00 — Grill round 2b / UX note

**Q7** Preview runtime → **A** (iframe + JSX transform + React, cache offline). **C** (WebContainer-class bundler) parked for later if user asks about **future plans**.

**Q10** Group noun → **A) Bundle**.

**Q11** Entry → **C**: convention with override.

**UX (user):** If a File does not fit Entry/Kind convention, **explain why** and let the user **choose Kind (and Entry) manually** — do not fail silently.


### 2026-10-30T23:57+02:00 — Grill round 3

**Q12** Bundle Kinds (v1) → **C + json**: `html`, `jsx`, `css`, `js`, `json`, plus **images** (data-URL or file bytes in Vault).

**Q13** Version scope → **A** (user: "yes"): Versions/Checkpoints stay **per File**; Bundle is grouping + Entry only.

**Q14** Persistence → **A**: extend **`htmlvault.v1`** in place (Bundles additive); don’t strand phone data.

**Q15** Post-T1 order → **A**: **PWA + Vercel** first, then Bundle/JSX/ZIP reliability.


### 2026-10-31T00:00+02:00 — Grill round 4 (freeze)

**Q16** Images → **A**: allow with **caps** (per-image / per-Bundle); refuse Import with a clear reason.

**Q17** TSX → **B**: treat like JSX in Preview (strip types / transpile); not full TS.

**UX (user):** AI often exports as **`.txt`** — detect Kind by **parsing content**, not extension alone; if unsure, explain + manual Kind (same convention-miss path).

**Q18** → **A**: **shared understanding frozen** (summary in prior agent message).


### 2026-10-31T00:08+02:00 — Smoke + branch workflow

**Q (user):** Smoke passed; continue. For the future, don’t wait for manual smoke — work on a different branch.

**A (agent):** Recorded in `.cursorrules`. T1 smoke marked passed; continue T3 on branch `feat/t3-pwa-vercel` (PWA + Vercel first). Legacy delete still needs explicit user OK.

---

### 2026-10-31T00:12+02:00 — Log-then-grep

**Q (user):** Instead of grepping command output, put it in a log file and grep that so output isn’t discarded.

**A (agent):** Added to `.cursorrules` workflow.

---

### 2026-10-31T00:26+02:00 — shell-log MCP via uv

**Q (user):** Switch shell-log MCP to official `mcp` via uv (not stdlib-only).

**A (agent):** `mcp/shell-log` is a uv project with `mcp>=2.3.0` (`MCPServer`); `.mcp.json` launches via `uv run`. Tools unchanged: `log_run` / `log_search` / `log_tail` / `log_list`.

---
