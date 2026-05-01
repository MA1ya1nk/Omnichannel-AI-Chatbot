import { getAuthToken } from "./auth";

export type ConversationMode = "ai" | "human";
export type ChannelType = "web" | "telegram" | "slack" | "multi";

export type AdminConversation = {
  id: string;
  channel: ChannelType;
  displayLabel?: string;
  sessionId: string;
  userId?: string | null;
  profileId?: string | null;
  conversationIds?: string[];
  primaryConversationId?: string;
  mode: ConversationMode;
  unreadCount: number;
  updatedAt: string;
  lastMessage?: {
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: string;
  };
};

export type AdminMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  channel?: string;
  metadata?: Record<string, unknown>;
};

export type AdminCannedResponse = {
  id: string;
  title: string;
  content: string;
};

export type AdminAnalytics = {
  channelBreakdown: Array<{ channel: string; count: number }>;
  peakHours: Array<{ hour: number; count: number }>;
  averageResponseMs: number;
};

export type UploadedKnowledgeDocument = {
  id: string;
  title: string;
  chunks: number;
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const adminToken = process.env.NEXT_PUBLIC_ADMIN_API_TOKEN ?? "dev-admin-token";

function adminHeaders(contentType = false): HeadersInit {
  const token = getAuthToken();
  return {
    ...(contentType ? { "Content-Type": "application/json" } : {}),
    "x-admin-token": adminToken,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export async function getConversations(): Promise<AdminConversation[]> {
  const response = await fetch(`${apiBase}/api/admin/conversations`, {
    cache: "no-store",
    headers: adminHeaders()
  });
  if (!response.ok) {
    throw new Error("Failed to load conversations.");
  }
  const data = await response.json();
  return data.conversations;
}

export async function getConversationMessages(conversationId: string): Promise<AdminMessage[]> {
  const response = await fetch(`${apiBase}/api/admin/conversations/${conversationId}/messages`, {
    cache: "no-store",
    headers: adminHeaders()
  });
  if (!response.ok) {
    throw new Error("Failed to load messages.");
  }
  const data = await response.json();
  return data.messages;
}

export async function setConversationMode(conversationId: string, mode: ConversationMode): Promise<AdminConversation> {
  const response = await fetch(`${apiBase}/api/admin/conversations/${conversationId}/mode`, {
    method: "PATCH",
    headers: adminHeaders(true),
    body: JSON.stringify({ mode })
  });
  if (!response.ok) {
    throw new Error("Failed to update conversation mode.");
  }
  const data = await response.json();
  return data.conversation;
}

export async function sendAdminReply(conversationId: string, text: string): Promise<AdminMessage> {
  const response = await fetch(`${apiBase}/api/admin/conversations/${conversationId}/reply`, {
    method: "POST",
    headers: adminHeaders(true),
    body: JSON.stringify({ text })
  });
  if (!response.ok) {
    throw new Error("Failed to send admin reply.");
  }
  const data = await response.json();
  return data.message;
}

export async function getCannedResponses(): Promise<AdminCannedResponse[]> {
  const response = await fetch(`${apiBase}/api/admin/canned-responses`, {
    cache: "no-store",
    headers: adminHeaders()
  });
  if (!response.ok) {
    throw new Error("Failed to load canned responses.");
  }
  const data = await response.json();
  return data.cannedResponses;
}

export async function getAnalytics(): Promise<AdminAnalytics> {
  const response = await fetch(`${apiBase}/api/admin/analytics`, {
    cache: "no-store",
    headers: adminHeaders()
  });
  if (!response.ok) {
    throw new Error("Failed to load analytics.");
  }
  return (await response.json()) as AdminAnalytics;
}

export async function uploadKnowledgeDocument(file: File): Promise<UploadedKnowledgeDocument> {
  const formData = new FormData();
  formData.append("file", file);
  const token = getAuthToken();

  const response = await fetch(`${apiBase}/api/admin/knowledge/upload`, {
    method: "POST",
    headers: {
      "x-admin-token": adminToken,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error("Failed to upload knowledge document.");
  }

  const data = await response.json();
  return data.document as UploadedKnowledgeDocument;
}
