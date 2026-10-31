import * as bootstrap from 'bootstrap'
import { $, esc, timestamp, sizeText, describe } from './util.js'
import { state, files, activeFile, activeBundle, bundles, saveState } from './state.js'
import { flushEditor } from './files.js'
import { renderPreview } from './preview.js'
import { copyText } from './io.js'

let editor = null;
let filter = '';
let logs = [];
let renameId = null;
/** @type {'file' | 'bundle'} */
let renameKind = 'file';
let confirmCallback = null;
/** @type {'files' | 'bundles'} */
let listMode = 'files';

export function bindUiCore({ editor: editorEl }) {
  editor = editorEl;
}

export function getFilter() {
  return filter;
}

export function getRenameId() {
  return renameId;
}

export function getRenameKind() {
  return renameKind;
}

export function setRenameId(id, kind = 'file') {
  renameId = id;
  renameKind = kind === 'bundle' ? 'bundle' : 'file';
}

export function getConfirmCallback() {
  return confirmCallback;
}

export function setConfirmCallback(cb) {
  confirmCallback = cb;
}

export function getListMode() {
  return listMode;
}

export function setListMode(mode) {
  listMode = mode === 'bundles' ? 'bundles' : 'files';
  syncListModeUi();
  renderList();
}

export function getLogs() {
  return logs;
}

export function clearLogs() {
  logs = [];
  renderLogs();
}

