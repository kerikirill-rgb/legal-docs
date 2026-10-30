import type { HostKvApi } from "@grok/agent-sdk/kv";

export type ProductId =
  | "subscription_monthly"
  | "full_astro"
  | "quarter_accompaniment";

export type Entitlement = {
  subscriptionUntil?: number;
  fullAstroUntil?: number;
  quarterUntil?: number;
  freeMiniUsedWeek?: string;
  freeMiniCount?: number;
  readingIds?: string[];
};

export type AccessSnapshot = {
  userId: string;
  entitlements: Entitlement;
  canMini: boolean;
  canStandard: boolean;
  canDeep: boolean;
  canAstroHouses: boolean;
  canQuarterCoaching: boolean;
  freeMiniRemaining: number;
  upsellHint?: string;
};

const USER_PREFIX = "tarot:user:";
const ORDER_PREFIX = "tarot:order:";

export type PendingOrder = {
  orderId: string;
  userId: string;
  productId: ProductId;
  method: "stars" | "rub" | "crypto";
  amount: number;
  currency: string;
  createdAt: number;
  status: "pending" | "paid" | "expired";
  telegramPaymentChargeId?: string;
};

export const PRODUCTS: Record<
  ProductId,
  {
    title: string;
    description: string;
    stars: number;
    rub: number;
    usdt: number;
    grants: keyof Entitlement;
    durationMs: number;
  }
> = {
  subscription_monthly: {
    title: "Подписка «Оракул»",
    description: "Безлимитные расклады на месяц, глубокие интерпретации.",
    stars: 150,
    rub: 499,
    usdt: 5,
    grants: "subscriptionUntil",
    durationMs: 30 * 24 * 60 * 60 * 1000,
  },
  full_astro: {
    title: "Полный астро-таро прогноз",
    description: "12 домов + персональный разбор на 30 дней.",
    stars: 350,
    rub: 1490,
    usdt: 15,
    grants: "fullAstroUntil",
    durationMs: 30 * 24 * 60 * 60 * 1000,
  },
  quarter_accompaniment: {
    title: "Квартальное сопровождение",
    description: "3 месяца: еженедельные расклады и поддержка таролога.",
    stars: 900,
    rub: 3990,
    usdt: 40,
    grants: "quarterUntil",
    durationMs: 90 * 24 * 60 * 60 * 1000,
  },
};

