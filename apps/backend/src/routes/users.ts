import { Router } from "express";
import { z } from "zod";
import { linkUserIdentities } from "../services/identity-service.js";
import { requireAuth } from "../middleware/auth.js";
import { createLinkToken, consumeValidLinkToken } from "../services/link-token-service.js";
import { env } from "../env.js";
import { prisma } from "../prisma.js";

const router = Router();

const linkSchema = z.object({
  email: z.string().email().optional(),
  canonicalKey: z.string().min(1).optional(),
  links: z
    .array(
      z.object({
        channel: z.enum(["web", "telegram", "slack", "whatsapp"]),
        externalUserId: z.string().min(1)
      })
    )
    .min(1)
});

router.post("/link", async (req, res, next) => {
  try {
    const payload = linkSchema.parse(req.body);
    const canonicalKey = payload.email?.toLowerCase() ?? payload.canonicalKey?.trim().toLowerCase();

    if (!canonicalKey) {
      return res.status(400).json({ error: "Either email or canonicalKey is required." });
    }

    const profileId = await linkUserIdentities({
      canonicalKey,
      links: payload.links
    });

    return res.status(201).json({
      profileId,
      canonicalKey
    });
  } catch (error) {
    next(error);
  }
});

const selfLinkSchema = z.object({
  links: z
    .array(
      z.object({
        channel: z.enum(["telegram", "slack"]),
        externalUserId: z.string().min(1)
      })
    )
    .min(1)
});

router.post("/me/link", requireAuth, async (req, res, next) => {
  try {
    const payload = selfLinkSchema.parse(req.body);
    const authUser = req.authUser;
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    const canonicalKey = authUser.email.toLowerCase();
    const profileId = await linkUserIdentities({
      canonicalKey,
      links: [
        ...payload.links,
        {
          channel: "web",
          externalUserId: authUser.userId
        }
      ]
    });
    return res.status(201).json({ profileId, canonicalKey });
  } catch (error) {
    next(error);
  }
});

router.get("/me/connections", requireAuth, async (req, res, next) => {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized." });
    }

    const identities = await prisma.channelIdentity.findMany({
      where: {
        profile: {
          authUsers: {
            some: {
              id: authUser.userId
            }
          }
        }
      }
    });

    const connected = new Set(identities.map((identity) => identity.channel));
    return res.json({
      connections: {
        web: true,
        telegram: connected.has("telegram"),
        slack: connected.has("slack")
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/me/connect/telegram", requireAuth, async (req, res, next) => {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    const link = await createLinkToken({
      userId: authUser.userId,
      channel: "telegram"
    });
    const botUsername = env.TELEGRAM_BOT_USERNAME || "your_bot_username";
    return res.json({
      token: link.token,
      deepLink: `https://t.me/${botUsername}?start=${link.token}`
    });
  } catch (error) {
    next(error);
  }
});

router.post("/me/connect/slack/start", requireAuth, async (req, res, next) => {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    if (!env.SLACK_CLIENT_ID || !env.SLACK_REDIRECT_URI) {
      return res.status(503).json({ error: "Slack OAuth is not configured." });
    }
    const link = await createLinkToken({
      userId: authUser.userId,
      channel: "slack"
    });

    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      user_scope: "chat:write",
      redirect_uri: env.SLACK_REDIRECT_URI,
      state: link.token
    });
    return res.json({
      authUrl: `https://slack.com/oauth/v2/authorize?${params.toString()}`
    });
  } catch (error) {
    next(error);
  }
});

async function disconnectChannelForUser(input: { appUserId: string; channel: "telegram" | "slack" }) {
  const appUser = await prisma.appUser.findUnique({
    where: { id: input.appUserId },
    select: { profileId: true }
  });

  if (!appUser) {
    return { disconnected: false };
  }

  const identities = await prisma.channelIdentity.findMany({
    where: {
      profileId: appUser.profileId,
      channel: input.channel
    },
    select: {
      externalUserId: true
    }
  });

  await prisma.channelIdentity.deleteMany({
    where: {
      profileId: appUser.profileId,
      channel: input.channel
    }
  });

  const externalIds = identities.map((identity) => identity.externalUserId);
  const sessionIds =
    input.channel === "slack"
      ? externalIds.map((externalId) => `slack-user:${externalId}`)
      : externalIds.map((externalId) => `telegram-user:${externalId}`);

  if (externalIds.length > 0 || sessionIds.length > 0) {
    await prisma.conversation.updateMany({
      where: {
        channel: input.channel,
        profileId: appUser.profileId,
        OR: [
          ...(externalIds.length > 0
            ? [
                {
                  userId: {
                    in: externalIds
                  }
                }
              ]
            : []),
          ...(sessionIds.length > 0
            ? [
                {
                  sessionId: {
                    in: sessionIds
                  }
                }
              ]
            : [])
        ]
      },
      data: {
        profileId: null
      }
    });
  }

  await prisma.linkToken.deleteMany({
    where: {
      userId: input.appUserId,
      channel: input.channel,
      usedAt: null
    }
  });

  return { disconnected: true };
}

router.post("/me/disconnect/telegram", requireAuth, async (req, res, next) => {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized." });
    }

    await disconnectChannelForUser({
      appUserId: authUser.userId,
      channel: "telegram"
    });

    return res.json({ disconnected: true, channel: "telegram" });
  } catch (error) {
    next(error);
  }
});

router.post("/me/disconnect/slack", requireAuth, async (req, res, next) => {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized." });
    }

    await disconnectChannelForUser({
      appUserId: authUser.userId,
      channel: "slack"
    });

    return res.json({ disconnected: true, channel: "slack" });
  } catch (error) {
    next(error);
  }
});

router.get("/connect/slack/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!code || !state) {
    return res.status(400).send("Invalid Slack callback.");
  }
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET || !env.SLACK_REDIRECT_URI) {
    return res.status(503).send("Slack OAuth is not configured.");
  }

  const consumed = await consumeValidLinkToken(state, "slack");
  if (!consumed) {
    return res.status(400).send("Expired or invalid Slack link session.");
  }

  const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      redirect_uri: env.SLACK_REDIRECT_URI
    })
  });

  const tokenPayload = (await tokenResponse.json()) as {
    ok: boolean;
    authed_user?: { id?: string };
  };

  if (!tokenPayload.ok || !tokenPayload.authed_user?.id) {
    return res.status(400).send("Slack authorization failed.");
  }

  const appUser = await prisma.appUser.findUnique({ where: { id: consumed.userId } });
  if (!appUser) {
    return res.status(404).send("User not found.");
  }

  await linkUserIdentities({
    canonicalKey: appUser.email.toLowerCase(),
    links: [
      { channel: "web", externalUserId: appUser.id },
      { channel: "slack", externalUserId: tokenPayload.authed_user.id }
    ]
  });

  return res.redirect(`${env.APP_BASE_URL}?connected=slack`);
});

export default router;
