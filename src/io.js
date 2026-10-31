import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import * as bootstrap from 'bootstrap'
import { $, cleanName, sizeText, describe } from './util.js'
import { state, saveState, files, activeFile, activeBundle } from './state.js'
import { addFile, createBundle, flushEditor, scheduleSave } from './files.js'

/** 512 KiB per image */
export const IMAGE_MAX_BYTES = 512 * 1024
/** 2 MiB total images per Bundle */
export const BUNDLE_IMAGES_MAX_BYTES = 2 * 1024 * 1024

const TEXT_EXT = /\.(html?|xhtml|txt|jsx|tsx|css|js|mjs|cjs|json)$/i
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|ico|bmp|avif)$/i
const IMPORT_EXT = /\.(html?|xhtml|txt|jsx|tsx|css|js|mjs|cjs|json|png|jpe?g|gif|webp|svg|ico|bmp|avif)$/i
const SKIP_ZIP_BASENAME = /^(history\.json|bundles\.json|readme\.txt)$/i

let editor = null;
let pendingInsert = null;

let toast = () => {};
let log = () => {};
let renderAll = () => {};
let askConfirm = () => {};

export function bindIoUi(hooks) {
  editor = hooks.editor;
  toast = hooks.toast;
  log = hooks.log;
  renderAll = hooks.renderAll;
  askConfirm = hooks.askConfirm;
}

export function getPendingInsert() {
  return pendingInsert;
}

export function clearPendingInsert() {
  pendingInsert = null;
}

function isImageName(name) {
  return IMAGE_EXT.test(cleanName(name));
}

function isTextImportName(name) {
  return TEXT_EXT.test(cleanName(name));
}

function isImportableName(name) {
  const base = cleanName(name);
  if (SKIP_ZIP_BASENAME.test(base)) return false;
  if (base.startsWith('.')) return false;
  return IMPORT_EXT.test(base);
}

function mimeForImage(name) {
  const ext = (cleanName(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
  return ({
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    bmp: 'image/bmp',
    avif: 'image/avif'
  })[ext] || 'application/octet-stream';
}

function bytesToDataUrl(bytes, mime) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return 'data:' + mime + ';base64,' + btoa(binary);
}

function dataUrlToBlobParts(content) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(content || ''));
  if (!match) return null;
  const mime = match[1] || 'application/octet-stream';
  const data = match[3] || '';
  if (match[2]) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { blob: new Blob([bytes], { type: mime }), mime, byteLength: bytes.byteLength };
  }
  const decoded = decodeURIComponent(data);
  return { blob: new Blob([decoded], { type: mime }), mime, byteLength: new Blob([decoded]).size };
}

/** Byte size of stored File content (data URL → decoded bytes). */
export function contentByteSize(content) {
  const parts = dataUrlToBlobParts(content);
  if (parts) return parts.byteLength;
  return new Blob([String(content ?? '')]).size;
}

function zipPayload(content, name) {
  if (isImageName(name) && /^data:/i.test(String(content || ''))) {
    const parts = dataUrlToBlobParts(content);
    if (parts) return parts.blob;
  }
  return content;
}

async function readFile(file) {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('File read failed'));
    reader.readAsText(file);
  });
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

function refuseImage(name, reason) {
  const message = 'Skipped image "' + cleanName(name) + '": ' + reason;
  log('warn', message);
  toast(message, 'warning');
}

/**
 * @returns {{ ok: true, content: string, bytes: number } | { ok: false }}
 */
function checkImageBytes(name, bytes, bundleImageTotal) {
  if (bytes > IMAGE_MAX_BYTES) {
    refuseImage(name, 'over ' + sizeText(IMAGE_MAX_BYTES) + ' limit (' + sizeText(bytes) + ')');
    return { ok: false };
  }
  if (bundleImageTotal != null && bundleImageTotal + bytes > BUNDLE_IMAGES_MAX_BYTES) {
    refuseImage(
      name,
      'would exceed Bundle image cap of ' + sizeText(BUNDLE_IMAGES_MAX_BYTES) +
        ' (already ' + sizeText(bundleImageTotal) + ')'
    );
    return { ok: false };
  }
  return { ok: true };
}

async function importOneLoose(file) {
  const name = file.name;
  if (!isImportableName(name) && !/\.zip$/i.test(name)) {
    log('warn', 'Skipped unsupported file: ' + name);
    return null;
  }
  if (isImageName(name)) {
    const check = checkImageBytes(name, file.size, null);
    if (!check.ok) return null;
    const content = await readFileAsDataUrl(file);
    return addFile(name, content, 'Imported');
  }
  if (!isTextImportName(name)) {
    log('warn', 'Skipped unsupported file: ' + name);
    return null;
  }
  return addFile(name, await readFile(file), 'Imported');
}

