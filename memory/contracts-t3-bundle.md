# T3 Bundle — shared contracts (Phase 1 + Phase 2)

Single interface doc for agents on `feat/t3-bundle`. Phase 1 lands module seams only (behavior-identical). Phase 2 extends APIs noted below; do not invent parallel shapes.

Storage key remains **`htmlvault.v1`** (extend in place).

---

## Module map (Phase 1)

| Module | Owns | Must not |
|---|---|---|
| `src/util.js` | `$`, `esc`, `cleanName`, `makeId`, `timestamp`, `sizeText`, `describe`, `VOID`, `RAW` | DOM events, state mutation |
| `src/state.js` | `KEY`, `defaultState`, `normalizeState`, `loadState`/`saveState`, `getState`/`setState`, `files`, `activeFile` | Preview, ZIP, UI lists |
| `src/files.js` | add/rename/dup/delete, versions/`commit`/`pushVersion`, `uniqueName`, editor sync (`syncEditor`/`flushEditor`/`scheduleSave`), `selectFile`/`createFile` | Import ZIP parsing, Preview iframe |
| `src/preview.js` | `buildPreview`, `renderPreview`, `validateHTML`, `compile`, `formatHTML`, preview console token / bridge | State schema, Bundle UI |
| `src/io.js` | Import, ZIP export, download, paste/clipboard/split-docs | Kind sniff (Phase 2 A), image caps (Phase 2 D beyond current) |
| `src/ui.js` | toast, modals, lists, logs, `renderAll` / `renderList` / `setMobileView`, history UI helpers | Storage schema changes |
| `src/main.js` | CSS/PWA bootstrap, DOM event wiring, startup | Business logic bodies |

**Conflict ownership (Phase 2):** A = `state.js` + new `kind.js`; B = offcanvas/sidebar + list rendering in `ui.js` / `index.html`; C = Preview APIs in `preview.js` + Vite/PWA deps only; D = `io.js` import/export. Parent merges if two agents touch `main.js` wiring.

---

## Phase 1 exports (behavior-identical)

### `util.js`

```js
export const $, esc, cleanName, makeId, timestamp, sizeText, describe, VOID, RAW
```

### `state.js`

```js
export const KEY = 'htmlvault.v1'
export function getState() / setState(next)
export function defaultState()
export function normalizeState(value)   // Phase 1: files/order/activeId/theme only
export function loadState()
export function saveState()             // may call bound ui hooks (log/toast)
export function files()
export function activeFile()
export function bindStateUi({ log, toast })  // break cycle with ui.js
```

**Phase 1 File shape (unchanged):**

```ts
{ id, name, content, created, updated, versions: [{ ts, note, content }] }
```

**Phase 1 Vault shape:**

```ts
{ files: Record<id, File>, order: string[], activeId: string | null, theme: 'light' | 'dark' }
```

### `files.js`

```js
export function uniqueName(name)
export function pushVersion(file, note, force?)
export function commit(file, note, force?)
export function addFile(name, content, note)
export function createFile()
export function selectFile(id)
export function deleteFile(id)
export function duplicateFile(id)
export function renameActiveOrId(/* via ui rename flow */)
export function syncEditor(note?)
export function flushEditor()
export function scheduleSave()
export function bindFilesUi(hooks)  // renderAll, toast, setMobileView, editor el, askConfirm, …
```

### `preview.js`

```js
export function getPreviewToken()
export function buildPreview(source)           // HTML srcdoc + console bridge
export function buildJsxPreview(source)        // Phase 2 C: Sucrase strip-types/JSX → React iframe
export function resolvePreviewKind(file)       // Phase 2 C: File.kind or light sniff (not kind.js)
export function renderPreview()                // HTML | JSX | unsupported Kind notice
export function validateHTML(source)
export function validateJsx(source)            // Phase 2 C: transform smoke + mount heuristics
export function compile()                      // branches HTML vs JSX validation
export function formatHTML(source)
export function bindPreviewUi(hooks)  // frame, flushEditor, log, toast, showResults, setMobileView, …
```

**Preview runtime (Phase 2 C):** `src/preview-runtime.js` re-exports `React` + `createRoot` for the sandboxed iframe via `?url` (absolute module URL). Transform runs in the Vault shell with **sucrase** (`typescript` + classic `jsx`). HTML path unchanged. Do not put Bundle fields in `normalizeState` here (A owns state).

### `io.js`

```js
export const IMAGE_MAX_BYTES = 512 * 1024          // Phase 2 D
export const BUNDLE_IMAGES_MAX_BYTES = 2 * 1024 * 1024
export function contentByteSize(content)           // data URL → decoded bytes
export function download(content, filename, type?)
export function exportCurrent()
export function exportBundle(bundleId?)            // active Bundle ZIP (sources only)
export function exportZip()                        // full Vault + history + bundles.json
export function importFiles(fileList)              // accept list + ZIP→Bundle + image caps
export function copyText(text)
export function readClipboardText(mode?)
export function insertIntoEditor(text, mode)
export function splitDocuments(text)
export function splitPastePrompt(text)
export function insertFromClipboard(mode)
export function pasteNew()
export function bindIoUi(hooks)
```

**Phase 2 D (IO) behavior:**

- Import accept: `html/htm/xhtml/txt/jsx/tsx/css/js/json` + images + zip (`#importInput`).
- Multi-file project ZIP (no root `history.json`) → `createBundle(zipStem, fileIds)` after members land; Vault backups (`history.json`) stay loose Files.
- Image caps: refuse with toast — 512 KiB/image; 2 MiB images/Bundle (ZIP members). Documented in `#aboutModal`.
- Export: `#dlCurrent` / `#dlBundle` / `#dlZip`. Images stored as data URLs; ZIP writes decoded binary.
- Menu: `#dlBundle` Export active Bundle.

