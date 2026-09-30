import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { SCENES } from './scenes'

const C = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }

const colors = {
  bg1: '#070B18',
  bg2: '#0E1A3A',
  blue: '#3B82F6',
  blueDeep: '#2563EB',
  cyan: '#22D3EE',
  green: '#22C55E',
  red: '#EF4444',
  text: '#F8FAFC',
  muted: '#B8C4D6',
  card: '#FFFFFF',
  tg: '#2AABEE',
}

const REQUISITES = [
  ['ИНН', '7701234567'],
  ['КПП', '770101001'],
  ['ОГРН', '1027700123456'],
  ['БИК', '044525999'],
  ['Р/с', '40702810400000012345'],
  ['К/с', '30101810400000000999'],
]

const appear = (frame, start, dur = 16, dist = 40) => ({
  opacity: interpolate(frame, [start, start + dur], [0, 1], C),
  transform: `translateY(${interpolate(frame, [start, start + dur], [dist, 0], C)}px)`,
})

const usePop = (start, config = { damping: 13, mass: 0.8 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - start, fps, config })
}

/* ---------- Icons ---------- */

const IconDoc = ({ size = 48, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
)

const IconCheck = ({ size = 32, color = '#fff', stroke = 3 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

const IconBolt = ({ size = 40, color = '#FACC15' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
  </svg>
)

const IconCamera = ({ size = 40, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </svg>
)

const IconAlert = ({ size = 36, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l10 18H2z" />
    <path d="M12 10v5M12 18h.01" />
  </svg>
)

const IconPlane = ({ size = 44, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M21.5 3.5L2.8 10.7c-1 .4-1 1.8.1 2.1l4.7 1.5 1.8 5.6c.3.9 1.4 1.1 2 .4l2.6-2.7 4.9 3.6c.8.6 1.9.1 2.1-.8l3-15.1c.2-1.1-.9-2-1.9-1.6zM9.5 14.2l8.6-7.6-6.9 8.9-.4 3.1z" />
  </svg>
)

/* ---------- Shared pieces ---------- */

const Background = () => {
  const frame = useCurrentFrame()
  const t = frame / 30
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${colors.bg1} 0%, ${colors.bg2} 55%, #0A1128 100%)`, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          width: 900,
          height: 900,
          borderRadius: '50%',
          left: -300 + Math.sin(t * 0.4) * 80,
          top: 100 + Math.cos(t * 0.3) * 120,
          background: 'radial-gradient(circle, rgba(37,99,235,0.35) 0%, rgba(37,99,235,0) 70%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 800,
          height: 800,
          borderRadius: '50%',
          right: -300 + Math.cos(t * 0.35) * 80,
          bottom: 50 + Math.sin(t * 0.25) * 140,
          background: 'radial-gradient(circle, rgba(34,211,238,0.22) 0%, rgba(34,211,238,0) 70%)',
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.09) 1.5px, transparent 1.5px)',
          backgroundSize: '44px 44px',
          maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
        }}
      />
    </AbsoluteFill>
  )
}

const Scene = ({ dur, fadeIn = true, children }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, fadeIn ? [0, 10, dur - 10, dur] : [0, 1, dur - 10, dur], [fadeIn ? 0 : 1, 1, 1, 0], C)
  return <AbsoluteFill style={{ opacity, fontFamily: 'Inter, sans-serif', color: colors.text }}>{children}</AbsoluteFill>
}

const Logo = ({ size = 160 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.28,
      background: `linear-gradient(135deg, ${colors.blue}, ${colors.cyan})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 20px 60px rgba(59,130,246,0.55)',
      position: 'relative',
    }}
  >
    <IconDoc size={size * 0.56} color="#fff" />
    <div
      style={{
        position: 'absolute',
        right: -size * 0.08,
        bottom: -size * 0.08,
        width: size * 0.38,
        height: size * 0.38,
        borderRadius: '50%',
        background: colors.green,
        border: `${size * 0.04}px solid ${colors.bg2}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <IconCheck size={size * 0.24} stroke={3.4} />
    </div>
  </div>
)

const Pill = ({ children, style }) => (
  <div
    style={{
      padding: '18px 34px',
      borderRadius: 999,
      background: 'rgba(255,255,255,0.08)',
      border: '1.5px solid rgba(255,255,255,0.16)',
      fontSize: 38,
      fontWeight: 600,
      ...style,
    }}
  >
    {children}
  </div>
)

/* ---------- Scene 1: hook ---------- */

const Hook = ({ dur }) => {
  const frame = useCurrentFrame()
  const words = ['Счёт.', 'Акт.', 'УПД.']
  const underline = interpolate(frame, [68, 88], [0, 100], C)
  return (
    <Scene dur={dur} fadeIn={false}>
      <AbsoluteFill style={{ justifyContent: 'center', padding: '0 90px' }}>
        {words.map((w, i) => {
          const start = i * 10
          const p = interpolate(frame, [start, start + 12], [i === 0 ? 1 : 0, 1], C)
          return (
            <div
              key={w}
              style={{
                fontSize: 170,
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: -4,
                opacity: p,
                transform: `translateX(${(1 - p) * -60}px)`,
              }}
            >
              {w}
            </div>
          )
        })}
        <div style={{ marginTop: 70, ...appear(frame, 48) }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.15 }}>
            И снова опечатка
            <br />
            <span style={{ position: 'relative', color: '#FCA5A5' }}>
              в ИНН?
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: -6,
                  height: 10,
                  width: `${underline}%`,
                  borderRadius: 6,
                  background: colors.red,
                }}
              />
            </span>
          </div>
        </div>
      </AbsoluteFill>
    </Scene>
  )
}

