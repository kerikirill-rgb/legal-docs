import { defineChannel, POST, publicEndpoint } from "@grok/agent-sdk/channels";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import {
  PRODUCTS,
  type ProductId,
  saveOrder,
  markOrderPaid,
  getOrder,
  userContinuationToken,
} from "../lib/access.js";
import {
  answerPreCheckoutQuery,
  sendMessage,
  sendStarsInvoice,
  verifyTelegramSecret,
  type TelegramUpdate,
} from "../lib/telegram.js";

type TgState = {
  chatId: number;
  userId: string;
};

function parseUpdate(body: unknown): TelegramUpdate | undefined {
  if (typeof body === "object" && body !== null && "update_id" in body) {
    return body as TelegramUpdate;
  }
  return undefined;
}

export default defineChannel<TgState>({
  auth: [publicEndpoint()],
  state: { chatId: 0, userId: "" },
  routes: [
    POST("/webhook", {
      description: "Telegram Bot API webhook",
      bodySchema: z.unknown(),
      handler: async (request, route) => {
        if (!verifyTelegramSecret(request)) {
          return new Response(null, { status: 401 });
        }
        const update = parseUpdate(route.body);
        if (!update) {
          return new Response(null, { status: 202 });
        }

        const kv = route.host.kv;

        if (update.pre_checkout_query) {
          const pq = update.pre_checkout_query;
          const payload = pq.invoice_payload;
          const orderId = payload.startsWith("order:") ? payload.slice(6) : payload;
          const order = await getOrder(kv, orderId);
          const ok = order !== undefined && order.status === "pending";
          await answerPreCheckoutQuery(pq.id, ok, ok ? undefined : "Заказ не найден или уже оплачен");
          return new Response(null, { status: 202 });
        }

        const buyData = update.callback_query?.data;
        if (buyData?.startsWith("buy:")) {
          const cq = update.callback_query!;
          const chatId = cq.message?.chat.id ?? cq.from.id;
          const userId = String(cq.from.id);
          const productId = buyData.slice(4) as ProductId;
          const product = PRODUCTS[productId];
          if (product) {
            const orderId = randomBytes(8).toString("hex");
            await saveOrder(kv, {
              orderId,
              userId,
              productId,
              method: "stars",
              amount: product.stars,
              currency: "XTR",
              createdAt: Date.now(),
              status: "pending",
            });
            await sendStarsInvoice({
              chatId,
              title: product.title,
              description: product.description,
              payload: `order:${orderId}`,
              stars: product.stars,
            });
          }
          return new Response(null, { status: 202 });
        }

        const msg = update.message;
        if (!msg?.text && !msg?.successful_payment) {
          return new Response(null, { status: 202 });
        }

        const chatId = msg.chat.id;
        const userId = String(msg.from?.id ?? chatId);

        if (msg.successful_payment) {
          const sp = msg.successful_payment;
          const orderId = sp.invoice_payload.startsWith("order:")
            ? sp.invoice_payload.slice(6)
            : sp.invoice_payload;
          await markOrderPaid(kv, orderId, {
            telegramPaymentChargeId: sp.telegram_payment_charge_id,
          });
          await sendMessage(chatId, "✨ Оплата получена. Доступ открыт — задайте вопрос картам.");
          return new Response(null, { status: 202 });
        }

        const text = msg.text?.trim() ?? "";

        if (text === "/start") {
          route.waitUntil(
            sendMessage(
              chatId,
              "🔮 Я — ваш таролог-оракул. Задайте вопрос текстом, и я сделаю расклад.\n\n" +
                "Бесплатно: 2 мини-расклада в неделю.\n/subscribe — тарифы и оплата (Stars, ₽, USDT).",
            ),
          );
          return new Response(null, { status: 202 });
        }

        if (text === "/subscribe" || text === "/pay") {
          const keyboard = {
            inline_keyboard: [
              [{ text: `⭐ Подписка (${PRODUCTS.subscription_monthly.stars} Stars)`, callback_data: "buy:subscription_monthly" }],
              [{ text: `⭐ Астро-прогноз (${PRODUCTS.full_astro.stars} Stars)`, callback_data: "buy:full_astro" }],
              [{ text: `⭐ Квартал (${PRODUCTS.quarter_accompaniment.stars} Stars)`, callback_data: "buy:quarter_accompaniment" }],
            ],
          };
          route.waitUntil(
            sendMessage(
              chatId,
              "Выберите продукт (Telegram Stars) или напишите «оплата рублями» / «оплата криптой» — помогу оформить.",
              { reply_markup: keyboard },
            ),
          );
          return new Response(null, { status: 202 });
        }

        const userMessage =
          text.length > 0
            ? text
            : "Пользователь отправил сообщение без текста — попроси сформулировать вопрос.";

        route.waitUntil(
          route.send(
            `[Telegram user ${userId}, chat ${chatId}]\n${userMessage}\n\n` +
              "Сначала вызови check_access и reading_history. Если нужен расклад — draw_tarot_spread. " +
              "После ответа — save_reading.",
            {
              continuationToken: userContinuationToken(userId),
              state: { chatId, userId },
              title: `TG ${userId}`,
              admission: "coalesce",
            },
          ),
        );
        return new Response(null, { status: 202 });
      },
    }),
  ],
  events: {
    async "message.completed"(event, channel) {
      if (event.data.finishReason === "tool_call" || event.data.text === "") {
        return;
      }
      const { chatId } = channel.state;
      if (!chatId) {
        return;
      }
      try {
        await sendMessage(chatId, event.data.text);
      } catch {
        // Token may be unset in dev
      }
    },
  },
});
