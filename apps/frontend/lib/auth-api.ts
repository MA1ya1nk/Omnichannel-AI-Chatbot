import { setAuthSession, type AuthUser } from "./auth";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export async function signUp(input: { name?: string; email: string; password: string }) {
  const response = await fetch(`${apiBase}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    throw new Error("Unable to sign up.");
  }
  const data = await response.json();
  setAuthSession({ token: data.token, user: data.user as AuthUser });
  return data.user as AuthUser;
}

export async function signIn(input: { email: string; password: string }) {
  const response = await fetch(`${apiBase}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    throw new Error("Invalid credentials.");
  }
  const data = await response.json();
  setAuthSession({ token: data.token, user: data.user as AuthUser });
  return data.user as AuthUser;
}
