"use client";

import { MessageCircle, SendHorizontal, X } from "lucide-react";
import DOMPurify from "dompurify";
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Button } from "./ui/button";
import { getAuthUser } from "../lib/auth";
import { loadHistory, sendMessage, type ChatMessage } from "../lib/chat-api";

function sessionIdForUser(userId: string): string {
  return `web-user:${userId}`;
}

export function ChatWidget({
  initialOpen = false,
  layout = "floating"
}: {
  initialOpen?: boolean;
  layout?: "floating" | "centered";
}) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const syncAuthState = () => {
      const authUser = getAuthUser();
      if (!authUser) {
        setIsAuthenticated(false);
        setSessionId("");
        setMessages([]);
        return;
      }
      setIsAuthenticated(true);
      const id = sessionIdForUser(authUser.id);
      setSessionId(id);
      loadHistory().then(setMessages).catch(() => setMessages([]));
    };

    syncAuthState();
    window.addEventListener("storage", syncAuthState);
    window.addEventListener("focus", syncAuthState);
    return () => {
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener("focus", syncAuthState);
    };
  }, []);

  useEffect(() => {
    if (initialOpen) {
      setIsOpen(true);
    }
  }, [initialOpen]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    const socket = io(apiBase, { transports: ["websocket"] });
    socket.emit("web:join", { sessionId });
    socket.on("web:message", (message: ChatMessage) => {
      setMessages((previous) => {
        const alreadyExists = previous.some((item) => item.id && message.id && item.id === message.id);
        if (alreadyExists) {
          return previous;
        }
        return [...previous, message];
      });
    });
    return () => {
      socket.disconnect();
    };
  }, [apiBase, sessionId]);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, isSending]);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  function renderSafeHtml(content: string) {
    return {
      __html: DOMPurify.sanitize(content, {
        ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "br", "p", "ul", "ol", "li", "a", "code", "pre"],
        ALLOWED_ATTR: ["href", "target", "rel"]
      })
    };
  }

  async function handleSend() {
    if (!isAuthenticated || !canSend || !sessionId) return;
    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);
    try {
      const assistantReply = await sendMessage({
        sessionId,
        text: userMessage.content
      });
      setMessages((prev) => {
        const alreadyExists = prev.some((item) => item.id && assistantReply.id && item.id === assistantReply.id);
        if (alreadyExists) {
          return prev;
        }
        return [...prev, assistantReply];
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I hit a temporary issue. Please try again." }
      ]);
    } finally {
      setIsSending(false);
    }
  }

  if (!isAuthenticated) {
    return null;
  }

  const isCentered = layout === "centered";

  return (
    <div
      className={
        isCentered
          ? "mx-auto flex w-full max-w-4xl items-center justify-center px-3 py-4 sm:px-6"
          : "fixed bottom-4 right-4 z-50 sm:bottom-5 sm:right-5"
      }
    >
      {isOpen && (
        <div
          className={
            isCentered
              ? "glass neon-ring flex h-[min(82vh,760px)] w-full flex-col overflow-hidden rounded-3xl shadow-glass"
              : "glass neon-ring mb-3 flex h-[min(78vh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl shadow-glass sm:mb-4 sm:h-[520px] sm:w-[360px]"
          }
        >
          <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-cyan-300 sm:text-base">Omnichannel AI</p>
              <p className="text-xs text-slate-400">One Brain, Many Voices</p>
            </div>
            {!isCentered && (
              <Button onClick={() => setIsOpen(false)} variant="ghost" size="icon" className="rounded-full">
                <X size={16} />
              </Button>
            )}
          </div>

          <div ref={messagesRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-5">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm sm:max-w-[80%] ${
                  message.role === "user"
                    ? "ml-auto bg-cyan-500/20 text-cyan-100"
                    : "mr-auto bg-slate-800/90 text-slate-100"
                }`}
              >
                <div dangerouslySetInnerHTML={renderSafeHtml(message.content)} />
              </div>
            ))}
            {isSending && <div className="text-xs text-slate-400">AI is thinking...</div>}
          </div>

          <div className="border-t border-slate-700/60 p-3 sm:p-4">
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

      {!isCentered && (
        <Button
          variant="ghost"
          size="icon"
          className="glass neon-ring flex h-12 w-12 items-center justify-center rounded-full text-cyan-300 shadow-glass sm:h-14 sm:w-14"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <MessageCircle size={20} />
        </Button>
      )}
    </div>
  );
}
