import { useRef, useState } from 'react'
import { ImagePlus, Download, Upload } from 'lucide-react'
import Card from '../components/Card'
import { useStore } from '../context/StoreContext'
import { validateInn, digitsOnlyInn } from '../utils/inn'

export default function SettingsPage() {
  const { company, updateCompany, exportAllDataJson, importAllDataJson } = useStore()
  const stampRef = useRef(null)
  const sigRef = useRef(null)
  const importRef = useRef(null)
  const [msg, setMsg] = useState('')

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result || ''))
      r.onerror = reject
      r.readAsDataURL(file)
    })
  }

  async function onStamp(ev) {
    const f = ev.target.files?.[0]
    ev.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) return
    const data = await readImage(f)
    updateCompany({ stampImage: data })
  }

  async function onSig(ev) {
    const f = ev.target.files?.[0]
    ev.target.value = ''
    if (!f) return
    const data = await readImage(f)
    updateCompany({ signatureImage: data })
  }

  function onImport(ev) {
    const f = ev.target.files?.[0]
    ev.target.value = ''
    if (!f) return
    importAllDataJson(f)
      .then(() => setMsg('Импорт JSON выполнен'))
      .catch((e) => setMsg(`Ошибка: ${e.message}`))
  }

  const innOk = !company.inn || validateInn(digitsOnlyInn(company.inn))

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Настройки компании (Исполнитель)</h1>
        <p className="mt-1 text-sm text-slate-600">Реквизиты подставляются во все документы. Печать и подпись — PNG с прозрачностью.</p>
      </div>
      {msg ? <p className="text-sm text-blue-700">{msg}</p> : null}
      <Card title="Реквизиты">
        {!innOk ? <p className="mb-2 text-sm text-amber-700">ИНН заполнен, но не проходит проверку контрольных цифр.</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
          <F label="Полное наименование" v={company.fullName} on={(v) => updateCompany({ fullName: v })} />
          <F label="Сокращённое наименование" v={company.shortName} on={(v) => updateCompany({ shortName: v })} />
          <F label="ИНН" v={company.inn} on={(v) => updateCompany({ inn: v })} />
          <F label="КПП" v={company.kpp} on={(v) => updateCompany({ kpp: v })} />
          <F label="ОГРН" v={company.ogrn} on={(v) => updateCompany({ ogrn: v })} />
          <F label="Юридический адрес" v={company.address} on={(v) => updateCompany({ address: v })} />
          <F label="Банк" v={company.bank} on={(v) => updateCompany({ bank: v })} />
          <F label="БИК" v={company.bik} on={(v) => updateCompany({ bik: v })} />
          <F label="Расчётный счёт" v={company.account} on={(v) => updateCompany({ account: v })} />
          <F label="Корреспондентский счёт" v={company.correspondentAccount} on={(v) => updateCompany({ correspondentAccount: v })} />
          <F label="ФИО руководителя" v={company.director} on={(v) => updateCompany({ director: v })} />
          <F label="Должность" v={company.directorPosition} on={(v) => updateCompany({ directorPosition: v })} />
          <F label="Email" v={company.email} on={(v) => updateCompany({ email: v })} type="email" />
          <F label="Телефон" v={company.phone} on={(v) => updateCompany({ phone: v })} />
          <F label="Сайт" v={company.website} on={(v) => updateCompany({ website: v })} />
        </div>
      </Card>
      <Card title="Печать и подпись">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-slate-800">Изображение печати</p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              {company.stampImage ? (
                <img src={company.stampImage} alt="Печать" className="h-24 max-w-[140px] rounded border border-slate-200 bg-white object-contain p-1" />
              ) : (
                <div className="flex h-24 w-32 items-center justify-center rounded border border-dashed border-slate-200 text-xs text-slate-400">
                  нет файла
                </div>
              )}
              <button
                type="button"
                onClick={() => stampRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                <ImagePlus className="h-4 w-4" />
                Загрузить PNG
              </button>
              <input ref={stampRef} type="file" accept="image/png,image/*" className="hidden" onChange={onStamp} />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">Изображение подписи</p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              {company.signatureImage ? (
                <img src={company.signatureImage} alt="Подпись" className="h-16 max-w-[160px] rounded border border-slate-200 bg-white object-contain p-1" />
              ) : (
                <div className="flex h-16 w-32 items-center justify-center rounded border border-dashed border-slate-200 text-xs text-slate-400">
                  нет файла
                </div>
              )}
              <button
                type="button"
                onClick={() => sigRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                <ImagePlus className="h-4 w-4" />
                Загрузить PNG
              </button>
              <input ref={sigRef} type="file" accept="image/png,image/*" className="hidden" onChange={onSig} />
            </div>
          </div>
        </div>
      </Card>
      <Card title="Резервная копия (JSON)">
        <p className="text-sm text-slate-600">Экспорт и импорт всех данных приложения (кроме встроенных шаблонов при импорте — они дополняются автоматически).</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportAllDataJson}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
          >
            <Download className="h-4 w-4" />
            Экспорт JSON
          </button>
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" />
            Импорт JSON
          </button>
          <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={onImport} />
        </div>
      </Card>
    </div>
  )
}

function F({ label, v, on, type = 'text' }) {
  return (
    <div>
      <label className="text-xs font-medium uppercase text-slate-500">{label}</label>
      <input
        type={type}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        value={v ?? ''}
        onChange={(e) => on(e.target.value)}
      />
    </div>
  )
}
