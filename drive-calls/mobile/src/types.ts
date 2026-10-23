export type Contact = {
  id: string
  phone: string
  firstName: string
  lastName: string
  company: string
  email: string
}

export type SuggestedAction = {
  type: 'email_draft' | 'task' | 'send_commercial_offer' | 'crm_note'
  title?: string
  to?: string
  subject?: string
  body?: string
  summary?: string
  note?: string
  approved?: boolean
}

export type AnalysisResult = {
  summary: string
  actions: SuggestedAction[]
}
