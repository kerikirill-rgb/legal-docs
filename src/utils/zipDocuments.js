import JSZip from 'jszip'
import { saveAs } from 'file-saver'

const MANIFEST = 'documents.json'

/**
 * @param {object[]} documents
 */
export async function exportDocumentsZip(documents) {
  const zip = new JSZip()
  zip.file(MANIFEST, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), documents }, null, 2))
  documents.forEach((d, i) => {
    const safe = String(d.name || `doc-${i}`).replace(/[\\/:*?"<>|]+/g, '_')
    zip.file(`html/${safe}-${d.id}.html`, wrapHtml(d.content || '', d.name))
  })
  const blob = await zip.generateAsync({ type: 'blob' })
  saveAs(blob, `legal-documents-${fmtFileDate(new Date())}.zip`)
}

/**
 * @param {Blob|File} file
 * @returns {Promise<object[]>}
 */
export async function importDocumentsZip(file) {
  const zip = await JSZip.loadAsync(file)
  const manifest = zip.file(MANIFEST)
  if (!manifest) throw new Error('В архиве нет documents.json')
  const raw = await manifest.async('string')
  const data = JSON.parse(raw)
  if (!data.documents || !Array.isArray(data.documents)) {
    throw new Error('Неверный формат documents.json')
  }
  return data.documents
}

function wrapHtml(body, title) {
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/><title>${escapeAttr(title || '')}</title></head><body>${body || ''}</body></html>`
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function fmtFileDate(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`
}
