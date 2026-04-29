import { MessageRole, Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { generateAssistantReply } from "./mistral-service.js";
import { type NormalizedMessage } from "./message-normalizer.js";

export async function processInboundMessage(normalized: NormalizedMessage): Promise<{
  conversationId: string;
  assistantText: string;
}> {
  let conversation = await prisma.conversation.findFirst({
    where: {
      sessionId: normalized.sessionId,
      channel: normalized.channel
    }
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        channel: normalized.channel,
        sessionId: normalized.sessionId,
        userId: normalized.userId
      }
    });
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: MessageRole.user,
      content: normalized.text,
      metadata: normalized.metadata as Prisma.InputJsonValue | undefined
    }
  });

  const history = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 20
  });

  const historyBeforeCurrentMessage = history
    .slice(0, -1)
    .map((message) => ({ role: message.role, content: message.content }));

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

  return {
    conversationId: conversation.id,
    assistantText
  };
}
