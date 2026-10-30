import { prompt } from "@grok/agent-sdk";
import { defineTool } from "@grok/agent-sdk/tools";
import { z } from "zod";
import {
  consumeFreeMini,
  computeAccess,
  getEntitlements,
  parseUserFromContinuation,
} from "../lib/access.js";
import { drawSpread, type SpreadKind } from "../lib/tarot/deck.js";

const SpreadSchema = z.enum(["mini", "standard", "deep", "celtic_cross", "astro_houses"]);

export default defineTool({
  description: prompt`
    Вытянуть реальные карты Таро для расклада. Карты выбираются случайно на сервере —
    не придумывай карты сам. После вызова интерпретируй каждую позицию как опытный таролог.
  `,
  inputSchema: z.object({
    spread: SpreadSchema.describe("Тип расклада"),
    question: z.string().max(500).describe("Вопрос или тема пользователя"),
  }),
  effect: "idempotent",
  async execute({ spread, question }, ctx) {
    const userId = parseUserFromContinuation(ctx.session.continuationKey);
    if (userId === undefined) {
      return { isError: true, error: "Нет привязки к пользователю Telegram." };
    }
    const ent = await getEntitlements(ctx.host.kv, userId);
    let access = computeAccess(userId, ent);

    const needs: Record<SpreadKind, keyof typeof access> = {
      mini: "canMini",
      standard: "canStandard",
      deep: "canDeep",
      celtic_cross: "canDeep",
      astro_houses: "canAstroHouses",
    };
    const flag = needs[spread as SpreadKind];
    if (!access[flag]) {
      return {
        allowed: false,
        spread,
        question,
        reason: "access_denied",
        upsell: access.upsellHint,
        access,
      };
    }

    if (spread === "mini" && !access.canStandard && !access.canQuarterCoaching) {
      access = await consumeFreeMini(ctx.host.kv, userId);
      if (!access.canMini) {
        return {
          allowed: false,
          spread,
          question,
          reason: "free_limit",
          upsell: access.upsellHint,
          access,
        };
      }
    }

    const cards = drawSpread(spread as SpreadKind);
    return {
      allowed: true,
      spread,
      question,
      cards: cards.map(c => ({
        position: c.position,
        name: c.card.name,
        reversed: c.reversed,
        keywords: c.reversed ? c.card.keywordsRev : c.card.keywordsUp,
        arcana: c.card.arcana,
      })),
      access: computeAccess(userId, await getEntitlements(ctx.host.kv, userId)),
    };
  },
});
