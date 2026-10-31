import { transform } from 'sucrase'
import runtimeUrl from './preview-runtime.js?url'
import { makeId, describe, VOID, RAW } from './util.js'
import { activeFile } from './state.js'

let frame = null
let previewToken = ''

let flushEditor = () => {}
let log = () => {}
let toast = () => {}
let showResults = () => {}
let setMobileView = () => {}

export function bindPreviewUi(hooks) {
  frame = hooks.frame
  flushEditor = hooks.flushEditor
  log = hooks.log
  toast = hooks.toast
  showResults = hooks.showResults
  setMobileView = hooks.setMobileView
}

export function getPreviewToken() {
  return previewToken
}

/** Use File.kind when present; else light name/content sniff (does not own kind.js). */
export function resolvePreviewKind(file) {
  if (!file) return 'html'
  const kind = file.kind
  if (kind === 'html' || kind === 'jsx') return kind
  if (kind === 'css' || kind === 'js' || kind === 'json' || kind === 'image') return kind

  const name = String(file.name || '').toLowerCase()
  if (/\.tsx?$/.test(name) || /\.jsx$/.test(name)) return 'jsx'
  if (/\.html?$/.test(name) || /\.xhtml$/.test(name)) return 'html'
  if (/\.css$/.test(name)) return 'css'
  if (/\.json$/.test(name)) return 'json'
  if (/\.(png|jpe?g|gif|webp|svg|ico)$/.test(name)) return 'image'
  if (/\.m?js$/.test(name) && !/\.jsx$/.test(name)) return 'js'

  const content = String(file.content || '')
  const head = content.slice(0, 4000)
  if (/^\s*<!doctype\s+html/i.test(head) || /^\s*<html[\s>]/i.test(head)) return 'html'
  if (
    /\bfrom\s+['"]react['"]/.test(head) ||
    /\bimport\s+React\b/.test(head) ||
    /<[A-Z][A-Za-z0-9]*[\s/>]/.test(head) ||
    /<\/[A-Z][A-Za-z0-9]*>/.test(head)
  ) {
    return 'jsx'
  }
  return 'html'
}

export function validateHTML(source) {
  const errors = []
  const warnings = []
  if (!source.trim()) return { errors: ['Document is empty.'], warnings }

  if (!/<!doctype\s+html\s*>/i.test(source)) warnings.push('Missing <!DOCTYPE html> declaration.')
  if (!/<html(?:\s|>)/i.test(source)) warnings.push('Missing <html> root element.')
  if (!/<head(?:\s|>)/i.test(source)) warnings.push('Missing <head> section.')
  if (!/<body(?:\s|>)/i.test(source)) warnings.push('Missing <body> section.')
  if (!/<title(?:\s|>)/i.test(source)) warnings.push('Missing <title> element.')
  if (!/<meta\b[^>]*\bname\s*=\s*["']viewport["']/i.test(source)) warnings.push('Missing viewport meta tag.')

  try {
    const parsed = new DOMParser().parseFromString(source, 'text/html')
    const ids = new Set()
    for (const element of parsed.querySelectorAll('[id]')) {
      if (ids.has(element.id)) warnings.push('Duplicate id: "' + element.id + '".')
      ids.add(element.id)
    }
    for (const image of parsed.querySelectorAll('img')) {
      if (!image.hasAttribute('alt')) warnings.push('An image is missing its alt attribute.')
    }
  } catch (error) {
    errors.push('HTML parsing failed: ' + describe(error))
  }
  return { errors, warnings }
}

export function validateJsx(source) {
  const errors = []
  const warnings = []
  if (!String(source || '').trim()) return { errors: ['Document is empty.'], warnings }
  try {
    prepareJsxExecutable(source)
  } catch (error) {
    errors.push('JSX/TSX transform failed: ' + (error && error.message ? error.message : describe(error)))
  }
  if (!/export\s+default\b|\bfunction\s+App\b|\bconst\s+App\b|\bclass\s+App\b|\bfunction\s+Main\b/.test(source)) {
    warnings.push('No default export, App, or Main detected — Preview may render a blank root.')
  }
  return { errors, warnings }
}

function transformJsxSource(source) {
  return transform(String(source || ''), {
    transforms: ['typescript', 'jsx'],
    jsxRuntime: 'classic',
    production: true,
  }).code
}

/** Map react / react-dom imports onto injected React + createRoot (single-file Preview). */
function rewriteImports(code) {
  let out = String(code || '')
  out = out.replace(
    /import\s+([A-Za-z_$][\w$]*)\s*,\s*\{([^}]*)\}\s*from\s*['"]react['"]\s*;?/g,
    (_, def, named) => `const ${def} = React; const {${named}} = React;`
  )
  out = out.replace(
    /import\s+\{([^}]*)\}\s*from\s*['"]react['"]\s*;?/g,
    (_, named) => `const {${named}} = React;`
  )
  out = out.replace(
    /import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s*from\s*['"]react['"]\s*;?/g,
    (_, def) => `const ${def} = React;`
  )
  out = out.replace(
    /import\s+([A-Za-z_$][\w$]*)\s*from\s*['"]react['"]\s*;?/g,
    (_, def) => `const ${def} = React;`
  )
  out = out.replace(
    /import\s+\{([^}]*)\}\s*from\s*['"]react-dom(?:\/client)?['"]\s*;?/g,
    'const {$1} = { createRoot };'
  )
  out = out.replace(
    /import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s*from\s*['"]react-dom(?:\/client)?['"]\s*;?/g,
    (_, def) => `const ${def} = { createRoot };`
  )
  out = out.replace(
    /import\s+([A-Za-z_$][\w$]*)\s*from\s*['"]react-dom(?:\/client)?['"]\s*;?/g,
    (_, def) => `const ${def} = { createRoot };`
  )
  // shortcut: single-file Preview cannot fetch sibling CSS/modules yet
  out = out.replace(/import\s+['"][^'"]+['"]\s*;?/g, '/* stripped side-effect import */')
  if (/\bimport\s+/.test(out)) {
    out = out.replace(
      /import\s[\s\S]*?from\s*['"][^'"]+['"]\s*;?/g,
      match => `throw new Error(${JSON.stringify('Unsupported import in single-file JSX Preview: ' + match.trim())});`
    )
  }
  return out
}

/** Strip ESM export wrappers so classic React.createElement code can run in the iframe boot. */
function rewriteExports(code) {
  return String(code || '')
    .replace(/export\s+default\s+async\s+function\s+([A-Za-z_$][\w$]*)/g, 'async function $1')
    .replace(/export\s+default\s+function\s+([A-Za-z_$][\w$]*)/g, 'function $1')
    .replace(/export\s+default\s+class\s+([A-Za-z_$][\w$]*)/g, 'class $1')
    .replace(/export\s+default\s+/g, 'const __VaultEntry = ')
    .replace(/export\s+async\s+function\s+/g, 'async function ')
    .replace(/export\s+function\s+/g, 'function ')
    .replace(/export\s+class\s+/g, 'class ')
    .replace(/export\s+const\s+/g, 'const ')
    .replace(/export\s+let\s+/g, 'let ')
    .replace(/export\s+var\s+/g, 'var ')
    .replace(/export\s*\{[^}]*\}\s*;?/g, '')
}

function prepareJsxExecutable(source) {
  return rewriteExports(rewriteImports(transformJsxSource(source)))
}

function consoleBridge() {
  previewToken = makeId() + makeId()
  return `<script>
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
  <\/script>`
}

export function buildPreview(source) {
  const bridge = consoleBridge()
  const headTag = /<head(?:\s[^>]*)?>/i
  if (headTag.test(source)) return source.replace(headTag, tag => tag + bridge)

  const doctype = /^\s*<!doctype[^>]*>/i.exec(source)
  return doctype
    ? source.slice(0, doctype[0].length) + bridge + source.slice(doctype[0].length)
    : bridge + source
}

export function buildJsxPreview(source) {
  const bridge = consoleBridge()
  const transformed = prepareJsxExecutable(source)
  const runtime = JSON.stringify(runtimeUrl)
  const user = JSON.stringify(transformed)
  const selfMounts = /\bcreateRoot\s*\(/.test(transformed) || /\bReactDOM\.render\s*\(/.test(transformed)
  const mount = selfMounts
    ? ''
    : '\\n;' +
      'const __Entry = typeof __VaultEntry !== "undefined" ? __VaultEntry' +
      ' : (typeof App !== "undefined" ? App : (typeof Main !== "undefined" ? Main : null));' +
      'const rootEl = document.getElementById("root");' +
      'if (__Entry && rootEl) createRoot(rootEl).render(React.createElement(__Entry));' +
      'else if (!__Entry) console.error("JSX Preview: no default export, App, or Main to mount.");'
  const boot = `<script type="module">
    import { React, createRoot } from ${runtime};
    const __user = ${user};
    const __run = new Function('React', 'createRoot', __user + ${JSON.stringify(mount)});
    __run(React, createRoot);
  <\/script>`

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JSX Preview</title>
  ${bridge}
</head>
<body>
  <div id="root"></div>
  ${boot}
</body>
</html>`
}

function buildUnsupportedPreview(kind, name) {
  previewToken = makeId() + makeId()
  const label = escText(kind || 'unknown')
  const fileName = escText(name || 'file')
  return `<!doctype html><html><body style="font:14px system-ui;padding:1rem">
    <p><strong>${fileName}</strong> is Kind <code>${label}</code>.</p>
    <p>Preview boots HTML or JSX/TSX Entry Files only.</p>
  </body></html>`
}

function escText(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char])
}

export function renderPreview() {
  flushEditor()
  const file = activeFile()
  if (!file) {
    frame.srcdoc = '<!doctype html><html><body><p>No file selected.</p></body></html>'
    return
  }
  try {
    const kind = resolvePreviewKind(file)
    if (kind === 'jsx') {
      frame.srcdoc = buildJsxPreview(file.content)
      return
    }
    if (kind === 'html') {
      frame.srcdoc = buildPreview(file.content)
      return
    }
    frame.srcdoc = buildUnsupportedPreview(kind, file.name)
  } catch (error) {
    log('error', 'Could not render preview.', describe(error))
    toast('Preview failed. Check logs for details.', 'danger')
    frame.srcdoc = `<!doctype html><html><body><pre style="color:#b00020;padding:1rem;white-space:pre-wrap">${escText(describe(error))}</pre></body></html>`
  }
}

export function compile() {
  flushEditor()
  const file = activeFile()
  if (!file) return toast('Select a file first', 'warning')

  const kind = resolvePreviewKind(file)
  if (kind === 'jsx') {
    const results = validateJsx(file.content)
    showResults(results)
    renderPreview()
    setMobileView('preview')
    if (results.errors.length) {
      log('error', 'JSX/TSX transform found errors.', results.errors.join('\n'))
    } else {
      toast(results.warnings.length ? 'JSX Preview loaded with warnings' : 'JSX Preview ready',
        results.warnings.length ? 'warning' : 'success')
    }
    return
  }

  if (kind !== 'html') {
    showResults({ errors: [], warnings: [`Kind "${kind}" is not an HTML/JSX Entry — Preview shows a notice.`] })
    renderPreview()
    setMobileView('preview')
    toast('This Kind is not previewable as an Entry', 'warning')
    return
  }

  const results = validateHTML(file.content)
  showResults(results)
  renderPreview()
  setMobileView('preview')

  if (results.errors.length) {
    log('error', 'HTML validation found errors.', results.errors.join('\n'))
  } else {
    toast(results.warnings.length ? 'Preview loaded with warnings' : 'Validation passed',
      results.warnings.length ? 'warning' : 'success')
  }
}

export function formatHTML(source) {
  const tokens = String(source || '').trim().match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][^>]*>|[^<]+|</g) || []
  const output = []
  let indent = 0
  let rawTag = ''
  let rawBuffer = ''

  for (const token of tokens) {
    const trimmed = token.trim()
    if (rawTag) {
      rawBuffer += token
      if (new RegExp('</' + rawTag + '\\s*>', 'i').test(rawBuffer)) {
        output.push('  '.repeat(Math.max(0, indent - 1)) + rawBuffer.trim())
        rawTag = ''
        rawBuffer = ''
        indent = Math.max(0, indent - 1)
      }
      continue
    }
    if (!trimmed) continue

    if (/^<\//.test(trimmed)) {
      indent = Math.max(0, indent - 1)
      output.push('  '.repeat(indent) + trimmed)
    } else if (/^<!--/.test(trimmed) || /^<!/.test(trimmed)) {
      output.push('  '.repeat(indent) + trimmed)
    } else if (/^</.test(trimmed)) {
      const match = /^<([a-zA-Z][a-zA-Z0-9:-]*)/.exec(trimmed)
      const tag = match ? match[1].toLowerCase() : ''
      output.push('  '.repeat(indent) + trimmed)
      if (RAW.has(tag) && !/\/\s*>$/.test(trimmed)) {
        rawTag = tag
        indent++
      } else if (tag && !VOID.has(tag) && !/\/\s*>$/.test(trimmed)) {
        indent++
      }
    } else {
      output.push('  '.repeat(indent) + trimmed)
    }
  }

  if (rawBuffer) output.push('  '.repeat(Math.max(0, indent - 1)) + rawBuffer.trim())
  return output.join('\n') + '\n'
}

export function getPreviewFrame() {
  return frame
}
