import { useEffect, useRef } from 'react'
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition'

type Handlers = {
  onStop: () => void
  onGo: () => void
  enabled: boolean
}

function matchCommand(text: string): 'stop' | 'go' | null {
  const t = text.toLowerCase().replace(/[!?.,"«»]/g, ' ')
  if (/\bстоп\b|\bstop\b|\bостанов/i.test(t)) return 'stop'
  if (/\bдальше\b|\bgo\b|\bвперед\b|\bпродолж/i.test(t)) return 'go'
  if (/\bпауз/i.test(t)) return 'stop'
  return null
}

/** Слушает «СТОП» / «ДАЛЬШЕ» во время паузы между звонками (нужен dev build на iPhone). */
export function useVoiceCommands({ onStop, onGo, enabled }: Handlers) {
  const handlers = useRef({ onStop, onGo })
  handlers.current = { onStop, onGo }

  useSpeechRecognitionEvent('result', (event) => {
    if (!enabled) return
    const transcript = event.results?.map((r) => r.transcript).join(' ') ?? ''
    const cmd = matchCommand(transcript)
    if (cmd === 'stop') handlers.current.onStop()
    if (cmd === 'go') handlers.current.onGo()
  })

  useEffect(() => {
    if (!enabled) {
      try {
        ExpoSpeechRecognitionModule.abort()
      } catch {
        /* web / unsupported */
      }
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
        if (!perm.granted || cancelled) return
        ExpoSpeechRecognitionModule.start({
          lang: 'ru-RU',
          interimResults: true,
          continuous: true,
        })
      } catch {
        /* simulator / web */
      }
    })()

    return () => {
      cancelled = true
      try {
        ExpoSpeechRecognitionModule.abort()
      } catch {
        /* ignore */
      }
    }
  }, [enabled])
}
