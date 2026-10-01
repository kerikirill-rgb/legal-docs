import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { SCENES } from './scenes'

const C = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }

const colors = {
  bg1: '#0B1020',
  bg2: '#1C1535',
  coral: '#FF8A4C',
  amber: '#FBBF24',
  green: '#34D399',
  tg: '#2AABEE',
  text: '#F8FAFC',
  muted: '#B9C2D3',
  bubble: '#262F4D',
}

const BOT_USERNAME = '@Homeworkline_bot'

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

const stroke = (color, width = 2) => ({
  fill: 'none',
  stroke: color,
  strokeWidth: width,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
})

const IconHouse = ({ size = 64, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 2)}>
    <path d="M3 10.5L12 3l9 7.5" />
    <path d="M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9" />
  </svg>
)

const IconCheck = ({ size = 32, color = '#fff', width = 3 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, width)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

const IconBell = ({ size = 48, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 2)}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z" />
    <path d="M10 21h4" />
  </svg>
)

const IconForget = ({ size = 48, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 2)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
    <path d="M4 4l16 16" />
  </svg>
)

const IconQuestion = ({ size = 48, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 2)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7" />
    <path d="M12 17h.01" />
  </svg>
)

const IconPlane = ({ size = 44, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M21.5 3.6L2.9 10.8c-1 .4-1 1.8.1 2.1l4.6 1.4 1.8 5.6c.3.9 1.4 1.1 2 .5l2.6-2.5 4.8 3.5c.8.6 1.9.1 2.1-.9l3-15.3c.2-1.1-.9-2-1.9-1.6zM9.6 14.4l8.2-7.4-6.6 8.6-.3 3z" />
  </svg>
)

const IconSpark = ({ size = 40, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2l1.8 5.6L19.5 9.5l-5.7 1.9L12 17l-1.8-5.6L4.5 9.5l5.7-1.9zM19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z" />
  </svg>
)

/* ---------- Building blocks ---------- */

const Background = () => {
  const frame = useCurrentFrame()
  const drift = Math.sin(frame / 90) * 60
  return (
    <AbsoluteFill style={{ background: `linear-gradient(170deg, ${colors.bg1} 0%, ${colors.bg2} 100%)` }}>
      <div
        style={{
          position: 'absolute',
          width: 900,
          height: 900,
          borderRadius: '50%',
          left: -300 + drift,
          top: -200,
          background: `radial-gradient(circle, ${colors.coral}55 0%, transparent 65%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 1000,
          height: 1000,
          borderRadius: '50%',
          right: -380 - drift,
          bottom: -260,
          background: `radial-gradient(circle, ${colors.tg}44 0%, transparent 65%)`,
        }}
      />
    </AbsoluteFill>
  )
}

const SceneWrap = ({ dur, children }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 10, dur - 10, dur], [0, 1, 1, 0], C)
  return <AbsoluteFill style={{ opacity, fontFamily: 'Inter', color: colors.text }}>{children}</AbsoluteFill>
}

const Title = ({ children, style }) => (
  <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.12, letterSpacing: -1.5, ...style }}>{children}</div>
)

/* ---------- Scene 1: hook ---------- */

const ChatBubble = ({ start, side, sender, children }) => {
  const frame = useCurrentFrame()
  const pop = usePop(start)
  const isLeft = side === 'left'
  return (
    <div
      style={{
        alignSelf: isLeft ? 'flex-start' : 'flex-end',
        opacity: interpolate(frame, [start, start + 6], [0, 1], C),
        transform: `scale(${0.6 + pop * 0.4})`,
        transformOrigin: isLeft ? 'left bottom' : 'right bottom',
        maxWidth: 780,
      }}
    >
      {sender && (
        <div style={{ fontSize: 34, color: colors.muted, marginBottom: 12, marginLeft: 20, fontWeight: 500 }}>
          {sender}
        </div>
      )}
      <div
        style={{
          fontSize: 58,
          fontWeight: 500,
          padding: '34px 46px',
          borderRadius: 48,
          borderBottomLeftRadius: isLeft ? 12 : 48,
          borderBottomRightRadius: isLeft ? 48 : 12,
          background: isLeft ? colors.bubble : colors.tg,
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

const HookScene = () => {
  const frame = useCurrentFrame()
  const big = usePop(92, { damping: 10, mass: 0.7 })
  return (
    <AbsoluteFill style={{ padding: '360px 90px 0', display: 'flex', flexDirection: 'column', gap: 44 }}>
      <ChatBubble start={8} side="left" sender="Аня">
        Ты вынес мусор?
      </ChatBubble>
      <ChatBubble start={34} side="right">
        Ой… забыл
      </ChatBubble>
      <ChatBubble start={58} side="left" sender="Аня">
        Я напоминаю уже третий раз
      </ChatBubble>
      <div
        style={{
          marginTop: 110,
          textAlign: 'center',
          fontSize: 132,
          fontWeight: 700,
          letterSpacing: -3,
          opacity: interpolate(frame, [90, 98], [0, 1], C),
          transform: `scale(${0.7 + big * 0.3})`,
        }}
      >
        Знакомо?
      </div>
    </AbsoluteFill>
  )
}

/* ---------- Scene 2: problems ---------- */

const PROBLEMS = [
  {
    icon: IconForget,
    title: 'Дела забываются',
    text: 'Мусор, цветы, бельё — всё держится в голове',
  },
  {
    icon: IconBell,
    title: 'Напоминаете друг другу',
    text: 'И это раздражает обоих',
  },
  {
    icon: IconQuestion,
    title: 'Непонятно, кто что делает',
    text: 'Договорённости теряются в переписке',
  },
]

const ProblemScene = () => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ padding: '330px 80px 0' }}>
      <div style={appear(frame, 0)}>
        <div style={{ fontSize: 40, color: colors.coral, fontWeight: 600, marginBottom: 22, letterSpacing: 2 }}>
          ПРОБЛЕМА
        </div>
        <Title>
          Быт превращается
          <br />в бесконечные
          <br />
          напоминания
        </Title>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 34, marginTop: 80 }}>
        {PROBLEMS.map((p, i) => {
          const Icon = p.icon
          return (
            <div
              key={p.title}
              style={{
                ...appear(frame, 22 + i * 18, 16, 60),
                display: 'flex',
                gap: 36,
                alignItems: 'center',
                padding: '38px 42px',
                borderRadius: 40,
                background: 'rgba(255,255,255,0.06)',
                border: '2px solid rgba(255,255,255,0.10)',
              }}
            >
              <div
                style={{
                  width: 110,
                  height: 110,
                  flexShrink: 0,
                  borderRadius: 32,
                  background: `${colors.coral}22`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={60} color={colors.coral} />
              </div>
              <div>
                <div style={{ fontSize: 48, fontWeight: 700, marginBottom: 10 }}>{p.title}</div>
                <div style={{ fontSize: 36, color: colors.muted, lineHeight: 1.3 }}>{p.text}</div>
              </div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

/* ---------- Scene 3: reveal ---------- */

const RevealScene = () => {
  const frame = useCurrentFrame()
  const pop = usePop(4, { damping: 11, mass: 0.9 })
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 80 }}>
      <div
        style={{
          width: 260,
          height: 260,
          borderRadius: 76,
          background: `linear-gradient(135deg, ${colors.coral}, ${colors.amber})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${pop}) rotate(${interpolate(pop, [0, 1], [-20, 0])}deg)`,
          boxShadow: `0 30px 90px ${colors.coral}66`,
        }}
      >
        <IconHouse size={150} color="#fff" />
      </div>
      <div style={{ ...appear(frame, 16), fontSize: 190, fontWeight: 700, letterSpacing: -6, marginTop: 60 }}>
        Дома
      </div>
      <div style={{ ...appear(frame, 28), fontSize: 50, color: colors.muted, lineHeight: 1.3, marginTop: 10 }}>
        Telegram-бот для домашних дел
        <br />
        на двоих
      </div>
    </AbsoluteFill>
  )
}

/* ---------- Scene 4: chat demo ---------- */

const Grow = ({ start, children, max = 700 }) => {
  const frame = useCurrentFrame()
  return (
    <div
      style={{
        maxHeight: interpolate(frame, [start, start + 14], [0, max], C),
        opacity: interpolate(frame, [start + 2, start + 12], [0, 1], C),
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  )
}

const BotMessage = ({ children }) => (
  <div
    style={{
      background: '#FFFFFF',
      color: '#0F172A',
      borderRadius: 34,
      borderBottomLeftRadius: 10,
      padding: '26px 32px',
      fontSize: 36,
      lineHeight: 1.38,
      maxWidth: 660,
      boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
      marginBottom: 12,
    }}
  >
    {children}
  </div>
)

const InlineButton = ({ label, pressAt, flex = 1 }) => {
  const frame = useCurrentFrame()
  const t = pressAt == null ? -1 : frame - pressAt
  const pressed = t >= 0 && t < 10
  const ripple = interpolate(t, [0, 14], [0, 1], C)
  return (
    <div
      style={{
        flex,
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'center',
        padding: '22px 12px',
        borderRadius: 22,
        fontSize: 32,
        fontWeight: 600,
        color: '#fff',
        background: pressed ? 'rgba(40,70,55,0.75)' : 'rgba(60,95,75,0.5)',
        transform: `scale(${pressed ? 0.95 : 1})`,
      }}
    >
      {pressAt != null && t >= 0 && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 420,
            height: 420,
            marginLeft: -210,
            marginTop: -210,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.45)',
            transform: `scale(${ripple})`,
            opacity: 1 - ripple,
          }}
        />
      )}
      <span style={{ position: 'relative' }}>{label}</span>
    </div>
  )
}

const ButtonRow = ({ children }) => (
  <div style={{ display: 'flex', gap: 10, marginBottom: 10, maxWidth: 640 }}>{children}</div>
)

const TaskLine = ({ title, mins, done }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: 7,
        background: done ? colors.green : colors.coral,
        flexShrink: 0,
      }}
    />
    <span style={{ fontWeight: 600 }}>{title}</span>
    <span style={{ color: '#64748B' }}>· {mins} мин</span>
  </div>
)

const PhoneHeader = () => (
  <div
    style={{
      height: 140,
      background: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      gap: 24,
      padding: '30px 36px 0',
      borderBottom: '1px solid #E2E8F0',
      flexShrink: 0,
    }}
  >
    <div
      style={{
        width: 78,
        height: 78,
        borderRadius: 39,
        background: `linear-gradient(135deg, ${colors.coral}, ${colors.amber})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <IconHouse size={44} color="#fff" />
    </div>
    <div>
      <div style={{ fontSize: 36, fontWeight: 700, color: '#0F172A' }}>Дома</div>
      <div style={{ fontSize: 26, color: colors.tg }}>бот</div>
    </div>
  </div>
)

const FLOW_STEPS = [
  { from: 0, title: 'Одно напоминание в день', sub: 'Только ваши дела — без спама' },
  { from: 120, title: 'Нажали «Сделано»', sub: 'Следующий срок посчитается сам' },
  { from: 215, title: 'Нужно передать дело?', sub: 'Только с согласия второго' },
]

const FlowCaption = () => {
  const frame = useCurrentFrame()
  return (
    <div style={{ position: 'absolute', top: 290, left: 80, right: 80, height: 190 }}>
      {FLOW_STEPS.map((s, i) => {
        const end = FLOW_STEPS[i + 1]?.from ?? 10_000
        const opacity = interpolate(frame, [s.from, s.from + 12, end - 8, end], [0, 1, 1, 0], C)
        const y = interpolate(frame, [s.from, s.from + 12], [30, 0], C)
        return (
          <div key={s.title} style={{ position: 'absolute', inset: 0, opacity, transform: `translateY(${y}px)` }}>
            <div style={{ fontSize: 34, fontWeight: 600, color: colors.amber, marginBottom: 12 }}>
              Шаг {i + 1} из {FLOW_STEPS.length}
            </div>
            <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -1 }}>{s.title}</div>
            <div style={{ fontSize: 40, color: colors.muted, marginTop: 8 }}>{s.sub}</div>
          </div>
        )
      })}
    </div>
  )
}

const FlowScene = () => {
  const frame = useCurrentFrame()
  const phoneIn = usePop(0, { damping: 16, mass: 1 })
  const firstDone = frame >= 105
  return (
    <AbsoluteFill>
      <FlowCaption />
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 510,
          width: 780,
          height: 1140,
          borderRadius: 80,
          border: '14px solid #0A0A0F',
          background: 'linear-gradient(180deg, #CFE0BE 0%, #E6EDCF 100%)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 40px 120px rgba(0,0,0,0.55)',
          transform: `translateY(${interpolate(phoneIn, [0, 1], [500, 0])}px)`,
        }}
      >
        <PhoneHeader />
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '0 28px 40px',
            overflow: 'hidden',
          }}
        >
          <Grow start={20}>
            <BotMessage>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Доброе утро! Сегодня:</div>
              <TaskLine title="Вынести мусор" mins={3} done={firstDone} />
              <TaskLine title="Протереть стол" mins={5} />
            </BotMessage>
          </Grow>
          <Grow start={42}>
            <ButtonRow>
              <InlineButton label="Сделано" pressAt={95} />
            </ButtonRow>
            <ButtonRow>
              <InlineButton label="На завтра" />
              <InlineButton label="Другая дата" />
            </ButtonRow>
            <ButtonRow>
              <InlineButton label="Предложить другому" />
            </ButtonRow>
          </Grow>
          <Grow start={115}>
            <BotMessage>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 700 }}>
                <IconCheck size={36} color={colors.green} /> Готово: «Вынести мусор»
              </div>
              <div>
                Следующий срок — <b>3 октября</b>
              </div>
            </BotMessage>
          </Grow>
          <Grow start={225}>
            <BotMessage>
              <b>Аня</b> предлагает вам взять
              <br />
              «Пропылесосить» · 20 мин
            </BotMessage>
          </Grow>
          <Grow start={240}>
            <ButtonRow>
              <InlineButton label="Возьму" pressAt={290} />
              <InlineButton label="Не могу" />
            </ButtonRow>
          </Grow>
          <Grow start={310}>
            <BotMessage>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 700 }}>
                <IconCheck size={36} color={colors.green} /> Договорились
              </div>
              <div>«Пропылесосить» сегодня на вас</div>
            </BotMessage>
          </Grow>
        </div>
      </div>
    </AbsoluteFill>
  )
}

