import { amountToWords } from './moneyWords'
import { renderTemplateString } from './templateRender'

function fmtMoney(n) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function fmtDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('ru-RU')
  } catch {
    return iso
  }
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function buildItemsTableHtml(items, { vatIncluded, vatRate = 20 } = {}) {
  const rows = (items ?? []).map((it, i) => {
    const typeRu = it.type === 'product' ? 'товар' : 'услуга'
    return `<tr>
  <td style="border:1px solid #333;padding:6px;text-align:center">${i + 1}</td>
  <td style="border:1px solid #333;padding:6px">${esc(it.name)} <span style="color:#666;font-size:11px">(${typeRu})</span></td>
  <td style="border:1px solid #333;padding:6px;text-align:right">${fmtMoney(it.quantity)}</td>
  <td style="border:1px solid #333;padding:6px">${esc(it.unit)}</td>
  <td style="border:1px solid #333;padding:6px;text-align:right">${fmtMoney(it.price)}</td>
  <td style="border:1px solid #333;padding:6px;text-align:right">${fmtMoney(it.amount)}</td>
</tr>`
  })
  const subtotal = (items ?? []).reduce((a, b) => a + (Number(b.amount) || 0), 0)
  let vatRow = ''
  let total = subtotal
  if (vatIncluded) {
    const vat = subtotal - subtotal / (1 + vatRate / 100)
    const wo = subtotal - vat
    vatRow = `<tr><td colspan="5" style="border:1px solid #333;padding:6px;text-align:right">В том числе НДС (${vatRate}%)</td><td style="border:1px solid #333;padding:6px;text-align:right">${fmtMoney(vat)}</td></tr>
<tr><td colspan="5" style="border:1px solid #333;padding:6px;text-align:right">Сумма без НДС</td><td style="border:1px solid #333;padding:6px;text-align:right">${fmtMoney(wo)}</td></tr>`
    total = subtotal
  }
  return `<table style="width:100%;border-collapse:collapse;font-size:12px;margin:12px 0">
<thead><tr>
  <th style="border:1px solid #333;padding:6px">№</th>
  <th style="border:1px solid #333;padding:6px">Наименование</th>
  <th style="border:1px solid #333;padding:6px">Кол-во</th>
  <th style="border:1px solid #333;padding:6px">Ед.</th>
  <th style="border:1px solid #333;padding:6px">Цена</th>
  <th style="border:1px solid #333;padding:6px">Сумма</th>
</tr></thead>
<tbody>
${rows.join('\n')}
${vatRow}
<tr><td colspan="5" style="border:1px solid #333;padding:6px;text-align:right;font-weight:bold">Итого</td><td style="border:1px solid #333;padding:6px;text-align:right;font-weight:bold">${fmtMoney(total)}</td></tr>
</tbody>
</table>`
}

export function buildStampSignatureBlock(company) {
  const stamp = company?.stampImage
  const sig = company?.signatureImage
  const stampHtml = stamp
    ? `<img src="${stamp}" alt="печать" style="max-height:90px;max-width:120px;vertical-align:middle" />`
    : '<span style="color:#999">[печать не загружена]</span>'
  const sigHtml = sig
    ? `<img src="${sig}" alt="подпись" style="max-height:48px;max-width:160px;vertical-align:bottom" />`
    : '<span style="color:#999">[подпись не загружена]</span>'
  return `<table style="width:100%;margin-top:32px;border-collapse:collapse;font-size:12px">
<tr>
  <td style="width:48%;vertical-align:top;padding:8px">
    <p><strong>Исполнитель / Поставщик</strong></p>
    <p>${esc(company?.shortName || company?.fullName || '')}</p>
    <p style="margin-top:16px">${stampHtml}</p>
    <p style="margin-top:8px">${sigHtml}</p>
    <p style="margin-top:8px">/ ${esc(company?.director || '_____________')} /</p>
    <p style="margin-top:4px;font-size:11px;color:#444">${esc(company?.directorPosition || '')}</p>
  </td>
  <td style="width:4%"></td>
  <td style="width:48%;vertical-align:top;padding:8px">
    <p><strong>Заказчик / Покупатель</strong></p>
    <p>ФИО лица, уполномоченного на подписание: <span class="customer-sign-name">_________________________</span></p>
    <p style="margin-top:24px">Подпись: _______________________</p>
    <p style="margin-top:12px">Дата: <span class="customer-sign-date">«____» _____________ 20____ г.</span></p>
  </td>
</tr>
</table>`
}

/**
 * Вычисление НДС и итогов
 */
