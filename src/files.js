import { $, cleanName, makeId } from './util.js';
import { state, saveState, files, activeFile, bundles } from './state.js';
import { ensureFileKind, resolveKind, openBundleEntryMiss } from './kind.js';
import * as bootstrap from 'bootstrap';

let editor = null;
let autoTimer = null;
let editorDirty = false;

let toast = () => {};
let renderAll = () => {};
let setMobileView = () => {};
let askConfirm = () => {};

export function bindFilesUi(hooks) {
  editor = hooks.editor;
  toast = hooks.toast;
  renderAll = hooks.renderAll;
  setMobileView = hooks.setMobileView;
  askConfirm = hooks.askConfirm;
}

export function uniqueName(name) {
  const base = cleanName(name);
  const existing = new Set(files().map(file => file.name.toLowerCase()));
  if (!existing.has(base.toLowerCase())) return base;

  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  let index = 1;
  while (existing.has((stem + '_' + index + ext).toLowerCase())) index++;
  return stem + '_' + index + ext;
}

export function pushVersion(file, note, force = false) {
  const now = Date.now();
  const latest = file.versions[0];
  if (!force && latest && latest.content === file.content) return;

  if (!force && latest && now - latest.ts < 60000) {
    file.versions[0] = { ts: now, note: note || latest.note || 'Edit', content: file.content };
  } else {
    file.versions.unshift({ ts: now, note: note || 'Edit', content: file.content });
  }
  file.versions = file.versions.slice(0, 40);
}

export function commit(file, note, force = false) {
  file.updated = Date.now();
  pushVersion(file, note, force);
}

export function syncEditor(note = 'Auto-save') {
  const file = activeFile();
  if (!file || editor.disabled || editor.value === file.content) return false;
  file.content = editor.value;
  commit(file, note);
  saveState();
  renderAll();
  return true;
}

export function flushEditor() {
  clearTimeout(autoTimer);
  autoTimer = null;
  if (editorDirty) {
    editorDirty = false;
    syncEditor();
  }
}

export function scheduleSave() {
  editorDirty = true;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    editorDirty = false;
    syncEditor();
  }, 900);
}

export function selectFile(id) {
  if (!state.files[id]) return;
  flushEditor();
  state.activeId = id;
  saveState();
  renderAll();
  const drawer = bootstrap.Offcanvas.getInstance($('#fileCanvas'));
  if (drawer) drawer.hide();
  setMobileView('edit');
}

export function createFile() {
  flushEditor();
  const now = Date.now();
  const content = '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>New page</title>\n</head>\n<body>\n\n</body>\n</html>\n';
  const name = uniqueName('untitled.html');
  const file = {
    id: makeId(),
    name,
    content,
    kind: resolveKind(name, content),
    created: now,
    updated: now,
    versions: []
  };
  state.files[file.id] = file;
  state.order.unshift(file.id);
  state.activeId = file.id;
  saveState();
  renderAll();
  editor.focus();
  toast('Created ' + file.name, 'success');
}

/** @param {{ prompt?: boolean, bundleId?: string|null }} [opts] prompt Kind miss modal when sniff is ambiguous (Import/paste). */
export function addFile(name, content, note, opts = {}) {
  const now = Date.now();
  const file = {
    id: makeId(),
    name: uniqueName(cleanName(name)),
    content,
    kind: null,
    created: now,
    updated: now,
    versions: [{ ts: now, note, content }]
  };
  state.files[file.id] = file;
  state.order.unshift(file.id);
  ensureFileKind(file, { prompt: opts.prompt !== false, bundleId: opts.bundleId || null });
  return file;
}

export function deleteFile(id) {
  const file = state.files[id];
  if (!file) return;
  askConfirm('Delete file', 'Delete "' + file.name + '" and its version history?', 'Delete', () => {
    flushEditor();
    delete state.files[id];
    state.order = state.order.filter(value => value !== id);
    if (state.activeId === id) state.activeId = state.order[0] || null;
    for (const bundle of Object.values(state.bundles || {})) {
      bundle.fileIds = bundle.fileIds.filter(fid => fid !== id);
      if (bundle.entryId === id) bundle.entryId = null;
      bundle.updated = Date.now();
    }
    saveState();
    renderAll();
    toast('Deleted ' + file.name, 'secondary');
  });
}

