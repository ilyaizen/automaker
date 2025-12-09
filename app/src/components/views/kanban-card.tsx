"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Feature } from "@/store/app-store";
import {
  GripVertical,
  Edit,
  CheckCircle2,
  Circle,
  Loader2,
  Trash2,
  Eye,
  PlayCircle,
  RotateCcw,
  StopCircle,
  FlaskConical,
  ArrowLeft,
  MessageSquare,
  GitCommit,
} from "lucide-react";
import { CountUpTimer } from "@/components/ui/count-up-timer";

interface KanbanCardProps {
  feature: Feature;
  onEdit: () => void;
  onDelete: () => void;
  onViewOutput?: () => void;
  onVerify?: () => void;
  onResume?: () => void;
  onForceStop?: () => void;
  onManualVerify?: () => void;
  onMoveBackToInProgress?: () => void;
  onFollowUp?: () => void;
  onCommit?: () => void;
  hasContext?: boolean;
  isCurrentAutoTask?: boolean;
  shortcutKey?: string;
}

export function KanbanCard({
  feature,
  onEdit,
  onDelete,
  onViewOutput,
  onVerify,
  onResume,
  onForceStop,
  onManualVerify,
  onMoveBackToInProgress,
  onFollowUp,
  onCommit,
  hasContext,
  isCurrentAutoTask,
  shortcutKey,
}: KanbanCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    setIsDeleteDialogOpen(false);
    onDelete();
  };

  const handleCancelDelete = () => {
    setIsDeleteDialogOpen(false);
  };

  // Dragging logic:
  // - Backlog items can always be dragged
  // - skipTests items can be dragged even when in_progress or verified (unless currently running)
  // - Non-skipTests (TDD) items in progress or verified cannot be dragged
  const isDraggable =
    feature.status === "backlog" ||
    (feature.skipTests && !isCurrentAutoTask);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: feature.id,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-grab active:cursor-grabbing transition-all backdrop-blur-sm border-white/10 relative",
        isDragging && "opacity-50 scale-105 shadow-lg",
        isCurrentAutoTask &&
          "border-purple-500 border-2 shadow-purple-500/50 shadow-lg animate-pulse"
      )}
      data-testid={`kanban-card-${feature.id}`}
      {...attributes}
    >
      {/* Shortcut key badge for in-progress cards */}
      {shortcutKey && (
        <div
          className="absolute top-2 left-2 px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/10 border border-white/20 text-zinc-300 z-10"
          data-testid={`shortcut-key-${feature.id}`}
        >
          {shortcutKey}
        </div>
      )}
      {/* Skip Tests indicator badge */}
      {feature.skipTests && (
        <div
          className={cn(
            "absolute px-1.5 py-0.5 text-[10px] font-medium rounded flex items-center gap-1 z-10",
            shortcutKey ? "top-2 left-10" : "top-2 left-2",
            "bg-orange-500/20 border border-orange-500/50 text-orange-400"
          )}
          data-testid={`skip-tests-badge-${feature.id}`}
          title="Manual verification required"
        >
          <FlaskConical className="w-3 h-3" />
          <span>Manual</span>
        </div>
      )}
      <CardHeader className="p-3 pb-2">
        {isCurrentAutoTask && (
          <div className="absolute top-2 right-2 flex items-center gap-2 bg-purple-500/20 border border-purple-500 rounded px-2 py-0.5">
            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
            <span className="text-xs text-purple-400 font-medium">
              Running...
            </span>
            {feature.startedAt && (
              <CountUpTimer
                startedAt={feature.startedAt}
                className="text-purple-400"
              />
            )}
          </div>
        )}
        {/* Show timer for in_progress cards that aren't currently running */}
        {!isCurrentAutoTask &&
          feature.status === "in_progress" &&
          feature.startedAt && (
            <div className="absolute top-2 right-2">
              <CountUpTimer
                startedAt={feature.startedAt}
                className="text-yellow-500"
              />
            </div>
          )}
        <div className="flex items-start gap-2">
          {isDraggable && (
            <div
              {...listeners}
              className="mt-0.5 touch-none cursor-grab"
              data-testid={`drag-handle-${feature.id}`}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm leading-tight">
              {feature.description}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {feature.category}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {/* Steps Preview */}
        {feature.steps.length > 0 && (
          <div className="mb-3 space-y-1">
            {feature.steps.slice(0, 3).map((step, index) => (
              <div
                key={index}
                className="flex items-start gap-2 text-xs text-muted-foreground"
              >
                {feature.status === "verified" ? (
                  <CheckCircle2 className="w-3 h-3 mt-0.5 text-green-500 shrink-0" />
                ) : (
                  <Circle className="w-3 h-3 mt-0.5 shrink-0" />
                )}
                <span className="truncate">{step}</span>
              </div>
            ))}
            {feature.steps.length > 3 && (
              <p className="text-xs text-muted-foreground pl-5">
                +{feature.steps.length - 3} more steps
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {isCurrentAutoTask && (
            <>
              {onViewOutput && (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-7 text-xs bg-purple-600 hover:bg-purple-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewOutput();
                  }}
                  data-testid={`view-output-${feature.id}`}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  View Output
                </Button>
              )}
              {onForceStop && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onForceStop();
                  }}
                  data-testid={`force-stop-${feature.id}`}
                >
                  <StopCircle className="w-3 h-3 mr-1" />
                  Stop
                </Button>
              )}
            </>
          )}
          {!isCurrentAutoTask && feature.status === "in_progress" && (
            <>
              {/* skipTests features show manual verify button */}
              {feature.skipTests && onManualVerify ? (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-7 text-xs bg-green-600 hover:bg-green-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onManualVerify();
                  }}
                  data-testid={`manual-verify-${feature.id}`}
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Verify
                </Button>
              ) : hasContext && onResume ? (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResume();
                  }}
                  data-testid={`resume-feature-${feature.id}`}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Resume
                </Button>
              ) : onVerify ? (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-7 text-xs bg-green-600 hover:bg-green-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerify();
                  }}
                  data-testid={`verify-feature-${feature.id}`}
                >
                  <PlayCircle className="w-3 h-3 mr-1" />
                  Resume
                </Button>
              ) : null}
              {onViewOutput && !feature.skipTests && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewOutput();
                  }}
                  data-testid={`view-output-inprogress-${feature.id}`}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Output
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDeleteClick}
                data-testid={`delete-inprogress-feature-${feature.id}`}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </>
          )}
          {!isCurrentAutoTask && feature.status === "verified" && (
            <>
              {/* Move back button for skipTests verified features */}
              {feature.skipTests && onMoveBackToInProgress && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-yellow-500 hover:text-yellow-500 hover:bg-yellow-500/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveBackToInProgress();
                  }}
                  data-testid={`move-back-${feature.id}`}
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Back
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                data-testid={`edit-feature-${feature.id}`}
              >
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDeleteClick}
                data-testid={`delete-feature-${feature.id}`}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </>
          )}
          {!isCurrentAutoTask && feature.status === "waiting_approval" && (
            <>
              {/* Follow-up prompt button */}
              {onFollowUp && (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFollowUp();
                  }}
                  data-testid={`follow-up-${feature.id}`}
                >
                  <MessageSquare className="w-3 h-3 mr-1" />
                  Follow-up
                </Button>
              )}
              {/* Commit and verify button */}
              {onCommit && (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-7 text-xs bg-green-600 hover:bg-green-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCommit();
                  }}
                  data-testid={`commit-${feature.id}`}
                >
                  <GitCommit className="w-3 h-3 mr-1" />
                  Commit
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDeleteClick}
                data-testid={`delete-waiting-feature-${feature.id}`}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </>
          )}
          {!isCurrentAutoTask && feature.status === "backlog" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                data-testid={`edit-feature-${feature.id}`}
              >
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDeleteClick}
                data-testid={`delete-feature-${feature.id}`}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent data-testid="delete-confirmation-dialog">
          <DialogHeader>
            <DialogTitle>Delete Feature</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this feature? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={handleCancelDelete}
              data-testid="cancel-delete-button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              data-testid="confirm-delete-button"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
