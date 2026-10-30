import { defineTool } from "@grok/agent-sdk/tools";
import { z } from "zod";
import { appendReading, indexReading, parseUserFromContinuation } from "../lib/access.js";
import { randomBytes } from "node:crypto";

export default defineTool({
  description:
    "Сохранить завершённое предсказание в историю пользователя. Вызывай один раз после каждого полного ответа с раскладом.",
  inputSchema: z.object({
    spread: z.string(),
    question: z.string(),
    summary: z.string().max(4000).describe("Краткое содержание интерпретации для истории"),
  }),
  effect: "write",
  async execute({ spread, question, summary }, ctx) {
    const userId = parseUserFromContinuation(ctx.session.continuationKey);
    if (userId === undefined) {
      return { saved: false, reason: "no_user" };
    }
    const id = randomBytes(8).toString("hex");
    const reading = {
      id,
      userId,
      spreadKind: spread,
      question,
      cardsSummary: summary,
      createdAt: Date.now(),
    };
    await appendReading(ctx.host.kv, reading);
    await indexReading(ctx.host.kv, userId, id);
    return { saved: true, readingId: id };
  },
});
