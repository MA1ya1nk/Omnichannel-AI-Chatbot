import type { ConversationMessage } from "../types/chat-events.js";
import { emitWebConversationMessage } from "./socket-server.js";
import TelegramBot from "node-telegram-bot-api";
import { WebClient } from "@slack/web-api";
import { env } from "../env.js";

const telegramBot = env.TELEGRAM_BOT_TOKEN ? new TelegramBot(env.TELEGRAM_BOT_TOKEN) : null;
const slackClient = env.SLACK_BOT_TOKEN ? new WebClient(env.SLACK_BOT_TOKEN) : null;

export async function dispatchHumanReply(input: {
  channel: string;
  channelAddress?: Record<string, unknown> | null;
  sessionId: string;
  text: string;
  persistedMessage: ConversationMessage;
}) {
  if (input.channel === "telegram") {
    const chatId = input.channelAddress?.chatId;
    if (!telegramBot || typeof chatId !== "number") {
      throw new Error("Telegram channel not configured correctly for dispatch.");
    }
    await telegramBot.sendMessage(chatId, input.text);
    return;
  }

  if (input.channel === "slack") {
    const channelId = input.channelAddress?.channelId;
    if (!slackClient || typeof channelId !== "string") {
      throw new Error("Slack channel not configured correctly for dispatch.");
    }
    await slackClient.chat.postMessage({
      channel: channelId,
      text: input.text
    });
    return;
  }

  if (input.channel === "web") {
    emitWebConversationMessage(input.sessionId, input.persistedMessage);
    return;
  }

  throw new Error(`Unsupported channel dispatch: ${input.channel}`);
}