async function importZipArchive(file) {
  const zip = await JSZip.loadAsync(file);
  const isVaultBackup = Boolean(zip.file('history.json'));
  const entries = Object.values(zip.files).filter(entry => {
    if (entry.dir) return false;
    const path = entry.name.replace(/\\/g, '/');
    if (path.includes('__MACOSX/') || path.split('/').pop().startsWith('.')) return false;
    return isImportableName(path);
  });

  const added = [];
  let imageBytes = 0;
  // Project ZIP (not a Vault backup) with 2+ members → Bundle after import.
  const asBundle = !isVaultBackup && entries.length >= 2;

  for (const entry of entries) {
    try {
      const base = cleanName(entry.name);
      if (isImageName(base)) {
        const bytes = await entry.async('uint8array');
        const check = checkImageBytes(base, bytes.byteLength, asBundle ? imageBytes : null);
        if (!check.ok) continue;
        const content = bytesToDataUrl(bytes, mimeForImage(base));
        // shortcut: Kind-miss during ZIP lacks bundleId until createBundle below
        const created = addFile(base, content, 'Imported');
        imageBytes += bytes.byteLength;
        added.push(created);
      } else {
        const created = addFile(base, await entry.async('string'), 'Imported');
        added.push(created);
      }
    } catch (error) {
      log('error', 'Could not import ZIP entry: ' + entry.name, describe(error));
    }
  }

  let bundle = null;
  if (asBundle && added.length >= 2) {
    const raw = String(file.name || 'Bundle').replace(/\.zip$/i, '').trim() || 'Bundle';
    bundle = createBundle(raw, added.map(f => f.id));
  }

  return { added, bundle, isVaultBackup };
}

export async function importFiles(fileList) {
  let count = 0;
  let bundlesMade = 0;

  for (const file of Array.from(fileList || [])) {
    try {
      if (/\.zip$/i.test(file.name)) {
        const { added, bundle } = await importZipArchive(file);
        count += added.length;
        if (bundle) bundlesMade++;
        // createBundle already picks Entry/activeId; loose ZIP picks first added
        else if (added.length) state.activeId = added[0].id;
      } else {
        const created = await importOneLoose(file);
        if (created) {
          count++;
          state.activeId = created.id;
        }
      }
    } catch (error) {
      log('error', 'Could not import file: ' + file.name, describe(error));
    }
  }

  if (count) {
    saveState();
    renderAll();
    const extra = bundlesMade ? ' → ' + bundlesMade + ' Bundle(s)' : '';
    toast('Imported ' + count + ' file(s)' + extra, 'success');
  } else {
    toast('No files imported. Check logs for errors.', 'warning');
  }
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    log('warn', 'Clipboard API failed; trying fallback.', describe(error));
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(area);
    area.select();
    const success = document.execCommand('copy');
    area.remove();
    return success;
  } catch (error) {
    log('error', 'Clipboard copy failed.', describe(error));
    return false;
  }
}

export async function readClipboardText(mode) {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const text = await navigator.clipboard.readText();
      if (text.trim()) return text;
    }
  } catch (error) {
    log('warn', 'Could not read clipboard.', describe(error));
  }
  pendingInsert = mode || null;
  $('#pasteArea').value = '';
  $('#pasteArea').placeholder = mode ? 'Paste text to insert…' : 'Paste HTML source here…';
  $('#pasteName').value = 'clipboard.html';
  $('#pasteName').classList.toggle('d-none', Boolean(mode));
  bootstrap.Modal.getOrCreateInstance($('#pasteModal')).show();
  return null;
}

export function insertIntoEditor(text, mode) {
  const file = activeFile();
  if (!file) return toast('Select a file first', 'warning');
  editor.focus();

  if (mode === 'append') {
    const end = editor.value.length;
    editor.setSelectionRange(end, end);
  } else if (mode === 'replace' && editor.selectionStart === editor.selectionEnd) {
    mode = 'cursor';
  }

  const separator = mode === 'append' && editor.value && !editor.value.endsWith('\n') ? '\n' : '';
  const inserted = separator + text;
  const ok = document.execCommand('insertText', false, inserted);
  if (!ok) {
    editor.setRangeText(inserted, editor.selectionStart, editor.selectionEnd, 'end');
  }
  scheduleSave();
  toast('Inserted ' + sizeText(new Blob([text]).size) + ' from clipboard', 'success');
  return true;
}

export function splitDocuments(text) {
  const boundaries = [];
  const pattern = /(?=<!doctype\s+html|<html(?:\s|>))/gi;
  let match;
  while ((match = pattern.exec(text))) boundaries.push(match.index);
  if (boundaries.length <= 1) return [String(text)];

  const parts = [];
  for (let i = 0; i < boundaries.length; i++) {
    const end = i + 1 < boundaries.length ? boundaries[i + 1] : text.length;
    const chunk = text.slice(boundaries[i], end).trim();
    if (chunk) parts.push(chunk);
  }
  return parts.length ? parts : [String(text)];
}

