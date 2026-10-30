import { defineTool } from "@grok/agent-sdk/tools";
import { z } from "zod";
import { computeAccess, getEntitlements, parseUserFromContinuation } from "../lib/access.js";

export default defineTool({
  description:
    "Проверить, какие расклады и продукты доступны текущему пользователю Telegram. Вызывай в начале каждого запроса на предсказание.",
  inputSchema: z.object({}),
  effect: "read",
  async execute(_input, ctx) {
    const userId = parseUserFromContinuation(ctx.session.continuationKey);
    if (userId === undefined) {
      return { error: "no_telegram_user", access: null };
    }
    const ent = await getEntitlements(ctx.host.kv, userId);
    const access = computeAccess(userId, ent);
    return {
      userId,
      access,
      products: {
        subscription_monthly: "Подписка «Оракул» — безлимитные расклады",
        full_astro: "Полный астро-таро прогноз (12 домов)",
        quarter_accompaniment: "Квартальное сопровождение таролога",
      },
    };
  },
});
