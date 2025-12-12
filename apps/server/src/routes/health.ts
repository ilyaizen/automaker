/**
 * Health check routes
 */

import { Router } from "express";
import { getAuthStatus } from "../lib/auth.js";

export function createHealthRoutes(): Router {
  const router = Router();

  // Basic health check
  router.get("/", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "0.1.0",
    });
  });

  // Detailed health check
  router.get("/detailed", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "0.1.0",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      dataDir: process.env.DATA_DIR || "./data",
      auth: getAuthStatus(),
      env: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    });
  });

  return router;
}
