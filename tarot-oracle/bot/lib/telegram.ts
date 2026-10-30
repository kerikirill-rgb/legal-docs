const API_BASE = "https://api.telegram.org";

function botToken(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }
  return t;
}

export async function telegramApi<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!json.ok) {
    throw new Error(json.description ?? `Telegram API ${method} failed`);
  }
  return json.result as T;
}

export async function sendMessage(chatId: number | string, text: string, extra?: Record<string, unknown>): Promise<void> {
  await telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...extra,
  });
}

export async function answerPreCheckoutQuery(id: string, ok: boolean, errorMessage?: string): Promise<void> {
  await telegramApi("answerPreCheckoutQuery", {
    pre_checkout_query_id: id,
    ok,
    error_message: errorMessage,
  });
}

export async function sendStarsInvoice(params: {
  chatId: number;
  title: string;
  description: string;
  payload: string;
  stars: number;
}): Promise<void> {
  await telegramApi("sendInvoice", {
    chat_id: params.chatId,
    title: params.title,
    description: params.description,
    payload: params.payload,
    provider_token: "",
    currency: "XTR",
    prices: [{ label: params.title, amount: params.stars }],
  });
}

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    successful_payment?: {
      currency: string;
      total_amount: number;
      invoice_payload: string;
      telegram_payment_charge_id: string;
    };
  };
  pre_checkout_query?: {
    id: string;
    from: { id: number };
    currency: string;
    total_amount: number;
    invoice_payload: string;
  };
  callback_query?: {
    id: string;
    from: { id: number };
    message?: { chat: { id: number }; message_id: number };
    data?: string;
  };
};

export function verifyTelegramSecret(request: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) {
    return true;
  }
  const header = request.headers.get("x-telegram-bot-api-secret-token");
  return header === expected;
}
