/**
 * Features routes - HTTP API for feature management
 */

import { Router, type Request, type Response } from "express";
import { FeatureLoader, type Feature } from "../services/feature-loader.js";
import { addAllowedPath } from "../lib/security.js";

export function createFeaturesRoutes(featureLoader: FeatureLoader): Router {
  const router = Router();

  // List all features for a project
  router.post("/list", async (req: Request, res: Response) => {
    try {
      const { projectPath } = req.body as { projectPath: string };

      if (!projectPath) {
        res.status(400).json({ success: false, error: "projectPath is required" });
        return;
      }

      // Add project path to allowed paths
      addAllowedPath(projectPath);

      const features = await featureLoader.getAll(projectPath);
      res.json({ success: true, features });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Get a single feature
  router.post("/get", async (req: Request, res: Response) => {
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

      const feature = await featureLoader.get(projectPath, featureId);
      if (!feature) {
        res.status(404).json({ success: false, error: "Feature not found" });
        return;
      }

      res.json({ success: true, feature });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Create a new feature
  router.post("/create", async (req: Request, res: Response) => {
    try {
      const { projectPath, feature } = req.body as {
        projectPath: string;
        feature: Partial<Feature>;
      };

      if (!projectPath || !feature) {
        res
          .status(400)
          .json({ success: false, error: "projectPath and feature are required" });
        return;
      }

      // Add project path to allowed paths
      addAllowedPath(projectPath);

      const created = await featureLoader.create(projectPath, feature);
      res.json({ success: true, feature: created });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Update a feature
  router.post("/update", async (req: Request, res: Response) => {
    try {
      const { projectPath, featureId, updates } = req.body as {
        projectPath: string;
        featureId: string;
        updates: Partial<Feature>;
      };

      if (!projectPath || !featureId || !updates) {
        res.status(400).json({
          success: false,
          error: "projectPath, featureId, and updates are required",
        });
        return;
      }

      const updated = await featureLoader.update(projectPath, featureId, updates);
      res.json({ success: true, feature: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Delete a feature
  router.post("/delete", async (req: Request, res: Response) => {
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

      const success = await featureLoader.delete(projectPath, featureId);
      res.json({ success });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Get agent output for a feature
  router.post("/agent-output", async (req: Request, res: Response) => {
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

      const content = await featureLoader.getAgentOutput(projectPath, featureId);
      res.json({ success: true, content });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}