function weekKey(now = Date.now()): string {
  const d = new Date(now);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

export async function getEntitlements(kv: HostKvApi, userId: string): Promise<Entitlement> {
  const raw = await kv.get(`${USER_PREFIX}${userId}`);
  if (raw === undefined || raw === null) {
    return {};
  }
  return raw as Entitlement;
}

async function putEntitlements(kv: HostKvApi, userId: string, ent: Entitlement): Promise<void> {
  await kv.put(`${USER_PREFIX}${userId}`, ent);
}

function active(until?: number, now = Date.now()): boolean {
  return typeof until === "number" && until > now;
}

export function computeAccess(userId: string, ent: Entitlement, now = Date.now()): AccessSnapshot {
  const hasSub = active(ent.subscriptionUntil, now);
  const hasAstro = active(ent.fullAstroUntil, now);
  const hasQuarter = active(ent.quarterUntil, now);

  const wk = weekKey(now);
  let freeCount = ent.freeMiniCount ?? 0;
  if (ent.freeMiniUsedWeek !== wk) {
    freeCount = 0;
  }
  const FREE_LIMIT = 2;
  const freeRemaining = Math.max(0, FREE_LIMIT - freeCount);

  const canMini = hasSub || hasQuarter || freeRemaining > 0;
  const canStandard = hasSub || hasQuarter;
  const canDeep = hasSub || hasQuarter;
  const canAstroHouses = hasAstro || hasQuarter;
  const canQuarterCoaching = hasQuarter;

  let upsellHint: string | undefined;
  if (!hasSub && !hasQuarter && freeRemaining === 0) {
    upsellHint = "Бесплатные мини-расклады на этой неделе использованы. Предложи подписку или разовый полный прогноз — мягко, без давления.";
  } else if (!hasSub && freeRemaining === 1) {
    upsellHint = "Остался один бесплатный мини-расклад на неделю. После него — ненавязчиво упомяни подписку.";
  }

  return {
    userId,
    entitlements: ent,
    canMini,
    canStandard,
    canDeep,
    canAstroHouses,
    canQuarterCoaching,
    freeMiniRemaining: hasSub || hasQuarter ? FREE_LIMIT : freeRemaining,
    upsellHint,
  };
}

export async function consumeFreeMini(kv: HostKvApi, userId: string): Promise<AccessSnapshot> {
  const ent = await getEntitlements(kv, userId);
  const access = computeAccess(userId, ent);
  if (active(ent.subscriptionUntil) || active(ent.quarterUntil)) {
    return access;
  }
  const wk = weekKey();
  let count = ent.freeMiniCount ?? 0;
  if (ent.freeMiniUsedWeek !== wk) {
    count = 0;
  }
  if (count >= 2) {
    return computeAccess(userId, ent);
  }
  const next: Entitlement = {
    ...ent,
    freeMiniUsedWeek: wk,
    freeMiniCount: count + 1,
  };
  await putEntitlements(kv, userId, next);
  return computeAccess(userId, next);
}

export async function grantProduct(
  kv: HostKvApi,
  userId: string,
  productId: ProductId,
  now = Date.now(),
): Promise<AccessSnapshot> {
  const product = PRODUCTS[productId];
  const ent = await getEntitlements(kv, userId);
  const field = product.grants;
  const current = ent[field] as number | undefined;
  const base = active(current, now) ? current! : now;
  const next: Entitlement = {
    ...ent,
    [field]: base + product.durationMs,
  };
  await putEntitlements(kv, userId, next);
  return computeAccess(userId, next);
}

export async function saveOrder(kv: HostKvApi, order: PendingOrder): Promise<void> {
  await kv.put(`${ORDER_PREFIX}${order.orderId}`, order);
}

export async function getOrder(kv: HostKvApi, orderId: string): Promise<PendingOrder | undefined> {
  const raw = await kv.get(`${ORDER_PREFIX}${orderId}`);
  return raw as PendingOrder | undefined;
}

export async function markOrderPaid(
  kv: HostKvApi,
  orderId: string,
  extra?: Partial<PendingOrder>,
): Promise<{ ok: boolean; userId?: string; productId?: ProductId }> {
  const order = await getOrder(kv, orderId);
  if (order === undefined) {
    return { ok: false };
  }
  if (order.status === "paid") {
    return { ok: true, userId: order.userId, productId: order.productId };
  }
  const updated: PendingOrder = { ...order, ...extra, status: "paid" };
  await kv.put(`${ORDER_PREFIX}${orderId}`, updated);
  await grantProduct(kv, order.userId, order.productId);
  return { ok: true, userId: order.userId, productId: order.productId };
}

export function userContinuationToken(userId: string): string {
  return `tg:user:${userId}`;
}

export function parseUserFromContinuation(key: string | null | undefined): string | undefined {
  if (typeof key !== "string") {
    return undefined;
  }
  const m = /^tg:user:(\d+)$/.exec(key);
  return m?.[1];
}

const READING_PREFIX = "tarot:reading:";

export type SavedReading = {
  id: string;
  userId: string;
  spreadKind: string;
  question: string;
  cardsSummary: string;
  createdAt: number;
};

export async function appendReading(kv: HostKvApi, reading: SavedReading): Promise<void> {
  await kv.put(`${READING_PREFIX}${reading.userId}:${reading.id}`, reading);
}

export async function listReadings(kv: HostKvApi, userId: string, limit = 10): Promise<SavedReading[]> {
  // KV has no list prefix in agent SDK — store index on user ent
  const ent = await getEntitlements(kv, userId);
  const ids = ent.readingIds ?? [];
  const out: SavedReading[] = [];
  for (const id of ids.slice(-limit).reverse()) {
    const raw = await kv.get(`${READING_PREFIX}${userId}:${id}`);
    if (raw) {
      out.push(raw as SavedReading);
    }
  }
  return out;
}

export async function indexReading(kv: HostKvApi, userId: string, readingId: string): Promise<void> {
  const ent = await getEntitlements(kv, userId);
  const ids = ent.readingIds ?? [];
  const next = [...ids, readingId].slice(-50);
  await putEntitlements(kv, userId, { ...ent, readingIds: next });
}
