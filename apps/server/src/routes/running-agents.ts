/**
 * Running Agents routes - HTTP API for tracking active agent executions
 */

import { Router, type Request, type Response } from "express";
import path from "path";

interface RunningAgent {
  featureId: string;
  projectPath: string;
  projectName: string;
  isAutoMode: boolean;
}

// In-memory tracking of running agents (shared with auto-mode service via reference)
const runningAgentsMap = new Map<string, RunningAgent>();
let autoLoopRunning = false;

export function createRunningAgentsRoutes(): Router {
  const router = Router();

  // Get all running agents
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const runningAgents = Array.from(runningAgentsMap.values());

      res.json({
        success: true,
        runningAgents,
        totalCount: runningAgents.length,
        autoLoopRunning,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}

// Export functions to update running agents from other services
export function registerRunningAgent(
  featureId: string,
  projectPath: string,
  isAutoMode: boolean
): void {
  runningAgentsMap.set(featureId, {
    featureId,
    projectPath,
    projectName: path.basename(projectPath),
    isAutoMode,
  });
}

export function unregisterRunningAgent(featureId: string): void {
  runningAgentsMap.delete(featureId);
}

export function setAutoLoopRunning(running: boolean): void {
  autoLoopRunning = running;
}

export function getRunningAgentsCount(): number {
  return runningAgentsMap.size;
}

export function isAgentRunning(featureId: string): boolean {
  return runningAgentsMap.has(featureId);
}
