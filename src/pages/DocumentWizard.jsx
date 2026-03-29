import { useEffect, useMemo, useState } from 'react'
import {
  ChevronRight,
  ChevronLeft,
  Wand2,
  Printer,
  Save,
  FileDown,
} from 'lucide-react'
import Card from '../components/Card'
import { useStore } from '../context/StoreContext'
import { newId } from '../utils/ids'
import { validateInn, digitsOnlyInn } from '../utils/inn'
import { generateDocumentHtml, calcTotals } from '../utils/documentVars'
import { amountToWords } from '../utils/moneyWords'
import { printHtmlFragment, downloadHtmlFile } from '../utils/print'
import { downloadDocumentDocx } from '../utils/docxExport'

const TYPES = [
  { value: 'contract', label: 'Договор' },
  { value: 'invoice', label: 'Счёт' },
  { value: 'act', label: 'Акт' },
  { value: 'upd', label: 'УПД' },
]

const emptyContractor = {
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

export default function DocumentWizard() {
  const {
    company,
    contractors,
    templates,
    catalog,
    documents,
    upsertDocument,
    wizardResume,
    clearWizardResume,
  } = useStore()

  const [step, setStep] = useState(0)
  const [docType, setDocType] = useState('contract')
  const [templateId, setTemplateId] = useState('')
  const [contractorMode, setContractorMode] = useState('dir')
  const [contractorId, setContractorId] = useState('')
  const [manual, setManual] = useState(() => ({ ...emptyContractor }))
  const [items, setItems] = useState([])
  const [vatIncluded, setVatIncluded] = useState(false)
  const [vatRate] = useState(20)
  const [docNumber, setDocNumber] = useState('1')
  const [docDate, setDocDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [docName, setDocName] = useState('')
  const [content, setContent] = useState('')
  const [err, setErr] = useState('')
  const [currentDocId, setCurrentDocId] = useState(null)
  const [status, setStatus] = useState('draft')

  const filteredTemplates = useMemo(
    () => templates.filter((t) => t.type === docType),
    [templates, docType],
  )

  useEffect(() => {
    if (!wizardResume) return
    const d = wizardResume
    setDocType(d.type || 'contract')
    setTemplateId(d.templateId || '')
    setContractorId(d.contractorId || '')
    if (d.contractorId) setContractorMode('dir')
    else setContractorMode('manual')
    setManual({ ...emptyContractor, ...(d.contractor || {}) })
    setItems(
      (d.items || []).map((it) => ({
        ...it,
        id: it.id || newId(),
      })),
    )
    setVatIncluded(!!d.vatIncluded)
    setDocNumber(d.documentNumber != null ? String(d.documentNumber) : '1')
    setDocDate(
      d.documentDate
        ? String(d.documentDate).slice(0, 10)
        : new Date(d.createdAt || Date.now()).toISOString().slice(0, 10),
    )
    setDocName(d.name || '')
    setContent(d.content || '')
    setCurrentDocId(d.id || null)
    setStatus(d.status || 'draft')
    setStep(d.content ? 5 : 0)
    clearWizardResume()
  }, [wizardResume, clearWizardResume])

  const selectedTemplate = templates.find((t) => t.id === templateId)

  const contractorObj = useMemo(() => {
    if (contractorMode === 'dir') {
      const c = contractors.find((x) => x.id === contractorId)
      if (!c) return { ...emptyContractor }
      return {
        name: c.name,
        shortName: c.shortName,
        inn: c.inn,
        kpp: c.kpp,
        ogrn: c.ogrn,
        address: c.address,
        bank: c.bank,
        bik: c.bik,
        account: c.account,
        correspondentAccount: c.correspondentAccount,
        director: c.director,
        directorPosition: c.directorPosition,
        email: c.email,
        phone: c.phone,
      }
    }
    return manual
  }, [contractorMode, contractorId, contractors, manual])

  const totals = useMemo(() => calcTotals(items, vatIncluded, vatRate), [items, vatIncluded, vatRate])
  const totalAmount = totals.total

  function addItem(preset) {
    setItems((prev) => [
      ...prev,
      {
        id: newId(),
        name: preset?.name || '',
        quantity: Number(preset?.quantity) || 1,
        unit: preset?.unit || 'шт.',
        price: Number(preset?.price) || 0,
        amount: (Number(preset?.quantity) || 1) * (Number(preset?.price) || 0),
        type: preset?.type === 'product' ? 'product' : 'service',
      },
    ])
  }

  function updateItem(id, patch) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        const n = { ...it, ...patch }
        const q = Number(n.quantity) || 0
        const p = Number(n.price) || 0
        if (q < 0 || p < 0) setErr('Количество и цена не могут быть отрицательными')
        n.amount = Math.max(0, q) * Math.max(0, p)
        n.quantity = Math.max(0, q)
        n.price = Math.max(0, p)
        return n
      }),
    )
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function validateStep(s) {
    setErr('')
    if (s === 1 && !templateId) {
      setErr('Выберите шаблон')
      return false
    }
    if (s === 2) {
      if (contractorMode === 'dir' && !contractorId) {
        setErr('Выберите контрагента из справочника')
        return false
      }
      if (!contractorObj.name?.trim()) {
        setErr('Укажите наименование контрагента')
        return false
      }
      const inn = digitsOnlyInn(contractorObj.inn)
      if (inn && !validateInn(inn)) {
        setErr('ИНН контрагента не проходит проверку')
        return false
      }
    }
    if (s === 3) {
      if (!items.length) {
        setErr('Добавьте хотя бы одну позицию')
        return false
      }
      if (items.some((i) => (Number(i.amount) || 0) < 0)) return false
      if (docType === 'upd' && items.some((i) => i.type !== 'product')) {
        setErr('УПД формируется только для товаров. Уберите услуги или смените тип документа.')
        return false
      }
    }
    return true
  }

  function next() {
    if (!validateStep(step)) return
    setStep((x) => Math.min(5, x + 1))
  }

  function back() {
    setErr('')
    setStep((x) => Math.max(0, x - 1))
  }

  function doGenerate() {
    setErr('')
    if (!selectedTemplate) {
      setErr('Шаблон не найден')
      return
    }
    if (docType === 'upd' && items.some((i) => i.type !== 'product')) {
      setErr('УПД только для товаров')
      return
    }
    if (!company.fullName?.trim()) {
      setErr('Заполните реквизиты исполнителя в разделе «Настройки»')
      return
    }
    const html = generateDocumentHtml(selectedTemplate.content, {
      company,
      contractor: contractorObj,
      items,
      documentDate: docDate,
      documentNumber: docNumber,
      docName: docName || `${TYPES.find((t) => t.value === docType)?.label} № ${docNumber}`,
      vatIncluded,
      vatRate,
    })
    setContent(html)
    setStep(5)
  }

  function persist() {
    const inn = digitsOnlyInn(contractorObj.inn)
    const docId = currentDocId || newId()
    const existing = documents.find((d) => d.id === docId)
    const now = new Date().toISOString()
    const doc = {
      id: docId,
      name: docName || `${TYPES.find((t) => t.value === docType)?.label} № ${docNumber}`,
      type: docType,
      templateId,
      contractorId: contractorMode === 'dir' ? contractorId : '',
      contractor: { ...contractorObj, inn: inn || contractorObj.inn },
      items: items.map((it) => ({ ...it })),
      totalAmount,
      totalAmountWords: amountToWords(totalAmount),
      vatIncluded,
      vatAmount: totals.vatAmount,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      content,
      status,
      documentNumber: docNumber,
      documentDate: docDate,
    }
    upsertDocument(doc)
    if (!currentDocId) setCurrentDocId(docId)
    setErr('')
    alert('Документ сохранён в «Мои документы»')
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Создать документ</h1>
        <p className="mt-1 text-sm text-slate-600">Пошаговый мастер: тип → шаблон → контрагент → позиции → НДС и номер → результат.</p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
        {['Тип', 'Шаблон', 'Контрагент', 'Позиции', 'Реквизиты', 'Итог'].map((l, i) => (
          <span
            key={l}
            className={`rounded-full px-2 py-1 ${step === i ? 'bg-blue-600 text-white' : 'bg-white shadow-sm ring-1 ring-slate-200'}`}
          >
            {i + 1}. {l}
          </span>
        ))}
      </div>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      {step === 0 && (
        <Card title="Тип документа">
          <div className="grid gap-3 sm:grid-cols-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setDocType(t.value)
                  setTemplateId('')
                }}
                className={`rounded-xl border-2 px-4 py-4 text-left text-sm font-medium transition ${
                  docType === t.value ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {docType === 'upd' ? (
            <p className="mt-3 text-sm text-amber-800">УПД применяется к товарам. Позиции-услуги в этом типе недопустимы.</p>
          ) : null}
          <Nav onNext={next} />
        </Card>
      )}

      {step === 1 && (
        <Card title="Шаблон">
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">— Выберите —</option>
            {filteredTemplates.map((t) => (
              <option key={t.id} value={t.id}>
            {t.name} {t.isCustom ? '' : '(встроенный)'}
              </option>
            ))}
          </select>
          {filteredTemplates.length === 0 ? (
            <p className="mt-2 text-sm text-amber-700">Нет шаблонов этого типа. Добавьте в разделе «Шаблоны».</p>
          ) : null}
          <Nav onBack={back} onNext={next} />
        </Card>
      )}

      {step === 2 && (
        <Card title="Контрагент">
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm ${contractorMode === 'dir' ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}
              onClick={() => setContractorMode('dir')}
            >
              Из справочника
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm ${contractorMode === 'manual' ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}
              onClick={() => setContractorMode('manual')}
            >
              Новые реквизиты
            </button>
          </div>
          {contractorMode === 'dir' ? (
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={contractorId}
              onChange={(e) => setContractorId(e.target.value)}
            >
              <option value="">— Выберите —</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (ИНН {c.inn})
                </option>
              ))}
            </select>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {Object.keys(emptyContractor).map((k) => (
                <div key={k}>
                  <label className="text-xs uppercase text-slate-500">{labelRu(k)}</label>
                  <input
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                    value={manual[k] ?? ''}
                    onChange={(e) => setManual((m) => ({ ...m, [k]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}
          <Nav onBack={back} onNext={next} />
        </Card>
      )}

      {step === 3 && (
        <Card title="Позиции">
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => addItem()}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white"
            >
              + Строка
            </button>
            <select
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              defaultValue=""
              onChange={(e) => {
                const id = e.target.value
                e.target.value = ''
                const p = catalog.find((c) => c.id === id)
                if (p) addItem(p)
              }}
            >
              <option value="">Добавить из справочника…</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type === 'product' ? 'товар' : 'услуга'})
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-500">
                  <th className="pb-2">Наименование</th>
                  <th className="pb-2">Тип</th>
                  <th className="pb-2">Кол-во</th>
                  <th className="pb-2">Ед.</th>
                  <th className="pb-2">Цена</th>
                  <th className="pb-2">Сумма</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-slate-50">
                    <td className="py-1 pr-2">
                      <input
                        className="w-52 min-w-[120px] rounded border px-2 py-1"
                        value={it.name}
                        onChange={(e) => updateItem(it.id, { name: e.target.value })}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <select
                        className="rounded border px-2 py-1"
                        value={it.type}
                        onChange={(e) => updateItem(it.id, { type: e.target.value })}
                      >
                        <option value="service">Услуга</option>
                        <option value="product">Товар</option>
                      </select>
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="number"
                        min="0"
                        className="w-20 rounded border px-2 py-1"
                        value={it.quantity}
                        onChange={(e) => updateItem(it.id, { quantity: e.target.value })}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        className="w-16 rounded border px-2 py-1"
                        value={it.unit}
                        onChange={(e) => updateItem(it.id, { unit: e.target.value })}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="number"
                        min="0"
                        className="w-24 rounded border px-2 py-1"
                        value={it.price}
                        onChange={(e) => updateItem(it.id, { price: e.target.value })}
                      />
                    </td>
                    <td className="py-1 pr-2 font-medium">{Number(it.amount).toFixed(2)}</td>
                    <td className="py-1">
                      <button type="button" className="text-red-600" onClick={() => removeItem(it.id)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-800">
            Итого: {totalAmount.toFixed(2)} ₽ ({amountToWords(totalAmount)})
          </p>
          <Nav onBack={back} onNext={next} />
        </Card>
      )}

      {step === 4 && (
        <Card title="Параметры и НДС">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase text-slate-500">Название документа</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="Например: Счёт № 15 от ООО Ромашка"
              />
            </div>
            <div>
              <label className="text-xs uppercase text-slate-500">Номер</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs uppercase text-slate-500">Дата</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={docDate}
                onChange={(e) => setDocDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="vat"
                type="checkbox"
                checked={vatIncluded}
                onChange={(e) => setVatIncluded(e.target.checked)}
              />
              <label htmlFor="vat" className="text-sm">
                Включить НДС ({vatRate}%)
              </label>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs uppercase text-slate-500">Статус</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="draft">Черновик</option>
                <option value="completed">Готов</option>
                <option value="sent">Отправлен</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={doGenerate}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
            >
              <Wand2 className="h-4 w-4" />
              Сформировать документ
            </button>
          </div>
          <Nav onBack={back} />
        </Card>
      )}

      {step === 5 && (
        <Card title="Результат">
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={persist}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
            >
              <Save className="h-4 w-4" />
              Сохранить в «Мои документы»
            </button>
            <button
              type="button"
              onClick={() => printHtmlFragment(content, docName)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />
              Печать
            </button>
            <button
              type="button"
              onClick={() => downloadHtmlFile(content, docName || 'document')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <FileDown className="h-4 w-4" />
              Скачать HTML
            </button>
            <button
              type="button"
              onClick={() =>
                downloadDocumentDocx(
                  {
                    name: docName,
                    type: docType,
                    createdAt: new Date().toISOString(),
                    content,
                    items,
                  },
                  docName || 'document',
                )
              }
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <FileDown className="h-4 w-4" />
              Скачать DOCX
            </button>
            <button
              type="button"
              onClick={() => printHtmlFragment(content, docName)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              title="В диалоге печати выберите «Сохранить как PDF»"
            >
              PDF (через печать)
            </button>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            Отредактируйте текст/HTML при необходимости перед сохранением или печатью.
          </p>
          <textarea
            className="h-[min(70vh,520px)] w-full rounded-lg border border-slate-200 font-mono text-xs leading-relaxed"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <Nav onBack={() => setStep(4)} />
        </Card>
      )}
    </div>
  )
}

function Nav({ onBack, onNext }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" /> Назад
        </button>
      ) : null}
      {onNext ? (
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
        >
          Далее <ChevronRight className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  )
}

function labelRu(k) {
  const m = {
    name: 'Полное название',
    shortName: 'Сокращённое',
    inn: 'ИНН',
    kpp: 'КПП',
    ogrn: 'ОГРН',
    address: 'Адрес',
    bank: 'Банк',
    bik: 'БИК',
    account: 'Р/с',
    correspondentAccount: 'К/с',
    director: 'Руководитель',
    directorPosition: 'Должность',
    email: 'Email',
    phone: 'Телефон',
  }
  return m[k] || k
}
