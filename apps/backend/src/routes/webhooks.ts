import { Router } from "express";
import TelegramBot from "node-telegram-bot-api";
import { env } from "../env.js";
import { normalizeTelegramMessage } from "../services/message-normalizer.js";
import { processInboundMessage } from "../services/brain-engine.js";
import { renderTelegramResponse } from "../services/response-renderer.js";
import { isDuplicateWebhookMessage } from "../services/idempotency-cache.js";
import { slackConfigured } from "../services/slack-bolt.js";

const router = Router();

const telegramConfigured = Boolean(env.TELEGRAM_BOT_TOKEN);
const telegramBot = telegramConfigured ? new TelegramBot(env.TELEGRAM_BOT_TOKEN) : null;

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

    const telegramMessageId = normalized.metadata?.messageId;
    if (typeof telegramMessageId === "number") {
      const dedupeKey = `telegram:${normalized.sessionId}:${telegramMessageId}`;
      if (isDuplicateWebhookMessage(dedupeKey)) {
        return res.status(200).json({ status: "duplicate_ignored" });
      }
    }

    const result = await processInboundMessage(normalized);
    const rendered = renderTelegramResponse(result.assistantText);

    const chatId = normalized.metadata?.chatId;
    if (typeof chatId !== "number") {
      return res.status(400).json({ error: "Invalid Telegram chat id." });
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
