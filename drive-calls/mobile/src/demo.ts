export const DEMO_CSV = `phone,firstName,lastName,company,email
+79001234567,Иван,Петров,ООО Ромашка,ivan@example.com
+79007654321,Мария,Сидорова,АО Вектор,maria@vector.ru
+79003112233,Алексей,Козлов,ИП Козлов,alex@kozlov.ru
`

export const DEMO_TRANSCRIPT = `Добрый день, Иван. Договорились: отправлю коммерческое на ivan@example.com до пятницы.
Нужно перезвонить в понедельник и уточнить объём. По цене обсудим после КП.`

import { Platform } from 'react-native'

const envSec = process.env.EXPO_PUBLIC_COUNTDOWN_SEC
export const COUNTDOWN_SEC =
  Number(envSec || (Platform.OS === 'web' ? '5' : '10')) || 10
