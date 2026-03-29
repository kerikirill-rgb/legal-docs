import { useState } from 'react'
import { Trash2, Upload, FileType } from 'lucide-react'
import mammoth from 'mammoth'
import Card from '../components/Card'
import { useStore } from '../context/StoreContext'
const DOC_TYPES = [
  { value: 'contract', label: 'Договор' },
  { value: 'invoice', label: 'Счёт' },
  { value: 'act', label: 'Акт' },
  { value: 'upd', label: 'УПД' },
]

function typeRu(t) {
  return DOC_TYPES.find((x) => x.value === t)?.label ?? t
}

export default function TemplatesPage() {
  const { templates, addTemplate, deleteTemplate } = useStore()
  const [name, setName] = useState('')
  const [type, setType] = useState('contract')
  const [err, setErr] = useState('')
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  const sorted = [...templates].sort((a, b) => {
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    const c = String(av).localeCompare(String(bv), 'ru')
    return sortDir === 'asc' ? c : -c
  })

  async function onFile(ev) {
    const f = ev.target.files?.[0]
    ev.target.value = ''
    if (!f) return
    setErr('')
    const low = f.name.toLowerCase()
    try {
      let content = ''
      if (low.endsWith('.txt') || low.endsWith('.html') || low.endsWith('.htm')) {
        content = await f.text()
      } else if (low.endsWith('.docx')) {
        const ab = await f.arrayBuffer()
        const r = await mammoth.extractRawText({ arrayBuffer: ab })
        content = r.value || ''
      } else {
        setErr('Поддерживаются .txt, .html, .docx')
        return
      }
      addTemplate({
        name: name.trim() || f.name.replace(/\.[^.]+$/, ''),
        type,
        content,
      })
      setName('')
    } catch (e) {
      setErr(String(e.message || e))
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Шаблоны</h1>
        <p className="mt-1 text-sm text-slate-600">
          Встроенные шаблоны соответствуют обобщённой структуре документов по законодательству РФ; загрузите свой файл с плейсхолдерами{' '}
          <code className="rounded bg-slate-100 px-1">{'{{ITEMS_TABLE}}'}</code> и{' '}
          <code className="rounded bg-slate-100 px-1">{'{{ИСПОЛНИТЕЛЬ_INN}}'}</code> и т.д.
        </p>
      </div>
      <Card title="Загрузить свой шаблон">
        {err ? <p className="mb-2 text-sm text-red-600">{err}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium uppercase text-slate-500">Название (необязательно)</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Мой договор поставки"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-slate-500">Тип документа</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {DOC_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm font-medium text-blue-700 hover:bg-slate-100">
          <Upload className="h-5 w-5" />
          Выбрать .txt, .html или .docx
          <input type="file" accept=".txt,.html,.htm,.docx" className="hidden" onChange={onFile} />
        </label>
      </Card>
      <Card
        title="Список шаблонов"
        actions={
          <div className="flex gap-2 text-xs">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="rounded border border-slate-200 px-2 py-1"
            >
              <option value="name">По названию</option>
              <option value="type">По типу</option>
              <option value="createdAt">По дате</option>
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
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="pb-2 pr-4">Название</th>
                <th className="pb-2 pr-4">Тип</th>
                <th className="pb-2 pr-4">Источник</th>
                <th className="pb-2 pr-4">Дата</th>
                <th className="pb-2 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id} className="border-b border-slate-50">
                  <td className="py-2 pr-4 font-medium text-slate-800">{t.name}</td>
                  <td className="py-2 pr-4">{typeRu(t.type)}</td>
                  <td className="py-2 pr-4">
                    {t.isCustom ? (
                      <span className="text-slate-600">Пользовательский</span>
                    ) : (
                      <span className="text-blue-600">Встроенный</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-slate-500">
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString('ru-RU') : '—'}
                  </td>
                  <td className="py-2 text-right">
                    {t.isCustom ? (
                      <button
                        type="button"
                        onClick={() => deleteTemplate(t.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-100 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Удалить
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex items-center gap-1 text-xs text-slate-500">
          <FileType className="h-3.5 w-3.5" />
          Встроенные шаблоны нельзя удалить; при необходимости скройте их, создав свои копии.
        </p>
      </Card>
    </div>
  )
}