export function duplicateFile(id) {
  flushEditor();
  const original = state.files[id];
  if (!original) return;
  const copy = {
    id: makeId(),
    name: uniqueName('copy-of-' + original.name),
    content: original.content,
    kind: resolveKind(original.name, original.content, original.kind),
    created: Date.now(),
    updated: Date.now(),
    versions: original.versions.map(version => ({ ...version }))
  };
  state.files[copy.id] = copy;
  state.order.unshift(copy.id);
  state.activeId = copy.id;
  saveState();
  renderAll();
  toast('Duplicated as ' + copy.name, 'success');
}

export function renameFile(id, name) {
  const file = state.files[id];
  if (!file) return false;
  const next = cleanName(name || file.name);
  if (files().some(other => other.id !== file.id && other.name.toLowerCase() === next.toLowerCase())) {
    toast('That name is already in use', 'warning');
    return false;
  }
  file.name = next;
  // shortcut: rename re-sniffs silently (no Kind-miss modal)
  file.kind = resolveKind(next, file.content);
  file.updated = Date.now();
  saveState();
  renderAll();
  toast('Renamed to ' + next, 'success');
  return true;
}

export function checkpointActive() {
  const file = activeFile();
  if (!file) {
    toast('No file selected', 'warning');
    return;
  }
  flushEditor();
  commit(file, 'Checkpoint', true);
  saveState();
  renderAll();
  toast('Checkpoint saved', 'success');
}

export function uniqueBundleName(name) {
  const base = String(name || 'Bundle').trim() || 'Bundle';
  const existing = new Set(bundles().map(bundle => bundle.name.toLowerCase()));
  if (!existing.has(base.toLowerCase())) return base;
  let index = 1;
  while (existing.has((base + ' ' + index).toLowerCase())) index++;
  return base + ' ' + index;
}

/**
 * Create a Bundle. Optional fileIds (D/ZIP can pass members).
 * On create without conventional Entry, opens Kind/Entry miss via openBundleEntryMiss.
 */
export function createBundle(name, fileIds = []) {
  flushEditor();
  const now = Date.now();
  const ids = (Array.isArray(fileIds) ? fileIds : []).filter(id => state.files[id]);
  const bundle = {
    id: makeId(),
    name: uniqueBundleName(name || 'Bundle'),
    fileIds: ids,
    entryId: null,
    created: now,
    updated: now
  };
  state.bundles[bundle.id] = bundle;
  state.bundleOrder.unshift(bundle.id);
  state.activeBundleId = bundle.id;
  // shortcut: empty Bundle has no Entry to pick — miss only when members exist (D/ZIP passes fileIds)
  if (ids.length) openBundleEntryMiss(bundle, state.files);
  if (bundle.entryId && state.files[bundle.entryId]) state.activeId = bundle.entryId;
  else if (ids[0]) state.activeId = ids[0];
  saveState();
  renderAll();
  toast('Created bundle ' + bundle.name, 'success');
  return bundle;
}

export function selectBundle(id) {
  const bundle = state.bundles[id];
  if (!bundle) return;
  flushEditor();
  state.activeBundleId = id;
  openBundleEntryMiss(bundle, state.files);
  if (bundle.entryId && state.files[bundle.entryId]) state.activeId = bundle.entryId;
  else if (bundle.fileIds[0] && state.files[bundle.fileIds[0]]) state.activeId = bundle.fileIds[0];
  saveState();
  renderAll();
  const drawer = bootstrap.Offcanvas.getInstance($('#fileCanvas'));
  if (drawer) drawer.hide();
  setMobileView('edit');
}

export function clearActiveBundle() {
  if (!state.activeBundleId) return;
  flushEditor();
  state.activeBundleId = null;
  saveState();
  renderAll();
}

export function deleteBundle(id) {
  const bundle = state.bundles[id];
  if (!bundle) return;
  askConfirm('Delete bundle', 'Delete bundle "' + bundle.name + '"? Files stay in the Vault.', 'Delete', () => {
    flushEditor();
    delete state.bundles[id];
    state.bundleOrder = state.bundleOrder.filter(value => value !== id);
    if (state.activeBundleId === id) state.activeBundleId = null;
    saveState();
    renderAll();
    toast('Deleted bundle ' + bundle.name, 'secondary');
  });
}

export function renameBundle(id, name) {
  const bundle = state.bundles[id];
  if (!bundle) return false;
  const next = String(name || bundle.name).trim() || 'Bundle';
  if (bundles().some(other => other.id !== bundle.id && other.name.toLowerCase() === next.toLowerCase())) {
    toast('That bundle name is already in use', 'warning');
    return false;
  }
  bundle.name = next;
  bundle.updated = Date.now();
  saveState();
  renderAll();
  toast('Renamed bundle to ' + next, 'success');
  return true;
}
