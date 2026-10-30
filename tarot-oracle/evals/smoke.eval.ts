import { defineEval } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["smoke"],
  description: "draw_tarot_spread returns cards for a mini spread.",
  async test(t) {
    await t.send(
      'Use draw_tarot_spread with spread "mini" and question "Карьера". Report how many cards returned.',
    );
    t.succeeded();
    t.calledTool("draw_tarot_spread");
  },
});
