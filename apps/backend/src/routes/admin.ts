import { MessageRole, Prisma } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import {
  addConversationMessage,
  getConversationMessages,
  getInboxSummaryByConversationId,
  getConversationSummaries,
  resolvePrimaryConversation,
  setConversationMode
} from "../services/conversation-service.js";
import { dispatchHumanReply } from "../services/channel-dispatcher.js";
import { isAdminRateLimited, isAuthorizedAdmin } from "../services/admin-security.js";
import { linkUserIdentities } from "../services/identity-service.js";
import { ingestKnowledgeDocument } from "../services/knowledge-base.js";
import { interruptConversation, resumeConversation } from "../services/langgraph-interrupt.js";
import { emitConversationMessage, emitConversationUpdated } from "../services/socket-server.js";

const router = Router();
const ALLOWED_ADMIN_EMAIL = "mk20040307@gmail.com";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

router.use(requireAuth);

router.use((req, res, next) => {
  const email = req.authUser?.email?.toLowerCase();
  if (email !== ALLOWED_ADMIN_EMAIL) {
    return res.status(403).json({ error: "Forbidden: admin access is restricted." });
  }
  return next();
});

router.use((req, res, next) => {
  const token = req.header("x-admin-token");
  const requestKey = req.ip ?? "unknown-ip";

  if (!isAuthorizedAdmin(token)) {
    return res.status(401).json({ error: "Unauthorized admin request." });
  }

  if (isAdminRateLimited(requestKey)) {
    return res.status(429).json({ error: "Admin rate limit exceeded." });
  }

  return next();
});

router.get("/conversations", async (_req, res, next) => {
  try {
    const conversations = await getConversationSummaries();
    res.json({ conversations });
  } catch (error) {
    next(error);
  }
});

router.get("/conversations/:conversationId/messages", async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const messages = await getConversationMessages(conversationId);
    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

const modeSchema = z.object({
  mode: z.enum(["ai", "human"])
});

router.patch("/conversations/:conversationId/mode", async (req, res, next) => {
  try {
    const { conversationId: inboxId } = req.params;
    const payload = modeSchema.parse(req.body);
    const primaryConversation = await resolvePrimaryConversation(inboxId);
    if (!primaryConversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }
    const conversation = await setConversationMode(primaryConversation.id, payload.mode);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    if (payload.mode === "human") {
      interruptConversation(primaryConversation.id);
    } else {
      resumeConversation(primaryConversation.id);
    }

    await prisma.adminAuditLog.create({
      data: {
        action: "mode_toggled",
        conversationId: primaryConversation.id,
        detail: { mode: payload.mode } as Prisma.InputJsonValue
      }
    });
    const summary = await getInboxSummaryByConversationId(primaryConversation.id);
    if (summary) {
      emitConversationUpdated(summary);
      return res.json({ conversation: summary });
    }
    return res.json({ conversation });
  } catch (error) {
    next(error);
  }
});

const replySchema = z.object({
  text: z.string().min(1)
});

router.post("/conversations/:conversationId/reply", async (req, res, next) => {
  try {
    const { conversationId: inboxId } = req.params;
    const payload = replySchema.parse(req.body);

    const conversation = await resolvePrimaryConversation(inboxId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    if (conversation.mode !== "human") {
      return res.status(409).json({
        error: "Manual reply is allowed only when Human Mode is ON."
      });
    }

    const pendingMessage = await addConversationMessage({
      conversationId: conversation.id,
      role: MessageRole.assistant,
      content: payload.text,
      channel: conversation.channel,
      metadata: {
        source: "admin",
        mode: "human"
      } as Prisma.InputJsonValue
    });

    await dispatchHumanReply({
      channel: conversation.channel,
      channelAddress: conversation.channelAddress as Record<string, unknown> | null,
      sessionId: conversation.sessionId,
      text: payload.text,
      persistedMessage: pendingMessage
    });

    await prisma.adminAuditLog.create({
      data: {
        action: "manual_reply_sent",
        conversationId: conversation.id,
        detail: { channel: conversation.channel } as Prisma.InputJsonValue
      }
    });

    const summary = await getInboxSummaryByConversationId(conversation.id);
    if (summary) {
      emitConversationUpdated(summary);
    }
    emitConversationMessage({
      conversationId: inboxId,
      message: {
        ...pendingMessage,
        channel: conversation.channel
      }
    });

    return res.json({ message: pendingMessage });
  } catch (error) {
    next(error);
  }
});

router.get("/canned-responses", async (_req, res, next) => {
  try {
    let cannedResponses = await prisma.cannedResponse.findMany({
      orderBy: { updatedAt: "desc" }
    });
    if (cannedResponses.length === 0) {
      await prisma.cannedResponse.createMany({
        data: [
          {
            title: "Checking",
            content: "Thanks for contacting us. I am checking this for you now."
          },
          {
            title: "Escalated",
            content: "I have escalated this to our specialist team."
          },
          {
            title: "Need Detail",
            content: "Could you please share one more detail so I can help better?"
          },
          {
            title: "Next Step",
            content: "Thanks for waiting. Here is what I can do next."
          }
        ]
      });
      cannedResponses = await prisma.cannedResponse.findMany({
        orderBy: { updatedAt: "desc" }
      });
    }
    res.json({ cannedResponses });
  } catch (error) {
    next(error);
  }
});

const cannedResponseSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1)
});

