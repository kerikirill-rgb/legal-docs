import { ArrowRight, FileText } from 'lucide-react'
import Card from '../components/Card'
import { useStore } from '../context/StoreContext'

function typeRu(t) {
  const m = { contract: 'Договор', invoice: 'Счёт', act: 'Акт', upd: 'УПД' }
  return m[t] || t
}

export default function Dashboard() {
  const { documents, setView } = useStore()
  const latest = [...documents].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 8)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Дашборд</h1>
        <p className="mt-1 text-sm text-slate-600">Последние документы и быстрый доступ к разделам.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Создать документ">
          <p className="text-sm text-slate-600">Пошаговый мастер: тип, шаблон, контрагент, позиции, НДС.</p>
          <button
            type="button"
            onClick={() => setView('wizard')}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
          >
            Перейти <ArrowRight className="h-4 w-4" />
          </button>
        </Card>
        <Card title="Контрагенты">
          <p className="text-sm text-slate-600">Справочник с поиском по ИНН и названию.</p>
          <button
            type="button"
            onClick={() => setView('contractors')}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Открыть
          </button>
        </Card>
        <Card title="Настройки компании">
          <p className="text-sm text-slate-600">Реквизиты исполнителя, печать и подпись для документов.</p>
          <button
            type="button"
            onClick={() => setView('settings')}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Настроить
          </button>
        </Card>
      </div>
      <Card title="Последние документы">
        {latest.length === 0 ? (
          <p className="text-sm text-slate-500">Пока нет сохранённых документов.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {latest.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-slate-800">{d.name}</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{typeRu(d.type)}</span>
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(d.createdAt).toLocaleString('ru-RU')}
                </span>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => setView('documents')}
          className="mt-4 text-sm font-medium text-blue-600 hover:underline"
        >
          Все документы →
        </button>
      </Card>
    </div>
  )
}
