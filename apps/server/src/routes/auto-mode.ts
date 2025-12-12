/**
 * Auto Mode routes - HTTP API for autonomous feature implementation
 *
 * Uses the AutoModeService for real feature execution with Claude Agent SDK
 */

import { Router, type Request, type Response } from "express";
import type { EventEmitter } from "../lib/events.js";
import { AutoModeService } from "../services/auto-mode-service.js";

export function createAutoModeRoutes(events: EventEmitter): Router {
  const router = Router();
  const autoModeService = new AutoModeService(events);

  // Start auto mode loop
  router.post("/start", async (req: Request, res: Response) => {
    try {
      const { projectPath, maxConcurrency } = req.body as {
        projectPath: string;
        maxConcurrency?: number;
      };

      if (!projectPath) {
        res.status(400).json({ success: false, error: "projectPath is required" });
        return;
      }

      await autoModeService.startAutoLoop(projectPath, maxConcurrency || 3);
      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Stop auto mode loop
  router.post("/stop", async (req: Request, res: Response) => {
    try {
      const runningCount = await autoModeService.stopAutoLoop();
      res.json({ success: true, runningFeatures: runningCount });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Stop a specific feature
  router.post("/stop-feature", async (req: Request, res: Response) => {
    try {
      const { featureId } = req.body as { featureId: string };

      if (!featureId) {
        res.status(400).json({ success: false, error: "featureId is required" });
        return;
      }

      const stopped = await autoModeService.stopFeature(featureId);
      res.json({ success: true, stopped });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Get auto mode status
  router.post("/status", async (req: Request, res: Response) => {
    try {
      const status = autoModeService.getStatus();
      res.json({
        success: true,
        ...status,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Run a single feature
  router.post("/run-feature", async (req: Request, res: Response) => {
    try {
      const { projectPath, featureId, useWorktrees } = req.body as {
        projectPath: string;
        featureId: string;
        useWorktrees?: boolean;
      };

      if (!projectPath || !featureId) {
        res
          .status(400)
          .json({ success: false, error: "projectPath and featureId are required" });
        return;
      }

      // Start execution in background
      autoModeService
        .executeFeature(projectPath, featureId, useWorktrees ?? true, false)
        .catch((error) => {
          console.error(`[AutoMode] Feature ${featureId} error:`, error);
        });

      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Verify a feature
  router.post("/verify-feature", async (req: Request, res: Response) => {
    try {
      const { projectPath, featureId } = req.body as {
        projectPath: string;
        featureId: string;
      };

      if (!projectPath || !featureId) {
        res
          .status(400)
          .json({ success: false, error: "projectPath and featureId are required" });
        return;
      }

      const passes = await autoModeService.verifyFeature(projectPath, featureId);
      res.json({ success: true, passes });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Resume a feature
  router.post("/resume-feature", async (req: Request, res: Response) => {
    try {
      const { projectPath, featureId, useWorktrees } = req.body as {
        projectPath: string;
        featureId: string;
        useWorktrees?: boolean;
      };

      if (!projectPath || !featureId) {
        res
          .status(400)
          .json({ success: false, error: "projectPath and featureId are required" });
        return;
      }

      // Start resume in background
      autoModeService
        .resumeFeature(projectPath, featureId, useWorktrees ?? true)
        .catch((error) => {
          console.error(`[AutoMode] Resume feature ${featureId} error:`, error);
        });

      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Check if context exists for a feature
  router.post("/context-exists", async (req: Request, res: Response) => {
    try {
      const { projectPath, featureId } = req.body as {
        projectPath: string;
        featureId: string;
      };

      if (!projectPath || !featureId) {
        res
          .status(400)
          .json({ success: false, error: "projectPath and featureId are required" });
        return;
      }

      const exists = await autoModeService.contextExists(projectPath, featureId);
      res.json({ success: true, exists });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Analyze project
  router.post("/analyze-project", async (req: Request, res: Response) => {
    try {
      const { projectPath } = req.body as { projectPath: string };

      if (!projectPath) {
        res.status(400).json({ success: false, error: "projectPath is required" });
        return;
      }

      // Start analysis in background
      autoModeService.analyzeProject(projectPath).catch((error) => {
        console.error(`[AutoMode] Project analysis error:`, error);
      });

      res.json({ success: true, message: "Project analysis started" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Follow up on a feature
  router.post("/follow-up-feature", async (req: Request, res: Response) => {
    try {
      const { projectPath, featureId, prompt, imagePaths } = req.body as {
        projectPath: string;
        featureId: string;
        prompt: string;
        imagePaths?: string[];
      };

      if (!projectPath || !featureId || !prompt) {
        res.status(400).json({
          success: false,
          error: "projectPath, featureId, and prompt are required",
        });
        return;
      }

      // Start follow-up in background
      autoModeService
        .followUpFeature(projectPath, featureId, prompt, imagePaths)
        .catch((error) => {
          console.error(`[AutoMode] Follow up feature ${featureId} error:`, error);
        });

      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Commit feature changes
  router.post("/commit-feature", async (req: Request, res: Response) => {
    try {
      const { projectPath, featureId } = req.body as {
        projectPath: string;
        featureId: string;
      };

      if (!projectPath || !featureId) {
        res
          .status(400)
          .json({ success: false, error: "projectPath and featureId are required" });
        return;
      }

      const commitHash = await autoModeService.commitFeature(projectPath, featureId);
      res.json({ success: true, commitHash });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}
