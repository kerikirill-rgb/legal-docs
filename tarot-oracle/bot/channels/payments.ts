import type { AuthContext } from "@grok/agent-sdk";
import { defineChannel, POST, bearerAuth } from "@grok/agent-sdk/channels";
import { z } from "zod";
import { markOrderPaid } from "../lib/access.js";

function paymentBearer(token: string): AuthContext | null {
  const expected = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!expected || token !== expected) {
    return null;
  }
  return {
    authenticator: "bearer",
    principalId: "payment-webhook",
    principalType: "service",
  };
}

/**
 * Webhook for external payment providers (YooKassa, crypto processor, manual admin).
 * Set PAYMENT_WEBHOOK_SECRET and send Authorization: Bearer <secret>.
 */
export default defineChannel({
  auth: [bearerAuth(paymentBearer)],
  routes: [
    POST("/confirm", {
      description: "Confirm a paid order and grant entitlements",
      bodySchema: z.object({
        orderId: z.string().min(8),
        externalId: z.string().optional(),
      }),
      handler: async (_req, route) => {
        const { orderId, externalId } = route.body;
        const result = await markOrderPaid(route.host.kv, orderId, {
          telegramPaymentChargeId: externalId,
        });
        if (!result.ok) {
          return new Response(JSON.stringify({ ok: false }), {
            status: 404,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({ ok: true, userId: result.userId, productId: result.productId }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      },
    }),
  ],
});
