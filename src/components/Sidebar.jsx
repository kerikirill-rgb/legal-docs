import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  PlusCircle,
  FolderOpen,
  Settings,
} from 'lucide-react'
import { useStore } from '../context/StoreContext'

const items = [
  { id: 'dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { id: 'templates', label: 'Шаблоны', icon: FileText },
  { id: 'contractors', label: 'Контрагенты', icon: Users },
  { id: 'catalog', label: 'Услуги и товары', icon: Package },
  { id: 'wizard', label: 'Создать документ', icon: PlusCircle },
  { id: 'documents', label: 'Мои документы', icon: FolderOpen },
  { id: 'settings', label: 'Настройки', icon: Settings },
]

export default function Sidebar() {
  const { view, setView } = useStore()
  return (
    <aside className="no-print flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Юридический</div>
        <div className="text-lg font-semibold text-slate-800">Конструктор документов</div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {items.map((it) => {
          const Icon = it.icon
          const active = view === it.id
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => setView(it.id)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              {it.label}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
