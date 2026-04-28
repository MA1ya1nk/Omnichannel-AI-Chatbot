"use client";

import { MessageCircle, SendHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { loadHistory, sendMessage, type ChatMessage } from "../lib/chat-api";

function getSessionId(): string {
  const existing = localStorage.getItem("omnichannel_session_id");
  if (existing) return existing;
  const sessionId = crypto.randomUUID();
  localStorage.setItem("omnichannel_session_id", sessionId);
  return sessionId;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const id = getSessionId();
    setSessionId(id);
    loadHistory(id).then(setMessages).catch(() => setMessages([]));
  }, []);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  async function handleSend() {
    if (!canSend || !sessionId) return;
    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);
    try {
      const assistantReply = await sendMessage({
        sessionId,
        text: userMessage.content
      });
      setMessages((prev) => [...prev, assistantReply]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I hit a temporary issue. Please try again." }
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {isOpen && (
        <div className="glass mb-4 flex h-[520px] w-[360px] flex-col overflow-hidden rounded-2xl shadow-glass">
          <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-cyan-300">Omnichannel AI</p>
              <p className="text-xs text-slate-400">One Brain, Many Voices</p>
            </div>
            <Button onClick={() => setIsOpen(false)} variant="ghost" size="icon" className="rounded-full">
              <X size={16} />
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "ml-auto bg-cyan-500/20 text-cyan-100"
                    : "mr-auto bg-slate-800/90 text-slate-100"
                }`}
              >
                {message.content}
              </div>
            ))}
            {isSending && <div className="text-xs text-slate-400">AI is thinking...</div>}
          </div>

          <div className="border-t border-slate-700/60 p-3">
            <div className="flex items-center gap-2">
              <input
                className="w-full rounded-xl border border-slate-600/70 bg-slate-900/70 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                placeholder="Ask anything..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSend();
                }}
              />
              <Button disabled={!canSend} onClick={handleSend} size="icon" className="rounded-xl">
                <SendHorizontal size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="glass flex h-14 w-14 items-center justify-center rounded-full text-cyan-300 shadow-glass"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <MessageCircle size={22} />
      </Button>
    </div>
  );
}
