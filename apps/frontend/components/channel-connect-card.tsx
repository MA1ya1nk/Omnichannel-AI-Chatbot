"use client";

import { CheckCircle2, Link2, Loader2, Smartphone, Webhook } from "lucide-react";
import { useEffect, useState } from "react";
import { createSlackConnectLink, createTelegramConnectLink, getConnections } from "../lib/connections-api";

export function ChannelConnectCard() {
  const [connections, setConnections] = useState<{ web: boolean; telegram: boolean; slack: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<"" | "telegram" | "slack">("");
  const [error, setError] = useState("");

  useEffect(() => {
    getConnections()
      .then((data) => {
        setConnections(data);
      })
      .catch(() => setError("Unable to load channel connection status."))
      .finally(() => setLoading(false));
  }, []);

  async function onTelegramConnect() {
    try {
      setWorking("telegram");
      const link = await createTelegramConnectLink();
      window.open(link, "_blank", "noopener,noreferrer");
    } catch {
      setError("Unable to start Telegram connect flow.");
    } finally {
      setWorking("");
    }
  }

  async function onSlackConnect() {
    try {
      setWorking("slack");
      const link = await createSlackConnectLink();
      window.open(link, "_blank", "noopener,noreferrer");
    } catch {
      setError("Unable to start Slack connect flow.");
    } finally {
      setWorking("");
    }
  }

  const telegramConnected = Boolean(connections?.telegram);
  const slackConnected = Boolean(connections?.slack);

  return (
    <section className="glass neon-ring mt-6 rounded-2xl p-4 sm:p-5">
      <h2 className="mb-1 text-sm font-semibold text-cyan-200 sm:text-base">Connected Channels</h2>
      <p className="mb-4 text-xs text-slate-400">
        Connect channels once and continue the same AI conversation across web, Telegram, and Slack.
      </p>

      {loading ? (
        <div className="text-xs text-slate-400">Loading channel status...</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/45 p-3">
            <div className="mb-2 flex items-center gap-2 text-slate-100">
              <Smartphone className="h-4 w-4 text-sky-300" />
              Telegram
            </div>
            <p className="mb-3 text-xs text-slate-400">
              {telegramConnected ? "Connected to your account." : "Not connected yet."}
            </p>
            <button
              onClick={onTelegramConnect}
              disabled={telegramConnected || working !== ""}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-100 disabled:opacity-60"
            >
              {working === "telegram" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              {telegramConnected ? "Connected" : "Connect Telegram"}
            </button>
          </div>

          <div className="rounded-xl border border-slate-700/60 bg-slate-900/45 p-3">
            <div className="mb-2 flex items-center gap-2 text-slate-100">
              <Webhook className="h-4 w-4 text-violet-300" />
              Slack
            </div>
            <p className="mb-3 text-xs text-slate-400">{slackConnected ? "Connected to your account." : "Not connected yet."}</p>
            <button
              onClick={onSlackConnect}
              disabled={slackConnected || working !== ""}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-100 disabled:opacity-60"
            >
              {working === "slack" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              {slackConnected ? "Connected" : "Connect Slack"}
            </button>
          </div>
        </div>
      )}

      {(telegramConnected || slackConnected) && (
        <p className="mt-3 inline-flex items-center gap-2 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          Channel linking is active for your account.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </section>
  );
}
