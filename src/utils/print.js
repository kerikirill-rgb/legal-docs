export function printHtmlFragment(html, title = 'Печать') {
  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) {
    window.alert('Разрешите всплывающие окна для печати')
    return
  }
  w.document.open()
  w.document.write(`<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/><title>${escape(title)}</title>
  <style>
    @media print { body { margin: 12mm; } }
    body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color:#111; }
  </style></head><body class="print-root">${html || ''}</body></html>`)
  w.document.close()
  w.focus()
  requestAnimationFrame(() => {
    w.print()
  })
}

function escape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

export function downloadHtmlFile(html, filename) {
  const blob = new Blob(
    [`<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/><title>doc</title></head><body>${html || ''}</body></html>`],
    { type: 'text/html;charset=utf-8' },
  )
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${filename.replace(/[\\/:*?"<>|]+/g, '_')}.html`
  a.click()
  URL.revokeObjectURL(a.href)
}