export function splitPastePrompt(text) {
  const docs = splitDocuments(text);
  if (docs.length <= 1) {
    const name = /<html[\s>]|<!\s*doctype/i.test(text) ? 'clipboard.html' : 'pasted.txt';
    const file = addFile(name, text, 'Pasted');
    state.activeId = file.id;
    saveState();
    renderAll();
    return toast('Single document detected — created ' + file.name, 'success');
  }

  askConfirm('Split clipboard',
    'Clipboard contains ' + docs.length + ' HTML documents. Create ' + docs.length + ' separate files?',
    'Create ' + docs.length + ' files', () => {
      for (let i = docs.length - 1; i >= 0; i--) {
        const name = i === 0 ? 'clipboard.html' : 'clipboard-' + (i + 1) + '.html';
        addFile(name, docs[i], 'Pasted');
      }
      state.activeId = state.order[0];
      saveState();
      renderAll();
      toast('Created ' + docs.length + ' file(s) from clipboard', 'success');
    });
}

export async function insertFromClipboard(mode) {
  const text = await readClipboardText(mode);
  if (text !== null) {
    if (mode === 'multi') splitPastePrompt(text);
    else insertIntoEditor(text, mode);
  }
}

export async function pasteNew() {
  const text = await readClipboardText();
  if (text === null) return;
  const docs = splitDocuments(text);
  if (docs.length > 1) return splitPastePrompt(text);

  const name = /<html[\s>]|<!\s*doctype/i.test(text) ? 'clipboard.html' : 'pasted.txt';
  const file = addFile(name, text, 'Pasted');
  state.activeId = file.id;
  saveState();
  renderAll();
  toast('Created ' + file.name, 'success');
}

export function download(content, filename, type = 'text/html;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  saveAs(blob, filename);
}

export function exportCurrent() {
  flushEditor();
  const file = activeFile();
  if (!file) return toast('Select a file first', 'warning');
  if (file.kind === 'image' || /^data:/i.test(file.content)) {
    const parts = dataUrlToBlobParts(file.content);
    if (parts) {
      download(parts.blob, file.name, parts.mime);
      toast('Downloaded ' + file.name, 'success');
      return;
    }
  }
  download(file.content, file.name);
  toast('Downloaded ' + file.name, 'success');
}

/** Export active Bundle (or id) as a ZIP of member sources — no history. */
export async function exportBundle(bundleId) {
  try {
    flushEditor();
    const bundle = bundleId
      ? state.bundles?.[bundleId] || null
      : activeBundle();
    if (!bundle) return toast('Select a Bundle first', 'warning');
    if (!bundle.fileIds?.length) return toast('Bundle has no files', 'warning');

    const zip = new JSZip();
    for (const id of bundle.fileIds) {
      const file = state.files[id];
      if (!file) continue;
      zip.file(file.name, zipPayload(file.content, file.name));
    }

    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    const safe = String(bundle.name || 'bundle').replace(/[^\w.-]+/g, '_') || 'bundle';
    download(blob, safe + '.zip', 'application/zip');
    toast('Exported Bundle "' + bundle.name + '"', 'success');
  } catch (error) {
    log('error', 'Bundle ZIP export failed.', describe(error));
    toast('Bundle export failed. Check logs for details.', 'danger');
  }
}

export async function exportZip() {
  try {
    flushEditor();
    const zip = new JSZip();
    const history = { exported: new Date().toISOString(), app: 'HTML Vault', files: {} };

    for (const file of files()) {
      zip.file(file.name, zipPayload(file.content, file.name));
      history.files[file.name] = {
        created: new Date(file.created).toISOString(),
        updated: new Date(file.updated).toISOString(),
        kind: file.kind || null,
        versions: file.versions.map(version => ({
          when: new Date(version.ts).toISOString(),
          note: version.note,
          content: version.content
        }))
      };
    }

    const bundlesMeta = {
      exported: history.exported,
      bundles: (state.bundleOrder || []).map(id => {
        const b = state.bundles?.[id];
        if (!b) return null;
        return {
          name: b.name,
          entry: b.entryId && state.files[b.entryId] ? state.files[b.entryId].name : null,
          files: b.fileIds.map(fid => state.files[fid]?.name).filter(Boolean)
        };
      }).filter(Boolean)
    };

    zip.file('history.json', JSON.stringify(history, null, 2));
    zip.file('bundles.json', JSON.stringify(bundlesMeta, null, 2));
    zip.file('README.txt', 'HTML Vault backup: source files, version history, and Bundle names.\n');
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    download(blob, 'html-vault-backup.zip', 'application/zip');
    toast('ZIP backup exported', 'success');
  } catch (error) {
    log('error', 'ZIP export failed.', describe(error));
    toast('ZIP export failed. Check logs for details.', 'danger');
  }
}

export function createFromPasteArea() {
  const content = $('#pasteArea').value;
  if (!content.trim()) return toast('Paste area is empty', 'warning');

  if (pendingInsert) {
    const mode = pendingInsert;
    pendingInsert = null;
    return { kind: 'insert', mode, content };
  }

  let name = cleanName($('#pasteName').value || 'clipboard.html');
  if (!/\.[a-z0-9]+$/i.test(name)) name += '.html';
  const file = addFile(name, content, 'Pasted');
  state.activeId = file.id;
  saveState();
  renderAll();
  toast('Created ' + file.name, 'success');
  return { kind: 'created' };
}
