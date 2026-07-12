/**
 * PropertyPro - Rate Limiting Utility
 * Implements rate limiting for API endpoints
 */

import { NextRequest } from "next/server";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: NextRequest) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store (in production, use Redis or similar)
const store: RateLimitStore = {};

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

/**
 * Rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = config;

  return {
    check: (
      req: NextRequest
    ): {
      success: boolean;
      limit: number;
      remaining: number;
      resetTime: number;
    } => {
      const key = keyGenerator(req);
      const now = Date.now();
      const resetTime = now + windowMs;

      // Initialize or reset if window expired
      if (!store[key] || store[key].resetTime < now) {
        store[key] = {
          count: 0,
          resetTime,
        };
      }

      const current = store[key];
      const remaining = Math.max(0, maxRequests - current.count);

      if (current.count >= maxRequests) {
        return {
          success: false,
          limit: maxRequests,
          remaining: 0,
          resetTime: current.resetTime,
        };
      }

      // Increment counter
      current.count++;

      return {
        success: true,
        limit: maxRequests,
        remaining: remaining - 1,
        resetTime: current.resetTime,
      };
    },

    reset: (req: NextRequest): void => {
      const key = keyGenerator(req);
      delete store[key];
    },
  };
}

/**
 * Default key generator - uses IP address and user agent
 */
function defaultKeyGenerator(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : req.ip || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  // Create a simple hash of IP + User Agent
  return `${ip}:${userAgent}`;
}

/**
 * User-based key generator - uses user ID from session
 */
export function userBasedKeyGenerator(userId: string): string {
  return `user:${userId}`;
}

/**
 * IP-based key generator - uses only IP address
 */
export function ipBasedKeyGenerator(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : req.ip || "unknown";
  return `ip:${ip}`;
}

/**
 * Predefined rate limit configurations
 */
export const rateLimitConfigs = {
  // Settings updates - 10 requests per minute
  settingsUpdate: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyGenerator: userBasedKeyGenerator,
  },

  // Authentication - 5 attempts per 15 minutes
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },

  // General API - 100 requests per minute
  general: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  },

  // File uploads - 5 uploads per minute
  upload: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    keyGenerator: userBasedKeyGenerator,
  },

  // Password reset - 3 attempts per hour
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
  },

  // Email sending - 10 emails per hour
  email: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    keyGenerator: userBasedKeyGenerator,
  },
};

/**
 * Rate limit response helper
 */
export function createRateLimitResponse(
  message: string = "Too many requests",
  resetTime: number
) {
  const resetDate = new Date(resetTime);

  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
      resetTime: resetDate.toISOString(),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": Math.ceil((resetTime - Date.now()) / 1000).toString(),
        "X-RateLimit-Reset": resetDate.toISOString(),
      },
    }
  );
}

/**
 * Rate limit middleware for Next.js API routes
 */
export function withRateLimit(
  config: RateLimitConfig,
  handler: (req: NextRequest) => Promise<Response>
) {
  const limiter = rateLimit(config);

  return async (req: NextRequest): Promise<Response> => {
    const result = limiter.check(req);

    // Add rate limit headers to response
    const addHeaders = (response: Response) => {
      response.headers.set("X-RateLimit-Limit", result.limit.toString());
      response.headers.set(
        "X-RateLimit-Remaining",
        result.remaining.toString()
      );
      response.headers.set(
        "X-RateLimit-Reset",
        new Date(result.resetTime).toISOString()
      );
      return response;
    };

    if (!result.success) {
      return createRateLimitResponse(
        "Too many requests. Please try again later.",
        result.resetTime
      );
    }

    try {
      const response = await handler(req);
      return addHeaders(response);
    } catch (error) {
      // If the request failed, optionally don't count it against the limit
      if (config.skipFailedRequests) {
        limiter.reset(req);
      }
      throw error;
    }
  };
}

/**
 * CSRF Token utilities
 */
export class CSRFProtection {
  private static tokens = new Map<string, { token: string; expires: number }>();

  static generateToken(sessionId: string): string {
    const token = crypto.randomUUID();
    const expires = Date.now() + 60 * 60 * 1000; // 1 hour

    this.tokens.set(sessionId, { token, expires });

    // Cleanup expired tokens
    this.cleanup();

    return token;
  }

  static validateToken(sessionId: string, token: string): boolean {
    const stored = this.tokens.get(sessionId);

    if (!stored || stored.expires < Date.now()) {
      this.tokens.delete(sessionId);
      return false;
    }

    return stored.token === token;
  }

  static removeToken(sessionId: string): void {
    this.tokens.delete(sessionId);
  }

  private static cleanup(): void {
    const now = Date.now();
    for (const [sessionId, data] of this.tokens.entries()) {
      if (data.expires < now) {
        this.tokens.delete(sessionId);
      }
    }
  }
}

/**
 * Security headers utility
 */
export function addSecurityHeaders(response: Response): Response {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
  );

  return response;
}

/**
 * Input sanitization utility
 */
export function sanitizeInput(input: any): any {
  if (typeof input === "string") {
    // Remove potentially dangerous characters
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "")
      .trim();
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  // Handle Date objects - return them as-is without processing
  if (input instanceof Date) {
    return input;
  }

  if (typeof input === "object" && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }

  return input;
}
