import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { env } from "../env.js";

const router = Router();
const jwtExpiresIn = env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"];

const signUpSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email(),
  password: z.string().min(6)
});

router.post("/signup", async (req, res, next) => {
  try {
    const payload = signUpSchema.parse(req.body);
    const email = payload.email.toLowerCase();

    const existing = await prisma.appUser.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email already registered." });
    }

    const profile = await prisma.userProfile.create({
      data: {
        canonicalKey: email,
        displayName: payload.name ?? email
      }
    });

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = await prisma.appUser.create({
      data: {
        email,
        name: payload.name,
        passwordHash,
        profileId: profile.id
      }
    });

    await prisma.channelIdentity.upsert({
      where: {
        channel_externalUserId: {
          channel: "web",
          externalUserId: user.id
        }
      },
      update: {
        profileId: profile.id
      },
      create: {
        channel: "web",
        externalUserId: user.id,
        profileId: profile.id
      }
    });

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        profileId: user.profileId
      },
      env.JWT_SECRET,
      { expiresIn: jwtExpiresIn }
    );

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profileId: user.profileId
      }
    });
  } catch (error) {
    next(error);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post("/login", async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const email = payload.email.toLowerCase();
    const user = await prisma.appUser.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const isValid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        profileId: user.profileId
      },
      env.JWT_SECRET,
      { expiresIn: jwtExpiresIn }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profileId: user.profileId
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const userId = req.authUser?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    const user = await prisma.appUser.findUnique({
      where: { id: userId }
    });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profileId: user.profileId
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
