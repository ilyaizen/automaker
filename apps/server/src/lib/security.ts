/**
 * Security utilities for path validation
 */

import path from "path";

// Allowed project directories - loaded from environment
const allowedPaths = new Set<string>();

/**
 * Initialize allowed paths from environment variable
 */
export function initAllowedPaths(): void {
  const dirs = process.env.ALLOWED_PROJECT_DIRS;
  if (dirs) {
    for (const dir of dirs.split(",")) {
      const trimmed = dir.trim();
      if (trimmed) {
        allowedPaths.add(path.resolve(trimmed));
      }
    }
  }

  // Always allow the data directory
  const dataDir = process.env.DATA_DIR;
  if (dataDir) {
    allowedPaths.add(path.resolve(dataDir));
  }
}

/**
 * Add a path to the allowed list
 */
export function addAllowedPath(filePath: string): void {
  allowedPaths.add(path.resolve(filePath));
}

/**
 * Check if a path is allowed
 */
export function isPathAllowed(filePath: string): boolean {
  const resolved = path.resolve(filePath);

  // Check if the path is under any allowed directory
  for (const allowed of allowedPaths) {
    if (resolved.startsWith(allowed + path.sep) || resolved === allowed) {
      return true;
    }
  }

  return false;
}

/**
 * Validate a path and throw if not allowed
 */
export function validatePath(filePath: string): string {
  const resolved = path.resolve(filePath);

  if (!isPathAllowed(resolved)) {
    throw new Error(`Access denied: ${filePath} is not in an allowed directory`);
  }

  return resolved;
}

/**
 * Get list of allowed paths (for debugging)
 */
export function getAllowedPaths(): string[] {
  return Array.from(allowedPaths);
}
