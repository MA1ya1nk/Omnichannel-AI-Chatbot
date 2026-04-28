import { Bot, Sparkles } from "lucide-react";
import { ChatWidget } from "../components/chat-widget";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-6 py-12">
      <section className="glass w-full max-w-5xl rounded-3xl p-10 shadow-glass">
        <div className="mb-8 flex items-center gap-3 text-cyan-300">
          <Bot className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Omnichannel AI Command Center</h1>
        </div>
        <p className="max-w-2xl text-slate-300">
          Phase 1 is live: one unified Mistral-powered brain connected to the web chat widget, with persistent
          conversation memory in PostgreSQL.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {["Unified Brain", "Realtime Ready", "Cross-Channel Renderer"].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4">
              <div className="mb-2 flex items-center gap-2 text-cyan-200">
                <Sparkles className="h-4 w-4" />
                <h2 className="text-sm font-medium">{item}</h2>
              </div>
              <p className="text-xs text-slate-400">Built for scalable, multi-channel orchestration.</p>
            </div>
          ))}
        </div>
      </section>
      <ChatWidget />
    </main>
  );
}
