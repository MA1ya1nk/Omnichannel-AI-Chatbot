import { env } from "../env.js";

const requestBuckets = new Map<string, { count: number; windowStartMs: number }>();
const WINDOW_MS = 60_000;

export function isAuthorizedAdmin(token: string | undefined): boolean {
  return Boolean(token && token === env.ADMIN_API_TOKEN);
}

export function isAdminRateLimited(key: string): boolean {
  const now = Date.now();
  const existing = requestBuckets.get(key);
  if (!existing || now - existing.windowStartMs > WINDOW_MS) {
    requestBuckets.set(key, { count: 1, windowStartMs: now });
    return false;
  }

  existing.count += 1;
  if (existing.count > env.ADMIN_RATE_LIMIT_PER_MINUTE) {
    return true;
  }
  return false;
}
