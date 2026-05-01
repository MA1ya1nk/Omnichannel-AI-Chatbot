import { Router } from "express";
import TelegramBot from "node-telegram-bot-api";
import { env } from "../env.js";
import { normalizeTelegramMessage } from "../services/message-normalizer.js";
import { processInboundMessage } from "../services/brain-engine.js";
import { renderTelegramResponse } from "../services/response-renderer.js";
import { isDuplicateWebhookMessage } from "../services/idempotency-cache.js";
import { consumeValidLinkToken } from "../services/link-token-service.js";
import { linkUserIdentities } from "../services/identity-service.js";
import { prisma } from "../prisma.js";
import { slackConfigured } from "../services/slack-bolt.js";
import { interruptConversation, resumeConversation } from "../services/langgraph-interrupt.js";
import { generateAssistantReply } from "../services/mistral-service.js";
import { getInboxSummaryByConversationId } from "../services/conversation-service.js";
import { emitConversationMessage, emitConversationUpdated } from "../services/socket-server.js";

const router = Router();

const telegramConfigured = Boolean(env.TELEGRAM_BOT_TOKEN);
const telegramBot = telegramConfigured ? new TelegramBot(env.TELEGRAM_BOT_TOKEN) : null;
const assistantName = env.TELEGRAM_BOT_USERNAME || "Omnichannel AI";

if (!telegramConfigured) {
  console.warn("Telegram webhook is not configured. Add TELEGRAM_BOT_TOKEN.");
}

async function findTelegramConversation(input: { sessionId: string; chatId?: number }) {
  const candidates = [input.sessionId];
  if (typeof input.chatId === "number") {
    candidates.push(`telegram-chat:${input.chatId}`);
  }

  for (const candidate of candidates) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        channel: "telegram",
        sessionId: candidate
      }
    });
    if (conversation) {
      return conversation;
    }
  }
  return null;
}

