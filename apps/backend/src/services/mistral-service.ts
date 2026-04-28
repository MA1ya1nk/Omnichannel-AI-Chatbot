import { Mistral } from "@mistralai/mistralai";
import { env } from "../env.js";

type HistoryMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ChatRequest = {
  userMessage: string;
  history: HistoryMessage[];
};

const apiKey = env.MISTRAL_API_KEY;
const model = env.MISTRAL_MODEL;

if (!apiKey) {
  throw new Error("Missing MISTRAL_API_KEY environment variable.");
}

const client = new Mistral({ apiKey });

async function retrieveContext(_query: string): Promise<string | null> {
  return null;
}

export async function generateAssistantReply(input: ChatRequest): Promise<string> {
  const context = await retrieveContext(input.userMessage);
  const systemPrompt = context
    ? `You are the unified AI brain for an omnichannel chatbot. Use this context when useful:\n${context}`
    : "You are the unified AI brain for an omnichannel chatbot. Reply clearly and helpfully.";

  const response = await client.chat.complete({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...input.history.map((message) => ({ role: message.role, content: message.content })),
      { role: "user", content: input.userMessage }
    ]
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    return "I could not generate a response right now. Please try again.";
  }

  if (typeof content === "string") {
    return content;
  }

  return content.map((part) => ("text" in part ? part.text : "")).join("\n").trim();
}
