export const $ = (selector, root = document) => root.querySelector(selector);

export const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
export const RAW = new Set(['script','style','pre','textarea']);

export const esc = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

export const cleanName = value => String(value || '').replace(/\\/g, '/').split('/').pop().trim() || 'untitled.html';

export const timestamp = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' :
    date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const sizeText = bytes => bytes < 1024 ? bytes + ' B' :
  bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1048576).toFixed(2) + ' MB';

export function makeId() {
  return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function describe(error) {
  if (error instanceof Error) return error.stack || error.message;
  if (typeof error === 'string') return error;
  try { return JSON.stringify(error); } catch (_) { return String(error); }
}