/* ---------- Scene 5: features ---------- */

const FEATURES = [
  'Приглашение партнёра по ссылке',
  'У каждого — свой список дел',
  'Одно напоминание в день',
  'Сделано, перенос, передача — в одну кнопку',
  'Следующий срок рассчитывается сам',
  'История выполнений за неделю',
]

const FeaturesScene = () => {
  const frame = useCurrentFrame()
  const aiStart = 22 + FEATURES.length * 12 + 8
  return (
    <AbsoluteFill style={{ padding: '320px 80px 0' }}>
      <div style={appear(frame, 0)}>
        <div style={{ fontSize: 40, color: colors.green, fontWeight: 600, marginBottom: 22, letterSpacing: 2 }}>
          ЧТО УМЕЕТ
        </div>
        <Title>Всё, чтобы договориться один раз</Title>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30, marginTop: 70 }}>
        {FEATURES.map((f, i) => (
          <div key={f} style={{ ...appear(frame, 22 + i * 12, 14, 40), display: 'flex', alignItems: 'center', gap: 30 }}>
            <div
              style={{
                width: 66,
                height: 66,
                borderRadius: 33,
                background: colors.green,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconCheck size={40} color="#0B1020" width={3.4} />
            </div>
            <div style={{ fontSize: 44, fontWeight: 500, lineHeight: 1.25 }}>{f}</div>
          </div>
        ))}
      </div>
      <div
        style={{
          ...appear(frame, aiStart, 16, 40),
          marginTop: 56,
          padding: '34px 40px',
          borderRadius: 40,
          background: `linear-gradient(135deg, ${colors.tg}33, ${colors.coral}33)`,
          border: '2px solid rgba(255,255,255,0.14)',
          display: 'flex',
          gap: 28,
          alignItems: 'center',
        }}
      >
        <IconSpark size={70} color={colors.amber} />
        <div>
          <div style={{ fontSize: 42, fontWeight: 700 }}>ИИ составит стартовый список</div>
          <div style={{ fontSize: 34, color: colors.muted, marginTop: 6, lineHeight: 1.3 }}>
            «Двое, две комнаты, кот, 10 минут в день»
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}

/* ---------- Scene 6: result ---------- */

const CHIPS = ['Без баллов и соревнований', 'Без упрёков', 'Только договорённости']

const ResultScene = () => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ padding: '0 80px', justifyContent: 'center' }}>
      <div style={appear(frame, 0, 18, 50)}>
        <div style={{ fontSize: 112, fontWeight: 700, lineHeight: 1.05, letterSpacing: -3 }}>
          Напоминает бот.
        </div>
        <div
          style={{
            fontSize: 112,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -3,
            marginTop: 10,
            background: `linear-gradient(90deg, ${colors.coral}, ${colors.amber})`,
            WebkitBackgroundClip: 'text',
            color: 'transparent',
          }}
        >
          Не вы.
        </div>
      </div>
      <div style={{ ...appear(frame, 18), fontSize: 46, color: colors.muted, marginTop: 40, lineHeight: 1.35 }}>
        Меньше «ты опять забыл» —
        <br />
        больше времени друг на друга
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 70 }}>
        {CHIPS.map((c, i) => (
          <div
            key={c}
            style={{
              ...appear(frame, 34 + i * 10, 12, 30),
              padding: '22px 34px',
              borderRadius: 999,
              fontSize: 38,
              fontWeight: 600,
              background: 'rgba(255,255,255,0.08)',
              border: '2px solid rgba(255,255,255,0.16)',
            }}
          >
            {c}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}

/* ---------- Scene 7: CTA ---------- */

const CtaScene = () => {
  const frame = useCurrentFrame()
  const pop = usePop(18, { damping: 10, mass: 0.8 })
  const pulse = 1 + Math.sin(Math.max(0, frame - 40) / 7) * 0.025
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 80 }}>
      <div style={appear(frame, 0)}>
        <div style={{ fontSize: 98, fontWeight: 700, letterSpacing: -2.5, lineHeight: 1.08 }}>
          Попробуйте
          <br />
          вдвоём
        </div>
        <div style={{ fontSize: 46, color: colors.muted, marginTop: 30 }}>Создать дом — за 3 минуты</div>
      </div>
      <div
        style={{
          marginTop: 90,
          display: 'flex',
          alignItems: 'center',
          gap: 26,
          padding: '40px 64px',
          borderRadius: 999,
          background: colors.tg,
          boxShadow: `0 24px 80px ${colors.tg}77`,
          transform: `scale(${pop * pulse})`,
        }}
      >
        <IconPlane size={66} color="#fff" />
        <span style={{ fontSize: 58, fontWeight: 700 }}>{BOT_USERNAME}</span>
      </div>
      <div
        style={{
          ...appear(frame, 40),
          marginTop: 80,
          padding: '26px 44px',
          borderRadius: 32,
          border: `2px dashed ${colors.amber}`,
          fontSize: 40,
          fontWeight: 600,
          color: colors.amber,
        }}
      >
        Ищем 5 пар на бесплатный тест
      </div>
    </AbsoluteFill>
  )
}

/* ---------- Composition ---------- */

const SCENE_COMPONENTS = {
  hook: HookScene,
  problem: ProblemScene,
  reveal: RevealScene,
  flow: FlowScene,
  features: FeaturesScene,
  result: ResultScene,
  cta: CtaScene,
}

export const Story = () => (
  <AbsoluteFill>
    <Background />
    {SCENES.map((s) => {
      const Scene = SCENE_COMPONENTS[s.id]
      return (
        <Sequence key={s.id} from={s.from} durationInFrames={s.dur}>
          <SceneWrap dur={s.dur}>
            <Scene />
          </SceneWrap>
        </Sequence>
      )
    })}
  </AbsoluteFill>
)
