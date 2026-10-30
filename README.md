# HTML Vault

Local, offline multi-file HTML workspace: edit, preview, version, and export in the browser.

## Setup

```bash
pnpm install
pnpm dev
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server |
| `pnpm build` | Production build to `dist/` |
| `pnpm preview` | Serve `dist/` locally |

Do not open the app as `file://` — use `pnpm dev` or `pnpm preview` (or a static host) so modules and storage behave correctly.

## Data

Vault state is stored in **`localStorage`** under the key **`htmlvault.v1`**. Same origin as before keeps existing Files. Domain language: see [`CONTEXT.md`](CONTEXT.md).
