import { useMemo, useCallback } from "react";
import { Feature } from "@/store/app-store";
import { resolveDependencies } from "@/lib/dependency-resolver";
import { pathsEqual } from "@/lib/utils";

type ColumnId = Feature["status"];

interface UseBoardColumnFeaturesProps {
  features: Feature[];
  runningAutoTasks: string[];
  searchQuery: string;
  currentWorktreePath: string | null; // Currently selected worktree path
  currentWorktreeBranch: string | null; // Branch name of the selected worktree (null = main)
  projectPath: string | null; // Main project path (for main worktree)
}

export function useBoardColumnFeatures({
  features,
  runningAutoTasks,
  searchQuery,
  currentWorktreePath,
  currentWorktreeBranch,
  projectPath,
}: UseBoardColumnFeaturesProps) {
  // Memoize column features to prevent unnecessary re-renders
  const columnFeaturesMap = useMemo(() => {
    const map: Record<ColumnId, Feature[]> = {
      backlog: [],
      in_progress: [],
      waiting_approval: [],
      verified: [],
      completed: [], // Completed features are shown in the archive modal, not as a column
    };

    // Filter features by search query (case-insensitive)
    const normalizedQuery = searchQuery.toLowerCase().trim();
    const filteredFeatures = normalizedQuery
      ? features.filter(
          (f) =>
            f.description.toLowerCase().includes(normalizedQuery) ||
            f.category?.toLowerCase().includes(normalizedQuery)
        )
      : features;

    // Determine the effective worktree path and branch for filtering
    // If currentWorktreePath is null, we're on the main worktree
    const effectiveWorktreePath = currentWorktreePath || projectPath;
    // Use the branch name from the selected worktree
    // If we're selecting main (currentWorktreePath is null), currentWorktreeBranch
    // should contain the main branch's actual name, defaulting to "main"
    // If we're selecting a non-main worktree but can't find it, currentWorktreeBranch is null
    // In that case, we can't do branch-based filtering, so we'll handle it specially below
    const effectiveBranch = currentWorktreeBranch;

    filteredFeatures.forEach((f) => {
      // If feature has a running agent, always show it in "in_progress"
      const isRunning = runningAutoTasks.includes(f.id);

      // Check if feature matches the current worktree
      // Match by worktreePath if set, OR by branchName if set
      // Features with neither are considered unassigned (show on ALL worktrees)
      const featureBranch = f.branchName || "main";
      const hasWorktreeAssigned = f.worktreePath || f.branchName;

      let matchesWorktree: boolean;
      if (!hasWorktreeAssigned) {
        // No worktree or branch assigned - show on ALL worktrees (unassigned)
        matchesWorktree = true;
      } else if (f.worktreePath) {
        // Has worktreePath - match by path (use pathsEqual for cross-platform compatibility)
        matchesWorktree = pathsEqual(f.worktreePath, effectiveWorktreePath);
      } else if (effectiveBranch === null) {
        // We're viewing main but branch hasn't been initialized yet
        // (worktrees disabled or haven't loaded yet).
        // Show features assigned to main/master branch since we're on the main worktree.
        matchesWorktree = featureBranch === "main" || featureBranch === "master";
      } else {
        // Has branchName but no worktreePath - match by branch name
        matchesWorktree = featureBranch === effectiveBranch;
      }

      if (isRunning) {
        // Only show running tasks if they match the current worktree
        if (matchesWorktree) {
          map.in_progress.push(f);
        }
      } else {
        // Otherwise, use the feature's status (fallback to backlog for unknown statuses)
        const status = f.status as ColumnId;

        // Filter all items by worktree, including backlog
        // This ensures backlog items with a branch assigned only show in that branch
        if (status === "backlog") {
          if (matchesWorktree) {
            map.backlog.push(f);
          }
        } else if (map[status]) {
          // Only show if matches current worktree or has no worktree assigned
          if (matchesWorktree) {
            map[status].push(f);
          }
        } else {
          // Unknown status, default to backlog
          map.backlog.push(f);
        }
      }
    });

    // Apply dependency-aware sorting to backlog
    // This ensures features appear in dependency order (dependencies before dependents)
    // Within the same dependency level, features are sorted by priority
    if (map.backlog.length > 0) {
      const { orderedFeatures } = resolveDependencies(map.backlog);
      map.backlog = orderedFeatures;
    }

    return map;
  }, [features, runningAutoTasks, searchQuery, currentWorktreePath, currentWorktreeBranch, projectPath]);

  const getColumnFeatures = useCallback(
    (columnId: ColumnId) => {
      return columnFeaturesMap[columnId];
    },
    [columnFeaturesMap]
  );

  // Memoize completed features for the archive modal
  const completedFeatures = useMemo(() => {
    return features.filter((f) => f.status === "completed");
  }, [features]);

  return {
    columnFeaturesMap,
    getColumnFeatures,
    completedFeatures,
  };
}
