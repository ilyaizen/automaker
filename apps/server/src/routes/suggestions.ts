/**
 * Suggestions routes - HTTP API for AI-powered feature suggestions
 */

import { Router, type Request, type Response } from "express";
import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import type { EventEmitter } from "../lib/events.js";

let isRunning = false;
let currentAbortController: AbortController | null = null;

export function createSuggestionsRoutes(events: EventEmitter): Router {
  const router = Router();

  // Generate suggestions
  router.post("/generate", async (req: Request, res: Response) => {
    try {
      const { projectPath, suggestionType = "features" } = req.body as {
        projectPath: string;
        suggestionType?: string;
      };

      if (!projectPath) {
        res.status(400).json({ success: false, error: "projectPath required" });
        return;
      }

      if (isRunning) {
        res.json({ success: false, error: "Suggestions generation is already running" });
        return;
      }

      isRunning = true;
      currentAbortController = new AbortController();

      // Start generation in background
      generateSuggestions(projectPath, suggestionType, events, currentAbortController)
        .catch((error) => {
          console.error("[Suggestions] Error:", error);
          events.emit("suggestions:event", {
            type: "suggestions_error",
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

  // Stop suggestions generation
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

async function generateSuggestions(
  projectPath: string,
  suggestionType: string,
  events: EventEmitter,
  abortController: AbortController
) {
  const typePrompts: Record<string, string> = {
    features: "Analyze this project and suggest new features that would add value.",
    refactoring: "Analyze this project and identify refactoring opportunities.",
    security: "Analyze this project for security vulnerabilities and suggest fixes.",
    performance: "Analyze this project for performance issues and suggest optimizations.",
  };

  const prompt = `${typePrompts[suggestionType] || typePrompts.features}

Look at the codebase and provide 3-5 concrete suggestions.

For each suggestion, provide:
1. A category (e.g., "User Experience", "Security", "Performance")
2. A clear description of what to implement
3. Concrete steps to implement it
4. Priority (1=high, 2=medium, 3=low)
5. Brief reasoning for why this would help

Format your response as JSON:
{
  "suggestions": [
    {
      "id": "suggestion-123",
      "category": "Category",
      "description": "What to implement",
      "steps": ["Step 1", "Step 2"],
      "priority": 1,
      "reasoning": "Why this helps"
    }
  ]
}`;

  events.emit("suggestions:event", {
    type: "suggestions_progress",
    content: `Starting ${suggestionType} analysis...\n`,
  });

  const options: Options = {
    model: "claude-opus-4-5-20251101",
    maxTurns: 5,
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
          events.emit("suggestions:event", {
            type: "suggestions_progress",
            content: block.text,
          });
        } else if (block.type === "tool_use") {
          events.emit("suggestions:event", {
            type: "suggestions_tool",
            tool: block.name,
            input: block.input,
          });
        }
      }
    } else if (msg.type === "result" && msg.subtype === "success") {
      responseText = msg.result || responseText;
    }
  }

  // Parse suggestions from response
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      events.emit("suggestions:event", {
        type: "suggestions_complete",
        suggestions: parsed.suggestions.map((s: Record<string, unknown>, i: number) => ({
          ...s,
          id: s.id || `suggestion-${Date.now()}-${i}`,
        })),
      });
    } else {
      throw new Error("No valid JSON found in response");
    }
  } catch (error) {
    // Return generic suggestions if parsing fails
    events.emit("suggestions:event", {
      type: "suggestions_complete",
      suggestions: [
        {
          id: `suggestion-${Date.now()}-0`,
          category: "Analysis",
          description: "Review the AI analysis output for insights",
          steps: ["Review the generated analysis"],
          priority: 1,
          reasoning: "The AI provided analysis but suggestions need manual review",
        },
      ],
    });
  }
}
