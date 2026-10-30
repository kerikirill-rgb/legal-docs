import { prompt } from "@grok/agent-sdk";
import { defineTool } from "@grok/agent-sdk/tools";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import {
  PRODUCTS,
  type ProductId,
  saveOrder,
  parseUserFromContinuation,
} from "../lib/access.js";

export default defineTool({
  description: prompt`
    Создать заказ на оплату (рубли или крипта). Для Telegram Stars пользователь может нажать
    кнопку в боте — не вызывай этот tool для Stars, если уже отправлен invoice из канала.
    Верни пользователю инструкции по оплате из результата.
  `,
  inputSchema: z.object({
    productId: z.enum(["subscription_monthly", "full_astro", "quarter_accompaniment"]),
    method: z.enum(["rub", "crypto"]),
  }),
  effect: "write",
  async execute({ productId, method }, ctx) {
    const userId = parseUserFromContinuation(ctx.session.continuationKey);
    if (userId === undefined) {
      return { ok: false, error: "no_user" };
    }
    const product = PRODUCTS[productId as ProductId];
    const orderId = randomBytes(10).toString("hex");
    const amount = method === "rub" ? product.rub : product.usdt;
    const currency = method === "rub" ? "RUB" : "USDT";

    await saveOrder(ctx.host.kv, {
      orderId,
      userId,
      productId: productId as ProductId,
      method,
      amount,
      currency,
      createdAt: Date.now(),
      status: "pending",
    });

    if (method === "rub") {
      const shopId = process.env.YOOKASSA_SHOP_ID;
      const returnUrl = process.env.PAYMENT_RETURN_URL ?? "https://t.me/";
      if (shopId) {
        return {
          ok: true,
          orderId,
          method: "rub",
          title: product.title,
          amountRub: product.rub,
          paymentUrl: `https://yookassa.ru/payments/${shopId}?order=${orderId}`,
          note: "После оплаты доступ откроется автоматически (webhook).",
          returnUrl,
        };
      }
      return {
        ok: true,
        orderId,
        method: "rub",
        title: product.title,
        amountRub: product.rub,
        manual: true,
        instructions: `Переведите ${product.rub} ₽ с комментарием «${orderId}» на реквизиты из описания бота. Админ подтвердит в течение часа.`,
      };
    }

    const wallet = process.env.CRYPTO_USDT_WALLET ?? "USDT_TRC20_WALLET_NOT_CONFIGURED";
    return {
      ok: true,
      orderId,
      method: "crypto",
      title: product.title,
      amountUsdt: product.usdt,
      wallet,
      memo: orderId,
      instructions: `Отправьте ровно ${product.usdt} USDT (TRC20) на ${wallet}. В memo/comment укажите: ${orderId}.`,
    };
  },
});
