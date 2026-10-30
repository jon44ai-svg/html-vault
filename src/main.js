import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import * as bootstrap from 'bootstrap'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import './style.css'

const KEY = 'htmlvault.v1';
const $ = (selector, root = document) => root.querySelector(selector);
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const RAW = new Set(['script','style','pre','textarea']);

let state;
let filter = '';
let autoTimer = null;
let editorDirty = false;
let renameId = null;
let confirmCallback = null;
let previewToken = '';
let logs = [];
let pendingInsert = null;

const editor = $('#editor');
const frame = $('#previewFrame');

const esc = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

const cleanName = value => String(value || '').replace(/\\/g, '/').split('/').pop().trim() || 'untitled.html';
const timestamp = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' :
    date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const sizeText = bytes => bytes < 1024 ? bytes + ' B' :
  bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1048576).toFixed(2) + ' MB';

function makeId() {
  return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function defaultState() {
  const now = Date.now();
  const file = {
    id: makeId(),
    name: 'index.html',
    content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>My Page</title>\n</head>\n<body>\n  <h1>Hello from HTML Vault!</h1>\n</body>\n</html>\n',
    created: now,
    updated: now,
    versions: []
  };
  return { files: { [file.id]: file }, order: [file.id], activeId: file.id, theme: 'light' };
}

function normalizeState(value) {
  if (!value || typeof value !== 'object' || !value.files || !Array.isArray(value.order)) return defaultState();

  const normalizedFiles = {};
  for (const [id, file] of Object.entries(value.files)) {
    if (!file || typeof file.content !== 'string') continue;
    normalizedFiles[id] = {
      id,
      name: cleanName(file.name),
      content: file.content,
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

  return {
    files: normalizedFiles,
    order,
    activeId: normalizedFiles[value.activeId] ? value.activeId : order[0] || null,
    theme: value.theme === 'dark' ? 'dark' : 'light'
  };
}

function log(type, message, details = '') {
  logs.push({ ts: Date.now(), type, message: String(message || ''), details: String(details || '') });
  if (logs.length > 300) logs = logs.slice(-300);
  renderLogs();
}

function describe(error) {
  if (error instanceof Error) return error.stack || error.message;
  if (typeof error === 'string') return error;
  try { return JSON.stringify(error); } catch (_) { return String(error); }
}

function loadState() {
  try {
    const value = localStorage.getItem(KEY);
    return value ? normalizeState(JSON.parse(value)) : defaultState();
  } catch (error) {
    log('error', 'Could not load saved files.', describe(error));
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    log('error', 'Could not save files. Browser storage may be full.', describe(error));
    toast('Save failed. Export a backup or free storage space.', 'danger');
    return false;
  }
}

function files() { return state.order.map(id => state.files[id]).filter(Boolean); }
function activeFile() { return state.activeId ? state.files[state.activeId] || null : null; }

function uniqueName(name) {
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

function pushVersion(file, note, force = false) {
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

function commit(file, note, force = false) {
  file.updated = Date.now();
  pushVersion(file, note, force);
}

function toast(message, type = 'primary') {
  const host = $('#toastHost');
  const colors = {
    success: 'text-bg-success', danger: 'text-bg-danger', warning: 'text-bg-warning',
    secondary: 'text-bg-secondary', primary: 'text-bg-primary'
  };
  const element = document.createElement('div');
  element.className = 'toast align-items-center border-0 ' + (colors[type] || colors.primary);
  element.setAttribute('role', 'status');
  element.innerHTML = '<div class="d-flex"><div class="toast-body"></div>' +
    '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>';
  $('.toast-body', element).textContent = message;
  host.appendChild(element);
  const instance = new bootstrap.Toast(element, { delay: 2800 });
  instance.show();
  element.addEventListener('hidden.bs.toast', () => element.remove());
}

function syncEditor(note = 'Auto-save') {
  const file = activeFile();
  if (!file || editor.disabled || editor.value === file.content) return false;
  file.content = editor.value;
  commit(file, note);
  saveState();
  renderAll();
  return true;
}

function flushEditor() {
  clearTimeout(autoTimer);
  autoTimer = null;
  if (editorDirty) {
    editorDirty = false;
    syncEditor();
  }
}

function scheduleSave() {
  editorDirty = true;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    editorDirty = false;
    syncEditor();
  }, 900);
}

function renderList() {
  const query = filter.trim().toLowerCase();
  const matching = files().filter(file => !query || file.name.toLowerCase().includes(query));

  const html = matching.map(file => `
    <div class="file-item ${file.id === state.activeId ? 'active' : ''}" data-id="${esc(file.id)}">
      <div class="file-main">
        <i class="bi bi-file-earmark-code"></i>
        <div class="min-w-0">
          <div class="file-name">${esc(file.name)}</div>
          <div class="file-sub">${esc(timestamp(file.updated))} · ${sizeText(new Blob([file.content]).size)} · ${file.versions.length} rev</div>
        </div>
      </div>
      <div class="file-actions">
        <button class="btn btn-sm btn-icon act-rename" data-id="${esc(file.id)}" title="Rename" aria-label="Rename"><i class="bi bi-pencil-square"></i></button>
        <button class="btn btn-sm btn-icon act-dup" data-id="${esc(file.id)}" title="Duplicate" aria-label="Duplicate"><i class="bi bi-files"></i></button>
        <button class="btn btn-sm btn-icon text-danger act-del" data-id="${esc(file.id)}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
      </div>
    </div>`).join('') || '<div class="empty-hint">No files match</div>';

  $('#fileListDesktop').innerHTML = html;
  $('#fileListCanvas').innerHTML = html;
}

function renderAll() {
  renderList();
  const file = activeFile();
  if (file) {
    editor.disabled = false;
    if (editor.value !== file.content) editor.value = file.content;
    $('#fileTitle').innerHTML = esc(file.name) + ' <span class="badge text-bg-secondary">' + file.versions.length + ' rev</span>';
  } else {
    editor.value = '';
    editor.disabled = true;
    $('#fileTitle').textContent = 'No file selected';
  }
}

function selectFile(id) {
  if (!state.files[id]) return;
  flushEditor();
  state.activeId = id;
  saveState();
  renderAll();
  const drawer = bootstrap.Offcanvas.getInstance($('#fileCanvas'));
  if (drawer) drawer.hide();
  setMobileView('edit');
}

function createFile() {
  flushEditor();
  const now = Date.now();
  const file = {
    id: makeId(),
    name: uniqueName('untitled.html'),
    content: '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>New page</title>\n</head>\n<body>\n\n</body>\n</html>\n',
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

function setMobileView(mode) {
  const main = $('.app-main');
  main.classList.toggle('show-edit', mode === 'edit');
  main.classList.toggle('show-preview', mode === 'preview');

  for (const [id, active] of [['tabEdit', mode === 'edit'], ['tabPreview', mode === 'preview']]) {
    const button = $('#' + id);
    button.classList.toggle('btn-primary', active);
    button.classList.toggle('btn-outline-primary', !active);
  }
}

function addFile(name, content, note) {
  const now = Date.now();
  const file = {
    id: makeId(),
    name: uniqueName(cleanName(name)),
    content,
    created: now,
    updated: now,
    versions: [{ ts: now, note, content }]
  };
  state.files[file.id] = file;
  state.order.unshift(file.id);
  return file;
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

async function importFiles(fileList) {
  let count = 0;
  for (const file of Array.from(fileList || [])) {
    try {
      if (/\.zip$/i.test(file.name)) {
        const zip = await JSZip.loadAsync(file);
        const entries = Object.values(zip.files).filter(entry =>
          !entry.dir && /\.(html?|xhtml|txt)$/i.test(entry.name)
        );
        for (const entry of entries) {
          try {
            addFile(entry.name, await entry.async('string'), 'Imported');
            count++;
          } catch (error) {
            log('error', 'Could not import ZIP entry: ' + entry.name, describe(error));
          }
        }
      } else {
        addFile(file.name, await readFile(file), 'Imported');
        count++;
      }
    } catch (error) {
      log('error', 'Could not import file: ' + file.name, describe(error));
    }
  }

  if (count) {
    state.activeId = state.order[0];
    saveState();
    renderAll();
    toast('Imported ' + count + ' file(s)', 'success');
  } else {
    toast('No files imported. Check logs for errors.', 'warning');
  }
}

async function copyText(text) {
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

async function readClipboardText(mode) {
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

function insertIntoEditor(text, mode) {
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

function splitDocuments(text) {
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

function splitPastePrompt(text) {
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

async function insertFromClipboard(mode) {
  const text = await readClipboardText(mode);
  if (text !== null) {
    if (mode === 'multi') splitPastePrompt(text);
    else insertIntoEditor(text, mode);
  }
}

async function pasteNew() {
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

function download(content, filename, type = 'text/html;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  saveAs(blob, filename);
}

function exportCurrent() {
  flushEditor();
  const file = activeFile();
  if (!file) return toast('Select a file first', 'warning');
  download(file.content, file.name);
  toast('Downloaded ' + file.name, 'success');
}

async function exportZip() {
  try {
    flushEditor();
    const zip = new JSZip();
    const history = { exported: new Date().toISOString(), app: 'HTML Vault', files: {} };

    for (const file of files()) {
      zip.file(file.name, file.content);
      history.files[file.name] = {
        created: new Date(file.created).toISOString(),
        updated: new Date(file.updated).toISOString(),
        versions: file.versions.map(version => ({
          when: new Date(version.ts).toISOString(),
          note: version.note,
          content: version.content
        }))
      };
    }

    zip.file('history.json', JSON.stringify(history, null, 2));
    zip.file('README.txt', 'HTML Vault backup: source files and version history.\n');
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

function validateHTML(source) {
  const errors = [];
  const warnings = [];
  if (!source.trim()) return { errors: ['Document is empty.'], warnings };

  if (!/<!doctype\s+html\s*>/i.test(source)) warnings.push('Missing <!DOCTYPE html> declaration.');
  if (!/<html(?:\s|>)/i.test(source)) warnings.push('Missing <html> root element.');
  if (!/<head(?:\s|>)/i.test(source)) warnings.push('Missing <head> section.');
  if (!/<body(?:\s|>)/i.test(source)) warnings.push('Missing <body> section.');
  if (!/<title(?:\s|>)/i.test(source)) warnings.push('Missing <title> element.');
  if (!/<meta\b[^>]*\bname\s*=\s*["']viewport["']/i.test(source)) warnings.push('Missing viewport meta tag.');

  try {
    const parsed = new DOMParser().parseFromString(source, 'text/html');
    const ids = new Set();
    for (const element of parsed.querySelectorAll('[id]')) {
      if (ids.has(element.id)) warnings.push('Duplicate id: "' + element.id + '".');
      ids.add(element.id);
    }
    for (const image of parsed.querySelectorAll('img')) {
      if (!image.hasAttribute('alt')) warnings.push('An image is missing its alt attribute.');
    }
  } catch (error) {
    errors.push('HTML parsing failed: ' + describe(error));
  }
  return { errors, warnings };
}

function showResults(results) {
  const list = $('#resultList');
  list.replaceChildren();
  const entries = [
    ...results.errors.map(text => ({ text, type: 'error' })),
    ...results.warnings.map(text => ({ text, type: 'warning' }))
  ];
  if (!entries.length) entries.push({ text: 'No basic HTML issues found.', type: 'success' });

  for (const entry of entries) {
    const item = document.createElement('li');
    item.className = entry.type === 'error' ? 'text-danger' :
      entry.type === 'warning' ? 'text-warning' : 'text-success';
    item.textContent = entry.text;
    list.appendChild(item);
  }
  $('#resultBox').classList.remove('d-none');
}

function buildPreview(source) {
  previewToken = makeId() + makeId();
  const bridge = `<script>
    (() => {
      const token = ${JSON.stringify(previewToken)};
      const send = (type, args, details = '') => {
        const message = Array.from(args || []).map(value => {
          if (value instanceof Error) return value.stack || value.message;
          if (typeof value === 'string') return value;
          try { return JSON.stringify(value); } catch (_) { return String(value); }
        }).join(' ');
        parent.postMessage({ __htmlVault: token, type, message, details }, '*');
      };
      ['log','info','warn','error'].forEach(type => {
        const original = console[type].bind(console);
        console[type] = (...args) => {
          original(...args);
          send(type === 'info' ? 'log' : type, args);
        };
      });
      addEventListener('error', event =>
        send('error', [event.message || 'Preview error'],
          (event.filename || '') + (event.lineno ? ':' + event.lineno : '')));
      addEventListener('unhandledrejection', event =>
        send('error', ['Unhandled promise rejection'],
          event.reason && (event.reason.stack || event.reason.message) || String(event.reason)));
    })();
  <\/script>`;

  const headTag = /<head(?:\s[^>]*)?>/i;
  if (headTag.test(source)) return source.replace(headTag, tag => tag + bridge);

  const doctype = /^\s*<!doctype[^>]*>/i.exec(source);
  return doctype
    ? source.slice(0, doctype[0].length) + bridge + source.slice(doctype[0].length)
    : bridge + source;
}

function renderPreview() {
  flushEditor();
  const file = activeFile();
  if (!file) {
    frame.srcdoc = '<!doctype html><html><body><p>No file selected.</p></body></html>';
    return;
  }
  try {
    frame.srcdoc = buildPreview(file.content);
  } catch (error) {
    log('error', 'Could not render preview.', describe(error));
    toast('Preview failed. Check logs for details.', 'danger');
  }
}

function compile() {
  flushEditor();
  const file = activeFile();
  if (!file) return toast('Select a file first', 'warning');

  const results = validateHTML(file.content);
  showResults(results);
  renderPreview();
  setMobileView('preview');

  if (results.errors.length) {
    log('error', 'HTML validation found errors.', results.errors.join('\n'));
  } else {
    toast(results.warnings.length ? 'Preview loaded with warnings' : 'Validation passed',
      results.warnings.length ? 'warning' : 'success');
  }
}

function formatHTML(source) {
  const tokens = String(source || '').trim().match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][^>]*>|[^<]+|</g) || [];
  const output = [];
  let indent = 0;
  let rawTag = '';
  let rawBuffer = '';

  for (const token of tokens) {
    const trimmed = token.trim();
    if (rawTag) {
      rawBuffer += token;
      if (new RegExp('</' + rawTag + '\\s*>', 'i').test(rawBuffer)) {
        output.push('  '.repeat(Math.max(0, indent - 1)) + rawBuffer.trim());
        rawTag = '';
        rawBuffer = '';
        indent = Math.max(0, indent - 1);
      }
      continue;
    }
    if (!trimmed) continue;

    if (/^<\//.test(trimmed)) {
      indent = Math.max(0, indent - 1);
      output.push('  '.repeat(indent) + trimmed);
    } else if (/^<!--/.test(trimmed) || /^<!/.test(trimmed)) {
      output.push('  '.repeat(indent) + trimmed);
    } else if (/^</.test(trimmed)) {
      const match = /^<([a-zA-Z][a-zA-Z0-9:-]*)/.exec(trimmed);
      const tag = match ? match[1].toLowerCase() : '';
      output.push('  '.repeat(indent) + trimmed);
      if (RAW.has(tag) && !/\/\s*>$/.test(trimmed)) {
        rawTag = tag;
        indent++;
      } else if (tag && !VOID.has(tag) && !/\/\s*>$/.test(trimmed)) {
        indent++;
      }
    } else {
      output.push('  '.repeat(indent) + trimmed);
    }
  }

  if (rawBuffer) output.push('  '.repeat(Math.max(0, indent - 1)) + rawBuffer.trim());
  return output.join('\n') + '\n';
}

function renderLogs() {
  const list = $('#consoleList');
  if (!logs.length) {
    list.innerHTML = '<li class="console-empty">No console messages.</li>';
    return;
  }
  list.replaceChildren(...logs.map(entry => {
    const item = document.createElement('li');
    item.className = entry.type === 'error' ? 'text-danger' : entry.type === 'warn' ? 'text-warning' : '';
    item.textContent = '[' + new Date(entry.ts).toLocaleTimeString() + '] ' +
      entry.type.toUpperCase() + ': ' + entry.message + (entry.details ? '\n' + entry.details : '');
    return item;
  }));
}

async function copyLogs() {
  const text = logs.length
    ? logs.map(entry => '[' + new Date(entry.ts).toISOString() + '] ' +
        entry.type.toUpperCase() + ': ' + entry.message + (entry.details ? '\n' + entry.details : '')).join('\n\n')
    : 'No console messages.';
  const copied = await copyText(text);
  toast(copied ? 'Logs copied to clipboard' : 'Could not copy logs', copied ? 'success' : 'warning');
}

function showModal(selector) {
  bootstrap.Modal.getOrCreateInstance($(selector)).show();
}

function hideModal(selector) {
  const modal = bootstrap.Modal.getInstance($(selector));
  if (modal) modal.hide();
}

function askConfirm(title, message, label, callback) {
  $('#confirmTitle').textContent = title;
  $('#confirmMsg').textContent = message;
  $('#confirmYes').textContent = label || 'Confirm';
  confirmCallback = callback;
  showModal('#confirmModal');
}

function openHistory() {
  const file = activeFile();
  if (!file) return toast('Select a file first', 'warning');
  flushEditor();

  const list = $('#historyList');
  list.replaceChildren();
  if (!file.versions.length) {
    list.innerHTML = '<div class="empty-hint">No history yet. Edit the file or create a checkpoint.</div>';
  } else {
    file.versions.forEach((version, index) => {
      const row = document.createElement('div');
      row.className = 'hist-item';
      const main = document.createElement('div');
      main.className = 'hist-main';

      const title = document.createElement('strong');
      title.textContent = 'Rev #' + (file.versions.length - index) + ' ';
      main.append(title, document.createTextNode(version.note || 'Edit'));

      const sub = document.createElement('div');
      sub.className = 'hist-sub';
      sub.textContent = timestamp(version.ts) + ' · ' + sizeText(new Blob([version.content]).size);
      main.appendChild(sub);

      const actions = document.createElement('div');
      actions.className = 'btn-group btn-group-sm';
      actions.innerHTML =
        '<button class="btn btn-outline-secondary hist-view" data-i="' + index + '" title="View"><i class="bi bi-eye"></i></button>' +
        '<button class="btn btn-outline-primary hist-restore" data-i="' + index + '"><i class="bi bi-arrow-counterclockwise"></i> Restore</button>';
      row.append(main, actions);
      list.appendChild(row);
    });
  }
  showModal('#historyModal');
}

function deleteFile(id) {
  const file = state.files[id];
  if (!file) return;
  askConfirm('Delete file', 'Delete "' + file.name + '" and its version history?', 'Delete', () => {
    flushEditor();
    delete state.files[id];
    state.order = state.order.filter(value => value !== id);
    if (state.activeId === id) state.activeId = state.order[0] || null;
    saveState();
    renderAll();
    toast('Deleted ' + file.name, 'secondary');
  });
}

function duplicateFile(id) {
  flushEditor();
  const original = state.files[id];
  if (!original) return;
  const copy = {
    id: makeId(),
    name: uniqueName('copy-of-' + original.name),
    content: original.content,
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

/* UI events */
$('#btnNew').addEventListener('click', createFile);
$('#btnNew2').addEventListener('click', createFile);
$('#btnImport').addEventListener('click', () => $('#importInput').click());
$('#importInput').addEventListener('change', event => {
  importFiles(event.target.files);
  event.target.value = '';
});
$('#btnPaste').addEventListener('click', pasteNew);

$('#pasteOk').addEventListener('click', () => {
  const content = $('#pasteArea').value;
  if (!content.trim()) return toast('Paste area is empty', 'warning');

  if (pendingInsert) {
    const mode = pendingInsert;
    pendingInsert = null;
    hideModal('#pasteModal');
    if (mode === 'multi') splitPastePrompt(content);
    else insertIntoEditor(content, mode);
    return;
  }

  let name = cleanName($('#pasteName').value || 'clipboard.html');
  if (!/\.[a-z0-9]+$/i.test(name)) name += '.html';
  const file = addFile(name, content, 'Pasted');
  state.activeId = file.id;
  saveState();
  renderAll();
  hideModal('#pasteModal');
  toast('Created ' + file.name, 'success');
});

$('#pasteModal').addEventListener('hidden.bs.modal', () => { pendingInsert = null; });

$('#btnInsertClip').addEventListener('click', () => insertFromClipboard('cursor'));
$('#insCursor').addEventListener('click', event => { event.preventDefault(); insertFromClipboard('cursor'); });
$('#insAppend').addEventListener('click', event => { event.preventDefault(); insertFromClipboard('append'); });
$('#insReplace').addEventListener('click', event => { event.preventDefault(); insertFromClipboard('replace'); });
$('#insMulti').addEventListener('click', event => { event.preventDefault(); insertFromClipboard('multi'); });

$('#dlCurrent').addEventListener('click', event => { event.preventDefault(); exportCurrent(); });
$('#dlZip').addEventListener('click', event => { event.preventDefault(); exportZip(); });

$('#btnCompile').addEventListener('click', compile);
$('#btnRefreshPreview').addEventListener('click', renderPreview);
$('#btnFormat').addEventListener('click', () => {
  if (!activeFile()) return;
  editor.value = formatHTML(editor.value);
  scheduleSave();
  toast('Formatted', 'success');
});
$('#btnCopy').addEventListener('click', async () => {
  if (!activeFile()) return toast('Select a file first', 'warning');
  const copied = await copyText(editor.value);
  toast(copied ? 'Source copied to clipboard' : 'Could not copy source', copied ? 'success' : 'warning');
});
$('#btnCopyLogs').addEventListener('click', copyLogs);
$('#btnClearConsole').addEventListener('click', () => { logs = []; renderLogs(); });
$('#btnCommit').addEventListener('click', () => {
  const file = activeFile();
  if (!file) return toast('No file selected', 'warning');
  flushEditor();
  commit(file, 'Checkpoint', true);
  saveState();
  renderAll();
  toast('Checkpoint saved', 'success');
});
$('#btnHistory').addEventListener('click', openHistory);
$('#closeResults').addEventListener('click', () => $('#resultBox').classList.add('d-none'));
$('#tabEdit').addEventListener('click', () => setMobileView('edit'));
$('#tabPreview').addEventListener('click', () => { setMobileView('preview'); renderPreview(); });

$('#renameOk').addEventListener('click', () => {
  const file = state.files[renameId];
  if (!file) return;
  const name = cleanName($('#renameInput').value || file.name);
  if (files().some(other => other.id !== file.id && other.name.toLowerCase() === name.toLowerCase())) {
    return toast('That name is already in use', 'warning');
  }
  file.name = name;
  file.updated = Date.now();
  saveState();
  renderAll();
  hideModal('#renameModal');
  toast('Renamed to ' + name, 'success');
});

$('#confirmYes').addEventListener('click', () => {
  const callback = confirmCallback;
  confirmCallback = null;
  hideModal('#confirmModal');
  if (callback) callback();
});

$('#historyList').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const file = activeFile();
  const index = Number(button.dataset.i);
  const version = file && file.versions[index];
  if (!version) return;

  if (button.classList.contains('hist-view')) {
    $('#versionCode').textContent = version.content;
    showModal('#versionModal');
  } else if (button.classList.contains('hist-restore')) {
    askConfirm('Restore version', 'Restore the version from ' + timestamp(version.ts) + '?', 'Restore', () => {
      flushEditor();
      if (file.content !== version.content) {
        file.versions.unshift({ ts: Date.now(), note: 'Before restore', content: file.content });
        file.versions = file.versions.slice(0, 40);
      }
      file.content = version.content;
      file.updated = Date.now();
      saveState();
      renderAll();
      renderPreview();
      toast('Version restored', 'success');
    });
  }
});

for (const id of ['fileListDesktop', 'fileListCanvas']) {
  $('#' + id).addEventListener('click', event => {
    const item = event.target.closest('.file-item');
    if (!item) return;
    const fileId = item.dataset.id;
    if (event.target.closest('.act-del')) return deleteFile(fileId);
    if (event.target.closest('.act-dup')) return duplicateFile(fileId);
    if (event.target.closest('.act-rename')) {
      renameId = fileId;
      $('#renameInput').value = state.files[fileId]?.name || '';
      showModal('#renameModal');
      setTimeout(() => $('#renameInput').focus(), 250);
      return;
    }
    selectFile(fileId);
  });
}

function updateSearch(value) {
  filter = value;
  $('#searchDesktop').value = value;
  $('#searchMobile').value = value;
  renderList();
}
$('#searchDesktop').addEventListener('input', event => updateSearch(event.target.value));
$('#searchMobile').addEventListener('input', event => updateSearch(event.target.value));

editor.addEventListener('input', scheduleSave);
editor.addEventListener('blur', flushEditor);
editor.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'v') {
    event.preventDefault();
    insertFromClipboard('cursor');
    return;
  }
  if (event.key !== 'Tab') return;
  event.preventDefault();
  editor.setRangeText('  ', editor.selectionStart, editor.selectionEnd, 'end');
  scheduleSave();
});

document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    $('#btnCommit').click();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'e') {
    event.preventDefault();
    compile();
  }
});

$('#toggleTheme').addEventListener('click', event => {
  event.preventDefault();
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-bs-theme', state.theme);
  saveState();
});

window.addEventListener('message', event => {
  if (event.source !== frame.contentWindow) return;
  const data = event.data;
  if (!data || data.__htmlVault !== previewToken) return;
  log(data.type || 'log', data.message || '', data.details || '');
});

window.addEventListener('error', event => {
  log('error', event.message || 'Application error', describe(event.error || event.filename));
});
window.addEventListener('unhandledrejection', event => {
  log('error', 'Unhandled application promise rejection', describe(event.reason));
});
window.addEventListener('beforeunload', flushEditor);

/* Startup */
state = loadState();
document.documentElement.setAttribute('data-bs-theme', state.theme);
renderAll();
renderLogs();
setMobileView('edit');
if (state.activeId) renderPreview();
