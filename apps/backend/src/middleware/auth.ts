import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env.js";

export type AuthUser = {
  userId: string;
  email: string;
  profileId: string;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ error: "Missing auth token." });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser & jwt.JwtPayload;
    req.authUser = {
      userId: payload.userId,
      email: payload.email,
      profileId: payload.profileId
    };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired auth token." });
  }
}