/* ---------- Scene 2: problem ---------- */

const Problem = ({ dur }) => {
  const frame = useCurrentFrame()
  const rows = REQUISITES.filter(([k]) => ['ИНН', 'КПП', 'БИК', 'Р/с'].includes(k))
  const errorAt = 100
  const isError = frame >= errorAt
  const shake = isError ? Math.sin((frame - errorAt) * 2.2) * interpolate(frame, [errorAt, errorAt + 18], [14, 0], C) : 0
  const minutes = Math.round(interpolate(frame, [128, 158], [0, 40], C))
  const cardPop = usePop(8)

  return (
    <Scene dur={dur}>
      <div style={{ position: 'absolute', top: 250, left: 90, right: 90, ...appear(frame, 0) }}>
        <div style={{ fontSize: 44, color: colors.muted, fontWeight: 500 }}>Каждый раз вручную:</div>
        <div style={{ fontSize: 72, fontWeight: 700, marginTop: 8, lineHeight: 1.1 }}>копируешь реквизиты</div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 520,
          left: 90,
          right: 90,
          background: colors.card,
          borderRadius: 36,
          padding: '44px 48px',
          color: '#0F172A',
          boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
          transform: `scale(${0.9 + cardPop * 0.1}) translateX(${shake}px)`,
          opacity: cardPop,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 40, fontWeight: 700 }}>СЧЁТ НА ОПЛАТУ № 147</div>
          <IconDoc size={52} color={colors.blueDeep} />
        </div>
        <div style={{ height: 2, background: '#E2E8F0', margin: '28px 0 18px' }} />
        {rows.map(([label, value], i) => {
          const start = 24 + i * 18
          const shown = value.slice(0, Math.floor(interpolate(frame, [start, start + 14], [0, value.length], C)))
          const bad = label === 'ИНН' && isError
          const display = bad ? '7701234576' : shown
          return (
            <div
              key={label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 18px',
                marginTop: 6,
                borderRadius: 16,
                background: bad ? '#FEE2E2' : 'transparent',
                fontSize: 40,
              }}
            >
              <span style={{ color: '#64748B', fontWeight: 500 }}>{label}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: bad ? colors.red : '#0F172A' }}>
                {display}
                {!bad && shown.length < value.length && frame >= start ? <span style={{ color: colors.blueDeep }}>|</span> : null}
              </span>
            </div>
          )
        })}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 1080,
          left: 90,
          right: 90,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '26px 32px',
          borderRadius: 24,
          background: 'rgba(239,68,68,0.16)',
          border: '2px solid rgba(239,68,68,0.6)',
          ...appear(frame, errorAt + 4, 12, 20),
        }}
      >
        <IconAlert size={52} color="#FCA5A5" />
        <div style={{ fontSize: 42, fontWeight: 600 }}>Одна цифра — и платёж вернули</div>
      </div>

      <div style={{ position: 'absolute', top: 1250, left: 90, right: 90, ...appear(frame, 124) }}>
        <div style={{ fontSize: 120, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          ≈ {minutes} <span style={{ fontSize: 64 }}>минут</span>
        </div>
        <div style={{ fontSize: 44, color: colors.muted, marginTop: 14 }}>на один пакет документов</div>
      </div>
    </Scene>
  )
}

