import { useEffect, useState } from "react";

export type OfflineActionType =
  "sync_operator" | "delete_operator" | "sync_history" | "sync_roster" | "delete_roster";

export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  data: unknown;
  timestamp: number;
}

const OFFLINE_QUEUE_KEY = "zf_ostrov_offline_sync_queue_v1";

// Helper: load queue from localStorage
export function getOfflineQueue(): OfflineAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Chyba při čtení offline fronty:", e);
  }
  return [];
}

// Helper: save queue to localStorage
export function saveOfflineQueue(queue: OfflineAction[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    notifySubscribers();
  } catch (e) {
    console.warn("Chyba při ukládání offline fronty:", e);
  }
}

// Queue an action
export function queueOfflineAction(type: OfflineActionType, data: unknown): void {
  const queue = getOfflineQueue();
  // If updating the same operator multiple times offline, coalesce into the latest state
  const opData = data as { id?: string } | undefined;
  if (type === "sync_operator" && opData?.id) {
    const existingIndex = queue.findIndex(
      (item) => item.type === "sync_operator" && (item.data as { id?: string })?.id === opData.id,
    );
    if (existingIndex >= 0) {
      queue[existingIndex] = {
        id: queue[existingIndex].id,
        type,
        data,
        timestamp: Date.now(),
      };
      saveOfflineQueue(queue);
      return;
    }
  }

  queue.push({
    id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    data,
    timestamp: Date.now(),
  });
  saveOfflineQueue(queue);
}

// Subscribers for real-time reactivity in UI components
type NetworkStatusListener = (status: {
  isOnline: boolean;
  pendingCount: number;
  isFlushing: boolean;
}) => void;

const subscribers = new Set<NetworkStatusListener>();
let isGlobalFlushing = false;

export function setFlushingStatus(flushing: boolean) {
  isGlobalFlushing = flushing;
  notifySubscribers();
}

export function getFlushingStatus() {
  return isGlobalFlushing;
}

export function notifySubscribers() {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  const pendingCount = getOfflineQueue().length;
  subscribers.forEach((fn) => fn({ isOnline, pendingCount, isFlushing: isGlobalFlushing }));
}

// Global window event listeners
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    notifySubscribers();
  });

  window.addEventListener("offline", () => {
    notifySubscribers();
  });
}

/**
 * React hook pro sledování stavu připojení v regálech a počtu neuložených změn
 */
export function useNetworkStatus() {
  const [status, setStatus] = useState(() => ({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    pendingCount: getOfflineQueue().length,
    isFlushing: isGlobalFlushing,
  }));

  useEffect(() => {
    const listener: NetworkStatusListener = (newStatus) => {
      setStatus(newStatus);
    };

    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  }, []);

  return {
    isOnline: status.isOnline,
    pendingCount: status.pendingCount,
    isFlushing: status.isFlushing,
  };
}
