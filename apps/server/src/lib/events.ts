/**
 * Event emitter for streaming events to WebSocket clients
 */

export type EventType =
  | "agent:stream"
  | "auto-mode:event"
  | "auto-mode:started"
  | "auto-mode:stopped"
  | "auto-mode:idle"
  | "auto-mode:error"
  | "feature:started"
  | "feature:completed"
  | "feature:stopped"
  | "feature:error"
  | "feature:progress"
  | "feature:tool-use"
  | "feature:follow-up-started"
  | "feature:follow-up-completed"
  | "feature:verified"
  | "feature:committed"
  | "project:analysis-started"
  | "project:analysis-progress"
  | "project:analysis-completed"
  | "project:analysis-error"
  | "suggestions:event"
  | "spec-regeneration:event";

export type EventCallback = (type: EventType, payload: unknown) => void;

export interface EventEmitter {
  emit: (type: EventType, payload: unknown) => void;
  subscribe: (callback: EventCallback) => () => void;
}

export function createEventEmitter(): EventEmitter {
  const subscribers = new Set<EventCallback>();

  return {
    emit(type: EventType, payload: unknown) {
      for (const callback of subscribers) {
        try {
          callback(type, payload);
        } catch (error) {
          console.error("Error in event subscriber:", error);
        }
      }
    },

    subscribe(callback: EventCallback) {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
  };
}