/* ---------- Scene 3: reveal ---------- */

const Reveal = ({ dur }) => {
  const frame = useCurrentFrame()
  const pop = usePop(4, { damping: 10, mass: 0.9 })
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 80px' }}>
        <div style={{ transform: `scale(${pop}) rotate(${(1 - pop) * -20}deg)` }}>
          <Logo size={220} />
        </div>
        <div style={{ fontSize: 132, fontWeight: 700, letterSpacing: -3, marginTop: 60, ...appear(frame, 16) }}>
          Legal<span style={{ color: colors.cyan }}>Docs</span>
        </div>
        <div style={{ fontSize: 50, color: '#CBD5E1', marginTop: 20, lineHeight: 1.3, ...appear(frame, 26) }}>
          Конструктор документов
          <br />
          для малого бизнеса
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center', marginTop: 60 }}>
          {['Договор за 5 шагов', 'Счета · Акты · УПД', 'В один клик'].map((t, i) => (
            <Pill key={t} style={appear(frame, 40 + i * 8, 14, 24)}>
              {t}
            </Pill>
          ))}
        </div>
      </AbsoluteFill>
    </Scene>
  )
}

/* ---------- Scene 4: Telegram bot flow ---------- */

const STEP_DUR = 102

const STEPS = [
  { title: 'Один раз отправь карточку своей компании' },
  { title: 'Добавь логотип, печать и подпись' },
  { title: 'Выбери готовые шаблоны или загрузи свои' },
  { title: 'Сфотографируй карточку контрагента' },
  { title: 'Получи полный пакет за 3\u00A0секунды' },
]

const Bubble = ({ from, at, children, width }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - at, fps, config: { damping: 14, mass: 0.7 } })
  const me = from === 'me'
  return (
    <div style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start', marginBottom: 22 }}>
      <div
        style={{
          maxWidth: width || '82%',
          width,
          padding: '22px 26px',
          borderRadius: 30,
          borderBottomRightRadius: me ? 8 : 30,
          borderBottomLeftRadius: me ? 30 : 8,
          background: me ? '#2B5278' : '#182533',
          fontSize: 32,
          lineHeight: 1.35,
          opacity: s,
          transform: `translateY(${(1 - s) * 30}px) scale(${0.85 + s * 0.15})`,
          transformOrigin: me ? 'bottom right' : 'bottom left',
        }}
      >
        {children}
      </div>
    </div>
  )
}

