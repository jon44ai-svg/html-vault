import { $ } from './util.js';
import * as bootstrap from 'bootstrap';

export const KINDS = ['html', 'jsx', 'css', 'js', 'json', 'image'];

/** Conventional Entry basenames (case-insensitive). Override still allowed. */
export const ENTRY_NAMES = new Set([
  'index.html', 'index.htm', 'index.xhtml',
  'index.jsx', 'index.tsx',
  'main.jsx', 'main.tsx',
  'app.jsx', 'app.tsx'
]);

const KIND_SET = new Set(KINDS);

let showModalFn = (sel) => bootstrap.Modal.getOrCreateInstance($(sel)).show();
let hideModalFn = (sel) => {
  const modal = bootstrap.Modal.getInstance($(sel));
  if (modal) modal.hide();
};
let getFileFn = () => null;
let getBundleFn = () => null;
let saveAndRenderFn = () => {};
let toastFn = () => {};

const missQueue = [];
let missActive = null;
let ignoreMissHidden = false;

export function bindKindUi({ showModal, hideModal, getFile, getBundle, saveAndRender, toast }) {
  if (showModal) showModalFn = showModal;
  if (hideModal) hideModalFn = hideModal;
  if (getFile) getFileFn = getFile;
  if (getBundle) getBundleFn = getBundle;
  if (saveAndRender) saveAndRenderFn = saveAndRender;
  if (toast) toastFn = toast;
}

export function isValidKind(value) {
  return KIND_SET.has(value);
}

export function isEntryName(name) {
  const base = String(name || '').replace(/\\/g, '/').split('/').pop().trim().toLowerCase();
  return ENTRY_NAMES.has(base);
}

export function guessEntryId(fileIds, filesMap) {
  const ids = Array.isArray(fileIds) ? fileIds : [];
  for (const id of ids) {
    const file = filesMap?.[id];
    if (file && isEntryName(file.name)) return id;
  }
  return null;
}

/**
 * Sniff Kind from name + content (esp. .txt).
 * @returns {{ kind: string|null, ambiguous: boolean, reason: string }}
 */
export function sniffKind(name, content) {
  const base = String(name || '').replace(/\\/g, '/').split('/').pop().trim();
  const lower = base.toLowerCase();
  const text = String(content ?? '');
  const ext = (lower.match(/\.([a-z0-9]+)$/) || [])[1] || '';

  if (/^(png|jpe?g|gif|webp|svg|ico|bmp|avif)$/.test(ext)) {
    return { kind: 'image', ambiguous: false, reason: 'Image extension .' + ext };
  }
  if (/^data:image\//i.test(text.trim())) {
    return { kind: 'image', ambiguous: false, reason: 'Content looks like an image data URL' };
  }

  const fromExt = {
    html: 'html', htm: 'html', xhtml: 'html',
    jsx: 'jsx', tsx: 'jsx',
    css: 'css',
    js: 'js', mjs: 'js', cjs: 'js',
    json: 'json'
  }[ext];

  if (fromExt && ext !== 'txt') {
    // .js with clear JSX markers → treat as jsx (common AI export)
    if (fromExt === 'js' && looksLikeJsx(text) && !looksLikePlainJsStrong(text)) {
      return { kind: 'jsx', ambiguous: false, reason: 'Extension .js but content looks like JSX' };
    }
    return { kind: fromExt, ambiguous: false, reason: 'Extension .' + ext };
  }

  // .txt / unknown / no extension — content sniff
  const hits = contentHits(text);
  if (hits.length === 1) {
    return {
      kind: hits[0].kind,
      ambiguous: false,
      reason: (ext === 'txt' || !ext ? 'Sniffed from content: ' : 'Unknown extension; sniffed: ') + hits[0].why
    };
  }
  if (hits.length > 1) {
    return {
      kind: hits[0].kind,
      ambiguous: true,
      reason: 'Ambiguous content for "' + base + '": could be ' + hits.map(h => h.kind).join(', ') + '. Pick Kind manually.'
    };
  }
  return {
    kind: null,
    ambiguous: true,
    reason: 'Could not tell Kind for "' + base + '"' + (ext === 'txt' ? ' (.txt export)' : '') + '. Choose Kind manually.'
  };
}

