export type ConversationMode = "ai" | "human";

export type ConversationSummary = {
  id: string;
  channel: string;
  sessionId: string;
  userId?: string | null;
  profileId?: string | null;
  conversationIds?: string[];
  primaryConversationId?: string;
  mode: ConversationMode;
  lastMessage?: {
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: string;
  };
  unreadCount: number;
  updatedAt: string;
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};
