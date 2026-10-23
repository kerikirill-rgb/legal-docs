import type { AnalysisResult, Contact, SuggestedAction } from './types'

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8787'

export async function analyzeTranscript(contact: Contact, transcript: string): Promise<AnalysisResult> {
  const res = await fetch(`${API_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contact, transcript }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Analyze failed')
  return data
}

export async function executeActions(contact: Contact, actions: SuggestedAction[]) {
  const res = await fetch(`${API_URL}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contact, actions }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Execute failed')
  return data as { results: unknown[]; demo?: boolean }
}
