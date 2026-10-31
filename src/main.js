import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import { registerSW } from 'virtual:pwa-register'
import './style.css'

import { $ } from './util.js'
import {
  state,
  loadState,
  saveState,
  activeFile,
  bindStateUi,
} from './state.js'
import {
  bindFilesUi,
  selectFile,
  createFile,
  deleteFile,
  duplicateFile,
  renameFile,
  scheduleSave,
  flushEditor,
  checkpointActive,
  createBundle,
  selectBundle,
  clearActiveBundle,
  deleteBundle,
  renameBundle,
} from './files.js'
import {
  bindPreviewUi,
  getPreviewToken,
  renderPreview,
  compile,
  formatHTML,
} from './preview.js'
import {
  bindIoUi,
  importFiles,
  pasteNew,
  createFromPasteArea,
  clearPendingInsert,
  insertFromClipboard,
  insertIntoEditor,
  splitPastePrompt,
  exportCurrent,
  exportBundle,
  exportZip,
  copyText,
} from './io.js'
import {
  bindUiCore,
  toast,
  log,
  describe,
  renderAll,
  renderLogs,
  clearLogs,
  copyLogs,
  showModal,
  hideModal,
  askConfirm,
  showResults,
  setMobileView,
  updateSearch,
  openHistory,
  handleHistoryClick,
  setListMode,
  setRenameId,
  getRenameId,
  getRenameKind,
  getConfirmCallback,
  setConfirmCallback,
} from './ui.js'
import {
  bindKindUi,
  confirmKindMiss,
  onKindMissHidden,
} from './kind.js'

registerSW({ immediate: true })

const editor = $('#editor')
const frame = $('#previewFrame')

bindUiCore({ editor })
bindStateUi({ log, toast })
bindFilesUi({ editor, toast, renderAll, setMobileView, askConfirm })
bindPreviewUi({ frame, flushEditor, log, toast, showResults, setMobileView })
bindIoUi({ editor, toast, log, renderAll, askConfirm })
bindKindUi({
  showModal,
  hideModal,
  getFile: (id) => state.files[id] || null,
  getBundle: (id) => state.bundles[id] || null,
  saveAndRender: () => { saveState(); renderAll() },
  toast,
})

/* UI events */
$('#btnNew').addEventListener('click', createFile)
$('#btnNew2').addEventListener('click', createFile)
for (const id of ['btnNewBundle', 'btnNewBundle2']) {
  $('#' + id)?.addEventListener('click', () => createBundle('Bundle'))
}
$('#btnImport').addEventListener('click', () => $('#importInput').click())
$('#importInput').addEventListener('change', (event) => {
  importFiles(event.target.files)
  event.target.value = ''
})
$('#btnPaste').addEventListener('click', pasteNew)

$('#pasteOk').addEventListener('click', () => {
  const result = createFromPasteArea()
  if (!result) return
  if (result.kind === 'insert') {
    hideModal('#pasteModal')
    if (result.mode === 'multi') splitPastePrompt(result.content)
    else insertIntoEditor(result.content, result.mode)
    return
  }
  hideModal('#pasteModal')
})

$('#pasteModal').addEventListener('hidden.bs.modal', () => clearPendingInsert())

$('#btnInsertClip').addEventListener('click', () => insertFromClipboard('cursor'))
$('#insCursor').addEventListener('click', (event) => { event.preventDefault(); insertFromClipboard('cursor') })
$('#insAppend').addEventListener('click', (event) => { event.preventDefault(); insertFromClipboard('append') })
$('#insReplace').addEventListener('click', (event) => { event.preventDefault(); insertFromClipboard('replace') })
$('#insMulti').addEventListener('click', (event) => { event.preventDefault(); insertFromClipboard('multi') })

$('#dlCurrent').addEventListener('click', (event) => { event.preventDefault(); exportCurrent() })
$('#dlBundle')?.addEventListener('click', (event) => { event.preventDefault(); exportBundle() })
$('#dlZip').addEventListener('click', (event) => { event.preventDefault(); exportZip() })

