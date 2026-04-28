export type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export async function loadHistory(sessionId: string): Promise<ChatMessage[]> {
  const response = await fetch(`${apiBase}/api/chat/history/${sessionId}`, {
    cache: "no-store"
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
  const response = await fetch(`${apiBase}/api/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error("Unable to send message.");
  }

  const data = await response.json();
  return data.message;
}
