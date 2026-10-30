# HTML Vault

A local, offline Vault on one device: edit, preview, version, and export HTML and JSX Bundles (phone-installable shell).

## Language

**Vault**:
The collection of Files and Bundles stored in this browser for this device, including order and active selection.
_Avoid_: Project, workspace, library, database

**File**:
One named source document in the Vault (HTML, JSX/TSX-as-JSX, CSS, JS, JSON, image, or related text), with content and metadata.
_Avoid_: Document, page, snippet, entry, note

**Bundle**:
A named group of Files that Preview and Export as one runnable frontend app.
_Avoid_: Project, app (in UI prefer Bundle), package, workspace

**Entry**:
The File in a Bundle that Preview boots first.
_Avoid_: Main, index (filenames may still be `main.jsx` / `index.html`)

**Kind**:
The declared type of a File (HTML, JSX, CSS, JS, JSON, or image) used for Preview and convention checks. Kind may be inferred from content when the name is misleading (for example `.txt`).
_Avoid_: File type (synonym in UI copy OK), language, mime

**Version**:
A historical snapshot of a File’s content, kept for restore.
_Avoid_: Revision (in UI copy prefer Version), snapshot, backup (backup means export)

**Checkpoint**:
A Version the user explicitly saves (as opposed to an auto-save Version).
_Avoid_: Commit (except as internal function name if retained), save point

**Export**:
A download of one File, one Bundle, or a ZIP of the Vault (optionally with history) leaving the browser.
_Avoid_: Backup (synonym in About copy; prefer Export), download (the mechanism, not the domain act)

**Import**:
Bringing external files or a ZIP into the Vault as Files and/or Bundles, including mislabeled text exports from other apps.
_Avoid_: Upload, open (opening is selecting an existing File or Bundle)
