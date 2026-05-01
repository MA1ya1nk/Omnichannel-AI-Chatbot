"use client";

import { useEffect, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { ChatWidget } from "../../components/chat-widget";
import { getAuthUser } from "../../lib/auth";

export default function WidgetPage() {
  const [authState, setAuthState] = useState<"loading" | "authenticated" | "guest">("loading");

  useEffect(() => {
    const syncAuth = () => {
      setAuthState(getAuthUser() ? "authenticated" : "guest");
    };
    syncAuth();
    window.addEventListener("storage", syncAuth);
    window.addEventListener("focus", syncAuth);
    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("focus", syncAuth);
    };
  }, []);

  if (authState === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <section className="glass neon-ring w-full max-w-md rounded-2xl p-6 text-center">
          <p className="text-sm text-slate-300">Loading your chat workspace...</p>
        </section>
      </main>
    );
  }

  if (authState === "guest") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <section className="glass neon-ring w-full max-w-md rounded-2xl p-6 text-center">
          <MessageSquareText className="mx-auto mb-3 h-6 w-6 text-cyan-300" />
          <h1 className="text-lg font-semibold text-slate-100">Sign in to access chat</h1>
          <p className="mt-2 text-sm text-slate-400">Your personal chat appears here after authentication.</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <a href="/signin" className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">
              Sign In
            </a>
            <a href="/signup" className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-100">
              Create Account
            </a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <section className="mx-auto mb-4 w-full max-w-4xl text-center">
        <h1 className="text-xl font-semibold text-cyan-200 sm:text-2xl">Your Personal Chat Workspace</h1>
        <p className="mt-1 text-sm text-slate-400">
          Ask questions, continue your history, and get responses in real time.
        </p>
      </section>
      <ChatWidget initialOpen layout="centered" />
    </main>
  );
}