/** Always returns a Kind — for normalize / silent paths. Prefer stored if valid. */
export function resolveKind(name, content, stored) {
  if (isValidKind(stored)) return stored;
  const sniff = sniffKind(name, content);
  return sniff.kind || 'html';
}

export function ensureFileKind(file, { prompt = false, bundleId = null } = {}) {
  if (!file) return null;
  const sniff = sniffKind(file.name, file.content);
  file.kind = sniff.kind || (isValidKind(file.kind) ? file.kind : 'html');
  if (prompt && sniff.ambiguous) {
    queueKindMiss({
      fileId: file.id,
      reason: sniff.reason,
      suggestedKind: file.kind,
      bundleId
    });
  }
  return sniff;
}

/**
 * Convention-miss / Kind-miss modal (mobile full-width).
 * Call when sniff is ambiguous, or when a Bundle has no conventional Entry.
 */
export function queueKindMiss(opts) {
  if (!opts?.fileId && !opts?.bundleId) return;
  missQueue.push(opts);
  if (!missActive) drainMissQueue();
}

/** Entry convention check for a Bundle — callable by B/D. */
export function checkBundleEntry(bundle, filesMap) {
  if (!bundle) return { ok: true };
  const map = filesMap || {};
  if (bundle.entryId && map[bundle.entryId] && bundle.fileIds?.includes(bundle.entryId)) {
    return { ok: true, entryId: bundle.entryId, conventional: isEntryName(map[bundle.entryId].name) };
  }
  const suggested = guessEntryId(bundle.fileIds, map);
  if (suggested) {
    return { ok: true, entryId: suggested, conventional: true, needsAssign: !bundle.entryId };
  }
  return {
    ok: false,
    reason: 'No Entry matches the usual names (index.html, main.jsx, App.jsx). Choose which File is the Entry.'
  };
}

export function openBundleEntryMiss(bundle, filesMap) {
  const check = checkBundleEntry(bundle, filesMap);
  if (check.ok) {
    if (check.needsAssign && check.entryId) {
      bundle.entryId = check.entryId;
      bundle.updated = Date.now();
    }
    return check;
  }
  const firstId = bundle.fileIds?.[0] || null;
  queueKindMiss({
    fileId: firstId,
    bundleId: bundle.id,
    reason: check.reason,
    suggestedKind: firstId && filesMap?.[firstId] ? filesMap[firstId].kind : 'html',
    suggestedEntryId: null,
    entryOnly: !firstId
  });
  return check;
}

export function confirmKindMiss() {
  if (!missActive) return;
  const kind = $('#kindMissKind')?.value;
  const entryId = $('#kindMissEntry')?.value || '';

  if (missActive.fileId && isValidKind(kind)) {
    const file = getFileFn(missActive.fileId);
    if (file) file.kind = kind;
  }

  if (missActive.bundleId) {
    const bundle = getBundleFn(missActive.bundleId);
    if (bundle) {
      bundle.entryId = entryId && bundle.fileIds.includes(entryId) ? entryId : null;
      bundle.updated = Date.now();
    }
  }

  const done = missActive;
  missActive = null;
  ignoreMissHidden = true;
  hideModalFn('#kindMissModal');
  saveAndRenderFn();
  toastFn('Kind' + (done.bundleId ? ' / Entry' : '') + ' saved', 'success');
  drainMissQueue();
}

/** Backdrop / Cancel — drop current miss and continue queue. */
export function onKindMissHidden() {
  if (ignoreMissHidden) {
    ignoreMissHidden = false;
    return;
  }
  missActive = null;
  drainMissQueue();
}

function drainMissQueue() {
  const next = missQueue.shift();
  if (!next) {
    missActive = null;
    return;
  }
  missActive = next;
  fillMissModal(next);
  showModalFn('#kindMissModal');
}

