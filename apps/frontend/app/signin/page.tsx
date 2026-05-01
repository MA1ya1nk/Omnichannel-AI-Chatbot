"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "../../lib/auth-api";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      setLoading(true);
      setError("");
      await signIn({ email, password });
      router.push("/");
    } catch {
      setError("Invalid credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="glass neon-ring w-full max-w-md rounded-3xl p-6 shadow-glass sm:p-8">
        <h1 className="mb-2 text-2xl font-semibold text-cyan-200">Sign In</h1>
        <p className="mb-6 text-sm text-slate-400">Access your personal omnichannel AI inbox.</p>
        <form className="space-y-3" onSubmit={onSubmit}>
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm outline-none focus:border-cyan-400"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm outline-none focus:border-cyan-400"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error && <p className="text-xs text-rose-300">{error}</p>}
          <button
            className="w-full rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="mt-4 text-xs text-slate-400">
          New user?{" "}
          <a className="text-cyan-300 hover:underline" href="/signup">
            Create account
          </a>
        </p>
      </section>
    </main>
  );
}
