/**
 * Git routes - HTTP API for git operations (non-worktree)
 */

import { Router, type Request, type Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export function createGitRoutes(): Router {
  const router = Router();

  // Get diffs for the main project
  router.post("/diffs", async (req: Request, res: Response) => {
    try {
      const { projectPath } = req.body as { projectPath: string };

      if (!projectPath) {
        res.status(400).json({ success: false, error: "projectPath required" });
        return;
      }

      try {
        const { stdout: diff } = await execAsync("git diff HEAD", {
          cwd: projectPath,
          maxBuffer: 10 * 1024 * 1024,
        });
        const { stdout: status } = await execAsync("git status --porcelain", {
          cwd: projectPath,
        });

        const files = status
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const statusChar = line[0];
            const filePath = line.slice(3);
            const statusMap: Record<string, string> = {
              M: "Modified",
              A: "Added",
              D: "Deleted",
              R: "Renamed",
              C: "Copied",
              U: "Updated",
              "?": "Untracked",
            };
            return {
              status: statusChar,
              path: filePath,
              statusText: statusMap[statusChar] || "Unknown",
            };
          });

        res.json({
          success: true,
          diff,
          files,
          hasChanges: files.length > 0,
        });
      } catch {
        res.json({ success: true, diff: "", files: [], hasChanges: false });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Get diff for a specific file
  router.post("/file-diff", async (req: Request, res: Response) => {
    try {
      const { projectPath, filePath } = req.body as {
        projectPath: string;
        filePath: string;
      };

      if (!projectPath || !filePath) {
        res
          .status(400)
          .json({ success: false, error: "projectPath and filePath required" });
        return;
      }

      try {
        const { stdout: diff } = await execAsync(`git diff HEAD -- "${filePath}"`, {
          cwd: projectPath,
          maxBuffer: 10 * 1024 * 1024,
        });

        res.json({ success: true, diff, filePath });
      } catch {
        res.json({ success: true, diff: "", filePath });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}
