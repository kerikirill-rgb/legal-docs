import { useMemo, useRef, useState } from 'react'
import {
  Search,
  Trash2,
  Eye,
  Pencil,
  Download,
  Upload,
  Printer,
  FileDown,
} from 'lucide-react'
import Card from '../components/Card'
import { useStore } from '../context/StoreContext'
import { exportDocumentsZip, importDocumentsZip } from '../utils/zipDocuments'
import { printHtmlFragment, downloadHtmlFile } from '../utils/print'
import { downloadDocumentDocx } from '../utils/docxExport'
import { newId } from '../utils/ids'

const TYPES = [
  { value: '', label: 'Все типы' },
  { value: 'contract', label: 'Договор' },
  { value: 'invoice', label: 'Счёт' },
  { value: 'act', label: 'Акт' },
  { value: 'upd', label: 'УПД' },
]

function typeRu(t) {
  return TYPES.find((x) => x.value === t)?.label || t
}

export default function DocumentsPage() {
  const { documents, deleteDocument, upsertDocument, openDocumentInWizard } = useStore()
  const [qInn, setQInn] = useState('')
  const [qName, setQName] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortKey, setSortKey] = useState('updatedAt')
  const [sortDir, setSortDir] = useState('desc')
  const [preview, setPreview] = useState(null)
  const zipImportRef = useRef(null)
  const [msg, setMsg] = useState('')

  const filtered = useMemo(() => {
    let list = [...documents]
    const inn = qInn.replace(/\D/g, '')
    if (inn) {
      list = list.filter((d) => String(d.contractor?.inn || '').replace(/\D/g, '').includes(inn))
    }
    const nm = qName.trim().toLowerCase()
    if (nm) {
      list = list.filter((d) =>
        String(d.contractor?.name || d.name || '')
          .toLowerCase()
          .includes(nm),
      )
    }
    if (typeFilter) list = list.filter((d) => d.type === typeFilter)
    const from = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : null
    const to = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null
    if (from != null) list = list.filter((d) => new Date(d.createdAt).getTime() >= from)
    if (to != null) list = list.filter((d) => new Date(d.createdAt).getTime() <= to)
    list.sort((a, b) => {
      const av = a[sortKey] || a.createdAt
      const bv = b[sortKey] || b.createdAt
      const na = new Date(av).getTime()
      const nb = new Date(bv).getTime()
      if (!Number.isNaN(na) && !Number.isNaN(nb)) {
        return sortDir === 'asc' ? na - nb : nb - na
      }
      const c = String(av).localeCompare(String(bv), 'ru')
      return sortDir === 'asc' ? c : -c
    })
    return list
  }, [documents, qInn, qName, typeFilter, dateFrom, dateTo, sortKey, sortDir])

  async function onImportZip(ev) {
    const f = ev.target.files?.[0]
    ev.target.value = ''
    if (!f) return
    try {
      const imported = await importDocumentsZip(f)
      imported.forEach((d) => upsertDocument({ ...d, id: d.id || newId(), updatedAt: new Date().toISOString() }))
      setMsg(`Импортировано документов: ${imported.length}`)
    } catch (e) {
      setMsg(`Ошибка импорта: ${e.message}`)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Мои документы</h1>
        <p className="mt-1 text-sm text-slate-600">Поиск по ИНН, названию, диапазону дат и типу. Экспорт и импорт ZIP.</p>
      </div>
      {msg ? <p className="text-sm text-blue-700">{msg}</p> : null}
      <Card title="Фильтры">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-sm"
              placeholder="ИНН контрагента"
              value={qInn}
              onChange={(e) => setQInn(e.target.value)}
            />
          </div>
          <input
            className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
            placeholder="Название организации"
            value={qName}
            onChange={(e) => setQName(e.target.value)}
          />
          <input
            type="date"
            className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <input
            type="date"
            className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <select
            className="rounded-lg border border-slate-200 px-2 py-2 text-sm lg:col-span-4"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            {TYPES.map((t) => (
              <option key={t.value || 'all'} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportDocumentsZip(documents)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
          >
            <Download className="h-4 w-4" />
            Экспорт всех в ZIP
          </button>
          <button
            type="button"
            onClick={() => zipImportRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <Upload className="h-4 w-4" />
            Импорт из ZIP
          </button>
          <input ref={zipImportRef} type="file" accept=".zip,application/zip" className="hidden" onChange={onImportZip} />
        </div>
      </Card>
      <Card
        title="Таблица"
        actions={
          <div className="flex gap-2 text-xs">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="rounded border border-slate-200 px-2 py-1"
            >
              <option value="updatedAt">По обновлению</option>
              <option value="createdAt">По созданию</option>
              <option value="name">По названию</option>
            </select>
            <button
              type="button"
              className="rounded border border-slate-200 px-2 py-1"
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            >
              {sortDir === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-slate-500">
                <th className="pb-2 pr-3">Название</th>
                <th className="pb-2 pr-3">Тип</th>
                <th className="pb-2 pr-3">Контрагент</th>
                <th className="pb-2 pr-3">ИНН</th>
                <th className="pb-2 pr-3">Создан</th>
                <th className="pb-2 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-slate-50">
                  <td className="py-2 pr-3 font-medium text-slate-800">{d.name}</td>
                  <td className="py-2 pr-3">{typeRu(d.type)}</td>
                  <td className="py-2 pr-3 text-slate-700">{d.contractor?.name}</td>
                  <td className="py-2 pr-3">{d.contractor?.inn}</td>
                  <td className="py-2 pr-3 text-slate-500">{new Date(d.createdAt).toLocaleString('ru-RU')}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      className="mr-1 inline-flex rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                      title="Просмотр"
                      onClick={() => setPreview(d)}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="mr-1 inline-flex rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                      title="Редактировать"
                      onClick={() => openDocumentInWizard(d)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="mr-1 inline-flex rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                      title="Печать"
                      onClick={() => printHtmlFragment(d.content, d.name)}
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex rounded border border-red-100 p-1.5 text-red-600 hover:bg-red-50"
                      title="Удалить"
                      onClick={() => {
                        if (confirm('Удалить документ?')) deleteDocument(d.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Нет документов по фильтру</p> : null}
        </div>
      </Card>
      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-slate-900">{preview.name}</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
                  onClick={() => printHtmlFragment(preview.content, preview.name)}
                >
                  <Printer className="h-3.5 w-3.5" /> Печать
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
                  onClick={() => downloadHtmlFile(preview.content, preview.name)}
                >
                  <FileDown className="h-3.5 w-3.5" /> HTML
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
                  onClick={() => downloadDocumentDocx(preview, preview.name)}
                >
                  <FileDown className="h-3.5 w-3.5" /> DOCX
                </button>
                <button type="button" className="rounded bg-slate-100 px-2 py-1 text-xs" onClick={() => setPreview(null)}>
                  Закрыть
                </button>
              </div>
            </div>
            <div
              className="max-h-[calc(90vh-56px)] overflow-auto p-4 text-sm"
              dangerouslySetInnerHTML={{ __html: preview.content }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
