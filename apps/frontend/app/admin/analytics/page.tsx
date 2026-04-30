"use client";

import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { getAnalytics, type AdminAnalytics } from "../../../lib/admin-api";

const PIE_COLORS = ["#06b6d4", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444"];

function heatColor(value: number, max: number) {
  if (max <= 0) {
    return "#1e293b";
  }
  const intensity = Math.max(0.1, value / max);
  const alpha = Math.min(0.95, 0.2 + intensity * 0.75);
  return `rgba(34, 211, 238, ${alpha})`;
}

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAnalytics()
      .then((data) => {
        setAnalytics(data);
        setError(null);
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Failed to load analytics.");
      });
  }, []);

  const maxHourCount = useMemo(
    () => Math.max(...(analytics?.peakHours.map((item) => item.count) ?? [0])),
    [analytics]
  );

  return (
    <main className="min-h-screen p-4 md:p-8">
      <section className="glass mx-auto w-full max-w-7xl rounded-3xl p-6 shadow-glass">
        <h1 className="mb-2 text-2xl font-semibold text-cyan-200">Analytics Dashboard</h1>
        <p className="mb-6 text-sm text-slate-400">Messages per channel, peak hours heatmap, and response latency.</p>

        {error && <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
        {!analytics && !error && <p className="text-sm text-slate-400">Loading analytics...</p>}

        {analytics && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
              <h2 className="mb-3 text-sm font-medium text-cyan-200">Messages Per Channel</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={analytics.channelBreakdown} dataKey="count" nameKey="channel" outerRadius={90} label>
                      {analytics.channelBreakdown.map((entry, index) => (
                        <Cell key={entry.channel} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
              <h2 className="mb-3 text-sm font-medium text-cyan-200">Average Response Time</h2>
              <p className="text-4xl font-semibold text-slate-100">{Math.round(analytics.averageResponseMs / 1000)}s</p>
              <p className="mt-2 text-xs text-slate-400">Calculated as average delay from user message to assistant reply.</p>
            </div>

            <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4 md:col-span-2">
              <h2 className="mb-3 text-sm font-medium text-cyan-200">Peak Hours Heatmap</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.peakHours}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="hour" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip />
                    <Bar dataKey="count">
                      {analytics.peakHours.map((hour) => (
                        <Cell key={hour.hour} fill={heatColor(hour.count, maxHourCount)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
