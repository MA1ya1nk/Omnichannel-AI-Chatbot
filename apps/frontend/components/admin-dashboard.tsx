"use client";

import {
  AlertCircle,
  Bot,
  MessageSquare,
  SendHorizontal,
  Smartphone,
  ToggleLeft,
  ToggleRight,
  Webhook
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  type AdminConversation,
  type AdminCannedResponse,
  type AdminMessage,
  getCannedResponses,
  getConversationMessages,
  getConversations,
  uploadKnowledgeDocument,
  sendAdminReply,
  setConversationMode
} from "../lib/admin-api";
import { Button } from "./ui/button";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function channelIcon(channel: string) {
  if (channel === "multi") return <Bot className="h-4 w-4 text-indigo-300" />;
  if (channel === "telegram") return <Smartphone className="h-4 w-4 text-sky-300" />;
  if (channel === "slack") return <Webhook className="h-4 w-4 text-violet-300" />;
  return <MessageSquare className="h-4 w-4 text-cyan-300" />;
}

function modeBadge(mode: "ai" | "human") {
  return mode === "human" ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/20 text-emerald-200";
}

export function AdminDashboard() {
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [text, setText] = useState("");
  const [cannedResponses, setCannedResponses] = useState<AdminCannedResponse[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null);
  const [uploadingKnowledge, setUploadingKnowledge] = useState(false);
  const [knowledgeStatus, setKnowledgeStatus] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  useEffect(() => {
    getConversations().then((data) => {
      setConversations(data);
      if (data.length > 0) {
        setSelectedId(data[0].id);
      }
    });
    getCannedResponses().then(setCannedResponses).catch(() => setCannedResponses([]));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    getConversationMessages(selectedId).then(setMessages).catch(() => setMessages([]));
  }, [selectedId]);

  useEffect(() => {
    if (!messagesContainerRef.current) return;
    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
  }, [messages, selectedId]);

  useEffect(() => {
    const socketInstance = io(apiBase, { transports: ["websocket"] });
    socketInstance.on("conversation:updated", (conversation: AdminConversation) => {
      setConversations((previous) => {
        const rest = previous.filter((item) => item.id !== conversation.id);
        return [conversation, ...rest];
      });
    });
    socketInstance.on("conversation:message", (payload: { conversationId: string; message: AdminMessage }) => {
      if (payload.conversationId === selectedId) {
        setMessages((previous) => [...previous, payload.message]);
      }
    });
    return () => {
      socketInstance.disconnect();
    };
  }, [selectedId]);

  async function onToggleMode() {
    if (!selectedConversation) return;
    const nextMode = selectedConversation.mode === "ai" ? "human" : "ai";
    const updated = await setConversationMode(selectedConversation.id, nextMode);
    setConversations((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
    setError(null);
  }

  async function onSend() {
    if (!selectedConversation || !text.trim() || sending) return;
    try {
      setSending(true);
      await sendAdminReply(selectedConversation.id, text.trim());
      setText("");
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to send manual reply.");
    } finally {
      setSending(false);
    }
  }

  async function onUploadKnowledge() {
    if (!knowledgeFile || uploadingKnowledge) return;
    try {
      setUploadingKnowledge(true);
      const document = await uploadKnowledgeDocument(knowledgeFile);
      setKnowledgeStatus(`Uploaded ${document.title} (${document.chunks} chunks).`);
      setKnowledgeFile(null);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to upload knowledge document.");
    } finally {
      setUploadingKnowledge(false);
    }
  }

  return (
    <main className="h-screen overflow-hidden p-4 md:p-8">
      <section className="glass mx-auto grid h-full w-full max-w-7xl gap-4 rounded-3xl p-4 shadow-glass md:grid-cols-[320px_1fr] md:p-6">
        <aside className="flex min-h-0 flex-col rounded-2xl border border-slate-700/60 bg-slate-950/30 p-3">
          <div className="mb-3 flex items-center gap-2 text-cyan-200">
            <Bot className="h-5 w-5" />
            <h1 className="text-base font-semibold">Unified Inbox</h1>
            <Link href="/admin/analytics" className="ml-auto text-xs text-cyan-300 hover:text-cyan-100">
              View Analytics
            </Link>
          </div>
          <div className="mb-3 rounded-xl border border-slate-700/60 bg-slate-900/40 p-2">
            <p className="mb-2 text-[11px] font-medium text-cyan-200">Knowledge Base (PDF)</p>
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => setKnowledgeFile(event.target.files?.[0] ?? null)}
              className="mb-2 block w-full text-xs text-slate-300 file:mr-2 file:rounded-md file:border-0 file:bg-cyan-500/20 file:px-2 file:py-1 file:text-xs file:text-cyan-100"
            />
            <Button className="w-full" onClick={onUploadKnowledge} disabled={!knowledgeFile || uploadingKnowledge}>
              {uploadingKnowledge ? "Uploading..." : "Upload PDF"}
            </Button>
            {knowledgeStatus && <p className="mt-2 text-[11px] text-emerald-300">{knowledgeStatus}</p>}
          </div>
          <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => setSelectedId(conversation.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                  selectedId === conversation.id
                    ? "border-cyan-400/70 bg-cyan-500/10"
                    : "border-slate-700/70 bg-slate-900/40 hover:border-slate-500"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {channelIcon(conversation.channel)}
                    <span className="text-xs uppercase text-slate-300">{conversation.channel}</span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${modeBadge(conversation.mode)}`}>
                    {conversation.mode.toUpperCase()}
                  </span>
                </div>
                <p className="line-clamp-1 text-sm text-slate-200">
                  {conversation.lastMessage?.content ?? "No messages yet"}
                </p>
              </button>
            ))}
          </div>
        </aside>

        <div className="flex min-h-0 flex-col rounded-2xl border border-slate-700/60 bg-slate-950/35">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/60 p-4">
            <div>
              <p className="text-sm text-slate-400">Conversation View</p>
              <h2 className="text-base font-semibold text-slate-100">
                {selectedConversation
                  ? selectedConversation.profileId
                    ? `Unified inbox: ${selectedConversation.profileId}`
                    : selectedConversation.sessionId
                  : "Select a conversation"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="gap-2" onClick={onToggleMode} disabled={!selectedConversation}>
                {selectedConversation?.mode === "human" ? (
                  <>
                    <ToggleRight className="h-4 w-4 text-amber-300" /> Human Mode ON
                  </>
                ) : (
                  <>
                    <ToggleLeft className="h-4 w-4 text-emerald-300" /> Human Mode OFF
                  </>
                )}
              </Button>
            </div>
          </header>
          {selectedConversation?.mode !== "human" && (
            <div className="flex items-center gap-2 border-b border-amber-400/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
              <AlertCircle className="h-4 w-4" />
              Enable Human Mode to send manual replies.
            </div>
          )}
          {error && (
            <div className="border-b border-rose-400/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">{error}</div>
          )}

          <div ref={messagesContainerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                  message.role === "user"
                    ? "mr-auto bg-slate-800/90 text-slate-100"
                    : "ml-auto bg-cyan-500/20 text-cyan-100"
                }`}
              >
                <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-400">
                  {channelIcon(selectedConversation?.channel ?? "web")}
                  <span>{message.role}</span>
                </div>
                {message.content}
              </div>
            ))}
          </div>

          <div className="border-t border-slate-700/60 p-4">
            <div className="mb-2 flex flex-wrap gap-2">
              {cannedResponses.map((response) => (
                <button
                  key={response.id}
                  type="button"
                  className="rounded-full border border-slate-600/70 px-3 py-1 text-xs text-slate-200 hover:border-cyan-400/80"
                  onClick={() => setText(response.content)}
                >
                  {response.title}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Type a manual response for the user..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              />
              <Button
                onClick={onSend}
                disabled={!selectedConversation || selectedConversation.mode !== "human" || !text.trim() || sending}
                size="icon"
              >
                <SendHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
