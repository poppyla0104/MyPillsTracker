/**
 * JWT authentication middleware and token utilities.
 * Extracts userId from the Bearer token and attaches it to the request.
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

// Extend Express Request to carry the authenticated user's ID
export interface AuthRequest extends Request {
  userId?: number;
}

/**
 * Middleware that verifies the JWT from the Authorization header.
 * Rejects requests without a valid token with 401.
 */
export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// Generate a JWT that expires in 7 days
export function signToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}