export function calcTotals(items, vatIncluded, vatRate = 20) {
  const subtotal = (items ?? []).reduce((a, b) => a + (Number(b.amount) || 0), 0)
  if (!vatIncluded) {
    return {
      subtotal,
      total: subtotal,
      vatAmount: 0,
      subtotalWithoutVat: subtotal,
    }
  }
  const subtotalWithoutVat = subtotal / (1 + vatRate / 100)
  const vatAmount = subtotal - subtotalWithoutVat
  return {
    subtotal,
    total: subtotal,
    vatAmount,
    subtotalWithoutVat,
  }
}

export function buildPlaceholderMap({
  company,
  contractor,
  items,
  documentDate,
  documentNumber,
  docName,
  vatIncluded,
  vatRate = 20,
}) {
  const totals = calcTotals(items, vatIncluded, vatRate)
  const totalAmount = totals.total
  const table = buildItemsTableHtml(items, { vatIncluded, vatRate })
  const stampBlock = buildStampSignatureBlock(company)

  const ex = (prefix, c) => ({
    [`${prefix}_FULL_NAME`]: c?.name ?? c?.fullName ?? '',
    [`${prefix}_SHORT_NAME`]: c?.shortName ?? '',
    [`${prefix}_INN`]: c?.inn ?? '',
    [`${prefix}_KPP`]: c?.kpp ?? '',
    [`${prefix}_OGRN`]: c?.ogrn ?? '',
    [`${prefix}_ADDRESS`]: c?.address ?? '',
    [`${prefix}_BANK`]: c?.bank ?? '',
    [`${prefix}_BIK`]: c?.bik ?? '',
    [`${prefix}_ACCOUNT`]: c?.account ?? '',
    [`${prefix}_CORR_ACCOUNT`]: c?.correspondentAccount ?? '',
    [`${prefix}_DIRECTOR`]: c?.director ?? '',
    [`${prefix}_DIRECTOR_POSITION`]: c?.directorPosition ?? '',
    [`${prefix}_EMAIL`]: c?.email ?? '',
    [`${prefix}_PHONE`]: c?.phone ?? '',
    [`${prefix}_WEBSITE`]: c?.website ?? '',
  })

  const ru = {
    дата: fmtDate(documentDate),
    номер_документа: documentNumber ?? '',
    название_документа: docName ?? '',
    таблица_позиций: table,
    сумма: fmtMoney(totalAmount),
    сумма_прописью: amountToWords(totalAmount),
    сумма_ндс: fmtMoney(totals.vatAmount),
    сумма_без_ндс: fmtMoney(totals.subtotalWithoutVat),
    ставка_ндс: String(vatRate),
    ндс_включен: vatIncluded ? 'да' : 'нет',
    блок_печать_подпись: stampBlock,
    всего_к_оплате: fmtMoney(totalAmount),
  }

  const flat = {
    ...ex('ИСПОЛНИТЕЛЬ', {
      name: company?.fullName,
      shortName: company?.shortName,
      inn: company?.inn,
      kpp: company?.kpp,
      ogrn: company?.ogrn,
      address: company?.address,
      bank: company?.bank,
      bik: company?.bik,
      account: company?.account,
      correspondentAccount: company?.correspondentAccount,
      director: company?.director,
      directorPosition: company?.directorPosition,
      email: company?.email,
      phone: company?.phone,
      website: company?.website,
    }),
    ...ex('КОНТРАГЕНТ', contractor),
    DOCUMENT_DATE: fmtDate(documentDate),
    DOCUMENT_NUMBER: documentNumber ?? '',
    ITEMS_TABLE: table,
    TOTAL_AMOUNT: fmtMoney(totalAmount),
    TOTAL_WORDS: amountToWords(totalAmount),
    VAT_AMOUNT: fmtMoney(totals.vatAmount),
    SUBTOTAL_WITHOUT_VAT: fmtMoney(totals.subtotalWithoutVat),
    VAT_RATE: String(vatRate),
    VAT_INCLUDED: vatIncluded ? 'да' : 'нет',
    STAMP_SIGNATURE_BLOCK: stampBlock,
    ...ru,
  }

  // Латиница дубликаты для совместимости
  const en = {
    ...ex('EXECUTOR', {
      name: company?.fullName,
      shortName: company?.shortName,
      inn: company?.inn,
      kpp: company?.kpp,
      ogrn: company?.ogrn,
      address: company?.address,
      bank: company?.bank,
      bik: company?.bik,
      account: company?.account,
      correspondentAccount: company?.correspondentAccount,
      director: company?.director,
      directorPosition: company?.directorPosition,
      email: company?.email,
      phone: company?.phone,
      website: company?.website,
    }),
    ...ex('CONTRACTOR', contractor),
  }

  return { ...flat, ...en }
}

export function generateDocumentHtml(templateContent, opts) {
  const vars = buildPlaceholderMap(opts)
  return renderTemplateString(templateContent, vars)
}
