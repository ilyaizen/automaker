/**
 * Spec Regeneration routes - HTTP API for AI-powered spec generation
 */

import { Router, type Request, type Response } from "express";
import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import path from "path";
import fs from "fs/promises";
import type { EventEmitter } from "../lib/events.js";

let isRunning = false;
let currentAbortController: AbortController | null = null;

export function createSpecRegenerationRoutes(events: EventEmitter): Router {
  const router = Router();

  // Create project spec from overview
  router.post("/create", async (req: Request, res: Response) => {
    try {
      const { projectPath, projectOverview, generateFeatures } = req.body as {
        projectPath: string;
        projectOverview: string;
        generateFeatures?: boolean;
      };

      if (!projectPath || !projectOverview) {
        res.status(400).json({
          success: false,
          error: "projectPath and projectOverview required",
        });
        return;
      }

      if (isRunning) {
        res.json({ success: false, error: "Spec generation already running" });
        return;
      }

      isRunning = true;
      currentAbortController = new AbortController();

      // Start generation in background
      generateSpec(
        projectPath,
        projectOverview,
        events,
        currentAbortController,
        generateFeatures
      )
        .catch((error) => {
          console.error("[SpecRegeneration] Error:", error);
          events.emit("spec-regeneration:event", {
            type: "spec_error",
            error: error.message,
          });
        })
        .finally(() => {
          isRunning = false;
          currentAbortController = null;
        });

      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Generate from project definition
  router.post("/generate", async (req: Request, res: Response) => {
    try {
      const { projectPath, projectDefinition } = req.body as {
        projectPath: string;
        projectDefinition: string;
      };

      if (!projectPath || !projectDefinition) {
        res.status(400).json({
          success: false,
          error: "projectPath and projectDefinition required",
        });
        return;
      }

      if (isRunning) {
        res.json({ success: false, error: "Spec generation already running" });
        return;
      }

      isRunning = true;
      currentAbortController = new AbortController();

      generateSpec(
        projectPath,
        projectDefinition,
        events,
        currentAbortController,
        false
      )
        .catch((error) => {
          console.error("[SpecRegeneration] Error:", error);
          events.emit("spec-regeneration:event", {
            type: "spec_error",
            error: error.message,
          });
        })
        .finally(() => {
          isRunning = false;
          currentAbortController = null;
        });

      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Generate features from existing spec
  router.post("/generate-features", async (req: Request, res: Response) => {
    try {
      const { projectPath } = req.body as { projectPath: string };

      if (!projectPath) {
        res.status(400).json({ success: false, error: "projectPath required" });
        return;
      }

      if (isRunning) {
        res.json({ success: false, error: "Generation already running" });
        return;
      }

      isRunning = true;
      currentAbortController = new AbortController();

      generateFeaturesFromSpec(projectPath, events, currentAbortController)
        .catch((error) => {
          console.error("[SpecRegeneration] Error:", error);
          events.emit("spec-regeneration:event", {
            type: "features_error",
            error: error.message,
          });
        })
        .finally(() => {
          isRunning = false;
          currentAbortController = null;
        });

      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Stop generation
  router.post("/stop", async (_req: Request, res: Response) => {
    try {
      if (currentAbortController) {
        currentAbortController.abort();
      }
      isRunning = false;
      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Get status
  router.get("/status", async (_req: Request, res: Response) => {
    try {
      res.json({ success: true, isRunning });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}

async function generateSpec(
  projectPath: string,
  projectOverview: string,
  events: EventEmitter,
  abortController: AbortController,
  generateFeatures?: boolean
) {
  const prompt = `You are helping to define a software project specification.

Project Overview:
${projectOverview}

Based on this overview, analyze the project and create a comprehensive specification that includes:

1. **Project Summary** - Brief description of what the project does
2. **Core Features** - Main functionality the project needs
3. **Technical Stack** - Recommended technologies and frameworks
4. **Architecture** - High-level system design
5. **Data Models** - Key entities and their relationships
6. **API Design** - Main endpoints/interfaces needed
7. **User Experience** - Key user flows and interactions

${generateFeatures ? `
Also generate a list of features to implement. For each feature provide:
- ID (lowercase-hyphenated)
- Title
- Description
- Priority (1=high, 2=medium, 3=low)
- Estimated complexity (simple, moderate, complex)
` : ""}

Format your response as markdown. Be specific and actionable.`;

  events.emit("spec-regeneration:event", {
    type: "spec_progress",
    content: "Starting spec generation...\n",
  });

  const options: Options = {
    model: "claude-opus-4-5-20251101",
    maxTurns: 10,
    cwd: projectPath,
    allowedTools: ["Read", "Glob", "Grep"],
    permissionMode: "acceptEdits",
    abortController,
  };

  const stream = query({ prompt, options });
  let responseText = "";

  for await (const msg of stream) {
    if (msg.type === "assistant" && msg.message.content) {
      for (const block of msg.message.content) {
        if (block.type === "text") {
          responseText = block.text;
          events.emit("spec-regeneration:event", {
            type: "spec_progress",
            content: block.text,
          });
        } else if (block.type === "tool_use") {
          events.emit("spec-regeneration:event", {
            type: "spec_tool",
            tool: block.name,
            input: block.input,
          });
        }
      }
    } else if (msg.type === "result" && msg.subtype === "success") {
      responseText = msg.result || responseText;
    }
  }

  // Save spec
  const specDir = path.join(projectPath, ".automaker");
  const specPath = path.join(specDir, "project-spec.md");

  await fs.mkdir(specDir, { recursive: true });
  await fs.writeFile(specPath, responseText);

  events.emit("spec-regeneration:event", {
    type: "spec_complete",
    specPath,
    content: responseText,
  });

  // If generate features was requested, parse and create them
  if (generateFeatures) {
    await parseAndCreateFeatures(projectPath, responseText, events);
  }
}

async function generateFeaturesFromSpec(
  projectPath: string,
  events: EventEmitter,
  abortController: AbortController
) {
  // Read existing spec
  const specPath = path.join(projectPath, ".automaker", "project-spec.md");
  let spec: string;

  try {
    spec = await fs.readFile(specPath, "utf-8");
  } catch {
    events.emit("spec-regeneration:event", {
      type: "features_error",
      error: "No project spec found. Generate spec first.",
    });
    return;
  }

  const prompt = `Based on this project specification:

${spec}

Generate a prioritized list of implementable features. For each feature provide:

1. **id**: A unique lowercase-hyphenated identifier
2. **title**: Short descriptive title
3. **description**: What this feature does (2-3 sentences)
4. **priority**: 1 (high), 2 (medium), or 3 (low)
5. **complexity**: "simple", "moderate", or "complex"
6. **dependencies**: Array of feature IDs this depends on (can be empty)

Format as JSON:
{
  "features": [
    {
      "id": "feature-id",
      "title": "Feature Title",
      "description": "What it does",
      "priority": 1,
      "complexity": "moderate",
      "dependencies": []
    }
  ]
}

Generate 5-15 features that build on each other logically.`;

  events.emit("spec-regeneration:event", {
    type: "features_progress",
    content: "Analyzing spec and generating features...\n",
  });

  const options: Options = {
    model: "claude-sonnet-4-20250514",
    maxTurns: 5,
    cwd: projectPath,
    allowedTools: ["Read", "Glob"],
    permissionMode: "acceptEdits",
    abortController,
  };

  const stream = query({ prompt, options });
  let responseText = "";

  for await (const msg of stream) {
    if (msg.type === "assistant" && msg.message.content) {
      for (const block of msg.message.content) {
        if (block.type === "text") {
          responseText = block.text;
          events.emit("spec-regeneration:event", {
            type: "features_progress",
            content: block.text,
          });
        }
      }
    } else if (msg.type === "result" && msg.subtype === "success") {
      responseText = msg.result || responseText;
    }
  }

  await parseAndCreateFeatures(projectPath, responseText, events);
}

async function parseAndCreateFeatures(
  projectPath: string,
  content: string,
  events: EventEmitter
) {
  try {
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*"features"[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const featuresDir = path.join(projectPath, ".automaker", "features");
    await fs.mkdir(featuresDir, { recursive: true });

    const createdFeatures: Array<{ id: string; title: string }> = [];

    for (const feature of parsed.features) {
      const featureDir = path.join(featuresDir, feature.id);
      await fs.mkdir(featureDir, { recursive: true });

      const featureData = {
        id: feature.id,
        title: feature.title,
        description: feature.description,
        status: "pending",
        priority: feature.priority || 2,
        complexity: feature.complexity || "moderate",
        dependencies: feature.dependencies || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await fs.writeFile(
        path.join(featureDir, "feature.json"),
        JSON.stringify(featureData, null, 2)
      );

      createdFeatures.push({ id: feature.id, title: feature.title });
    }

    events.emit("spec-regeneration:event", {
      type: "features_complete",
      features: createdFeatures,
      count: createdFeatures.length,
    });
  } catch (error) {
    events.emit("spec-regeneration:event", {
      type: "features_error",
      error: (error as Error).message,
    });
  }
}