const FileRow = ({ name, meta, color = colors.tg }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
    <div style={{ width: 76, height: 76, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <IconDoc size={40} />
    </div>
    <div>
      <div style={{ fontWeight: 600, fontSize: 31 }}>{name}</div>
      <div style={{ color: '#8FA3B8', fontSize: 26, marginTop: 4 }}>{meta}</div>
    </div>
  </div>
)

const CheckLine = ({ children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
    <IconCheck size={30} color={colors.green} />
    <span>{children}</span>
  </div>
)

const StepChat = ({ step }) => {
  const frame = useCurrentFrame()
  if (step === 0) {
    return (
      <>
        <Bubble from="me" at={4}>
          <FileRow name="Карточка_ООО_Ромашка.pdf" meta="184 КБ · PDF" />
        </Bubble>
        <Bubble from="bot" at={30}>
          <div style={{ fontWeight: 700 }}>Реквизиты сохранены</div>
          <CheckLine>ИНН · КПП · ОГРН</CheckLine>
          <CheckLine>БИК · р/с · к/с</CheckLine>
          <CheckLine>Адрес и директор</CheckLine>
        </Bubble>
      </>
    )
  }
  if (step === 1) {
    return (
      <>
        <Bubble from="me" at={4}>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ width: 150, height: 150, borderRadius: 22, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 34, fontWeight: 800, color: colors.blueDeep, textAlign: 'center', lineHeight: 1.1 }}>
                ООО
                <br />
                Ромашка
              </div>
            </div>
            <div style={{ width: 150, height: 150, borderRadius: 22, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 118, height: 118, borderRadius: '50%', border: '5px solid #2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB', fontSize: 20, fontWeight: 700, textAlign: 'center', transform: 'rotate(-12deg)' }}>
                ПЕЧАТЬ
              </div>
            </div>
          </div>
        </Bubble>
        <Bubble from="bot" at={32}>
          <div style={{ fontWeight: 700 }}>Готово!</div>
          <CheckLine>Логотип добавлен</CheckLine>
          <CheckLine>Печать и подпись в шаблонах</CheckLine>
        </Bubble>
      </>
    )
  }
  if (step === 2) {
    const buttons = ['Договор', 'Счёт', 'Акт', 'УПД']
    return (
      <Bubble from="bot" at={4} width="100%">
        <div style={{ fontWeight: 700, marginBottom: 18 }}>Какие документы нужны?</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {buttons.map((b, i) => {
            const on = frame >= 28 + i * 12
            return (
              <div
                key={b}
                style={{
                  padding: '22px 0',
                  borderRadius: 18,
                  textAlign: 'center',
                  fontWeight: 600,
                  background: on ? colors.tg : 'rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  transform: `scale(${on ? interpolate(frame, [28 + i * 12, 34 + i * 12], [0.92, 1], C) : 1})`,
                }}
              >
                {on ? <IconCheck size={30} /> : null}
                {b}
              </div>
            )
          })}
        </div>
        <div style={{ color: '#8FA3B8', fontSize: 27, marginTop: 18 }}>20+ готовых шаблонов или свои .docx</div>
      </Bubble>
    )
  }
  if (step === 3) {
    const flash = interpolate(frame, [10, 14, 24], [0, 0.9, 0], C)
    const progress = interpolate(frame, [38, 64], [0, 100], C)
    return (
      <>
        <Bubble from="me" at={6}>
          <div style={{ position: 'relative', width: 420, height: 270, borderRadius: 20, background: '#F1F5F9', padding: 26, color: '#0F172A', overflow: 'hidden', transform: 'rotate(-2deg)' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>Карточка предприятия</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>ООО «Вектор»</div>
            {[88, 70, 80, 60].map((w, i) => (
              <div key={i} style={{ height: 14, width: `${w}%`, background: '#CBD5E1', borderRadius: 7, marginTop: 16 }} />
            ))}
            <AbsoluteFill style={{ background: '#fff', opacity: flash }} />
          </div>
        </Bubble>
        <Bubble from="bot" at={34}>
          {progress < 100 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600 }}>
                <IconCamera size={34} color={colors.tg} /> Распознаю реквизиты…
              </div>
              <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.12)', marginTop: 16, width: 460 }}>
                <div style={{ height: 12, borderRadius: 6, width: `${progress}%`, background: colors.tg }} />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 38 }}>
              <div style={{ fontWeight: 700 }}>Контрагент найден</div>
              <CheckLine>ООО «Вектор»</CheckLine>
              <CheckLine>ИНН 5402123456</CheckLine>
            </div>
          )}
        </Bubble>
      </>
    )
  }
  const files = [
    ['Договор_№15.pdf', '#6366F1'],
    ['Счёт_№147.pdf', colors.tg],
    ['Акт_№147.pdf', '#14B8A6'],
    ['УПД_№147.pdf', '#F59E0B'],
  ]
  return (
    <Bubble from="bot" at={4} width="100%">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 700, fontSize: 36, marginBottom: 20 }}>
        <IconBolt size={40} /> Готово за 2,8 сек
      </div>
      {files.map(([name, color], i) => (
        <div key={name} style={{ marginTop: 16, ...appear(frame, 14 + i * 9, 10, 20) }}>
          <FileRow name={name} meta="Реквизиты сверены · PDF" color={color} />
        </div>
      ))}
    </Bubble>
  )
}

