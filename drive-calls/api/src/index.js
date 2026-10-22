import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { z } from 'zod'
import { analyzeCall } from './analyze.js'
import { applyActions } from './bitrix.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true, bitrix: Boolean(process.env.BITRIX_WEBHOOK_URL), openai: Boolean(process.env.OPENAI_API_KEY) })
})

const AnalyzeBody = z.object({
  transcript: z.string().min(1),
  contact: z.object({
    id: z.string(),
    phone: z.string(),
    firstName: z.string().optional().default(''),
    lastName: z.string().optional().default(''),
    company: z.string().optional().default(''),
    email: z.string().optional().default(''),
  }),
})

app.post('/analyze', async (req, res) => {
  try {
    const body = AnalyzeBody.parse(req.body)
    const result = await analyzeCall(body)
    res.json(result)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

const ExecuteBody = z.object({
  contact: AnalyzeBody.shape.contact,
  actions: z.array(z.record(z.unknown())),
})

app.post('/execute', async (req, res) => {
  try {
    const body = ExecuteBody.parse(req.body)
    const results = await applyActions(body.actions, body.contact)
    res.json({ results })
  } catch (e) {
    res.status(400).json({ error: e.message, bitrix: e.bitrix })
  }
})

const port = Number(process.env.PORT || 8787)
app.listen(port, () => {
  console.log(`drive-calls API on http://localhost:${port}`)
})
