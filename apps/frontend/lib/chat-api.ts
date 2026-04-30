import { getAuthToken, getAuthUser } from "./auth";

export type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function authHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

export async function loadHistory(): Promise<ChatMessage[]> {
  const token = getAuthToken();
  if (!token) {
    return [];
  }
  const response = await fetch(`${apiBase}/api/chat/secure/history`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("Unable to load chat history.");
  }

  const data = await response.json();
  return data.messages;
}

export async function sendMessage(input: {
  sessionId: string;
  text: string;
}): Promise<ChatMessage> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Please sign in to use chat.");
  }
  const authUser = getAuthUser();
  const endpoint = "/api/chat/secure/message";

  const response = await fetch(`${apiBase}${endpoint}`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      ...input,
      userId: authUser?.id
    })
  });

  if (!response.ok) {
    throw new Error("Unable to send message.");
  }

  const data = await response.json();
  return data.message;
}
