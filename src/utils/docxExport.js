import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
} from 'docx'
import { saveAs } from 'file-saver'

function htmlToPlain(html) {
  if (!html) return ''
  try {
    const p = new DOMParser()
    const d = p.parseFromString(html, 'text/html')
    return (d.body?.innerText || '').replace(/\r\n/g, '\n')
  } catch {
    return html.replace(/<[^>]+>/g, '\n')
  }
}

/**
 * @param {object} doc сохранённый документ приложения
 * @param {string} filename без расширения
 */
export async function downloadDocumentDocx(doc, filename = 'document') {
  const title = new Paragraph({
    text: doc.name || 'Документ',
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 200 },
  })
  const meta = new Paragraph({
    children: [
      new TextRun({ text: `Тип: ${typeRu(doc.type)}. ` }),
      new TextRun({ text: `Создан: ${fmtDate(doc.createdAt)}` }),
    ],
    spacing: { after: 200 },
  })
  const plain = htmlToPlain(doc.content)
  const chunks = plain.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)
  const bodyParas = chunks.map(
    (c) =>
      new Paragraph({
        children: [new TextRun(c)],
        spacing: { after: 120 },
      }),
  )

  const itemRows = (doc.items || []).map(
    (it, i) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(String(i + 1))] }),
          new TableCell({ children: [new Paragraph(it.name || '')] }),
          new TableCell({ children: [new Paragraph(String(it.quantity))] }),
          new TableCell({ children: [new Paragraph(it.unit || '')] }),
          new TableCell({ children: [new Paragraph(String(it.price))] }),
          new TableCell({ children: [new Paragraph(String(it.amount))] }),
        ],
      }),
  )

  const table =
    itemRows.length > 0
      ? new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                '№',
                'Наименование',
                'Кол-во',
                'Ед.',
                'Цена',
                'Сумма',
              ].map(
                (h) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
                  }),
              ),
            }),
            ...itemRows,
          ],
        })
      : null

  const children = [title, meta, ...bodyParas, ...(table ? [new Paragraph({ text: '' }), table] : [])]

  const file = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(file)
  saveAs(blob, `${filename.replace(/[^\w\-а-яА-ЯёЁ ]+/gu, '_')}.docx`)
}

function typeRu(t) {
  const m = { contract: 'Договор', invoice: 'Счёт', act: 'Акт', upd: 'УПД' }
  return m[t] || t
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('ru-RU')
  } catch {
    return iso || ''
  }
}