const StepDots = ({ active, localFrame }) => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18 }}>
    {STEPS.map((_, i) => {
      const done = i < active
      const on = i === active
      const grow = on ? interpolate(localFrame, [0, 12], [0.8, 1], C) : 1
      return (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              fontWeight: 700,
              background: done ? colors.green : on ? colors.blue : 'rgba(255,255,255,0.08)',
              border: on ? '4px solid rgba(255,255,255,0.8)' : '2px solid rgba(255,255,255,0.15)',
              boxShadow: on ? '0 0 40px rgba(59,130,246,0.8)' : 'none',
              transform: `scale(${grow})`,
            }}
          >
            {done ? <IconCheck size={38} /> : i + 1}
          </div>
          {i < STEPS.length - 1 ? <div style={{ width: 40, height: 4, borderRadius: 2, background: done ? colors.green : 'rgba(255,255,255,0.15)' }} /> : null}
        </div>
      )
    })}
  </div>
)

const Flow = ({ dur }) => {
  const frame = useCurrentFrame()
  const step = Math.min(STEPS.length - 1, Math.floor(frame / STEP_DUR))
  const local = frame - step * STEP_DUR
  const titleOpacity = interpolate(local, [0, 10, STEP_DUR - 8, STEP_DUR], [0, 1, 1, step === STEPS.length - 1 ? 1 : 0], C)
  const phoneIn = usePop(0, { damping: 16 })

  return (
    <Scene dur={dur}>
      <div style={{ position: 'absolute', top: 300, left: 0, right: 0 }}>
        <StepDots active={step} localFrame={local} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: 410,
          left: 70,
          right: 70,
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontSize: 60,
          fontWeight: 700,
          lineHeight: 1.15,
          textWrap: 'balance',
          opacity: titleOpacity,
          transform: `translateY(${interpolate(local, [0, 12], [24, 0], C)}px)`,
        }}
      >
        {STEPS[step].title}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 610,
          left: 140,
          width: 800,
          height: 900,
          borderRadius: 64,
          background: '#0E1621',
          border: '10px solid #1E293B',
          boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.08)',
          overflow: 'hidden',
          opacity: phoneIn,
          transform: `translateY(${(1 - phoneIn) * 120}px)`,
        }}
      >
        <div style={{ height: 120, background: '#17212B', display: 'flex', alignItems: 'center', gap: 22, padding: '0 34px' }}>
          <Logo size={72} />
          <div>
            <div style={{ fontSize: 34, fontWeight: 700 }}>LegalDocs Bot</div>
            <div style={{ fontSize: 26, color: colors.tg }}>бот · онлайн</div>
          </div>
        </div>
        <div style={{ position: 'absolute', top: 120, left: 0, right: 0, bottom: 0, padding: '34px 30px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          {STEPS.map((_, i) => (
            <Sequence key={i} from={i * STEP_DUR} durationInFrames={i === STEPS.length - 1 ? dur - i * STEP_DUR : STEP_DUR} layout="none">
              <StepChatFrame step={i} last={i === STEPS.length - 1} />
            </Sequence>
          ))}
        </div>
      </div>
    </Scene>
  )
}

