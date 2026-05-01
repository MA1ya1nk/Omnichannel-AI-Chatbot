import { getAuthToken } from "./auth";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function authHeader() {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Not authenticated.");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

export async function getConnections() {
  const response = await fetch(`${apiBase}/api/users/me/connections`, {
    headers: authHeader(),
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error("Unable to fetch channel connections.");
  }
  const data = await response.json();
  return data.connections as { web: boolean; telegram: boolean; slack: boolean };
}

export async function createTelegramConnectLink() {
  const response = await fetch(`${apiBase}/api/users/me/connect/telegram`, {
    method: "POST",
    headers: authHeader()
  });
  if (!response.ok) {
    throw new Error("Unable to create Telegram connect link.");
  }
  const data = await response.json();
  return data.deepLink as string;
}

export async function createSlackConnectLink() {
  const response = await fetch(`${apiBase}/api/users/me/connect/slack/start`, {
    method: "POST",
    headers: authHeader()
  });
  if (!response.ok) {
    throw new Error("Unable to start Slack connect flow.");
  }
  const data = await response.json();
  return data.authUrl as string;
}

export async function disconnectTelegram() {
  const response = await fetch(`${apiBase}/api/users/me/disconnect/telegram`, {
    method: "POST",
    headers: authHeader()
  });
  if (!response.ok) {
    throw new Error("Unable to disconnect Telegram.");
  }
}

export async function disconnectSlack() {
  const response = await fetch(`${apiBase}/api/users/me/disconnect/slack`, {
    method: "POST",
    headers: authHeader()
  });
  if (!response.ok) {
    throw new Error("Unable to disconnect Slack.");
  }
}
