import { z } from "zod";

const webMessageSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().optional(),
  identityKey: z.string().optional(),
  text: z.string().min(1),
  type: z.enum(["text"]).default("text"),
  metadata: z.record(z.unknown()).optional()
});

export type NormalizedMessage = {
  channel: "web" | "telegram" | "slack";
  sessionId: string;
  userId?: string;
  identityKey?: string;
  text: string;
  type: "text";
  timestamp: string;
  metadata?: Record<string, unknown>;
  channelAddress?: Record<string, unknown>;
};

export function normalizeWebMessage(payload: unknown): NormalizedMessage {
  const parsed = webMessageSchema.parse(payload);

  return {
    channel: "web",
    sessionId: parsed.sessionId,
    userId: parsed.userId,
    identityKey: parsed.identityKey ?? parsed.userId ?? parsed.sessionId,
    text: parsed.text.trim(),
    type: parsed.type,
    timestamp: new Date().toISOString(),
    metadata: parsed.metadata,
    channelAddress: {
      sessionId: parsed.sessionId
    }
  };
}

const telegramUpdateSchema = z.object({
  message: z
    .object({
      message_id: z.number(),
      text: z.string().optional(),
      chat: z.object({
        id: z.number()
      }),
      from: z
        .object({
          id: z.number()
        })
        .optional()
    })
    .optional()
});

export function normalizeTelegramMessage(payload: unknown): NormalizedMessage | null {
  const parsed = telegramUpdateSchema.parse(payload);
  const message = parsed.message;

  if (!message?.text?.trim()) {
    return null;
  }

  return {
    channel: "telegram",
    sessionId: message.from?.id ? `telegram-user:${message.from.id}` : `telegram-chat:${message.chat.id}`,
    userId: message.from?.id ? String(message.from.id) : undefined,
    identityKey: message.from?.id ? `telegram-user:${message.from.id}` : `telegram-chat:${message.chat.id}`,
    text: message.text.trim(),
    type: "text",
    timestamp: new Date().toISOString(),
    metadata: {
      chatId: message.chat.id,
      messageId: message.message_id
    },
    channelAddress: {
      chatId: message.chat.id
    }
  };
}

const slackEventSchema = z.object({
  event: z
    .object({
      type: z.string(),
      text: z.string().optional(),
      channel: z.string().optional(),
      user: z.string().optional(),
      subtype: z.string().optional(),
      team: z.string().optional(),
      bot_id: z.string().optional(),
      ts: z.string().optional()
    })
    .optional()
});

export function normalizeSlackMessage(payload: unknown): NormalizedMessage | null {
  const parsed = slackEventSchema.parse(payload);
  const event = parsed.event;

  if (
    !event ||
    event.type !== "message" ||
    event.bot_id ||
    event.subtype ||
    !event.user ||
    !event.text?.trim() ||
    !event.channel
  ) {
    return null;
  }

  return {
    channel: "slack",
    sessionId: `slack-user:${event.user}`,
    userId: event.user,
    identityKey: `slack-user:${event.user}`,
    text: event.text.trim(),
    type: "text",
    timestamp: new Date().toISOString(),
    metadata: {
      channelId: event.channel,
      teamId: event.team,
      slackTs: event.ts
    },
    channelAddress: {
      channelId: event.channel
    }
  };
}