async function regenerateTelegramReply(input: { sessionId: string; chatId?: number }) {
  const conversation = await findTelegramConversation({ sessionId: input.sessionId, chatId: input.chatId });
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

async function applyHumanModeForTelegramConversation(conversation: { id: string; profileId: string | null }, mode: "ai" | "human") {
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

router.post("/telegram", async (req, res, next) => {
  try {
    if (!telegramBot) {
      return res.status(503).json({ error: "Telegram not configured." });
    }
    if (env.TELEGRAM_WEBHOOK_SECRET_TOKEN) {
      const headerToken = req.header("X-Telegram-Bot-Api-Secret-Token");
      if (headerToken !== env.TELEGRAM_WEBHOOK_SECRET_TOKEN) {
        return res.status(401).json({ error: "Invalid Telegram webhook secret token." });
      }
    }

    const normalized = normalizeTelegramMessage(req.body);
    if (!normalized) {
      const callbackQuery = req.body?.callback_query;
      if (callbackQuery && telegramBot) {
        const callbackId = callbackQuery.id as string | undefined;
        const action = callbackQuery.data as string | undefined;
        const fromId = callbackQuery.from?.id;
        const chatId = callbackQuery.message?.chat?.id;

        if (callbackId) {
          await telegramBot.answerCallbackQuery(callbackId).catch(() => undefined);
        }

        if (typeof chatId === "number" && typeof fromId === "number" && action) {
          const sessionId = `telegram-user:${fromId}`;
          if (action === "handoff_human") {
            const conversation = await findTelegramConversation({ sessionId, chatId });
            if (conversation) {
              await applyHumanModeForTelegramConversation(conversation, "human");
            }
            await telegramBot.sendMessage(chatId, "Human support has been enabled. A human agent will assist you shortly.");
            return res.status(200).json({ status: "human_mode_enabled" });
          }

          if (action === "disable_human_support") {
            const conversation = await findTelegramConversation({ sessionId, chatId });
            if (conversation) {
              await applyHumanModeForTelegramConversation(conversation, "ai");
            }
            await telegramBot.sendMessage(chatId, "Human support has been disabled. AI responses are active again.");
            return res.status(200).json({ status: "human_mode_disabled" });
          }

          if (action === "regenerate_reply") {
            const regenerated = await regenerateTelegramReply({ sessionId, chatId });
            if (!regenerated) {
              await telegramBot.sendMessage(chatId, "I could not regenerate a reply right now.");
              return res.status(200).json({ status: "regenerate_unavailable" });
            }
            const rendered = renderTelegramResponse(regenerated.assistantText);
            await telegramBot.sendMessage(chatId, rendered.text, {
              reply_markup: rendered.reply_markup
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
            return res.status(200).json({ status: "regenerated" });
          }
        }
      }
      return res.status(200).json({ status: "ignored" });
    }

    if (normalized.text.startsWith("/start ")) {
      const token = normalized.text.replace("/start ", "").trim();
      if (token.startsWith("telegram_")) {
        const consumed = await consumeValidLinkToken(token, "telegram");
        const telegramUserId = normalized.userId;
        if (!consumed || !telegramUserId) {
          const chatId = normalized.metadata?.chatId;
          if (typeof chatId === "number") {
            await telegramBot.sendMessage(chatId, "Link request invalid or expired. Please retry from the web app.");
          }
          return res.status(200).json({ status: "link_invalid" });
        }

        const appUser = await prisma.appUser.findUnique({ where: { id: consumed.userId } });
        if (!appUser) {
          return res.status(200).json({ status: "link_user_missing" });
        }

        await linkUserIdentities({
          canonicalKey: appUser.email.toLowerCase(),
          links: [
            { channel: "web", externalUserId: appUser.id },
            { channel: "telegram", externalUserId: telegramUserId }
          ]
        });

        const chatId = normalized.metadata?.chatId;
        if (typeof chatId === "number") {
          await telegramBot.sendMessage(chatId, "Telegram connected successfully. Your chats are now unified.");
        }
        return res.status(200).json({ status: "telegram_linked" });
      }
    }

    const telegramMessageId = normalized.metadata?.messageId;
    if (typeof telegramMessageId === "number") {
      const dedupeKey = `telegram:${normalized.sessionId}:${telegramMessageId}`;
      if (isDuplicateWebhookMessage(dedupeKey)) {
        return res.status(200).json({ status: "duplicate_ignored" });
      }
    }

    const chatId = normalized.metadata?.chatId;
    if (typeof chatId !== "number") {
      return res.status(400).json({ error: "Invalid Telegram chat id." });
    }

    let typingMessageId: number | null = null;
    try {
      await telegramBot.sendChatAction(chatId, "typing");
      const typingMessage = await telegramBot.sendMessage(chatId, `${assistantName} is typing...`);
      typingMessageId = typingMessage.message_id;
    } catch {
      typingMessageId = null;
    }

    const result = await processInboundMessage(normalized);
    if (result.interruptedForHuman || !result.assistantText) {
      if (typingMessageId) {
        await telegramBot.deleteMessage(chatId, typingMessageId).catch(() => undefined);
      }
      const renderedPending = renderTelegramResponse(
        result.humanSupportPendingMessage ??
          "Your request is currently pending with human support. Please wait for the admin response, or tap Disable Human Support to resume AI assistance.",
        { showDisableHuman: true }
      );
      await telegramBot.sendMessage(chatId, renderedPending.text, {
        reply_markup: renderedPending.reply_markup
      });
      return res.status(200).json({ status: "human_mode_enabled", conversationId: result.conversationId });
    }
    const rendered = renderTelegramResponse(result.assistantText);

    if (typingMessageId) {
      await telegramBot.deleteMessage(chatId, typingMessageId).catch(() => undefined);
    }

    await telegramBot.sendChatAction(chatId, "typing");
    await telegramBot.sendMessage(chatId, rendered.text, {
      reply_markup: rendered.reply_markup
    });

    return res.status(200).json({ status: "ok", conversationId: result.conversationId });
  } catch (error) {
    next(error);
  }
});

router.get("/telegram/health", (_req, res) => {
  res.json({ configured: telegramConfigured });
});

router.get("/slack/health", (_req, res) => {
  res.json({ configured: slackConfigured });
});

export default router;
