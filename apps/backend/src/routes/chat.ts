import { MessageRole, Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { normalizeWebMessage } from "../services/message-normalizer.js";
import { generateAssistantReply } from "../services/mistral-service.js";

const router = Router();

const requestSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().optional(),
  text: z.string().min(1),
  metadata: z.record(z.unknown()).optional()
});

router.post("/message", async (req, res, next) => {
  try {
    requestSchema.parse(req.body);
    const normalized = normalizeWebMessage(req.body);

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

    const reply = await generateAssistantReply({
      userMessage: normalized.text,
      history: historyBeforeCurrentMessage
    });

    const assistantMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.assistant,
        content: reply
      }
    });

    res.json({
      conversationId: conversation.id,
      message: {
        id: assistantMessage.id,
        role: "assistant",
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/history/:sessionId", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const conversation = await prisma.conversation.findFirst({
      where: { sessionId, channel: "web" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    res.json({
      conversationId: conversation?.id ?? null,
      messages:
        conversation?.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt
        })) ?? []
    });
  } catch (error) {
    next(error);
  }
});

export default router;
