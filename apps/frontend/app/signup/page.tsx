"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signUp } from "../../lib/auth-api";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      setLoading(true);
      setError("");
      await signUp({ name, email, password });
      router.push("/");
    } catch {
      setError("Unable to create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="glass neon-ring w-full max-w-md rounded-3xl p-6 shadow-glass sm:p-8">
        <h1 className="mb-2 text-2xl font-semibold text-cyan-200">Create Account</h1>
        <p className="mb-6 text-sm text-slate-400">Get your personal AI chat identity across channels.</p>
        <form className="space-y-3" onSubmit={onSubmit}>
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm outline-none focus:border-cyan-400"
            placeholder="Name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
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
            placeholder="Password (min 6)"
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
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>
        <p className="mt-4 text-xs text-slate-400">
          Already have account?{" "}
          <a className="text-cyan-300 hover:underline" href="/signin">
            Sign in
          </a>
        </p>
      </section>
    </main>
  );
}
