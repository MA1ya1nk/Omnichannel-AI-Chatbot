import { z } from "zod";

const webMessageSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().optional(),
  text: z.string().min(1),
  metadata: z.record(z.unknown()).optional()
});

export type NormalizedMessage = {
  channel: "web";
  sessionId: string;
  userId?: string;
  text: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export function normalizeWebMessage(payload: unknown): NormalizedMessage {
  const parsed = webMessageSchema.parse(payload);

  return {
    channel: "web",
    sessionId: parsed.sessionId,
    userId: parsed.userId,
    text: parsed.text.trim(),
    timestamp: new Date().toISOString(),
    metadata: parsed.metadata
  };
}
