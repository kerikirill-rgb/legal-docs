import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as DocumentPicker from 'expo-document-picker'
import * as Clipboard from 'expo-clipboard'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { analyzeTranscript, executeActions } from './src/api'
import { parseContactsCsv } from './src/csv'
import type { AnalysisResult, Contact, SuggestedAction } from './src/types'
import { useVoiceCommands } from './src/useVoiceCommands'

const STORAGE_KEY = 'drive-calls:v1'
const COUNTDOWN_SEC = 10

type Phase = 'idle' | 'incall' | 'wrapup' | 'countdown' | 'paused'

type Session = {
  contacts: Contact[]
  index: number
  phase: Phase
}

async function loadSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  return JSON.parse(raw) as Session
}

async function saveSession(session: Session) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

function displayName(c: Contact) {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.phone
}

export default function App() {
  const [session, setSession] = useState<Session>({ contacts: [], index: 0, phase: 'idle' })
  const [transcript, setTranscript] = useState('')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [busyBitrix, setBusyBitrix] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SEC)
  const dialGuard = useRef(false)

  const current = session.contacts[session.index]
  const nextContact = session.contacts[session.index + 1]

  useEffect(() => {
    loadSession().then((s) => {
      if (s) setSession(s)
    })
  }, [])

  useEffect(() => {
    if (session.contacts.length) saveSession(session)
  }, [session])

  const dial = useCallback(
    async (contact: Contact) => {
      const url = `tel:${contact.phone.replace(/\s/g, '')}`
      const ok = await Linking.canOpenURL(url)
      if (!ok) {
        Alert.alert('Звонок', 'На этом устройстве нельзя открыть tel: (нужен iPhone)')
        return
      }
      setSession((s) => ({ ...s, phase: 'incall' }))
      await Linking.openURL(url)
    },
    [],
  )

  const startCall = useCallback(async () => {
    if (!current) return
    await dial(current)
  }, [current, dial])

  const advanceAndDial = useCallback(async () => {
    if (dialGuard.current) return
    dialGuard.current = true
    const nextIndex = session.index + 1
    if (nextIndex >= session.contacts.length) {
      Alert.alert('Обзвон', 'Список завершён')
      setSession((s) => ({ ...s, phase: 'idle' }))
      dialGuard.current = false
      return
    }
    const next = session.contacts[nextIndex]
    setTranscript('')
    setAnalysis(null)
    setSession((s) => ({ ...s, index: nextIndex, phase: 'incall' }))
    setSecondsLeft(COUNTDOWN_SEC)
    dialGuard.current = false
    await dial(next)
  }, [session.contacts, session.index, dial])

  const beginCountdown = useCallback(() => {
    if (!session.contacts[session.index + 1]) {
      Alert.alert('Обзвон', 'Это был последний контакт в списке')
      setSession((s) => ({ ...s, phase: 'idle' }))
      return
    }
    setSecondsLeft(COUNTDOWN_SEC)
    setSession((s) => ({ ...s, phase: 'countdown' }))
  }, [session.contacts, session.index])

  const pauseCountdown = useCallback(() => {
    setSession((s) => ({ ...s, phase: 'paused' }))
  }, [])

  const resumeCountdown = useCallback(() => {
    setSession((s) => ({ ...s, phase: 'countdown' }))
  }, [])

  useVoiceCommands({
    enabled: session.phase === 'countdown' || session.phase === 'paused',
    onStop: pauseCountdown,
    onGo: () => {
      setSecondsLeft(0)
    },
  })

  useEffect(() => {
    if (session.phase !== 'countdown') return
    if (secondsLeft <= 0) {
      advanceAndDial()
      return
    }
    const t = setTimeout(() => setSecondsLeft((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [session.phase, secondsLeft, advanceAndDial])

  const importCsv = useCallback(async () => {
    const pick = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain'],
    })
    if (pick.canceled || !pick.assets?.[0]) return
    const asset = pick.assets[0]
    const res = await fetch(asset.uri)
    const text = await res.text()
    const contacts = parseContactsCsv(text)
    if (!contacts.length) {
      Alert.alert('CSV', 'Не удалось прочитать контакты. Нужны колонки: phone, firstName, lastName, company, email')
      return
    }
    setSession({ contacts, index: 0, phase: 'idle' })
    setTranscript('')
    setAnalysis(null)
  }, [])

  const pasteFromClipboard = useCallback(async () => {
    const text = await Clipboard.getStringAsync()
    if (text) setTranscript(text)
  }, [])

  const runAnalyze = useCallback(async () => {
    if (!current || !transcript.trim()) return
    setLoading(true)
    try {
      const result = await analyzeTranscript(current, transcript.trim())
      setAnalysis({
        ...result,
        actions: result.actions.map((a) => ({ ...a, approved: a.approved !== false })),
      })
    } catch (e) {
      Alert.alert('Анализ', e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }, [current, transcript])

  const toggleAction = (i: number, approved: boolean) => {
    if (!analysis) return
    const actions = analysis.actions.map((a, idx) => (idx === i ? { ...a, approved } : a))
    setAnalysis({ ...analysis, actions })
  }

  const sendToBitrix = useCallback(async () => {
    if (!current || !analysis) return
    setBusyBitrix(true)
    try {
      await executeActions(current, analysis.actions)
      Alert.alert('Битрикс', 'Лид / задачи обновлены')
    } catch (e) {
      Alert.alert('Битрикс', e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusyBitrix(false)
    }
  }, [current, analysis])

  const progress = useMemo(() => {
    if (!session.contacts.length) return '0/0'
    return `${session.index + 1}/${session.contacts.length}`
  }, [session])

  if (session.phase === 'incall' && current) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.inCallSafe}>
          <StatusBar style="light" />
          <Text style={styles.inCallLabel}>Сейчас на линии</Text>
          <Text style={styles.inCallName}>{displayName(current)}</Text>
          {current.company ? <Text style={styles.inCallCompany}>{current.company}</Text> : null}
          <Pressable
            style={styles.endCallBtn}
            onPress={() => setSession((s) => ({ ...s, phase: 'wrapup' }))}
          >
            <Text style={styles.endCallBtnText}>Завершил разговор</Text>
          </Pressable>
        </SafeAreaView>
      </SafeAreaProvider>
    )
  }

  if ((session.phase === 'countdown' || session.phase === 'paused') && nextContact) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.countdownSafe}>
          <StatusBar style="light" />
          <Text style={styles.countdownTitle}>
            {session.phase === 'paused' ? 'Пауза' : 'Следующий звонок'}
          </Text>
          {session.phase === 'countdown' ? (
            <Text style={styles.countdownNumber}>{secondsLeft}</Text>
          ) : (
            <Text style={styles.countdownPaused}>остановлено</Text>
          )}
          <Text style={styles.nextName}>{displayName(nextContact)}</Text>
          {nextContact.company ? <Text style={styles.nextCompany}>{nextContact.company}</Text> : null}
          <Text style={styles.voiceHint}>Скажите «СТОП» или «ДАЛЬШЕ» · или кнопки ниже</Text>
          <Pressable style={styles.stopBtn} onPress={pauseCountdown}>
            <Text style={styles.stopBtnText}>СТОП</Text>
          </Pressable>
          {session.phase === 'paused' ? (
            <Pressable style={styles.secondaryBtn} onPress={resumeCountdown}>
              <Text style={styles.secondaryBtnText}>Продолжить таймер</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.primaryBtn} onPress={() => setSecondsLeft(0)}>
            <Text style={styles.primaryBtnText}>Дальше сейчас</Text>
          </Pressable>
        </SafeAreaView>
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.kicker}>Drive Calls · iPhone</Text>
          <Text style={styles.title}>Обзвон</Text>
          <Text style={styles.hint}>
            На линии — только ФИО и компания. После звонка — вставка из «Мой МТС», Битрикс, затем таймер 10 сек.
          </Text>

          <Pressable style={styles.secondaryBtn} onPress={importCsv}>
            <Text style={styles.secondaryBtnText}>Загрузить CSV</Text>
          </Pressable>

          {current ? (
            <View style={styles.card}>
              <Text style={styles.progress}>{progress}</Text>
              <Text style={styles.sectionTitle}>Следующий в очереди</Text>
              <Text style={styles.name}>{displayName(current)}</Text>
              {current.company ? <Text style={styles.company}>{current.company}</Text> : null}
              <Text style={styles.phone}>{current.phone}</Text>

              {session.phase === 'idle' && (
                <Pressable style={styles.primaryBtn} onPress={startCall}>
                  <Text style={styles.primaryBtnText}>Позвонить</Text>
                </Pressable>
              )}

              {session.phase === 'wrapup' && (
                <View style={styles.wrapBlock}>
                  <Text style={styles.sectionTitle}>Расшифровка из «Мой МТС»</Text>
                  <Pressable style={styles.linkBtn} onPress={pasteFromClipboard}>
                    <Text style={styles.linkBtnText}>Вставить из буфера</Text>
                  </Pressable>
                  <TextInput
                    style={styles.textArea}
                    multiline
                    placeholder="Текст разговора…"
                    placeholderTextColor="#6b7280"
                    value={transcript}
                    onChangeText={setTranscript}
                  />
                  <Pressable style={styles.secondaryBtn} onPress={runAnalyze} disabled={loading}>
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.secondaryBtnText}>Разобрать AI</Text>
                    )}
                  </Pressable>

                  {analysis && (
                    <View style={styles.analysis}>
                      <Text style={styles.sectionTitle}>Резюме</Text>
                      <Text style={styles.body}>{analysis.summary}</Text>
                      {analysis.actions.map((a, i) => (
                        <View key={i} style={styles.actionRow}>
                          <Switch value={Boolean(a.approved)} onValueChange={(v) => toggleAction(i, v)} />
                          <View style={styles.actionText}>
                            <Text style={styles.actionType}>{a.type}</Text>
                            <Text style={styles.body}>
                              {a.title || a.subject || a.note || a.summary || a.body}
                            </Text>
                          </View>
                        </View>
                      ))}
                      <Pressable style={styles.secondaryBtn} onPress={sendToBitrix} disabled={busyBitrix}>
                        {busyBitrix ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.secondaryBtnText}>Отправить в Битрикс</Text>
                        )}
                      </Pressable>
                    </View>
                  )}

                  <Pressable style={styles.primaryBtn} onPress={beginCountdown}>
                    <Text style={styles.primaryBtnText}>К следующему — через {COUNTDOWN_SEC} сек</Text>
                  </Pressable>
                  <Pressable style={styles.linkBtn} onPress={beginCountdown}>
                    <Text style={styles.linkBtnText}>Пропустить CRM и сразу в таймер</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.empty}>Загрузите CSV со списком для обзвона.</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  inCallSafe: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  inCallLabel: { color: '#64748b', fontSize: 16, marginBottom: 12 },
  inCallName: { color: '#f8fafc', fontSize: 40, fontWeight: '800', textAlign: 'center' },
  inCallCompany: { color: '#38bdf8', fontSize: 24, marginTop: 12, textAlign: 'center' },
  endCallBtn: {
    position: 'absolute',
    bottom: 48,
    left: 24,
    right: 24,
    backgroundColor: '#334155',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  endCallBtnText: { color: '#f1f5f9', fontSize: 18, fontWeight: '600' },
  countdownSafe: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  countdownTitle: { color: '#94a3b8', fontSize: 18 },
  countdownNumber: { color: '#f8fafc', fontSize: 96, fontWeight: '900', marginVertical: 8 },
  countdownPaused: { color: '#fbbf24', fontSize: 28, fontWeight: '700', marginVertical: 16 },
  nextName: { color: '#f8fafc', fontSize: 32, fontWeight: '800', textAlign: 'center' },
  nextCompany: { color: '#38bdf8', fontSize: 20, marginTop: 8, textAlign: 'center' },
  voiceHint: { color: '#64748b', fontSize: 14, marginTop: 24, textAlign: 'center' },
  stopBtn: {
    marginTop: 32,
    backgroundColor: '#dc2626',
    width: '100%',
    paddingVertical: 28,
    borderRadius: 20,
    alignItems: 'center',
  },
  stopBtnText: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: 4 },
  container: { padding: 20, paddingBottom: 48 },
  kicker: { color: '#94a3b8', fontSize: 13, marginBottom: 4 },
  title: { color: '#f8fafc', fontSize: 28, fontWeight: '700', marginBottom: 8 },
  hint: { color: '#cbd5e1', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
  },
  progress: { color: '#64748b', fontSize: 13, marginBottom: 8 },
  name: { color: '#f8fafc', fontSize: 32, fontWeight: '800' },
  company: { color: '#38bdf8', fontSize: 18, marginTop: 4 },
  phone: { color: '#94a3b8', fontSize: 16, marginTop: 8, marginBottom: 20 },
  primaryBtn: {
    backgroundColor: '#22c55e',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
  },
  primaryBtnText: { color: '#052e16', fontSize: 18, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
  },
  secondaryBtnText: { color: '#f1f5f9', fontSize: 16, fontWeight: '600' },
  linkBtn: { alignSelf: 'flex-start', marginBottom: 8, marginTop: 8 },
  linkBtnText: { color: '#38bdf8', fontSize: 15 },
  wrapBlock: { marginTop: 8 },
  sectionTitle: { color: '#e2e8f0', fontSize: 16, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  textArea: {
    minHeight: 120,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    color: '#f8fafc',
    fontSize: 15,
    textAlignVertical: 'top',
  },
  analysis: { marginTop: 8 },
  body: { color: '#cbd5e1', fontSize: 14, lineHeight: 20 },
  actionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  actionText: { flex: 1 },
  actionType: { color: '#a5b4fc', fontSize: 12, textTransform: 'uppercase', marginBottom: 2 },
  empty: { color: '#64748b', marginTop: 24, fontSize: 16 },
})