### `ui.js`

```js
export function toast(message, type?)
export function log(type, message, details?)
export function renderLogs()
export function copyLogs()
export function showModal(selector) / hideModal(selector)
export function askConfirm(title, message, label, callback)
export function renderList()
export function renderAll()
export function setMobileView(mode)  // 'edit' | 'preview'
export function showResults(results)
export function openHistory()
export function updateSearch(value)
export function getFilter() / setRenameId / getConfirmCallback …
// plus bindUiCore for editor/bootstrap and wiring helpers used by main
```

### `main.js`

- Import CSS + `registerSW`
- Call bind helpers once
- Attach all `#…` listeners (keep existing DOM ids)
- `state = loadState()` → theme → `renderAll` / `renderLogs` / `setMobileView('edit')` / optional `renderPreview`

---

## Phase 2 state + Kind (Subagent A — landed)

Additive `normalizeState` defaults so old phone data loads; never drop existing Files.

```ts
type Kind = 'html' | 'jsx' | 'css' | 'js' | 'json' | 'image'

type Bundle = {
  id: string
  name: string
  fileIds: string[]
  entryId: string | null
  created: number
  updated: number
}

// Vault (htmlvault.v1):
{
  files: Record<id, File & { kind: Kind }>  // inferred on Import/normalize/add
  order: string[]
  activeId: string | null
  theme: 'light' | 'dark'
  bundles: Record<id, Bundle>
  bundleOrder: string[]
  activeBundleId: string | null
}
```

- Versions stay **per File**.
- Loose Files remain valid; a Bundle references File ids.
- `src/kind.js` + `#kindMissModal` (mobile `modal-fullscreen-sm-down`).

### `kind.js` exports (A)

```js
export const KINDS, ENTRY_NAMES
export function isValidKind(value)
export function isEntryName(name)
export function guessEntryId(fileIds, filesMap)
export function sniffKind(name, content)      // { kind, ambiguous, reason }
export function resolveKind(name, content, stored?)  // always a Kind (normalize / silent)
export function ensureFileKind(file, { prompt, bundleId }?)  // sets file.kind; queues miss modal if prompt+ambiguous
export function queueKindMiss(opts)           // { fileId?, bundleId?, reason, suggestedKind?, suggestedEntryId?, entryOnly? }
export function checkBundleEntry(bundle, filesMap)
export function openBundleEntryMiss(bundle, filesMap)  // auto-assign convention or queue modal
export function confirmKindMiss() / onKindMissHidden()
export function bindKindUi({ showModal, hideModal, getFile, getBundle, saveAndRender, toast })
```

### Wiring (A)

- `defaultState` / `normalizeState`: `bundles`, `bundleOrder`, `activeBundleId`; each File gets `kind` via `resolveKind` (no modal on load).
- `activeBundle()` getter on `state.js`.
- `files.addFile(..., { prompt, bundleId })`: Kind set + miss modal when sniff ambiguous (default `prompt: true` so Import/paste get it).
- `createFile` / `duplicateFile` / `renameFile`: Kind set silently.
- `deleteFile`: prunes id from all Bundle `fileIds` / `entryId`.
- DOM: `#kindMissModal`, `#kindMissReason`, `#kindMissKind`, `#kindMissEntryWrap`, `#kindMissEntry`, `#kindMissOk`.

### Phase 2 API extensions (remaining owners)

| Owner | Extension |
|---|---|
| A | ✅ `normalizeState` Bundle fields; `kind.js`; miss modal hooks |
| B | Files\|Bundles segmented control in `#fileCanvas` + desktop sidebar; Bundle CRUD; Entry badge — call `openBundleEntryMiss` / `queueKindMiss` when needed |
| C | JSX/TSX via `buildJsxPreview`/`resolvePreviewKind`/`validateJsx`; deps `react`, `react-dom`, `sucrase` (install gate); Workbox `maximumFileSizeToCacheInBytes` + preview-runtime cache |
| D | ✅ Broader import accept + image caps; ZIP→Bundle via `files.createBundle`; `exportBundle`; About caps |

Caps (D, documented in About): **512 KiB / image**, **2 MiB images / Bundle**.

Also list `#kindMissModal` under Mobile DOM hooks.

---

## Mobile DOM hooks (preserve ids)

| Hook | Role |
|---|---|
| `#fileCanvas` | Files offcanvas (`d-lg-none` opener in header) |
| `#fileListCanvas` / `#fileListDesktop` | Mirrored file lists |
| `#searchMobile` / `#searchDesktop` | Filter (synced) |
| `#tabEdit` / `#tabPreview` | Mobile Edit\|Preview |
| `.app-main.show-edit` / `.show-preview` | Pane visibility |
| `#btnNew`, `#btnImport`, `#btnPaste`, Menu dropdown | Header actions |
| `#editor`, `#previewFrame`, `#consoleList` | Edit / Preview / logs |
| Modals: `#renameModal`, `#pasteModal`, `#historyModal`, `#versionModal`, `#confirmModal`, `#aboutModal`, `#kindMissModal` | Existing flows + Kind/Entry miss (A) |
| `#toastHost` | Toasts |

Phase 2 B adds segmented **Files \| Bundles** at top of offcanvas (and same control on desktop sidebar); keep Bootstrap + these ids.

---

## Phase 1 parity checklist (by construction)

- localStorage key / File schema unchanged
- Autosave, Checkpoint, History restore
- Preview iframe + console bridge
- Import HTML/txt/ZIP; Export current + full ZIP+history
- Mobile tabs + Files offcanvas; desktop sidebar
- Theme toggle, format, clipboard insert/split
