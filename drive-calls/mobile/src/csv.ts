import type { Contact } from './types'

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if ((ch === ',' || ch === ';') && !inQuotes) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1)
  if (digits.length === 11 && digits.startsWith('7')) return '+' + digits
  if (digits.length === 10) return '+7' + digits
  return raw.trim()
}

/** Expected headers: phone, firstName, lastName, company, email (any order by name) */
export function parseContactsCsv(text: string): Contact[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase())
  const idx = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)))

  const phoneI = idx(['phone', 'тел', 'номер'])
  const fnI = idx(['firstname', 'first', 'имя'])
  const lnI = idx(['lastname', 'last', 'фам'])
  const coI = idx(['company', 'комп'])
  const emI = idx(['email', 'почт', 'mail'])

  const contacts: Contact[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    const phone = normalizePhone(cols[phoneI >= 0 ? phoneI : 0] || '')
    if (!phone) continue
    contacts.push({
      id: `${phone}-${i}`,
      phone,
      firstName: cols[fnI] || '',
      lastName: cols[lnI] || '',
      company: cols[coI] || '',
      email: cols[emI] || '',
    })
  }
  return contacts
}
