import { useMemo, useState } from 'react'
import { Plus, Search, Trash2, Pencil } from 'lucide-react'
import Card from '../components/Card'
import { useStore } from '../context/StoreContext'
import { validateInn, digitsOnlyInn } from '../utils/inn'

const empty = {
  name: '',
  shortName: '',
  inn: '',
  kpp: '',
  ogrn: '',
  address: '',
  bank: '',
  bik: '',
  account: '',
  correspondentAccount: '',
  director: '',
  directorPosition: '',
  email: '',
  phone: '',
}

export default function ContractorsPage() {
  const { contractors, addContractor, updateContractor, deleteContractor } = useStore()
  const [q, setQ] = useState('')
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [err, setErr] = useState('')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return contractors
    return contractors.filter((c) => {
      const inn = digitsOnlyInn(c.inn)
      const qs = s.replace(/\D/g, '')
      if (qs && inn.includes(qs)) return true
      return (c.name || '').toLowerCase().includes(s) || (c.shortName || '').toLowerCase().includes(s)
    })
  }, [contractors, q])

  function onChange(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function startEdit(c) {
    setEditId(c.id)
    setForm({
      name: c.name ?? '',
      shortName: c.shortName ?? '',
      inn: c.inn ?? '',
      kpp: c.kpp ?? '',
      ogrn: c.ogrn ?? '',
      address: c.address ?? '',
      bank: c.bank ?? '',
      bik: c.bik ?? '',
      account: c.account ?? '',
      correspondentAccount: c.correspondentAccount ?? '',
      director: c.director ?? '',
      directorPosition: c.directorPosition ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
    })
    setErr('')
  }

  function resetForm() {
    setForm(empty)
    setEditId(null)
    setErr('')
  }

  function save(e) {
    e.preventDefault()
    setErr('')
    if (!form.name.trim()) {
      setErr('Укажите полное наименование организации')
      return
    }
    const inn = digitsOnlyInn(form.inn)
    if (inn && !validateInn(inn)) {
      setErr('ИНН неверный (проверьте 10 или 12 цифр и контрольные разряды)')
      return
    }
    const row = { ...form, inn }
    if (editId) {
      updateContractor(editId, row)
      resetForm()
      return
    }
    addContractor(row)
    resetForm()
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Контрагенты</h1>
        <p className="mt-1 text-sm text-slate-600">Справочник сторон договоров. Поиск по ИНН и названию.</p>
      </div>
      <Card title={editId ? 'Редактирование контрагента' : 'Новый контрагент'}>
        {err ? <p className="mb-3 text-sm text-red-600">{err}</p> : null}
        <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
          <Field label="Полное название *" value={form.name} onChange={(v) => onChange('name', v)} />
          <Field label="Сокращённое название" value={form.shortName} onChange={(v) => onChange('shortName', v)} />
          <Field label="ИНН" value={form.inn} onChange={(v) => onChange('inn', v)} />
          <Field label="КПП" value={form.kpp} onChange={(v) => onChange('kpp', v)} />
          <Field label="ОГРН" value={form.ogrn} onChange={(v) => onChange('ogrn', v)} />
          <Field label="Юридический адрес" value={form.address} onChange={(v) => onChange('address', v)} />
          <Field label="Банк" value={form.bank} onChange={(v) => onChange('bank', v)} />
          <Field label="БИК" value={form.bik} onChange={(v) => onChange('bik', v)} />
          <Field label="Расчётный счёт" value={form.account} onChange={(v) => onChange('account', v)} />
          <Field label="Корсчёт банка" value={form.correspondentAccount} onChange={(v) => onChange('correspondentAccount', v)} />
          <Field label="ФИО руководителя" value={form.director} onChange={(v) => onChange('director', v)} />
          <Field label="Должность руководителя" value={form.directorPosition} onChange={(v) => onChange('directorPosition', v)} />
          <Field label="Email" value={form.email} onChange={(v) => onChange('email', v)} type="email" />
          <Field label="Телефон" value={form.phone} onChange={(v) => onChange('phone', v)} />
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              {editId ? 'Сохранить изменения' : 'Добавить в справочник'}
            </button>
            {editId ? (
              <button type="button" onClick={resetForm} className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">
                Отмена
              </button>
            ) : null}
          </div>
        </form>
      </Card>
      <Card
        title="Справочник"
        actions={
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="w-64 rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm"
              placeholder="ИНН или название…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="pb-2 pr-3">Название</th>
                <th className="pb-2 pr-3">ИНН</th>
                <th className="pb-2 pr-3">КПП</th>
                <th className="pb-2 pr-3">Руководитель</th>
                <th className="pb-2 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-50">
                  <td className="py-2 pr-3 font-medium text-slate-800">{c.name}</td>
                  <td className="py-2 pr-3">{c.inn}</td>
                  <td className="py-2 pr-3">{c.kpp}</td>
                  <td className="py-2 pr-3 text-slate-600">{c.director}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="mr-1 inline-flex rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                      title="Изменить"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteContractor(c.id)}
                      className="inline-flex rounded-lg border border-red-100 p-1.5 text-red-600 hover:bg-red-50"
                      title="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Нет записей</p> : null}
        </div>
      </Card>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="text-xs font-medium uppercase text-slate-500">{label}</label>
      <input
        type={type}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
