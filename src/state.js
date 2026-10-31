import { cleanName, makeId, describe } from './util.js';
import { resolveKind } from './kind.js';

export const KEY = 'htmlvault.v1';

export let state;

let logFn = () => {};
let toastFn = () => {};

export function bindStateUi({ log, toast }) {
  logFn = log;
  toastFn = toast;
}

export function getState() {
  return state;
}

export function setState(next) {
  state = next;
  return state;
}

export function defaultState() {
  const now = Date.now();
  const file = {
    id: makeId(),
    name: 'index.html',
    content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>My Page</title>\n</head>\n<body>\n  <h1>Hello from HTML Vault!</h1>\n</body>\n</html>\n',
    kind: 'html',
    created: now,
    updated: now,
    versions: []
  };
  return {
    files: { [file.id]: file },
    order: [file.id],
    activeId: file.id,
    theme: 'light',
    bundles: {},
    bundleOrder: [],
    activeBundleId: null
  };
}

export function normalizeState(value) {
  if (!value || typeof value !== 'object' || !value.files || !Array.isArray(value.order)) return defaultState();

  const normalizedFiles = {};
  for (const [id, file] of Object.entries(value.files)) {
    if (!file || typeof file.content !== 'string') continue;
    const name = cleanName(file.name);
    const content = file.content;
    normalizedFiles[id] = {
      id,
      name,
      content,
      kind: resolveKind(name, content, file.kind),
      created: Number(file.created) || Date.now(),
      updated: Number(file.updated) || Date.now(),
      versions: Array.isArray(file.versions)
        ? file.versions.filter(v => v && typeof v.content === 'string').slice(0, 40)
            .map(v => ({ ts: Number(v.ts) || Date.now(), note: String(v.note || 'Edit'), content: v.content }))
        : []
    };
  }

  const order = value.order.filter(id => normalizedFiles[id]);
  for (const id of Object.keys(normalizedFiles)) if (!order.includes(id)) order.push(id);

  const bundles = {};
  const rawBundles = value.bundles && typeof value.bundles === 'object' ? value.bundles : {};
  for (const [id, bundle] of Object.entries(rawBundles)) {
    if (!bundle || typeof bundle !== 'object') continue;
    const fileIds = Array.isArray(bundle.fileIds)
      ? bundle.fileIds.filter(fid => normalizedFiles[fid])
      : [];
    const entryId = bundle.entryId && fileIds.includes(bundle.entryId) ? bundle.entryId : null;
    bundles[id] = {
      id,
      name: String(bundle.name || 'Bundle').trim() || 'Bundle',
      fileIds,
      entryId,
      created: Number(bundle.created) || Date.now(),
      updated: Number(bundle.updated) || Date.now()
    };
  }

  const bundleOrder = Array.isArray(value.bundleOrder)
    ? value.bundleOrder.filter(id => bundles[id])
    : [];
  for (const id of Object.keys(bundles)) if (!bundleOrder.includes(id)) bundleOrder.push(id);

  const activeBundleId = value.activeBundleId && bundles[value.activeBundleId]
    ? value.activeBundleId
    : null;

  return {
    files: normalizedFiles,
    order,
    activeId: normalizedFiles[value.activeId] ? value.activeId : order[0] || null,
    theme: value.theme === 'dark' ? 'dark' : 'light',
    bundles,
    bundleOrder,
    activeBundleId
  };
}

export function loadState() {
  try {
    const value = localStorage.getItem(KEY);
    state = value ? normalizeState(JSON.parse(value)) : defaultState();
    return state;
  } catch (error) {
    logFn('error', 'Could not load saved files.', describe(error));
    state = defaultState();
    return state;
  }
}

export function saveState() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    logFn('error', 'Could not save files. Browser storage may be full.', describe(error));
    toastFn('Save failed. Export a backup or free storage space.', 'danger');
    return false;
  }
}

export function files() {
  return state.order.map(id => state.files[id]).filter(Boolean);
}

export function activeFile() {
  return state.activeId ? state.files[state.activeId] || null : null;
}

export function activeBundle() {
  return state.activeBundleId ? state.bundles[state.activeBundleId] || null : null;
}

export function bundles() {
  return (state.bundleOrder || []).map(id => state.bundles[id]).filter(Boolean);
}