router.post("/canned-responses", async (req, res, next) => {
  try {
    const payload = cannedResponseSchema.parse(req.body);
    const cannedResponse = await prisma.cannedResponse.create({
      data: payload
    });
    await prisma.adminAuditLog.create({
      data: {
        action: "canned_response_created",
        detail: { id: cannedResponse.id } as Prisma.InputJsonValue
      }
    });
    res.status(201).json({ cannedResponse });
  } catch (error) {
    next(error);
  }
});

router.delete("/canned-responses/:cannedResponseId", async (req, res, next) => {
  try {
    const { cannedResponseId } = req.params;
    await prisma.cannedResponse.delete({
      where: { id: cannedResponseId }
    });
    await prisma.adminAuditLog.create({
      data: {
        action: "canned_response_deleted",
        detail: { id: cannedResponseId } as Prisma.InputJsonValue
      }
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/identity-links", async (req, res, next) => {
  try {
    const payload = z
      .object({
        canonicalKey: z.string().min(1),
        links: z
          .array(
            z.object({
              channel: z.enum(["web", "telegram", "slack"]),
              externalUserId: z.string().min(1)
            })
          )
          .min(1)
      })
      .parse(req.body);

    const profileId = await linkUserIdentities({
      canonicalKey: payload.canonicalKey,
      links: payload.links
    });

    await prisma.adminAuditLog.create({
      data: {
        action: "identity_links_created",
        detail: { canonicalKey: payload.canonicalKey } as Prisma.InputJsonValue
      }
    });

    res.status(201).json({ profileId });
  } catch (error) {
    next(error);
  }
});

router.post("/knowledge/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "A file is required." });
    }
    if (!req.file.mimetype.includes("pdf")) {
      return res.status(400).json({ error: "Only PDF uploads are supported." });
    }

    const parser = new PDFParse({ data: req.file.buffer });
    const parsed = await parser.getText();
    const result = await ingestKnowledgeDocument({
      title: req.file.originalname,
      mimeType: req.file.mimetype,
      rawText: parsed.text,
      uploadedBy: req.header("x-admin-token")
    });
    await parser.destroy();

    await prisma.adminAuditLog.create({
      data: {
        action: "knowledge_document_uploaded",
        detail: { documentId: result.id, title: result.title } as Prisma.InputJsonValue
      }
    });

    return res.status(201).json({ document: result });
  } catch (error) {
    next(error);
  }
});

router.get("/analytics", async (_req, res, next) => {
  try {
    const messages = await prisma.message.findMany({
      include: {
        conversation: {
          select: {
            channel: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    const channelBreakdownMap = new Map<string, number>();
    const peakHours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    const responseTimes: number[] = [];

    let pendingUserMessageAt: Date | null = null;
    for (const message of messages) {
      if (message.role === "user") {
        const channel = message.conversation.channel;
        channelBreakdownMap.set(channel, (channelBreakdownMap.get(channel) ?? 0) + 1);
      }

      const hour = message.createdAt.getHours();
      peakHours[hour].count += 1;

      if (message.role === "user") {
        pendingUserMessageAt = message.createdAt;
      } else if (message.role === "assistant" && pendingUserMessageAt) {
        responseTimes.push(message.createdAt.getTime() - pendingUserMessageAt.getTime());
        pendingUserMessageAt = null;
      }
    }

    const averageResponseMs =
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((total, item) => total + item, 0) / responseTimes.length)
        : 0;

    const channelBreakdown = Array.from(channelBreakdownMap.entries()).map(([channel, count]) => ({
      channel,
      count
    }));

    return res.json({
      channelBreakdown,
      peakHours,
      averageResponseMs
    });
  } catch (error) {
    next(error);
  }
});

router.get("/audit-logs", async (_req, res, next) => {
  try {
    const logs = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

export default router;
