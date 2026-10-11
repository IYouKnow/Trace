import { useSyncExternalStore } from "react";

export type Toast = {
  id: number;
  message: string;
};

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Toast[] {
  return toasts;
}

/// Shows a toast that auto-dismisses; returns its id so it can be closed early.
export function toast(message: string, duration = 5000): number {
  const id = nextId++;
  toasts = [...toasts, { id, message }];
  emit();
  if (duration > 0) {
    window.setTimeout(() => dismiss(id), duration);
  }
  return id;
}

export function dismiss(id: number) {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

/// Subscribes a component to the current toasts.
export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}
