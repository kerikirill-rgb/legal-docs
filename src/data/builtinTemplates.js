const now = () => new Date().toISOString()

/** Встроенные шаблоны (обобщённые, с отсылкой к ГК РФ; требуют юридической адаптации под дело). */
export function createBuiltinTemplates() {
  const ts = now()
  return [
    {
      id: 'tpl-svc-contract',
      name: 'Договор оказания услуг (встроенный)',
      type: 'contract',
      content: svcContract,
      isCustom: false,
      createdAt: ts,
    },
    {
      id: 'tpl-supply-contract',
      name: 'Договор поставки (встроенный)',
      type: 'contract',
      content: supplyContract,
      isCustom: false,
      createdAt: ts,
    },
    {
      id: 'tpl-work-contract',
      name: 'Договор подряда (встроенный)',
      type: 'contract',
      content: workContract,
      isCustom: false,
      createdAt: ts,
    },
    {
      id: 'tpl-invoice',
      name: 'Счёт на оплату (встроенный)',
      type: 'invoice',
      content: invoiceTpl,
      isCustom: false,
      createdAt: ts,
    },
    {
      id: 'tpl-act',
      name: 'Акт выполненных работ (встроенный)',
      type: 'act',
      content: actTpl,
      isCustom: false,
      createdAt: ts,
    },
    {
      id: 'tpl-upd',
      name: 'УПД (универсальный передаточный документ, встроенный)',
      type: 'upd',
      content: updTpl,
      isCustom: false,
      createdAt: ts,
    },
  ]
}

const commonStyle = `<style>
body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.35; color: #111; max-width: 210mm; margin: 0 auto; padding: 16mm; }
h1 { text-align: center; font-size: 14pt; margin: 0 0 16px; }
.small { font-size: 11pt; color: #333; }
</style>`

const svcContract = `${commonStyle}
<h1>ДОГОВОР ОКАЗАНИЯ УСЛУГ № {{DOCUMENT_NUMBER}}</h1>
<p class="small">г. ______________ &nbsp;&nbsp; «____» _____________ 20____ г.</p>
<p>Настоящий договор заключён в соответствии со ст. 779, 780 ГК РФ между:</p>
<p><strong>Исполнитель:</strong> {{ИСПОЛНИТЕЛЬ_FULL_NAME}}, ИНН {{ИСПОЛНИТЕЛЬ_INN}}, КПП {{ИСПОЛНИТЕЛЬ_KPP}}, ОГРН {{ИСПОЛНИТЕЛЬ_OGRN}}, адрес: {{ИСПОЛНИТЕЛЬ_ADDRESS}}, в лице {{ИСПОЛНИТЕЛЬ_DIRECTOR_POSITION}} {{ИСПОЛНИТЕЛЬ_DIRECTOR}}, действующего на основании Устава,</p>
<p>и</p>
<p><strong>Заказчик:</strong> {{КОНТРАГЕНТ_FULL_NAME}}, ИНН {{КОНТРАГЕНТ_INN}}, КПП {{КОНТРАГЕНТ_KPP}}, ОГРН {{КОНТРАГЕНТ_OGRN}}, адрес: {{КОНТРАГЕНТ_ADDRESS}}, в лице {{КОНТРАГЕНТ_DIRECTOR_POSITION}} {{КОНТРАГЕНТ_DIRECTOR}}, действующего на основании ____________________,</p>
<p>далее совместно — «Стороны», а по отдельности — «Сторона».</p>
<h1 style="margin-top:24px;font-size:13pt">1. Предмет договора</h1>
<p>1.1. Исполнитель обязуется оказать, а Заказчик принять и оплатить услуги по номенклатуре и ценам согласно спецификации (таблице позиций).</p>
<p>1.2. Срок оказания услуг: по заявкам Заказчика / в срок до «____» __________ 20____ г. (уточняется доп. соглашением).</p>
<h1 style="margin-top:16px;font-size:13pt">2. Цена и порядок расчётов</h1>
<p>2.1. Общая цена услуг по договору составляет <strong>{{TOTAL_AMOUNT}}</strong> ({{TOTAL_WORDS}}), в т.ч. НДС: {{VAT_INCLUDED}}. Сумма НДС: {{VAT_AMOUNT}}.</p>
<p>2.2. Оплата производится на расчётный счёт Исполнителя: БИК {{ИСПОЛНИТЕЛЬ_BIK}}, р/с {{ИСПОЛНИТЕЛЬ_ACCOUNT}}, к/с {{ИСПОЛНИТЕЛЬ_CORR_ACCOUNT}}, банк: {{ИСПОЛНИТЕЛЬ_BANK}}.</p>
<h1 style="margin-top:16px;font-size:13pt">3. Акт приёмки</h1>
<p>3.1. Приёмка осуществляется по акту, подписываемому Сторонами. Молчание Заказчика в течение 10 рабочих дней после получения акта может рассматриваться в порядке, предусмотренном договором/законом.</p>
<h1 style="margin-top:16px;font-size:13pt">4. Заключительные положения</h1>
<p>4.1. Договор вступает в силу с даты подписания и действует до полного исполнения обязательств.</p>
<p>4.2. Применимое право — право Российской Федерации. Споры — в порядке, установленном законодательством РФ (март 2026 г.).</p>
<h1 style="margin-top:20px;font-size:13pt">Спецификация (таблица позиций)</h1>
{{ITEMS_TABLE}}
{{STAMP_SIGNATURE_BLOCK}}
`

