"use client";

import {
  ArrowRight,
  Bot,
  ChartNoAxesCombined,
  CheckCircle2,
  CreditCard,
  Layers,
  Lock,
  LogIn,
  LogOut,
  Menu,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Sparkles,
  UserPlus
} from "lucide-react";
import { useEffect, useState } from "react";
import { ChannelConnectCard } from "../components/channel-connect-card";
import { ChatWidget } from "../components/chat-widget";
import { clearAuthSession, getAuthUser, type AuthUser } from "../lib/auth";

const featureCards = [
  {
    title: "Unified Intelligence",
    description: "One AI brain handles website, Telegram, and Slack with shared context and behavior.",
    icon: Sparkles
  },
  {
    title: "Identity-Linked Sessions",
    description: "Each authenticated user keeps a private, isolated conversation history.",
    icon: ShieldCheck
  },
  {
    title: "Human Handoff Controls",
    description: "Switch from AI to human mode instantly from the unified admin inbox.",
    icon: Settings
  },
  {
    title: "Realtime Operations",
    description: "Socket-powered updates keep admins and users in sync without refresh.",
    icon: Layers
  }
];

const highlights = [
  "Secure user-specific chat isolation",
  "Admin analytics and audit visibility",
  "Channel-ready response rendering",
  "Knowledge-base assisted answers"
];

const signedInShortcuts = [
  {
    title: "Continue Conversation",
    description: "Jump back into your assistant with persistent context from your latest session.",
    href: "/widget",
    icon: MessageSquareText,
    cta: "Open Chat"
  },
  {
    title: "Review Analytics",
    description: "Track channel volume, peak activity, and average response performance in realtime.",
    href: "/admin/analytics",
    icon: ChartNoAxesCombined,
    cta: "View Analytics"
  },
  {
    title: "Operate Inbox",
    description: "Monitor live conversations, switch to human mode, and send guided manual replies.",
    href: "/admin",
    icon: Layers,
    cta: "Open Inbox"
  }
];

const ALLOWED_ADMIN_EMAIL = "mk20040307@gmail.com";

