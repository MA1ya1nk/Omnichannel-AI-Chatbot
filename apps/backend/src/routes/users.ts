import { Router } from "express";
import { z } from "zod";
import { linkUserIdentities } from "../services/identity-service.js";

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

export default router;
