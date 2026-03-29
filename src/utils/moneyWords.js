/**
 * Сумма прописью на русском (рубли и копейки).
 * @param {number} amount
 */
export function amountToWords(amount) {
  if (amount < 0 || !Number.isFinite(amount)) return 'ноль рублей 00 копеек'
  const rub = Math.floor(amount)
  let kop = Math.round((amount - rub) * 100)
  if (kop === 100) {
    kop = 0
  }
  const rubStr = morph(rub, [
    'рубль',
    'рубля',
    'рублей',
  ])
  const kopStr = morph(kop, ['копейка', 'копейки', 'копеек'], true)
  return `${intToWords(rub)} ${rubStr} ${String(kop).padStart(2, '0')} ${kopStr}`.trim()
}

const hundreds = [
  '',
  'сто',
  'двести',
  'триста',
  'четыреста',
  'пятьсот',
  'шестьсот',
  'семьсот',
  'восемьсот',
  'девятьсот',
]
const tens = [
  '',
  'десять',
  'двадцать',
  'тридцать',
  'сорок',
  'пятьдесят',
  'шестьдесят',
  'семьдесят',
  'восемьдесят',
  'девяносто',
]
const onesM = [
  '',
  'один',
  'два',
  'три',
  'четыре',
  'пять',
  'шесть',
  'семь',
  'восемь',
  'девять',
]
const onesF = [
  '',
  'одна',
  'две',
  'три',
  'четыре',
  'пять',
  'шесть',
  'семь',
  'восемь',
  'девять',
]
const teens = [
  'десять',
  'одиннадцать',
  'двенадцать',
  'тринадцать',
  'четырнадцать',
  'пятнадцать',
  'шестнадцать',
  'семнадцать',
  'восемнадцать',
  'девятнадцать',
]

function intToWords(n) {
  if (n === 0) return 'ноль'
  const scales = [
    { v: 1e9, m: ['миллиард', 'миллиарда', 'миллиардов'], f: false },
    { v: 1e6, m: ['миллион', 'миллиона', 'миллионов'], f: false },
    { v: 1e3, m: ['тысяча', 'тысячи', 'тысяч'], f: true },
  ]
  let rest = n
  const parts = []
  for (const s of scales) {
    const q = Math.floor(rest / s.v)
    rest %= s.v
    if (q > 0) parts.push(`${tripletWords(q, s.f)} ${morph(q, s.m, s.f)}`)
  }
  if (rest > 0) parts.push(tripletWords(rest, false))
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function tripletWords(num, feminine) {
  const h = Math.floor(num / 100)
  const t = Math.floor((num % 100) / 10)
  const o = num % 10
  const chunk = []
  if (h) chunk.push(hundreds[h])
  if (t === 1) chunk.push(teens[o])
  else {
    if (t) chunk.push(tens[t])
    if (o) chunk.push(feminine ? onesF[o] : onesM[o])
  }
  return chunk.join(' ')
}

function morph(n, forms, feminineKop = false) {
  n = Math.abs(n) % 100
  const n1 = n % 10
  if (n > 10 && n < 20) return forms[2]
  if (n1 > 1 && n1 < 5) return forms[1]
  if (n1 === 1) return forms[0]
  return forms[2]
}