const StepChatFrame = ({ step, last }) => {
  const frame = useCurrentFrame()
  const out = last ? 1 : interpolate(frame, [STEP_DUR - 10, STEP_DUR], [1, 0], C)
  return (
    <div style={{ opacity: out, transform: `translateY(${(1 - out) * -60}px)` }}>
      <StepChat step={step} />
    </div>
  )
}

/* ---------- Scene 5: result ---------- */

const DOCS = [
  { name: 'Договор', color: '#6366F1' },
  { name: 'Счёт', color: colors.tg },
  { name: 'Акт', color: '#14B8A6' },
  { name: 'УПД', color: '#F59E0B' },
]

const MiniDoc = ({ name, color, index }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - 6 - index * 6, fps, config: { damping: 12 } })
  const rot = [-12, -4, 4, 12][index]
  const x = [-270, -90, 90, 270][index]
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: 0,
        width: 250,
        height: 330,
        marginLeft: -125,
        borderRadius: 24,
        background: '#fff',
        boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
        transform: `translateX(${x * s}px) translateY(${(1 - s) * 200 + Math.abs(rot) * 2}px) rotate(${rot * s}deg)`,
        opacity: s,
        overflow: 'hidden',
        color: '#0F172A',
      }}
    >
      <div style={{ height: 70, background: color, display: 'flex', alignItems: 'center', padding: '0 22px', color: '#fff', fontSize: 34, fontWeight: 700 }}>{name}</div>
      <div style={{ padding: 22 }}>
        {[90, 70, 80, 55, 75].map((w, i) => (
          <div key={i} style={{ height: 12, width: `${w}%`, borderRadius: 6, background: '#E2E8F0', marginTop: 14 }} />
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 26 }}>
          <div style={{ width: 54, height: 54, borderRadius: '50%', background: colors.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconCheck size={32} />
          </div>
        </div>
      </div>
    </div>
  )
}

const Result = ({ dur }) => {
  const frame = useCurrentFrame()
  const badge = usePop(150, { damping: 11 })
  return (
    <Scene dur={dur}>
      <div style={{ position: 'absolute', top: 220, left: 80, right: 80, textAlign: 'center', ...appear(frame, 0) }}>
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>Полный пакет документов</div>
      </div>
      <div style={{ position: 'absolute', top: 400, left: 0, right: 0, height: 380 }}>
        {DOCS.map((d, i) => (
          <MiniDoc key={d.name} {...d} index={i} />
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 830,
          left: 80,
          right: 80,
          borderRadius: 32,
          background: 'rgba(15,23,42,0.75)',
          border: '1.5px solid rgba(255,255,255,0.12)',
          padding: '26px 34px',
          ...appear(frame, 40),
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', color: colors.muted, fontSize: 28, fontWeight: 600, paddingBottom: 12 }}>
          <span>Реквизит</span>
          <span>Договор · Счёт · Акт · УПД</span>
        </div>
        {REQUISITES.map(([label, value], i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
              <span style={{ width: 96, color: colors.muted, fontSize: 32, fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 32, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {DOCS.map((d, j) => {
                const on = frame >= 56 + i * 12 + j * 3
                return (
                  <div
                    key={d.name}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      background: on ? colors.green : 'rgba(255,255,255,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: `scale(${on ? interpolate(frame, [56 + i * 12 + j * 3, 62 + i * 12 + j * 3], [0.5, 1], C) : 1})`,
                    }}
                  >
                    {on ? <IconCheck size={24} stroke={3.4} /> : null}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', top: 1400, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            padding: '24px 40px',
            borderRadius: 999,
            background: colors.green,
            boxShadow: '0 0 60px rgba(34,197,94,0.6)',
            fontSize: 42,
            fontWeight: 700,
            transform: `scale(${badge})`,
            opacity: badge,
          }}
        >
          100% совпадение — цифра в цифру
        </div>
      </div>
    </Scene>
  )
}

/* ---------- Scene 6: stats ---------- */

const Stats = ({ dur }) => {
  const frame = useCurrentFrame()
  const secs = Math.round(interpolate(frame, [8, 40], [40, 3], C))
  const items = [
    { big: `${secs} ${frame < 40 ? 'мин' : 'сек'}`, small: 'вместо 40 минут на пакет', color: colors.cyan },
    { big: '0 ошибок', small: 'в ИНН, БИК и номерах счетов', color: colors.green },
    { big: '1 клик', small: 'до договора, счёта, акта и УПД', color: '#FACC15' },
  ]
  return (
    <Scene dur={dur}>
      <AbsoluteFill style={{ justifyContent: 'center', padding: '0 90px', gap: 70 }}>
        {items.map((it, i) => (
          <div key={it.small} style={{ ...appear(frame, 4 + i * 16, 16, 50), borderLeft: `10px solid ${it.color}`, paddingLeft: 40 }}>
            <div style={{ fontSize: 140, fontWeight: 700, lineHeight: 1, letterSpacing: -3, color: it.color, fontVariantNumeric: 'tabular-nums' }}>{it.big}</div>
            <div style={{ fontSize: 46, color: '#CBD5E1', marginTop: 14 }}>{it.small}</div>
          </div>
        ))}
      </AbsoluteFill>
    </Scene>
  )
}

/* ---------- Scene 7: CTA ---------- */

const Cta = ({ dur }) => {
  const frame = useCurrentFrame()
  const pop = usePop(2)
  const pulse = 1 + Math.sin(frame / 6) * 0.025 * interpolate(frame, [40, 50], [0, 1], C)
  return (
    <Scene dur={dur + 10}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 80px' }}>
        <div style={{ transform: `scale(${pop})` }}>
          <Logo size={190} />
        </div>
        <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: -3, marginTop: 50, ...appear(frame, 10) }}>
          Legal<span style={{ color: colors.cyan }}>Docs</span>
        </div>
        <div style={{ fontSize: 54, fontWeight: 600, lineHeight: 1.25, marginTop: 24, ...appear(frame, 18) }}>
          Договоры, счета, акты и УПД —
          <br />в один клик
        </div>
        <div
          style={{
            marginTop: 70,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            padding: '32px 56px',
            borderRadius: 999,
            background: colors.tg,
            boxShadow: '0 20px 60px rgba(42,171,238,0.55)',
            fontSize: 46,
            fontWeight: 700,
            ...appear(frame, 28),
            transform: `scale(${pulse}) translateY(${interpolate(frame, [28, 44], [40, 0], C)}px)`,
          }}
        >
          <IconPlane size={52} /> Попробовать в Telegram
        </div>
        <div style={{ fontSize: 40, color: colors.muted, marginTop: 34, ...appear(frame, 38) }}>Ссылка — в профиле</div>
      </AbsoluteFill>
    </Scene>
  )
}

const COMPONENTS = { hook: Hook, problem: Problem, reveal: Reveal, flow: Flow, result: Result, stats: Stats, cta: Cta }

export const Reel = () => (
  <AbsoluteFill>
    <Background />
    {SCENES.map(({ id, dur, from }) => {
      const Comp = COMPONENTS[id]
      return (
        <Sequence key={id} from={from} durationInFrames={dur}>
          <Comp dur={dur} />
        </Sequence>
      )
    })}
  </AbsoluteFill>
)