const supplyContract = `${commonStyle}
<h1>ДОГОВОР ПОСТАВКИ № {{DOCUMENT_NUMBER}}</h1>
<p class="small">г. ______________ &nbsp;&nbsp; «____» _____________ 20____ г.</p>
<p>Настоящий договор заключён в соответствии со ст. 506, 516 ГК РФ между:</p>
<p><strong>Поставщик:</strong> {{ИСПОЛНИТЕЛЬ_FULL_NAME}}, ИНН {{ИСПОЛНИТЕЛЬ_INN}}, КПП {{ИСПОЛНИТЕЛЬ_KPP}}, ОГРН {{ИСПОЛНИТЕЛЬ_OGRN}}, адрес: {{ИСПОЛНИТЕЛЬ_ADDRESS}}, в лице {{ИСПОЛНИТЕЛЬ_DIRECTOR_POSITION}} {{ИСПОЛНИТЕЛЬ_DIRECTOR}},</p>
<p>и</p>
<p><strong>Покупатель:</strong> {{КОНТРАГЕНТ_FULL_NAME}}, ИНН {{КОНТРАГЕНТ_INN}}, КПП {{КОНТРАГЕНТ_KPP}}, ОГРН {{КОНТРАГЕНТ_OGRN}}, адрес: {{КОНТРАГЕНТ_ADDRESS}}, в лице {{КОНТРАГЕНТ_DIRECTOR_POSITION}} {{КОНТРАГЕНТ_DIRECTOR}},</p>
<h1 style="margin-top:24px;font-size:13pt">1. Предмет договора</h1>
<p>1.1. Поставщик обязуется передать в собственность Покупателя товары согласно спецификации, Покупатель обязуется принять и оплатить.</p>
<h1 style="margin-top:16px;font-size:13pt">2. Цена, поставка, расчёты</h1>
<p>2.1. Общая цена: <strong>{{TOTAL_AMOUNT}}</strong> ({{TOTAL_WORDS}}). НДС включён: {{VAT_INCLUDED}}. Сумма НДС: {{VAT_AMOUNT}}.</p>
<p>2.2. УПД оформляется при отгрузке товара в соответствии с законодательством РФ.</p>
{{ITEMS_TABLE}}
{{STAMP_SIGNATURE_BLOCK}}
`

const workContract = `${commonStyle}
<h1>ДОГОВОР ПОДРЯДА № {{DOCUMENT_NUMBER}}</h1>
<p class="small">г. ______________ &nbsp;&nbsp; «____» _____________ 20____ г.</p>
<p>Настоящий договор заключён в соответствии со ст. 702–729 ГК РФ между:</p>
<p><strong>Подрядчик:</strong> {{ИСПОЛНИТЕЛЬ_FULL_NAME}}, ИНН {{ИСПОЛНИТЕЛЬ_INN}}, КПП {{ИСПОЛНИТЕЛЬ_KPP}}, ОГРН {{ИСПОЛНИТЕЛЬ_OGRN}}, адрес: {{ИСПОЛНИТЕЛЬ_ADDRESS}}, в лице {{ИСПОЛНИТЕЛЬ_DIRECTOR_POSITION}} {{ИСПОЛНИТЕЛЬ_DIRECTOR}},</p>
<p>и</p>
<p><strong>Заказчик:</strong> {{КОНТРАГЕНТ_FULL_NAME}}, ИНН {{КОНТРАГЕНТ_INN}}, КПП {{КОНТРАГЕНТ_KPP}}, ОГРН {{КОНТРАГЕНТ_OGRN}}, адрес: {{КОНТРАГЕНТ_ADDRESS}}, в лице {{КОНТРАГЕНТ_DIRECTOR_POSITION}} {{КОНТРАГЕНТ_DIRECTOR}},</p>
<h1 style="margin-top:24px;font-size:13pt">1. Предмет договора</h1>
<p>1.1. Подрядчик обязуется выполнить определённые работы по заданию Заказчика, Заказчик обязуется создать условия, принять и оплатить результат.</p>
<h1 style="margin-top:16px;font-size:13pt">2. Цена работ</h1>
<p>2.1. Цена работ: <strong>{{TOTAL_AMOUNT}}</strong> ({{TOTAL_WORDS}}). НДС: {{VAT_INCLUDED}}, сумма НДС: {{VAT_AMOUNT}}.</p>
{{ITEMS_TABLE}}
<h1 style="margin-top:16px;font-size:13pt">3. Приёмка</h1>
<p>3.1. Сдача-приёмка оформляется актом выполненных работ, подписываемым Сторонами.</p>
{{STAMP_SIGNATURE_BLOCK}}
`

