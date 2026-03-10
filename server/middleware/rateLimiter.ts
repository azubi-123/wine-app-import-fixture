import type { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Simple in-memory rate limiter
// For production with multiple instances, use Redis-based rate limiting
class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    const keysToDelete: string[] = [];

    // Collect keys to delete (avoid iterator issues)
    this.limits.forEach((entry, key) => {
      if (now > entry.resetTime) {
        keysToDelete.push(key);
      }
    });

    // Delete expired entries
    keysToDelete.forEach(key => this.limits.delete(key));
  }

  isAllowed(key: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now > entry.resetTime) {
      // New window
      this.limits.set(key, { count: 1, resetTime: now + windowMs });
      return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
    }

    if (entry.count >= maxRequests) {
      return { allowed: false, remaining: 0, resetTime: entry.resetTime };
    }

    entry.count++;
    return { allowed: true, remaining: maxRequests - entry.count, resetTime: entry.resetTime };
  }
}

const rateLimiter = new RateLimiter();

interface RateLimitOptions {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  message?: string;      // Error message
  keyGenerator?: (req: Request) => string; // Custom key generator
}

/**
 * Create a rate limiting middleware
 */
export function createRateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    message = "Too many requests, please try again later",
    keyGenerator = (req: Request) => {
      // Use session userId if available, otherwise use IP
      const userId = req.session?.userId;
      return userId ? `user:${userId}` : `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    }
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const result = rateLimiter.isAllowed(key, maxRequests, windowMs);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

    if (!result.allowed) {
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
      });
      return;
    }

    next();
  };
}

// Pre-configured rate limiters for common use cases

/**
 * Rate limiter for AI/OpenAI endpoints (expensive operations)
 * 10 requests per minute per user
 */
export const aiRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: "AI rate limit exceeded. Please wait before making more AI requests."
});

/**
 * Rate limiter for general API endpoints
 * 100 requests per minute per user
 */
export const apiRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: "Too many requests. Please slow down."
});

/**
 * Rate limiter for transcription endpoint (Whisper API - very expensive)
 * 5 requests per minute per user
 */
export const transcriptionRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
  message: "Transcription rate limit exceeded. Please wait before uploading more audio."
});
