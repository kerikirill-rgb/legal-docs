/** Проверка контрольных цифр ИНН (юр. лица 10, ИП/физ. 12). */
export function validateInn(inn) {
  if (inn == null || typeof inn !== 'string') return false
  const d = inn.replace(/\D/g, '')
  if (d.length === 10) return check10(d)
  if (d.length === 12) return check12(d)
  return false
}

function check10(inn) {
  const c = [2, 4, 10, 3, 5, 9, 4, 6, 8]
  let s = 0
  for (let i = 0; i < 9; i++) s += Number(inn[i]) * c[i]
  const ctrl = (s % 11) % 10
  return ctrl === Number(inn[9])
}

function check12(inn) {
  const c1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
  const c2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
  let s1 = 0
  for (let i = 0; i < 10; i++) s1 += Number(inn[i]) * c1[i]
  const ctrl1 = (s1 % 11) % 10
  if (ctrl1 !== Number(inn[10])) return false
  let s2 = 0
  for (let i = 0; i < 11; i++) s2 += Number(inn[i]) * c2[i]
  const ctrl2 = (s2 % 11) % 10
  return ctrl2 === Number(inn[11])
}

export function digitsOnlyInn(inn) {
  return String(inn ?? '').replace(/\D/g, '')
}
