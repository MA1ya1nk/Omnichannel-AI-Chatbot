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

const router = Router();

const telegramConfigured = Boolean(env.TELEGRAM_BOT_TOKEN);
const telegramBot = telegramConfigured ? new TelegramBot(env.TELEGRAM_BOT_TOKEN) : null;
const assistantName = env.TELEGRAM_BOT_USERNAME || "Omnichannel AI";

if (!telegramConfigured) {
  console.warn("Telegram webhook is not configured. Add TELEGRAM_BOT_TOKEN.");
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
