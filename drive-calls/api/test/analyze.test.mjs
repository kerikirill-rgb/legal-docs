import { analyzeCall } from '../src/analyze.js'

const contact = {
  id: '1',
  phone: '+7900',
  firstName: 'Иван',
  lastName: 'П',
  company: 'Ромашка',
  email: 'i@test.ru',
}

const transcript =
  'Договорились отправить коммерческое на почту ivan@corp.ru и перезвонить в пятницу сделать расчёт.'

const result = await analyzeCall({ transcript, contact })
console.log(JSON.stringify(result, null, 2))
if (!result.actions.some((a) => a.type === 'send_commercial_offer')) process.exit(1)
console.log('ok')
