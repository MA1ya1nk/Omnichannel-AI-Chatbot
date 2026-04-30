import { App, ExpressReceiver } from "@slack/bolt";
import { env } from "../env.js";
import { normalizeSlackMessage } from "./message-normalizer.js";
import { processInboundMessage } from "./brain-engine.js";
import { renderSlackResponse } from "./response-renderer.js";
import { isDuplicateWebhookMessage } from "./idempotency-cache.js";
import { prisma } from "../prisma.js";
import { interruptConversation, resumeConversation } from "./langgraph-interrupt.js";
import { generateAssistantReply } from "./mistral-service.js";
import { getInboxSummaryByConversationId } from "./conversation-service.js";
import { emitConversationMessage, emitConversationUpdated } from "./socket-server.js";

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

async function findSlackConversation(input: { sessionId: string; channelId?: string }) {
  const candidates = [input.sessionId];
  if (input.channelId) {
    candidates.push(`slack-channel:${input.channelId}`);
  }

  for (const candidate of candidates) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        channel: "slack",
        sessionId: candidate
      }
    });
    if (conversation) {
      return conversation;
    }
  }
  return null;
}

function extractActionValue(body: Record<string, unknown>): string | undefined {
  if (!("actions" in body) || !Array.isArray(body.actions) || body.actions.length === 0) {
    return undefined;
  }
  const firstAction = body.actions[0] as { value?: unknown };
  return typeof firstAction.value === "string" && firstAction.value.trim() ? firstAction.value : undefined;
}

async function regenerateSlackReply(input: { sessionId: string; channelId?: string; conversationId?: string }) {
  const conversation = input.conversationId
    ? await prisma.conversation.findUnique({ where: { id: input.conversationId } })
    : await findSlackConversation({ sessionId: input.sessionId, channelId: input.channelId });
  if (!conversation) {
    return null;
  }

  const where = conversation.profileId
    ? {
        conversation: {
          profileId: conversation.profileId
        }
      }
    : { conversationId: conversation.id };

  const history = await prisma.message.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: 40
  });

  const lastUserMessage = [...history].reverse().find((item) => item.role === "user");
  if (!lastUserMessage) {
    return null;
  }

  const historyBeforeCurrentMessage = history
    .filter((item: { id: string }) => item.id !== lastUserMessage.id)
    .map((item: { role: "user" | "assistant" | "system"; content: string }) => ({
      role: item.role,
      content: item.content
    })) as Array<{ role: "user" | "assistant" | "system"; content: string }>;

  const assistantText = await generateAssistantReply({
    userMessage: lastUserMessage.content,
    history: historyBeforeCurrentMessage
  });

  const persisted = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: assistantText
    }
  });

  return { assistantText, conversation, persisted };
}

async function applyHumanModeForSlackConversation(conversation: { id: string; profileId: string | null }, mode: "ai" | "human") {
  const where = conversation.profileId ? { profileId: conversation.profileId } : { id: conversation.id };
  const affectedConversations = await prisma.conversation.findMany({
    where,
    select: { id: true }
  });

  await prisma.conversation.updateMany({
    where,
    data: { mode }
  });

  for (const item of affectedConversations) {
    if (mode === "human") {
      interruptConversation(item.id);
    } else {
      resumeConversation(item.id);
    }
    const summary = await getInboxSummaryByConversationId(item.id);
    if (summary) {
      emitConversationUpdated(summary);
    }
  }
}

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
      const renderedPending = renderSlackResponse(
        result.humanSupportPendingMessage ??
          "Your request is currently pending with human support. Please wait for the admin response, or tap Disable Human Support to resume AI assistance.",
        { showDisableHuman: true, conversationId: result.conversationId }
      );
      await client.chat.postMessage({
        channel: event.channel,
        text: renderedPending.text,
        blocks: renderedPending.blocks as never
      });
      return;
    }
    const rendered = renderSlackResponse(result.assistantText, { conversationId: result.conversationId });

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

  slackApp.action("handoff_human", async ({ ack, body, client }) => {
    await ack();
    const channelId =
      "channel" in body && body.channel && "id" in body.channel ? (body.channel.id as string | undefined) : undefined;
    const userId = "user" in body && body.user && "id" in body.user ? (body.user.id as string | undefined) : undefined;
    if (!channelId || !userId) {
      return;
    }

    const actionValue = extractActionValue(body as unknown as Record<string, unknown>);
    const sessionId = `slack-user:${userId}`;
    const conversation = actionValue
      ? await prisma.conversation.findUnique({ where: { id: actionValue } })
      : await findSlackConversation({ sessionId, channelId });

    if (conversation) {
      await applyHumanModeForSlackConversation(conversation, "human");
    }

    await client.chat.postMessage({
      channel: channelId,
      text: "Human support has been enabled. A human agent will assist you shortly."
    });
  });

  slackApp.action("disable_human_support", async ({ ack, body, client }) => {
    await ack();
    const channelId =
      "channel" in body && body.channel && "id" in body.channel ? (body.channel.id as string | undefined) : undefined;
    const userId = "user" in body && body.user && "id" in body.user ? (body.user.id as string | undefined) : undefined;
    if (!channelId || !userId) {
      return;
    }

    const actionValue = extractActionValue(body as unknown as Record<string, unknown>);
    const sessionId = `slack-user:${userId}`;
    const conversation = actionValue
      ? await prisma.conversation.findUnique({ where: { id: actionValue } })
      : await findSlackConversation({ sessionId, channelId });
    if (conversation) {
      await applyHumanModeForSlackConversation(conversation, "ai");
    }

    await client.chat.postMessage({
      channel: channelId,
      text: "Human support has been disabled. AI responses are active again."
    });
  });

  slackApp.action("regenerate_reply", async ({ ack, body, client }) => {
    await ack();
    const channelId =
      "channel" in body && body.channel && "id" in body.channel ? (body.channel.id as string | undefined) : undefined;
    const userId = "user" in body && body.user && "id" in body.user ? (body.user.id as string | undefined) : undefined;
    if (!channelId || !userId) {
      return;
    }

    const actionValue = extractActionValue(body as unknown as Record<string, unknown>);
    const sessionId = `slack-user:${userId}`;
    const regenerated = await regenerateSlackReply({
      sessionId,
      channelId,
      conversationId: actionValue
    });
    if (!regenerated) {
      await client.chat.postMessage({
        channel: channelId,
        text: "I could not regenerate a reply right now."
      });
      return;
    }

    const rendered = renderSlackResponse(regenerated.assistantText, {
      conversationId: regenerated.conversation.id
    });
    await client.chat.postMessage({
      channel: channelId,
      text: rendered.text,
      blocks: rendered.blocks as never
    });
    emitConversationMessage({
      conversationId: regenerated.conversation.profileId ?? regenerated.conversation.id,
      message: {
        id: regenerated.persisted.id,
        role: regenerated.persisted.role,
        content: regenerated.persisted.content,
        createdAt: regenerated.persisted.createdAt.toISOString(),
        channel: regenerated.conversation.channel,
        metadata: regenerated.persisted.metadata as Record<string, unknown> | undefined
      }
    });
    const summary = await getInboxSummaryByConversationId(regenerated.conversation.id);
    if (summary) {
      emitConversationUpdated(summary);
    }
  });

  slackApp.error(async (error) => {
    console.error("Slack Bolt error", error);
  });
} else {
  console.warn("Slack webhook is not configured. Add SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET.");
}

export const slackReceiver = receiver;
export const slackConfigured = isSlackConfigured;
