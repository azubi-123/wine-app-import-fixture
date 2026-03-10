import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users, authAttempts } from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { trackHostSignup } from "../audos-integration";

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_ATTEMPTS_PER_EMAIL = 5;
const MAX_ATTEMPTS_PER_IP = 20;

// Extend Express Request to include session
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    userEmail?: string;
  }
}

/**
 * Check if an email or IP has exceeded rate limits
 */
async function checkRateLimit(email: string, ipAddress: string | undefined): Promise<{ allowed: boolean; retryAfter?: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  // Check email rate limit
  const emailAttempts = await db
    .select({ count: sql<number>`count(*)` })
    .from(authAttempts)
    .where(
      and(
        eq(authAttempts.email, email.toLowerCase()),
        gte(authAttempts.attemptedAt, windowStart)
      )
    );

  if (Number(emailAttempts[0]?.count || 0) >= MAX_ATTEMPTS_PER_EMAIL) {
    // Find oldest attempt to calculate retry time
    const oldestAttempt = await db
      .select({ attemptedAt: authAttempts.attemptedAt })
      .from(authAttempts)
      .where(
        and(
          eq(authAttempts.email, email.toLowerCase()),
          gte(authAttempts.attemptedAt, windowStart)
        )
      )
      .orderBy(authAttempts.attemptedAt)
      .limit(1);

    if (oldestAttempt[0]) {
      const retryAfter = Math.ceil(
        (oldestAttempt[0].attemptedAt.getTime() + RATE_LIMIT_WINDOW_MS - Date.now()) / 1000
      );
      return { allowed: false, retryAfter };
    }
  }

  // Check IP rate limit if IP is available
  if (ipAddress) {
    const ipAttempts = await db
      .select({ count: sql<number>`count(*)` })
      .from(authAttempts)
      .where(
        and(
          eq(authAttempts.ipAddress, ipAddress),
          gte(authAttempts.attemptedAt, windowStart)
        )
      );

    if (Number(ipAttempts[0]?.count || 0) >= MAX_ATTEMPTS_PER_IP) {
      return { allowed: false, retryAfter: 3600 }; // 1 hour
    }
  }

  return { allowed: true };
}

/**
 * Log an auth attempt for rate limiting
 */
async function logAuthAttempt(email: string, ipAddress: string | undefined): Promise<void> {
  await db.insert(authAttempts).values({
    email: email.toLowerCase(),
    ipAddress: ipAddress || null
  });
}

/**
 * Clean up old auth attempts (call periodically)
 */
async function cleanupOldAttempts(): Promise<void> {
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS * 2); // 2 hours old
  await db.delete(authAttempts).where(
    sql`${authAttempts.attemptedAt} < ${cutoff}`
  );
}

/**
 * Middleware to require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

// Admin email whitelist - in production, this should be from database or env var
const ADMIN_EMAILS = new Set([
  process.env.ADMIN_EMAIL, // Primary admin from env
  // Add additional admin emails here or load from database
].filter(Boolean));

/**
 * Middleware to require admin privileges
 * Must be used after requireAuth
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId || !req.session?.userEmail) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // Check if user email is in admin list
  if (!ADMIN_EMAILS.has(req.session.userEmail)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}

/**
 * Register auth routes
 */
export function registerAuthRoutes(app: Express): void {
  // Login/Signup endpoint (email-only)
  app.post("/api/auth", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      // Validate email
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Basic email validation
      if (!normalizedEmail.includes("@") || normalizedEmail.length < 5) {
        return res.status(400).json({ error: "Invalid email address" });
      }

      // Get client IP
      const ipAddress = req.ip || req.socket.remoteAddress;

      // Check rate limit
      const rateLimit = await checkRateLimit(normalizedEmail, ipAddress);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          error: "Too many login attempts. Please try again later.",
          retryAfter: rateLimit.retryAfter
        });
      }

      // Log this attempt
      await logAuthAttempt(normalizedEmail, ipAddress);

      // Find or create user
      let user = await db.query.users.findFirst({
        where: eq(users.email, normalizedEmail)
      });

      if (!user) {
        // Create new user
        const [newUser] = await db.insert(users).values({
          email: normalizedEmail
        }).returning();
        user = newUser;
        trackHostSignup(normalizedEmail);
      }

      // Regenerate session to prevent session fixation attacks
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Set session data on the fresh session
      req.session.userId = user.id;
      req.session.userEmail = user.email;

      // Save session explicitly before responding (important for production reliability)
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Return user info (without sensitive data)
      return res.json({
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.error("Auth error:", error);
      return res.status(500).json({ error: "Authentication failed" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("cata.sid");
      return res.json({ success: true });
    });
  });

  // Get current user endpoint
  // Enhanced for agent-native access - returns full user state
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, req.session.userId)
      });

      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: "User not found" });
      }

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
          // Agent-native: include tasting level info for automated workflows
          tastingLevel: user.tastingLevel,
          tastingsCompleted: user.tastingsCompleted,
          levelUpPromptEligible: user.levelUpPromptEligible,
          onboardingCompleted: user.onboardingCompleted,
          onboardingData: user.onboardingData
        }
      });
    } catch (error) {
      console.error("Get user error:", error);
      return res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Periodic cleanup of old auth attempts (run every hour)
  setInterval(() => {
    cleanupOldAttempts().catch(console.error);
  }, 60 * 60 * 1000);
}
