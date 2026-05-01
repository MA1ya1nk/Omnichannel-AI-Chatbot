import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
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

function webSessionIdForUser(userId: string): string {
  return `web-user:${userId}`;
}

router.post("/message", async (req, res, next) => {
  return res.status(401).json({ error: "Authentication is required for chat messaging." });
});

router.post("/secure/message", requireAuth, async (req, res, next) => {
  try {
    requestSchema.parse(req.body);
    if (!req.authUser) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    const normalized = normalizeWebMessage({
      ...req.body,
      sessionId: webSessionIdForUser(req.authUser.userId),
      userId: req.authUser.userId,
      identityKey: req.authUser.email.toLowerCase()
    });

    const result = await processInboundMessage(normalized);
    if (result.interruptedForHuman) {
      return res.json({
        conversationId: result.conversationId,
        message: {
          role: "assistant",
          content:
            result.humanSupportPendingMessage ??
            "Your request is currently pending with human support. Please wait for the admin response, or enable AI mode again.",
          createdAt: new Date().toISOString()
        },
        interruptedForHuman: true
      });
    }
    return res.json({
      conversationId: result.conversationId,
      message: {
        id: result.assistantMessageId,
        role: "assistant",
        content: result.assistantText ?? "",
        createdAt: result.assistantCreatedAt ?? new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/history/:sessionId", (_req, res) => {
  return res.status(401).json({ error: "Authentication is required for chat history." });
});

router.get("/secure/history", requireAuth, async (req, res, next) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    const sessionId = webSessionIdForUser(req.authUser.userId);
    const conversation = await prisma.conversation.findFirst({
      where: {
        channel: "web",
        sessionId,
        userId: req.authUser.userId
      },
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