export default function HomePage() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const isAdminUser = authUser?.email?.toLowerCase() === ALLOWED_ADMIN_EMAIL;

  useEffect(() => {
    setAuthUser(getAuthUser());
    setHydrated(true);
  }, []);

  function handleLogout() {
    clearAuthSession();
    setAuthUser(null);
    window.location.href = "/";
  }

  if (!hydrated) {
    return (
      <main className="relative min-h-screen overflow-x-hidden px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <section className="mx-auto w-full max-w-6xl">
          <article className="glass neon-ring rounded-3xl p-8 text-center">
            <p className="text-sm text-slate-300">Loading workspace...</p>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-0 top-0 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-0 top-28 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
      </div>

      <nav className="glass neon-ring sticky top-3 z-40 mx-auto mb-8 flex w-full max-w-6xl items-center justify-between rounded-2xl px-4 py-3 transition-all duration-300 hover:shadow-glass sm:px-5">
        <div className="flex items-center gap-2 text-cyan-200">
          <Bot className="h-5 w-5" />
          <span className="text-sm font-semibold sm:text-base">Omnichannel AI</span>
        </div>

        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          {hydrated && isAdminUser && (
            <a
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/80 px-3 py-1.5 text-xs text-slate-100 transition hover:border-cyan-400 hover:text-cyan-200"
            >
              <ChartNoAxesCombined className="h-3.5 w-3.5" />
              Admin
            </a>
          )}
          {hydrated && !authUser && (
            <>
              <a
                href="/signin"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/80 px-3 py-1.5 text-xs text-slate-100 transition hover:border-cyan-400 hover:text-cyan-200"
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign In
              </a>
              <a
                href="/signup"
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Create Account
              </a>
            </>
          )}
          {hydrated && authUser && (
            <>
              <a
                href="/widget"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/80 px-3 py-1.5 text-xs text-slate-100 transition hover:border-cyan-400 hover:text-cyan-200"
              >
                <MessageSquareText className="h-3.5 w-3.5" />
                Chat
              </a>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </>
          )}
        </div>

        <details className="relative sm:hidden">
          <summary className="list-none cursor-pointer rounded-lg border border-slate-600/80 px-2.5 py-1.5 text-slate-100 transition hover:border-cyan-400 hover:text-cyan-200">
            <Menu className="h-4 w-4" />
          </summary>
          <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-700/80 bg-slate-900/95 p-2 shadow-glass">
            <div className="flex flex-col gap-1.5 text-xs">
              {hydrated && isAdminUser && (
                <a
                  href="/admin"
                  className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-slate-100 transition hover:bg-slate-800/80"
                >
                  <ChartNoAxesCombined className="h-3.5 w-3.5" />
                  Admin
                </a>
              )}
              {hydrated && !authUser && (
                <>
                  <a
                    href="/signin"
                    className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-slate-100 transition hover:bg-slate-800/80"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    Sign In
                  </a>
                  <a
                    href="/signup"
                    className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-slate-100 transition hover:bg-slate-800/80"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Create Account
                  </a>
                </>
              )}
              {hydrated && authUser && (
                <>
                  <a
                    href="/widget"
                    className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-slate-100 transition hover:bg-slate-800/80"
                  >
                    <MessageSquareText className="h-3.5 w-3.5" />
                    Chat
                  </a>
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-slate-100 transition hover:bg-slate-800/80"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </button>
                </>
              )}
            </div>
          </div>
        </details>
      </nav>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        {authUser ? (
          <>
            <article className="glass neon-ring rounded-3xl p-6 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-glass sm:p-8 lg:p-12">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Signed in workspace
              </div>
              <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
                <div>
                  <h1 className="text-3xl font-semibold leading-tight text-slate-100 sm:text-4xl lg:text-5xl">
                    Welcome back, {authUser.name || "Operator"}.
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm text-slate-300 sm:text-base">
                    Your workspace is ready with live channel conversations, identity-linked context, and knowledge-based
                    responses. Pick where you want to continue.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href="/widget"
                      className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                    >
                      Continue Chat
                      <ArrowRight className="h-4 w-4" />
                    </a>
                    {isAdminUser && (
                      <a
                        href="/admin"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-600/80 px-4 py-2 text-sm text-slate-100 transition hover:border-cyan-400 hover:text-cyan-200"
                      >
                        <ChartNoAxesCombined className="h-4 w-4" />
                        Open Control Center
                      </a>
                    )}
                  </div>
                  <p className="mt-4 text-xs text-cyan-100">Signed in as {authUser.email}</p>
                </div>
                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/40 p-5">
                  <h2 className="mb-3 text-sm font-medium text-cyan-200">Live readiness status</h2>
                  <ul className="space-y-2 text-xs text-slate-300 sm:text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                      <span>Session restored with secure identity context.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                      <span>Realtime message sync active for web and admin panels.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                      <span>RAG-assisted answers available from uploaded documents.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </article>

            <article className={`grid gap-4 ${isAdminUser ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
              {(isAdminUser ? signedInShortcuts : signedInShortcuts.filter((item) => item.href !== "/admin")).map(
                (item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      href={item.href}
                      key={item.title}
                      className="glass rounded-2xl border border-slate-700/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/60"
                    >
                      <div className="mb-3 inline-flex rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-2 text-cyan-200">
                        <Icon className="h-4 w-4" />
                      </div>
                      <h3 className="text-base font-semibold text-slate-100">{item.title}</h3>
                      <p className="mt-2 text-sm text-slate-400">{item.description}</p>
                      <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-cyan-200">
                        {item.cta}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </a>
                  );
                }
              )}
            </article>
            <ChannelConnectCard />
          </>
        ) : (
          <>
            <article className="glass neon-ring rounded-3xl p-6 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-glass sm:p-8 lg:p-12">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" />
                Enterprise-grade omnichannel assistant platform
              </div>
              <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
                <div>
                  <h1 className="text-3xl font-semibold leading-tight text-slate-100 sm:text-4xl lg:text-5xl">
                    Build trusted conversations across every channel, with one unified AI core.
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm text-slate-300 sm:text-base">
                    Omnichannel AI delivers structured customer interactions, realtime support workflows, and clean identity
                    separation so every user sees only their own data.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href="/signup"
                      className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                    >
                      Start Free
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/40 p-5">
                  <h2 className="mb-3 text-sm font-medium text-cyan-200">Why teams choose this stack</h2>
                  <ul className="space-y-2 text-xs text-slate-300 sm:text-sm">
                    {highlights.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 rounded-xl border border-slate-700/70 bg-slate-950/50 p-3 text-xs text-slate-300">
                    <p className="mb-1 font-medium text-slate-100">Operational status</p>
                    <p className="text-slate-400">Web, Slack, Telegram integrations + secure auth flows active.</p>
                  </div>
                </div>
              </div>
            </article>

            <article className="grid gap-4 sm:grid-cols-2">
              {featureCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="glass rounded-2xl border border-slate-700/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/60"
                  >
                    <div className="mb-3 inline-flex rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-2 text-cyan-200">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-100">{card.title}</h3>
                    <p className="mt-2 text-sm text-slate-400">{card.description}</p>
                  </div>
                );
              })}
            </article>

            <article className="glass rounded-3xl border border-slate-700/60 p-6 transition-all duration-300 hover:border-cyan-400/40 sm:p-8">
              <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Structured Journey</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-4">
                  <LogIn className="mb-2 h-5 w-5 text-cyan-300" />
                  <h3 className="text-sm font-medium text-slate-100">1. Authenticate</h3>
                  <p className="mt-1 text-xs text-slate-400">User signs in with secure identity and private session binding.</p>
                </div>
                <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-4">
                  <MessageSquareText className="mb-2 h-5 w-5 text-cyan-300" />
                  <h3 className="text-sm font-medium text-slate-100">2. Engage</h3>
                  <p className="mt-1 text-xs text-slate-400">AI responds with channel-ready formatting and persistent memory.</p>
                </div>
                <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-4">
                  <CreditCard className="mb-2 h-5 w-5 text-cyan-300" />
                  <h3 className="text-sm font-medium text-slate-100">3. Scale</h3>
                  <p className="mt-1 text-xs text-slate-400">Monitor analytics, handoff to human, and optimize operations.</p>
                </div>
              </div>
            </article>

            <article className="glass rounded-3xl border border-slate-700/60 p-6 text-center sm:p-8">
              <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                <Lock className="h-3.5 w-3.5" />
                Privacy-first by design
              </div>
              <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">
                Every user gets an isolated chat workspace.
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400">
                Secure identity controls ensure users can only access their own conversation history and message stream.
              </p>
            </article>
          </>
        )}
      </section>
      <ChatWidget />
    </main>
  );
}