export function toast(message, type = 'primary') {
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

export function renderLogs() {
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

export function log(type, message, details = '') {
  logs.push({ ts: Date.now(), type, message: String(message || ''), details: String(details || '') });
  if (logs.length > 300) logs = logs.slice(-300);
  renderLogs();
}

export async function copyLogs() {
  const text = logs.length
    ? logs.map(entry => '[' + new Date(entry.ts).toISOString() + '] ' +
        entry.type.toUpperCase() + ': ' + entry.message + (entry.details ? '\n' + entry.details : '')).join('\n\n')
    : 'No console messages.';
  const copied = await copyText(text);
  toast(copied ? 'Logs copied to clipboard' : 'Could not copy logs', copied ? 'success' : 'warning');
}

export function showModal(selector) {
  bootstrap.Modal.getOrCreateInstance($(selector)).show();
}

export function hideModal(selector) {
  const modal = bootstrap.Modal.getInstance($(selector));
  if (modal) modal.hide();
}

export function askConfirm(title, message, label, callback) {
  $('#confirmTitle').textContent = title;
  $('#confirmMsg').textContent = message;
  $('#confirmYes').textContent = label || 'Confirm';
  confirmCallback = callback;
  showModal('#confirmModal');
}

export function showResults(results) {
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

export function setMobileView(mode) {
  const main = $('.app-main');
  main.classList.toggle('show-edit', mode === 'edit');
  main.classList.toggle('show-preview', mode === 'preview');

  for (const [id, active] of [['tabEdit', mode === 'edit'], ['tabPreview', mode === 'preview']]) {
    const button = $('#' + id);
    button.classList.toggle('btn-primary', active);
    button.classList.toggle('btn-outline-primary', !active);
  }
}

function syncListModeUi() {
  for (const root of document.querySelectorAll('[data-list-mode-root]')) {
    for (const button of root.querySelectorAll('[data-list-mode]')) {
      const active = button.dataset.listMode === listMode;
      button.classList.toggle('btn-primary', active);
      button.classList.toggle('btn-outline-primary', !active);
    }
  }
  const searchingFiles = listMode === 'files';
  for (const id of ['searchDesktop', 'searchMobile']) {
    const input = $('#' + id);
    if (input) input.placeholder = searchingFiles ? 'Filter files' : 'Filter bundles';
  }
  for (const el of document.querySelectorAll('[data-files-only]')) {
    el.classList.toggle('d-none', !searchingFiles);
  }
  for (const el of document.querySelectorAll('[data-bundles-only]')) {
    el.classList.toggle('d-none', searchingFiles);
  }
}

function renderBundleFilterBars() {
  const bundle = activeBundle();
  const html = bundle
    ? `<div class="bundle-filter-bar">
        <span class="min-w-0 text-truncate"><i class="bi bi-collection"></i> <strong>${esc(bundle.name)}</strong></span>
        <button type="button" class="btn btn-sm btn-outline-secondary act-clear-bundle">All files</button>
      </div>`
    : '';
  for (const id of ['bundleFilterDesktop', 'bundleFilterCanvas']) {
    const host = $('#' + id);
    if (host) host.innerHTML = listMode === 'files' ? html : '';
  }
}

function fileListHtml() {
  const query = filter.trim().toLowerCase();
  const bundle = activeBundle();
  const memberIds = bundle ? new Set(bundle.fileIds) : null;
  const matching = files().filter(file => {
    if (memberIds && !memberIds.has(file.id)) return false;
    return !query || file.name.toLowerCase().includes(query);
  });

  return matching.map(file => {
    const isEntry = bundle && bundle.entryId === file.id;
    return `
    <div class="file-item ${file.id === state.activeId ? 'active' : ''}" data-id="${esc(file.id)}">
      <div class="file-main">
        <i class="bi bi-file-earmark-code"></i>
        <div class="min-w-0">
          <div class="file-name">${esc(file.name)}${isEntry ? ' <span class="badge text-bg-primary">Entry</span>' : ''}</div>
          <div class="file-sub">${esc(timestamp(file.updated))} · ${sizeText(new Blob([file.content]).size)} · ${file.versions.length} rev</div>
        </div>
      </div>
      <div class="file-actions">
        <button class="btn btn-sm btn-icon act-rename" data-id="${esc(file.id)}" title="Rename" aria-label="Rename"><i class="bi bi-pencil-square"></i></button>
        <button class="btn btn-sm btn-icon act-dup" data-id="${esc(file.id)}" title="Duplicate" aria-label="Duplicate"><i class="bi bi-files"></i></button>
        <button class="btn btn-sm btn-icon text-danger act-del" data-id="${esc(file.id)}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
      </div>
    </div>`;
  }).join('') || `<div class="empty-hint">${bundle ? 'No files in this bundle' : 'No files match'}</div>`;
}

function bundleListHtml() {
  const query = filter.trim().toLowerCase();
  const matching = bundles().filter(bundle => !query || bundle.name.toLowerCase().includes(query));

  return matching.map(bundle => `
    <div class="file-item ${bundle.id === state.activeBundleId ? 'active' : ''}" data-bundle-id="${esc(bundle.id)}">
      <div class="file-main">
        <i class="bi bi-collection"></i>
        <div class="min-w-0">
          <div class="file-name">${esc(bundle.name)}</div>
          <div class="file-sub">${bundle.fileIds.length} file${bundle.fileIds.length === 1 ? '' : 's'} · ${esc(timestamp(bundle.updated))}</div>
        </div>
      </div>
      <div class="file-actions">
        <button class="btn btn-sm btn-icon act-bundle-rename" data-bundle-id="${esc(bundle.id)}" title="Rename" aria-label="Rename"><i class="bi bi-pencil-square"></i></button>
        <button class="btn btn-sm btn-icon text-danger act-bundle-del" data-bundle-id="${esc(bundle.id)}" title="Delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
      </div>
    </div>`).join('') || '<div class="empty-hint">No bundles yet</div>';
}

export function renderList() {
  syncListModeUi();
  renderBundleFilterBars();
  const html = listMode === 'bundles' ? bundleListHtml() : fileListHtml();
  $('#fileListDesktop').innerHTML = html;
  $('#fileListCanvas').innerHTML = html;
}

export function renderAll() {
  // Opening a Bundle shows its members under Files
  if (state.activeBundleId && listMode === 'bundles') listMode = 'files';
  renderList();
  const file = activeFile();
  const bundle = activeBundle();
  if (file) {
    editor.disabled = false;
    if (editor.value !== file.content) editor.value = file.content;
    const entryBadge = bundle && bundle.entryId === file.id
      ? ' <span class="badge text-bg-primary">Entry</span>'
      : '';
    const bundleBadge = bundle
      ? ' <span class="badge text-bg-secondary">' + esc(bundle.name) + '</span>'
      : '';
    $('#fileTitle').innerHTML = esc(file.name) + entryBadge + bundleBadge +
      ' <span class="badge text-bg-secondary">' + file.versions.length + ' rev</span>';
  } else {
    editor.value = '';
    editor.disabled = true;
    $('#fileTitle').textContent = 'No file selected';
  }
}

export function updateSearch(value) {
  filter = value;
  $('#searchDesktop').value = value;
  $('#searchMobile').value = value;
  renderList();
}

export function openHistory() {
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

export function handleHistoryClick(event) {
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
}

export { describe };
