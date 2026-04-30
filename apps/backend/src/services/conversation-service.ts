import { MessageRole, Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import type { ConversationMessage, ConversationSummary } from "../types/chat-events.js";

function toConversationSummary(input: {
  id: string;
  channel: string;
  sessionId: string;
  userId: string | null;
  profileId: string | null;
  mode: "ai" | "human";
  updatedAt: Date;
  messages: Array<{ role: MessageRole; content: string; createdAt: Date }>;
}): ConversationSummary {
  const [last] = input.messages;
  return {
    id: input.id,
    channel: input.channel,
    sessionId: input.sessionId,
    userId: input.userId,
    profileId: input.profileId,
    mode: input.mode,
    lastMessage: last
      ? {
          role: last.role,
          content: last.content,
          createdAt: last.createdAt.toISOString()
        }
      : undefined,
    unreadCount: 0,
    updatedAt: input.updatedAt.toISOString()
  };
}

export async function getConversationSummaries(): Promise<ConversationSummary[]> {
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });
  const grouped = new Map<string, typeof conversations>();

  for (const conversation of conversations) {
    const key = conversation.profileId ?? conversation.id;
    const existing = grouped.get(key) ?? [];
    existing.push(conversation);
    grouped.set(key, existing);
  }

  const summaries: ConversationSummary[] = [];
  for (const [key, items] of grouped.entries()) {
    const sortedByUpdated = [...items].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const primary = sortedByUpdated[0];
    const hasMultipleChannels = new Set(items.map((item) => item.channel)).size > 1;

    summaries.push({
      ...toConversationSummary({
        id: key,
        channel: hasMultipleChannels ? "multi" : primary.channel,
        sessionId: primary.profileId ? `profile:${primary.profileId}` : primary.sessionId,
        userId: primary.userId,
        profileId: primary.profileId,
        mode: primary.mode,
        updatedAt: primary.updatedAt,
        messages: primary.messages
      }),
      conversationIds: items.map((item) => item.id),
      primaryConversationId: primary.id
    });
  }

  return summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getConversationMessages(inboxId: string): Promise<ConversationMessage[]> {
  const profileConversation = await prisma.conversation.findFirst({
    where: { profileId: inboxId },
    select: { id: true }
  });

  const where = profileConversation
    ? {
        conversation: {
          profileId: inboxId
        }
      }
    : { conversationId: inboxId };

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: "asc" }
  });

  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    metadata: message.metadata as Record<string, unknown> | undefined
  }));
}

export async function getConversationSummaryById(conversationId: string): Promise<ConversationSummary | null> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  if (!conversation) {
    return null;
  }

  return toConversationSummary({
    id: conversation.id,
    channel: conversation.channel,
    sessionId: conversation.sessionId,
    userId: conversation.userId,
    profileId: conversation.profileId,
    mode: conversation.mode,
    updatedAt: conversation.updatedAt,
    messages: conversation.messages
  });
}

export async function getInboxSummaryByConversationId(conversationId: string): Promise<ConversationSummary | null> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId }
  });
  if (!conversation) {
    return null;
  }

  if (!conversation.profileId) {
    return getConversationSummaryById(conversationId);
  }

  const summaries = await getConversationSummaries();
  return summaries.find((item) => item.id === conversation.profileId) ?? null;
}

export async function resolvePrimaryConversation(inboxId: string) {
  const byId = await prisma.conversation.findUnique({
    where: { id: inboxId }
  });
  if (byId) {
    return byId;
  }

  const byProfile = await prisma.conversation.findFirst({
    where: { profileId: inboxId },
    orderBy: { updatedAt: "desc" }
  });
  return byProfile;
}

export async function setConversationMode(conversationId: string, mode: "ai" | "human") {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { mode }
  });

  return getConversationSummaryById(conversationId);
}

export async function addConversationMessage(input: {
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const message = await prisma.message.create({
    data: {
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      metadata: input.metadata
    }
  });

  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    metadata: message.metadata as Record<string, unknown> | undefined
  } as ConversationMessage;
}
