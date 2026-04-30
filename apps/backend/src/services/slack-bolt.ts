import { App, ExpressReceiver } from "@slack/bolt";
import { env } from "../env.js";
import { normalizeSlackMessage } from "./message-normalizer.js";
import { processInboundMessage } from "./brain-engine.js";
import { renderSlackResponse } from "./response-renderer.js";
import { isDuplicateWebhookMessage } from "./idempotency-cache.js";

const isSlackConfigured = Boolean(env.SLACK_BOT_TOKEN && env.SLACK_SIGNING_SECRET);

const receiver = new ExpressReceiver({
  signingSecret: env.SLACK_SIGNING_SECRET || "missing-signing-secret",
  endpoints: "/"
});

const slackApp = new App({
  token: env.SLACK_BOT_TOKEN || "missing-bot-token",
  receiver
});
const assistantName = "Omnichannel AI";

if (isSlackConfigured) {
  slackApp.event("message", async ({ event, client, logger }) => {
    const normalized = normalizeSlackMessage({ event });
    if (!normalized) {
      return;
    }
    const messageTs = normalized.metadata?.slackTs;
    const channelId = normalized.metadata?.channelId;
    if (typeof messageTs === "string" && typeof channelId === "string") {
      const dedupeKey = `slack:${channelId}:${messageTs}`;
      if (isDuplicateWebhookMessage(dedupeKey)) {
        return;
      }
    }

    let typingMessageTs: string | null = null;
    try {
      const typingMessage = await client.chat.postMessage({
        channel: event.channel,
        text: `${assistantName} is typing...`
      });
      typingMessageTs = typingMessage.ts ?? null;
    } catch {
      typingMessageTs = null;
    }

    const result = await processInboundMessage(normalized);
    if (result.interruptedForHuman || !result.assistantText) {
      if (typingMessageTs) {
        await client.chat.delete({
          channel: event.channel,
          ts: typingMessageTs
        }).catch(() => undefined);
      }
      return;
    }
    const rendered = renderSlackResponse(result.assistantText);

    if (typingMessageTs) {
      await client.chat.delete({
        channel: event.channel,
        ts: typingMessageTs
      }).catch(() => undefined);
    }

    await client.chat.postMessage({
      channel: event.channel,
      text: rendered.text,
      blocks: rendered.blocks as never
    });
  });

  slackApp.error(async (error) => {
    console.error("Slack Bolt error", error);
  });
} else {
  console.warn("Slack webhook is not configured. Add SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET.");
}

export const slackReceiver = receiver;
export const slackConfigured = isSlackConfigured;
