export type TarotCard = {
  id: number;
  name: string;
  arcana: "major" | "minor";
  suit?: "wands" | "cups" | "swords" | "pentacles";
  keywordsUp: string[];
  keywordsRev: string[];
};

const MAJOR: Omit<TarotCard, "id">[] = [
  { name: "Шут", arcana: "major", keywordsUp: ["начало", "доверие", "спонтанность"], keywordsRev: ["неосторожность", "страх шага"] },
  { name: "Маг", arcana: "major", keywordsUp: ["воля", "мастерство", "ресурс"], keywordsRev: ["манипуляция", "расфокус"] },
  { name: "Жрица", arcana: "major", keywordsUp: ["интуиция", "тайна", "глубина"], keywordsRev: ["закрытость", "иллюзии"] },
  { name: "Императрица", arcana: "major", keywordsUp: ["изобилие", "забота", "рост"], keywordsRev: ["застой", "зависимость"] },
  { name: "Император", arcana: "major", keywordsUp: ["структура", "опора", "лидерство"], keywordsRev: ["жёсткость", "контроль"] },
  { name: "Иерофант", arcana: "major", keywordsUp: ["традиция", "наставник", "смысл"], keywordsRev: ["догма", "давление"] },
  { name: "Влюблённые", arcana: "major", keywordsUp: ["выбор", "союз", "ценности"], keywordsRev: ["разлад", "нерешительность"] },
  { name: "Колесница", arcana: "major", keywordsUp: ["движение", "победа", "фокус"], keywordsRev: ["хаос", "агрессия"] },
  { name: "Сила", arcana: "major", keywordsUp: ["мужество", "мягкая сила", "страсть"], keywordsRev: ["сомнение", "подавление"] },
  { name: "Отшельник", arcana: "major", keywordsUp: ["поиск", "мудрость", "пауза"], keywordsRev: ["изоляция", "одиночество"] },
  { name: "Колесо Фортуны", arcana: "major", keywordsUp: ["цикл", "шанс", "поворот"], keywordsRev: ["сопротивление переменам", "невезение"] },
  { name: "Справедливость", arcana: "major", keywordsUp: ["баланс", "истина", "ответственность"], keywordsRev: ["несправедливость", "самообман"] },
  { name: "Повешенный", arcana: "major", keywordsUp: ["перспектива", "жертва ради роста", "пауза"], keywordsRev: ["застревание", "жертва без смысла"] },
  { name: "Смерть", arcana: "major", keywordsUp: ["трансформация", "завершение", "обновление"], keywordsRev: ["цепляние", "страх перемен"] },
  { name: "Умеренность", arcana: "major", keywordsUp: ["гармония", "исцеление", "мерность"], keywordsRev: ["крайности", "нетерпение"] },
  { name: "Дьявол", arcana: "major", keywordsUp: ["привязанность", "тень", "материальное"], keywordsRev: ["освобождение", "осознанность"] },
  { name: "Башня", arcana: "major", keywordsUp: ["прорыв", "правда", "шок"], keywordsRev: ["избегание краха", "страх"] },
  { name: "Звезда", arcana: "major", keywordsUp: ["надежда", "вдохновение", "исцеление"], keywordsRev: ["уныние", "потеря веры"] },
  { name: "Луна", arcana: "major", keywordsUp: ["подсознание", "сон", "иллюзии"], keywordsRev: ["ясность", "преодоление страха"] },
  { name: "Солнце", arcana: "major", keywordsUp: ["радость", "успех", "ясность"], keywordsRev: ["временная тень", "задержка"] },
  { name: "Суд", arcana: "major", keywordsUp: ["пробуждение", "призвание", "итог"], keywordsRev: ["самокритика", "страх оценки"] },
  { name: "Мир", arcana: "major", keywordsUp: ["завершение", "целостность", "достижение"], keywordsRev: ["незавершённость", "задержка финала"] },
];

const RANKS = ["Туз", "Двойка", "Тройка", "Четвёрка", "Пятёрка", "Шестёрка", "Семёрка", "Восьмёрка", "Девятка", "Десятка", "Паж", "Рыцарь", "Королева", "Король"] as const;

const SUIT_META: Record<
  NonNullable<TarotCard["suit"]>,
  { label: string; up: string[]; rev: string[] }
> = {
  wands: { label: "Жезлов", up: ["энергия", "действие", "инициатива"], rev: ["выгорание", "задержка"] },
  cups: { label: "Кубков", up: ["чувства", "связь", "интуиция"], rev: ["эмоциональный застой", "обида"] },
  swords: { label: "Мечей", up: ["мысль", "решение", "правда"], rev: ["конфликт", "тревога"] },
  pentacles: { label: "Пентаклей", up: ["материя", "работа", "стабильность"], rev: ["нехватка", "застой"] },
};

function buildDeck(): TarotCard[] {
  const deck: TarotCard[] = MAJOR.map((c, i) => ({ ...c, id: i }));
  let id = MAJOR.length;
  for (const suit of Object.keys(SUIT_META) as (keyof typeof SUIT_META)[]) {
    const meta = SUIT_META[suit];
    for (const rank of RANKS) {
      deck.push({
        id: id++,
        name: `${rank} ${meta.label}`,
        arcana: "minor",
        suit,
        keywordsUp: [...meta.up, rank.toLowerCase()],
        keywordsRev: [...meta.rev, "пересмотр"],
      });
    }
  }
  return deck;
}

export const TAROT_DECK: TarotCard[] = buildDeck();

export type SpreadKind = "mini" | "standard" | "deep" | "celtic_cross" | "astro_houses";

export const SPREAD_POSITIONS: Record<SpreadKind, string[]> = {
  mini: ["суть ситуации", "скрытое влияние", "совет карт"],
  standard: ["суть", "прошлое", "настоящее", "препятствие", "исход"],
  deep: ["душа вопроса", "сознание", "подсознание", "прошлое", "настоящее", "будущее", "совет"],
  celtic_cross: [
    "суть",
    "перекрёст",
    "основа",
    "недавнее прошлое",
    "возможный исход",
    "ближайшее будущее",
    "вы сами",
    "окружение",
    "надежды и страхи",
    "итог",
  ],
  astro_houses: [
    "1 дом — я",
    "2 дом — ресурсы",
    "3 дом — общение",
    "4 дом — корни",
    "5 дом — творчество",
    "6 дом — служение",
    "7 дом — партнёрство",
    "8 дом — трансформация",
    "9 дом — смысл",
    "10 дом — карьера",
    "11 дом — мечты",
    "12 дом — подсознание",
  ],
};

export type DrawnCard = {
  card: TarotCard;
  reversed: boolean;
  position: string;
};

export function drawSpread(kind: SpreadKind, count?: number): DrawnCard[] {
  const positions = SPREAD_POSITIONS[kind];
  const n = count ?? positions.length;
  const pool = [...TAROT_DECK];
  const drawn: DrawnCard[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const card = pool.splice(idx, 1)[0]!;
    const reversed = Math.random() < 0.35;
    drawn.push({
      card,
      reversed,
      position: positions[i] ?? `позиция ${i + 1}`,
    });
  }
  return drawn;
}
