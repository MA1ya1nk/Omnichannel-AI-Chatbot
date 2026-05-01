import { env } from "../env.js";

const processedWebhookMessages = new Map<string, number>();
const ttlMs = env.WEBHOOK_IDEMPOTENCY_TTL_MS;

function pruneExpired(now: number) {
  for (const [key, expiresAt] of processedWebhookMessages.entries()) {
    if (expiresAt <= now) {
      processedWebhookMessages.delete(key);
    }
  }
}

export function isDuplicateWebhookMessage(id: string): boolean {
  const now = Date.now();
  pruneExpired(now);

  const existing = processedWebhookMessages.get(id);
  if (existing && existing > now) {
    return true;
  }

  processedWebhookMessages.set(id, now + ttlMs);
  return false;
}
