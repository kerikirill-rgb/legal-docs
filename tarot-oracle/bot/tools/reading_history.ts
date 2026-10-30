import { defineTool } from "@grok/agent-sdk/tools";
import { z } from "zod";
import { listReadings, parseUserFromContinuation } from "../lib/access.js";

export default defineTool({
  description: "Получить последние сохранённые расклады пользователя для контекста и персонализации.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(10).optional(),
  }),
  effect: "read",
  async execute({ limit }, ctx) {
    const userId = parseUserFromContinuation(ctx.session.continuationKey);
    if (userId === undefined) {
      return { readings: [] };
    }
    const readings = await listReadings(ctx.host.kv, userId, limit ?? 5);
    return { readings };
  },
});
