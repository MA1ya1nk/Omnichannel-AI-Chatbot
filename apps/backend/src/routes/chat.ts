import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { normalizeWebMessage } from "../services/message-normalizer.js";
import { processInboundMessage } from "../services/brain-engine.js";

const router = Router();

const requestSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().optional(),
  identityKey: z.string().optional(),
  text: z.string().min(1),
  type: z.enum(["text"]).optional(),
  metadata: z.record(z.unknown()).optional()
});

router.post("/message", async (req, res, next) => {
  try {
    requestSchema.parse(req.body);
    const normalized = normalizeWebMessage(req.body);

    const result = await processInboundMessage(normalized);

    if (result.interruptedForHuman) {
      return res.json({
        conversationId: result.conversationId,
        message: {
          role: "assistant",
          content: "A human agent has joined this conversation and will reply shortly.",
          createdAt: new Date().toISOString()
        },
        interruptedForHuman: true
      });
    }

    return res.json({
      conversationId: result.conversationId,
      message: {
        role: "assistant",
        content: result.assistantText ?? "",
        createdAt: new Date().toISOString()
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

    const messages = (conversation?.messages ?? []) as Array<{
      id: string;
      role: string;
      content: string;
      createdAt: Date;
    }>;

    res.json({
      conversationId: conversation?.id ?? null,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
});

export default router;
