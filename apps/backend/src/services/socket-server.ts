import { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { ConversationMessage, ConversationSummary } from "../types/chat-events.js";
import { env } from "../env.js";

let io: Server | null = null;

export function initSocketServer(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: [env.FRONTEND_ORIGIN]
    }
  });

  io.on("connection", (socket) => {
    socket.join("admins");

    socket.on("web:join", (payload: { sessionId?: string }) => {
      if (!payload?.sessionId) {
        return;
      }
      socket.join(`web:${payload.sessionId}`);
    });
  });

  return io;
}

function getIo(): Server | null {
  return io;
}

export function emitConversationUpdated(conversation: ConversationSummary) {
  getIo()?.to("admins").emit("conversation:updated", conversation);
}

export function emitConversationMessage(payload: { conversationId: string; message: ConversationMessage }) {
  getIo()?.to("admins").emit("conversation:message", payload);
}

export function emitWebConversationMessage(sessionId: string, message: ConversationMessage) {
  getIo()?.to(`web:${sessionId}`).emit("web:message", message);
}
