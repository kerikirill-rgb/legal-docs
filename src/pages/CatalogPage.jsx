import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Card from '../components/Card'
import { useStore } from '../context/StoreContext'

export default function CatalogPage() {
  const { catalog, addCatalogItem, updateCatalogItem, deleteCatalogItem } = useStore()
  const [row, setRow] = useState({
    name: '',
    quantity: 1,
    unit: 'шт.',
    price: 0,
    type: 'service',
  })
  const [err, setErr] = useState('')

  function add(e) {
    e.preventDefault()
    setErr('')
    if (!row.name.trim()) {
      setErr('Укажите наименование')
      return
    }
    if (Number(row.price) < 0 || Number(row.quantity) < 0) {
      setErr('Количество и цена не могут быть отрицательными')
      return
    }
    addCatalogItem(row)
    setRow({ name: '', quantity: 1, unit: 'шт.', price: 0, type: 'service' })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Услуги и товары</h1>
        <p className="mt-1 text-sm text-slate-600">
          Типовые позиции для мастера документов. Для товаров доступен УПД; для услуг — акт и счёт.
        </p>
      </div>
      <Card title="Добавить в справочник">
        {err ? <p className="mb-2 text-sm text-red-600">{err}</p> : null}
        <form onSubmit={add} className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="text-xs font-medium uppercase text-slate-500">Наименование</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={row.name}
              onChange={(e) => setRow((r) => ({ ...r, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-slate-500">Количество</label>
            <input
              type="number"
              min="0"
              step="any"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={row.quantity}
              onChange={(e) => setRow((r) => ({ ...r, quantity: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-slate-500">Ед.</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={row.unit}
              onChange={(e) => setRow((r) => ({ ...r, unit: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-slate-500">Цена</label>
            <input
              type="number"
              min="0"
              step="any"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={row.price}
              onChange={(e) => setRow((r) => ({ ...r, price: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-slate-500">Тип</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={row.type}
              onChange={(e) => setRow((r) => ({ ...r, type: e.target.value }))}
            >
              <option value="service">Услуга</option>
              <option value="product">Товар</option>
            </select>
          </div>
          <div className="md:col-span-3 lg:col-span-6">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Сохранить позицию
            </button>
          </div>
        </form>
      </Card>
      <Card title="Справочник позиций">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="pb-2 pr-3">Наименование</th>
                <th className="pb-2 pr-3">Тип</th>
                <th className="pb-2 pr-3">Кол-во</th>
                <th className="pb-2 pr-3">Ед.</th>
                <th className="pb-2 pr-3">Цена</th>
                <th className="pb-2 pr-3">Сумма</th>
                <th className="pb-2 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((c) => (
                <tr key={c.id} className="border-b border-slate-50">
                  <td className="py-2 pr-3">
                    <input
                      className="w-full min-w-[140px] rounded border border-slate-200 px-2 py-1 text-sm"
                      value={c.name}
                      onChange={(e) => updateCatalogItem(c.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      className="rounded border border-slate-200 px-2 py-1 text-sm"
                      value={c.type}
                      onChange={(e) => updateCatalogItem(c.id, { type: e.target.value })}
                    >
                      <option value="service">Услуга</option>
                      <option value="product">Товар</option>
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min="0"
                      className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
                      value={c.quantity}
                      onChange={(e) => updateCatalogItem(c.id, { quantity: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
                      value={c.unit}
                      onChange={(e) => updateCatalogItem(c.id, { unit: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min="0"
                      className="w-24 rounded border border-slate-200 px-2 py-1 text-sm"
                      value={c.price}
                      onChange={(e) => updateCatalogItem(c.id, { price: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-3 font-medium">{Number(c.amount).toFixed(2)}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => deleteCatalogItem(c.id)}
                      className="inline-flex rounded-lg border border-red-100 p-1.5 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {catalog.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Пусто</p> : null}
        </div>
      </Card>
    </div>
  )
}
