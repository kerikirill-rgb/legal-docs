import OpenAI from 'openai'
import { z } from 'zod'

const ActionSchema = z.object({
  type: z.enum(['email_draft', 'task', 'send_commercial_offer', 'crm_note', 'lead']),
  title: z.string().optional(),
  to: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  summary: z.string().optional(),
  note: z.string().optional(),
  approved: z.boolean().default(true),
})

const AnalysisSchema = z.object({
  summary: z.string(),
  actions: z.array(ActionSchema),
})

const SYSTEM = `Ты помощник менеджера после телефонного разговора. По расшифровке выдели:
- краткое резюме (2-4 предложения)
- конкретные действия: черновик письма (email_draft), задача (task), отправить КП (send_commercial_offer), заметка для CRM/сделка (crm_note)
Используй email из контакта, если в разговоре не назван другой. Ответ строго JSON без markdown.`

/**
 * @param {{ transcript: string, contact: Record<string, string> }} input
 */
export async function analyzeCall(input) {
  const { transcript, contact } = input
  const contactLine = [
    contact.firstName,
    contact.lastName,
    contact.company,
    contact.email,
    contact.phone,
  ]
    .filter(Boolean)
    .join(', ')

  if (!process.env.OPENAI_API_KEY) {
    return heuristicAnalyze(transcript, contact)
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: JSON.stringify({
          contact: contactLine,
          transcript,
          schema: {
            summary: 'string',
            actions: 'array of { type, title?, to?, subject?, body?, summary?, note? }',
          },
        }),
      },
    ],
  })

  const raw = completion.choices[0]?.message?.content || '{}'
  const parsed = AnalysisSchema.parse(JSON.parse(raw))
  return parsed
}

function heuristicAnalyze(transcript, contact) {
  const lower = transcript.toLowerCase()
  const actions = [
    {
      type: 'crm_note',
      summary: transcript.slice(0, 500),
      approved: true,
    },
  ]
  if (lower.includes('коммер') || lower.includes('кп') || lower.includes('предложен')) {
    actions.push({
      type: 'send_commercial_offer',
      note: 'Собеседник просил коммерческое предложение',
      approved: true,
    })
  }
  if (lower.includes('письм') || lower.includes('email') || lower.includes('почт')) {
    actions.push({
      type: 'email_draft',
      to: contact.email || '',
      subject: `После звонка — ${contact.company || contact.lastName || ''}`.trim(),
      body: `Добрый день!\n\nПо итогам нашего разговора:\n${transcript.slice(0, 800)}\n\nС уважением,`,
      approved: true,
    })
  }
  if (lower.includes('перезвон') || lower.includes('напомн') || lower.includes('сделать')) {
    actions.push({
      type: 'task',
      title: `Follow-up: ${contact.lastName || contact.company || 'контакт'}`,
      body: transcript.slice(0, 600),
      approved: true,
    })
  }
  return {
    summary: transcript.slice(0, 280) + (transcript.length > 280 ? '…' : ''),
    actions,
  }
}