const invoiceTpl = `${commonStyle}
<h1>СЧЁТ НА ОПЛАТУ № {{DOCUMENT_NUMBER}}</h1>
<p class="small">от {{DOCUMENT_DATE}}</p>
<p><strong>Поставщик (Исполнитель):</strong> {{ИСПОЛНИТЕЛЬ_FULL_NAME}}<br/>
ИНН {{ИСПОЛНИТЕЛЬ_INN}} КПП {{ИСПОЛНИТЕЛЬ_KPP}} ОГРН {{ИСПОЛНИТЕЛЬ_OGRN}}<br/>
{{ИСПОЛНИТЕЛЬ_ADDRESS}}<br/>
р/с {{ИСПОЛНИТЕЛЬ_ACCOUNT}} в {{ИСПОЛНИТЕЛЬ_BANK}}, БИК {{ИСПОЛНИТЕЛЬ_BIK}}, к/с {{ИСПОЛНИТЕЛЬ_CORR_ACCOUNT}}</p>
<p><strong>Покупатель (Заказчик):</strong> {{КОНТРАГЕНТ_FULL_NAME}}<br/>
ИНН {{КОНТРАГЕНТ_INN}} КПП {{КОНТРАГЕНТ_KPP}}<br/>
{{КОНТРАГЕНТ_ADDRESS}}</p>
<p><strong>К оплате:</strong> {{TOTAL_AMOUNT}} ({{TOTAL_WORDS}})<br/>
НДС ({{VAT_RATE}}%): {{VAT_INCLUDED}}. Сумма НДС: {{VAT_AMOUNT}}</p>
{{ITEMS_TABLE}}
{{STAMP_SIGNATURE_BLOCK}}
`

const actTpl = `${commonStyle}
<h1>АКТ выполненных работ (оказанных услуг) № {{DOCUMENT_NUMBER}}</h1>
<p class="small">от {{DOCUMENT_DATE}}</p>
<p>{{ИСПОЛНИТЕЛЬ_FULL_NAME}}, именуемое в дальнейшем «Исполнитель», в лице {{ИСПОЛНИТЕЛЬ_DIRECTOR_POSITION}} {{ИСПОЛНИТЕЛЬ_DIRECTOR}}, с одной стороны, и<br/>
{{КОНТРАГЕНТ_FULL_NAME}}, именуемое «Заказчик», в лице {{КОНТРАГЕНТ_DIRECTOR_POSITION}} {{КОНТРАГЕНТ_DIRECTOR}}, с другой стороны, составили настоящий акт о нижеследующем:</p>
<p>1. Исполнитель в период по договору оказал услуги / выполнил работы в объёме согласно таблице:</p>
{{ITEMS_TABLE}}
<p>2. Стоимость работ (услуг) составила <strong>{{TOTAL_AMOUNT}}</strong> ({{TOTAL_WORDS}}), в т.ч. НДС: {{VAT_AMOUNT}} (при наличии).</p>
<p>3. Заказчик претензий по объёму и качеству не имеет.</p>
{{STAMP_SIGNATURE_BLOCK}}
`

const updTpl = `${commonStyle}
<h1>УНИВЕРСАЛЬНЫЙ ПЕРЕДАТОЧНЫЙ ДОКУМЕНТ (УПД)</h1>
<p class="small">Статус: 1 — счёт-фактура и передаточный документ (по согласованию сторон и правилам заполнения, утв. Постановлением Правительства РФ)</p>
<p><strong>Счёт-фактура № {{DOCUMENT_NUMBER}} от {{DOCUMENT_DATE}}</strong></p>
<p><strong>Продавец:</strong> {{ИСПОЛНИТЕЛЬ_FULL_NAME}}, ИНН/КПП {{ИСПОЛНИТЕЛЬ_INN}}/{{ИСПОЛНИТЕЛЬ_KPP}}, адрес: {{ИСПОЛНИТЕЛЬ_ADDRESS}}</p>
<p><strong>Покупатель:</strong> {{КОНТРАГЕНТ_FULL_NAME}}, ИНН/КПП {{КОНТРАГЕНТ_INN}}/{{КОНТРАГЕНТ_KPP}}, адрес: {{КОНТРАГЕНТ_ADDRESS}}</p>
<p><strong>Основание:</strong> договор / соглашение сторон (реквизиты указываются дополнительно).</p>
<p><strong>Товарные позиции:</strong></p>
{{ITEMS_TABLE}}
<p><strong>Всего к оплате:</strong> {{TOTAL_AMOUNT}} ({{TOTAL_WORDS}}). НДС: {{VAT_INCLUDED}}, {{VAT_AMOUNT}}.</p>
<p class="small">Настоящий шаблон УПД обобщённый; поля 1–11 счёта-фактуры и строки товаров должны быть заполнены с учётом актуальных требований ФНС (март 2026 г.).</p>
{{STAMP_SIGNATURE_BLOCK}}
`

export const BUILTIN_TEMPLATE_IDS = createBuiltinTemplates().map((t) => t.id)