$('#btnCompile').addEventListener('click', compile)
$('#btnRefreshPreview').addEventListener('click', renderPreview)
$('#btnFormat').addEventListener('click', () => {
  if (!activeFile()) return
  editor.value = formatHTML(editor.value)
  scheduleSave()
  toast('Formatted', 'success')
})
$('#btnCopy').addEventListener('click', async () => {
  if (!activeFile()) return toast('Select a file first', 'warning')
  const copied = await copyText(editor.value)
  toast(copied ? 'Source copied to clipboard' : 'Could not copy source', copied ? 'success' : 'warning')
})
$('#btnCopyLogs').addEventListener('click', copyLogs)
$('#btnClearConsole').addEventListener('click', clearLogs)
$('#btnCommit').addEventListener('click', checkpointActive)
$('#btnHistory').addEventListener('click', openHistory)
$('#closeResults').addEventListener('click', () => $('#resultBox').classList.add('d-none'))
$('#tabEdit').addEventListener('click', () => setMobileView('edit'))
$('#tabPreview').addEventListener('click', () => { setMobileView('preview'); renderPreview() })

$('#renameOk').addEventListener('click', () => {
  const id = getRenameId()
  const kind = getRenameKind()
  const value = $('#renameInput').value
  const ok = kind === 'bundle' ? renameBundle(id, value) : renameFile(id, value)
  if (ok) hideModal('#renameModal')
})

$('#confirmYes').addEventListener('click', () => {
  const callback = getConfirmCallback()
  setConfirmCallback(null)
  hideModal('#confirmModal')
  if (callback) callback()
})

$('#historyList').addEventListener('click', handleHistoryClick)

$('#kindMissOk')?.addEventListener('click', confirmKindMiss)
$('#kindMissModal')?.addEventListener('hidden.bs.modal', onKindMissHidden)

for (const root of document.querySelectorAll('[data-list-mode-root]')) {
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-list-mode]')
    if (!button) return
    setListMode(button.dataset.listMode)
  })
}

for (const id of ['fileListDesktop', 'fileListCanvas']) {
  $('#' + id).addEventListener('click', (event) => {
    const clearBtn = event.target.closest('.act-clear-bundle')
    if (clearBtn) return clearActiveBundle()

    const item = event.target.closest('.file-item')
    if (!item) return

    const bundleId = item.dataset.bundleId
    if (bundleId) {
      if (event.target.closest('.act-bundle-del')) return deleteBundle(bundleId)
      if (event.target.closest('.act-bundle-rename')) {
        setRenameId(bundleId, 'bundle')
        $('#renameInput').value = state.bundles[bundleId]?.name || ''
        showModal('#renameModal')
        setTimeout(() => $('#renameInput').focus(), 250)
        return
      }
      return selectBundle(bundleId)
    }

    const fileId = item.dataset.id
    if (!fileId) return
    if (event.target.closest('.act-del')) return deleteFile(fileId)
    if (event.target.closest('.act-dup')) return duplicateFile(fileId)
    if (event.target.closest('.act-rename')) {
      setRenameId(fileId, 'file')
      $('#renameInput').value = state.files[fileId]?.name || ''
      showModal('#renameModal')
      setTimeout(() => $('#renameInput').focus(), 250)
      return
    }
    selectFile(fileId)
  })
}

for (const id of ['bundleFilterDesktop', 'bundleFilterCanvas']) {
  const host = $('#' + id)
  if (host) {
    host.addEventListener('click', (event) => {
      if (event.target.closest('.act-clear-bundle')) clearActiveBundle()
    })
  }
}

$('#searchDesktop').addEventListener('input', (event) => updateSearch(event.target.value))
$('#searchMobile').addEventListener('input', (event) => updateSearch(event.target.value))

editor.addEventListener('input', scheduleSave)
editor.addEventListener('blur', flushEditor)
editor.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'v') {
    event.preventDefault()
    insertFromClipboard('cursor')
    return
  }
  if (event.key !== 'Tab') return
  event.preventDefault()
  editor.setRangeText('  ', editor.selectionStart, editor.selectionEnd, 'end')
  scheduleSave()
})

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    $('#btnCommit').click()
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'e') {
    event.preventDefault()
    compile()
  }
})

$('#toggleTheme').addEventListener('click', (event) => {
  event.preventDefault()
  state.theme = state.theme === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-bs-theme', state.theme)
  saveState()
})

window.addEventListener('message', (event) => {
  if (event.source !== frame.contentWindow) return
  const data = event.data
  if (!data || data.__htmlVault !== getPreviewToken()) return
  log(data.type || 'log', data.message || '', data.details || '')
})

window.addEventListener('error', (event) => {
  log('error', event.message || 'Application error', describe(event.error || event.filename))
})
window.addEventListener('unhandledrejection', (event) => {
  log('error', 'Unhandled application promise rejection', describe(event.reason))
})
window.addEventListener('beforeunload', flushEditor)

/* Startup */
loadState()
document.documentElement.setAttribute('data-bs-theme', state.theme)
renderAll()
renderLogs()
setMobileView('edit')
if (state.activeId) renderPreview()
