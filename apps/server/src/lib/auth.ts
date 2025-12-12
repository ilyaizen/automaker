/**
 * Authentication middleware for API security
 *
 * Supports API key authentication via header or environment variable.
 */

import type { Request, Response, NextFunction } from "express";

// API key from environment (optional - if not set, auth is disabled)
const API_KEY = process.env.AUTOMAKER_API_KEY;

/**
 * Authentication middleware
 *
 * If AUTOMAKER_API_KEY is set, requires matching key in X-API-Key header.
 * If not set, allows all requests (development mode).
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // If no API key is configured, allow all requests
  if (!API_KEY) {
    next();
    return;
  }

  // Check for API key in header
  const providedKey = req.headers["x-api-key"] as string | undefined;

  if (!providedKey) {
    res.status(401).json({
      success: false,
      error: "Authentication required. Provide X-API-Key header.",
    });
    return;
  }

  if (providedKey !== API_KEY) {
    res.status(403).json({
      success: false,
      error: "Invalid API key.",
    });
    return;
  }

  next();
}

/**
 * Check if authentication is enabled
 */
export function isAuthEnabled(): boolean {
  return !!API_KEY;
}

/**
 * Get authentication status for health endpoint
 */
export function getAuthStatus(): { enabled: boolean; method: string } {
  return {
    enabled: !!API_KEY,
    method: API_KEY ? "api_key" : "none",
  };
}
