/**
 * Worktree routes - HTTP API for git worktree operations
 */

import { Router, type Request, type Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";

const execAsync = promisify(exec);

export function createWorktreeRoutes(): Router {
  const router = Router();

  // Check if a path is a git repo
  async function isGitRepo(repoPath: string): Promise<boolean> {
    try {
      await execAsync("git rev-parse --is-inside-work-tree", { cwd: repoPath });
      return true;
    } catch {
      return false;
    }
  }

  // Get worktree info
  router.post("/info", async (req: Request, res: Response) => {
    try {
      const { projectPath, featureId } = req.body as {
        projectPath: string;
        featureId: string;
      };

      if (!projectPath || !featureId) {
        res
          .status(400)
          .json({ success: false, error: "projectPath and featureId required" });
        return;
      }

      // Check if worktree exists
      const worktreePath = path.join(projectPath, ".automaker", "worktrees", featureId);
      try {
        await fs.access(worktreePath);
        const { stdout } = await execAsync("git rev-parse --abbrev-ref HEAD", {
          cwd: worktreePath,
        });
        res.json({
          success: true,
          worktreePath,
          branchName: stdout.trim(),
        });
      } catch {
        res.json({ success: true, worktreePath: null, branchName: null });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Get worktree status
  router.post("/status", async (req: Request, res: Response) => {
    try {
      const { projectPath, featureId } = req.body as {
        projectPath: string;
        featureId: string;
      };

      if (!projectPath || !featureId) {
        res
          .status(400)
          .json({ success: false, error: "projectPath and featureId required" });
        return;
      }

      const worktreePath = path.join(projectPath, ".automaker", "worktrees", featureId);

      try {
        await fs.access(worktreePath);
        const { stdout: status } = await execAsync("git status --porcelain", {
          cwd: worktreePath,
        });
        const files = status
          .split("\n")
          .filter(Boolean)
          .map((line) => line.slice(3));
        const { stdout: diffStat } = await execAsync("git diff --stat", {
          cwd: worktreePath,
        });
        const { stdout: logOutput } = await execAsync(
          'git log --oneline -5 --format="%h %s"',
          { cwd: worktreePath }
        );

        res.json({
          success: true,
          modifiedFiles: files.length,
          files,
          diffStat: diffStat.trim(),
          recentCommits: logOutput.trim().split("\n").filter(Boolean),
        });
      } catch {
        res.json({
          success: true,
          modifiedFiles: 0,
          files: [],
          diffStat: "",
          recentCommits: [],
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // List all worktrees
  router.post("/list", async (req: Request, res: Response) => {
    try {
      const { projectPath } = req.body as { projectPath: string };

      if (!projectPath) {
        res.status(400).json({ success: false, error: "projectPath required" });
        return;
      }

      if (!(await isGitRepo(projectPath))) {
        res.json({ success: true, worktrees: [] });
        return;
      }

      const { stdout } = await execAsync("git worktree list --porcelain", {
        cwd: projectPath,
      });

      const worktrees: Array<{ path: string; branch: string }> = [];
      const lines = stdout.split("\n");
      let current: { path?: string; branch?: string } = {};

      for (const line of lines) {
        if (line.startsWith("worktree ")) {
          current.path = line.slice(9);
        } else if (line.startsWith("branch ")) {
          current.branch = line.slice(7).replace("refs/heads/", "");
        } else if (line === "") {
          if (current.path && current.branch) {
            worktrees.push({ path: current.path, branch: current.branch });
          }
          current = {};
        }
      }

      res.json({ success: true, worktrees });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Get diffs for a worktree
  router.post("/diffs", async (req: Request, res: Response) => {
    try {
      const { projectPath, featureId } = req.body as {
        projectPath: string;
        featureId: string;
      };

      if (!projectPath || !featureId) {
        res
          .status(400)
          .json({ success: false, error: "projectPath and featureId required" });
        return;
      }

      const worktreePath = path.join(projectPath, ".automaker", "worktrees", featureId);

      try {
        await fs.access(worktreePath);
        const { stdout: diff } = await execAsync("git diff HEAD", {
          cwd: worktreePath,
          maxBuffer: 10 * 1024 * 1024,
        });
        const { stdout: status } = await execAsync("git status --porcelain", {
          cwd: worktreePath,
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
      const { projectPath, featureId, filePath } = req.body as {
        projectPath: string;
        featureId: string;
        filePath: string;
      };

      if (!projectPath || !featureId || !filePath) {
        res.status(400).json({
          success: false,
          error: "projectPath, featureId, and filePath required",
        });
        return;
      }

      const worktreePath = path.join(projectPath, ".automaker", "worktrees", featureId);

      try {
        await fs.access(worktreePath);
        const { stdout: diff } = await execAsync(`git diff HEAD -- "${filePath}"`, {
          cwd: worktreePath,
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

  // Revert feature (remove worktree)
  router.post("/revert", async (req: Request, res: Response) => {
    try {
      const { projectPath, featureId } = req.body as {
        projectPath: string;
        featureId: string;
      };

      if (!projectPath || !featureId) {
        res
          .status(400)
          .json({ success: false, error: "projectPath and featureId required" });
        return;
      }

      const worktreePath = path.join(projectPath, ".automaker", "worktrees", featureId);

      try {
        // Remove worktree
        await execAsync(`git worktree remove "${worktreePath}" --force`, {
          cwd: projectPath,
        });
        // Delete branch
        await execAsync(`git branch -D feature/${featureId}`, { cwd: projectPath });

        res.json({ success: true, removedPath: worktreePath });
      } catch (error) {
        // Worktree might not exist
        res.json({ success: true, removedPath: null });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Merge feature (merge worktree branch into main)
  router.post("/merge", async (req: Request, res: Response) => {
    try {
      const { projectPath, featureId, options } = req.body as {
        projectPath: string;
        featureId: string;
        options?: { squash?: boolean; message?: string };
      };

      if (!projectPath || !featureId) {
        res
          .status(400)
          .json({ success: false, error: "projectPath and featureId required" });
        return;
      }

      const branchName = `feature/${featureId}`;
      const worktreePath = path.join(projectPath, ".automaker", "worktrees", featureId);

      // Get current branch
      const { stdout: currentBranch } = await execAsync(
        "git rev-parse --abbrev-ref HEAD",
        { cwd: projectPath }
      );

      // Merge the feature branch
      const mergeCmd = options?.squash
        ? `git merge --squash ${branchName}`
        : `git merge ${branchName} -m "${options?.message || `Merge ${branchName}`}"`;

      await execAsync(mergeCmd, { cwd: projectPath });

      // If squash merge, need to commit
      if (options?.squash) {
        await execAsync(
          `git commit -m "${options?.message || `Merge ${branchName} (squash)`}"`,
          { cwd: projectPath }
        );
      }

      // Clean up worktree and branch
      try {
        await execAsync(`git worktree remove "${worktreePath}" --force`, {
          cwd: projectPath,
        });
        await execAsync(`git branch -D ${branchName}`, { cwd: projectPath });
      } catch {
        // Cleanup errors are non-fatal
      }

      res.json({ success: true, mergedBranch: branchName });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}
