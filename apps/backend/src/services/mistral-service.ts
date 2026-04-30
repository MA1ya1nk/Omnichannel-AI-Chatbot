import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatMistralAI } from "@langchain/mistralai";
import { env } from "../env.js";
import { retrieveKnowledgeContext } from "./knowledge-base.js";

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

const modelClient = new ChatMistralAI({
  apiKey,
  model,
  temperature: 0.2
});

const GraphState = Annotation.Root({
  userMessage: Annotation<string>,
  history: Annotation<HistoryMessage[]>,
  context: Annotation<string | null>,
  assistantText: Annotation<string>
});

async function retrieveContext(query: string): Promise<string | null> {
  try {
    return await retrieveKnowledgeContext(query);
  } catch {
    return null;
  }
}

async function contextNode(state: typeof GraphState.State) {
  const context = await retrieveContext(state.userMessage);
  return { context };
}

async function responseNode(state: typeof GraphState.State) {
  const systemPrompt = state.context
    ? `You are the unified AI brain for an omnichannel chatbot. Use this context when useful:\n${state.context}`
    : "You are the unified AI brain for an omnichannel chatbot. Reply clearly and helpfully. You may use clean HTML for formatting when useful.";

  const messageHistory = state.history.map((message) => {
    if (message.role === "assistant") {
      return new AIMessage(message.content);
    }
    if (message.role === "system") {
      return new SystemMessage(message.content);
    }
    return new HumanMessage(message.content);
  });

  const response = await modelClient.invoke([
    new SystemMessage(systemPrompt),
    ...messageHistory,
    new HumanMessage(state.userMessage)
  ]);

  const assistantText =
    typeof response.content === "string"
      ? response.content
      : response.content
          .map((part) => ("text" in part && typeof part.text === "string" ? part.text : ""))
          .join("\n")
          .trim();

  return {
    assistantText: assistantText || "I could not generate a response right now. Please try again."
  };
}

const orchestrationGraph = new StateGraph(GraphState)
  .addNode("retrieve_context", contextNode)
  .addNode("generate_response", responseNode)
  .addEdge(START, "retrieve_context")
  .addEdge("retrieve_context", "generate_response")
  .addEdge("generate_response", END)
  .compile();

export async function generateAssistantReply(input: ChatRequest): Promise<string> {
  const result = await orchestrationGraph.invoke({
    userMessage: input.userMessage,
    history: input.history,
    context: null,
    assistantText: ""
  });
  return result.assistantText;
}
