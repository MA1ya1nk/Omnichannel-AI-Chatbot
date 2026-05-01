import { MessageRole, Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { generateAssistantReply } from "./mistral-service.js";
import { type NormalizedMessage } from "./message-normalizer.js";
import { emitConversationMessage, emitConversationUpdated, emitWebConversationMessage } from "./socket-server.js";
import { getInboxSummaryByConversationId } from "./conversation-service.js";
import { resolveProfileId } from "./identity-service.js";
import { isConversationInterrupted, interruptConversation, resumeConversation } from "./langgraph-interrupt.js";

export async function processInboundMessage(normalized: NormalizedMessage): Promise<{
  conversationId: string;
  assistantText?: string;
  assistantMessageId?: string;
  assistantCreatedAt?: string;
  interruptedForHuman: boolean;
  humanSupportPendingMessage?: string;
}> {
  const profileId = await resolveProfileId({
    channel: normalized.channel,
    externalUserId: normalized.userId,
    canonicalIdentityKey: normalized.identityKey
  });

  const conversationWhere =
    normalized.channel === "web" && normalized.userId
      ? {
          sessionId: normalized.sessionId,
          channel: normalized.channel,
          userId: normalized.userId
        }
      : {
          sessionId: normalized.sessionId,
          channel: normalized.channel
        };

  let conversation = await prisma.conversation.findFirst({
    where: conversationWhere
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        channel: normalized.channel,
        sessionId: normalized.sessionId,
        userId: normalized.userId,
        profileId,
        channelAddress: normalized.channelAddress as Prisma.InputJsonValue | undefined
      }
    });
  } else if ((profileId && conversation.profileId !== profileId) || normalized.channelAddress) {
    const updateData: Prisma.ConversationUpdateInput = {};
    if (profileId && conversation.profileId !== profileId) {
      updateData.profile = {
        connect: {
          id: profileId
        }
      };
    }
    if (normalized.channelAddress) {
      updateData.channelAddress = normalized.channelAddress as Prisma.InputJsonValue;
    }

    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: updateData
    });
  }

  let humanModeEnabled = conversation.mode === "human";
  let modeUpdatedToHuman = false;
  if (!humanModeEnabled && conversation.profileId) {
    const humanConversation = await prisma.conversation.findFirst({
      where: {
        profileId: conversation.profileId,
        mode: "human"
      },
      select: { id: true }
    });
    humanModeEnabled = Boolean(humanConversation);
    if (humanModeEnabled) {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { mode: "human" }
      });
      modeUpdatedToHuman = true;
    }
  }

  if (modeUpdatedToHuman) {
    const summaryAfterModeUpdate = await getInboxSummaryByConversationId(conversation.id);
    if (summaryAfterModeUpdate) {
      emitConversationUpdated(summaryAfterModeUpdate);
    }
  }

  if (humanModeEnabled) {
    interruptConversation(conversation.id);
    return {
      conversationId: conversation.id,
      interruptedForHuman: true,
      humanSupportPendingMessage:
        "Your request is currently pending with human support. Please wait for the admin response, or tap Disable Human Support to resume AI assistance."
    };
  }
  resumeConversation(conversation.id);
  if (isConversationInterrupted(conversation.id)) {
    return {
      conversationId: conversation.id,
      interruptedForHuman: true,
      humanSupportPendingMessage:
        "Your request is currently pending with human support. Please wait for the admin response, or tap Disable Human Support to resume AI assistance."
    };
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: MessageRole.user,
      content: normalized.text,
      metadata: normalized.metadata as Prisma.InputJsonValue | undefined
    }
  });

  const userMessage = await prisma.message.findFirst({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" }
  });

  if (userMessage) {
    emitConversationMessage({
      conversationId: conversation.profileId ?? conversation.id,
      message: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: userMessage.createdAt.toISOString(),
        channel: conversation.channel,
        metadata: userMessage.metadata as Record<string, unknown> | undefined
      }
    });
  }

  const summaryAfterUserMessage = await getInboxSummaryByConversationId(conversation.id);
  if (summaryAfterUserMessage) {
    emitConversationUpdated(summaryAfterUserMessage);
  }

  const historyWhere = conversation.profileId
    ? {
        conversation: {
          profileId: conversation.profileId
        }
      }
    : { conversationId: conversation.id };

  const history = await prisma.message.findMany({
    where: historyWhere,
    orderBy: { createdAt: "asc" },
    take: 40
  });

  const historyBeforeCurrentMessage = history
    .slice(0, -1)
    .map((message: { role: "user" | "assistant" | "system"; content: string }) => ({
      role: message.role,
      content: message.content
    }));

  const assistantText = await generateAssistantReply({
    userMessage: normalized.text,
    history: historyBeforeCurrentMessage
  });

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: MessageRole.assistant,
      content: assistantText
    }
  });

  const assistantMessage = await prisma.message.findFirst({
    where: { conversationId: conversation.id, role: MessageRole.assistant },
    orderBy: { createdAt: "desc" }
  });

  if (assistantMessage) {
    emitConversationMessage({
      conversationId: conversation.profileId ?? conversation.id,
      message: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt.toISOString(),
        channel: conversation.channel,
        metadata: assistantMessage.metadata as Record<string, unknown> | undefined
      }
    });
    if (normalized.channel === "web") {
      emitWebConversationMessage(normalized.sessionId, {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt.toISOString(),
        metadata: assistantMessage.metadata as Record<string, unknown> | undefined
      });
    }
  }

  const summaryAfterAssistantMessage = await getInboxSummaryByConversationId(conversation.id);
  if (summaryAfterAssistantMessage) {
    emitConversationUpdated(summaryAfterAssistantMessage);
  }

  return {
    conversationId: conversation.id,
    assistantText,
    assistantMessageId: assistantMessage?.id,
    assistantCreatedAt: assistantMessage?.createdAt.toISOString(),
    interruptedForHuman: false
  };
}
