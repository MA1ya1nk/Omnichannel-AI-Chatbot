import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

function randomToken(prefix: string) {
  return `${prefix}_${crypto.randomBytes(16).toString("hex")}`;
}

export async function createLinkToken(input: {
  userId: string;
  channel: "telegram" | "slack";
  ttlMinutes?: number;
  metadata?: Record<string, unknown>;
}) {
  const ttlMinutes = input.ttlMinutes ?? 15;
  const token = randomToken(input.channel);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  return prisma.linkToken.create({
    data: {
      token,
      channel: input.channel,
      userId: input.userId,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      expiresAt
    }
  });
}

export async function consumeValidLinkToken(token: string, channel: "telegram" | "slack") {
  const link = await prisma.linkToken.findUnique({ where: { token } });
  if (!link || link.channel !== channel || link.usedAt || link.expiresAt.getTime() < Date.now()) {
    return null;
  }
  await prisma.linkToken.update({
    where: { id: link.id },
    data: { usedAt: new Date() }
  });
  return link;
}