function fillMissModal(opts) {
  const reasonEl = $('#kindMissReason');
  const kindSel = $('#kindMissKind');
  const entryWrap = $('#kindMissEntryWrap');
  const entrySel = $('#kindMissEntry');
  const title = $('#kindMissTitle');

  if (reasonEl) reasonEl.textContent = opts.reason || 'Choose Kind for this File.';
  if (title) {
    title.textContent = opts.bundleId && !opts.fileId
      ? 'Choose Bundle Entry'
      : opts.bundleId
        ? 'Choose Kind and Entry'
        : 'Choose File Kind';
  }

  if (kindSel) {
    kindSel.value = isValidKind(opts.suggestedKind) ? opts.suggestedKind : 'html';
    kindSel.disabled = Boolean(opts.entryOnly);
    kindSel.closest('.mb-3')?.classList.toggle('d-none', Boolean(opts.entryOnly));
  }

  const showEntry = Boolean(opts.bundleId);
  if (entryWrap) entryWrap.classList.toggle('d-none', !showEntry);
  if (showEntry && entrySel) {
    const bundle = getBundleFn(opts.bundleId);
    entrySel.replaceChildren();
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '(none yet)';
    entrySel.appendChild(blank);
    for (const id of bundle?.fileIds || []) {
      const file = getFileFn(id);
      if (!file) continue;
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = file.name + (isEntryName(file.name) ? ' · convention' : '');
      entrySel.appendChild(opt);
    }
    entrySel.value = opts.suggestedEntryId || guessEntryId(bundle?.fileIds, Object.fromEntries(
      (bundle?.fileIds || []).map(id => [id, getFileFn(id)]).filter(([, f]) => f)
    )) || '';
  }
}

function contentHits(text) {
  const sample = text.slice(0, 8000);
  const trimmed = sample.trim();
  const hits = [];

  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed !== null && typeof parsed === 'object') {
        hits.push({ kind: 'json', why: 'valid JSON' });
      }
    } catch (_) { /* not json */ }
  }

  if (looksLikeHtml(sample)) hits.push({ kind: 'html', why: 'HTML markup' });
  if (looksLikeJsx(sample)) hits.push({ kind: 'jsx', why: 'JSX / React' });
  else if (looksLikeJs(sample)) hits.push({ kind: 'js', why: 'JavaScript' });
  if (looksLikeCss(sample)) hits.push({ kind: 'css', why: 'CSS' });

  return hits;
}

function looksLikeHtml(sample) {
  if (/<!DOCTYPE\s+html|<html[\s>]/i.test(sample)) return true;
  if (/<\/(html|head|body|div|section|main)>/i.test(sample) && /<(div|p|span|body|head|meta|link|script)[\s>]/i.test(sample)) {
    return !looksLikeJsx(sample);
  }
  return false;
}

function looksLikeJsx(sample) {
  if (/\bfrom\s+['"]react['"]|\bimport\s+React\b|\bReactDOM\b/.test(sample)) return true;
  if (/<[A-Z][A-Za-z0-9]*(\s|>|\/)/.test(sample)) return true;
  if (/\breturn\s*\(\s*<[a-zA-Z]/.test(sample)) return true;
  return false;
}

function looksLikePlainJsStrong(sample) {
  return /\b(module\.exports|require\s*\(|window\.|document\.)/.test(sample) && !looksLikeJsx(sample);
}

function looksLikeJs(sample) {
  if (looksLikeJsx(sample)) return false;
  return /\b(function|const|let|var|import|export|=>)\b/.test(sample) &&
    !looksLikeCss(sample);
}

function looksLikeCss(sample) {
  if (/^\s*[{}]\s*$/m.test(sample)) return false;
  const rules = (sample.match(/[a-z-]+\s*:\s*[^;{}]+;/gi) || []).length;
  const blocks = (sample.match(/\{[^{}]*\}/g) || []).length;
  if (/@(media|keyframes|import|font-face)\b/i.test(sample) && blocks) return true;
  return rules >= 3 && blocks >= 1 && !/<[a-zA-Z]/.test(sample);
}

if (import.meta.env.DEV) {
  console.assert(sniffKind('a.html', '').kind === 'html');
  console.assert(sniffKind('x.txt', '<!DOCTYPE html><html></html>').kind === 'html');
  console.assert(sniffKind('x.txt', 'import React from "react";\nexport default function App(){return <div/>}').kind === 'jsx');
  console.assert(sniffKind('x.txt', '{"a":1}').kind === 'json');
  console.assert(sniffKind('x.txt', 'zzz').ambiguous === true);
}
