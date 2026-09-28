/**
 * Offline synchronizační služba pro mobilní obchůzku haly ZF Ostrov.
 * Zajišťuje bezpečné uložení a automatické odeslání změn při výpadku signálu.
 */
import { Operator, MoveHistoryRecord, RosterMember } from "../types";
import {
  syncOperatorToCloud,
  deleteOperatorFromCloud,
  syncHistoryRecordToCloud,
  syncRosterMemberToCloud,
  deleteRosterMemberFromCloud,
} from "./firestoreSync";
import {
  OfflineAction,
  getOfflineQueue,
  saveOfflineQueue,
  useNetworkStatus,
  setFlushingStatus,
  getFlushingStatus,
} from "./offlineQueue";

export * from "./offlineQueue";

export async function flushOfflineQueue(onSuccess?: (syncedCount: number) => void): Promise<number> {
  if (typeof window === "undefined" || !navigator.onLine || getFlushingStatus()) return 0;
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  setFlushingStatus(true);
  let syncedCount = 0;
  const remainingQueue: OfflineAction[] = [];
  try {
    for (const item of queue) {
      try {
        if (item.type === "sync_operator") await syncOperatorToCloud(item.data as Operator, false);
        else if (item.type === "delete_operator") await deleteOperatorFromCloud(item.data as string, false);
        else if (item.type === "sync_history") await syncHistoryRecordToCloud(item.data as MoveHistoryRecord, false);
        else if (item.type === "sync_roster") await syncRosterMemberToCloud(item.data as RosterMember, false);
        else if (item.type === "delete_roster") await deleteRosterMemberFromCloud(item.data as string, false);
        syncedCount++;
      } catch (err) {
        console.warn("Položka se nepodařila odeslat, zůstává ve frontě:", item, err);
        remainingQueue.push(item);
      }
    }
    saveOfflineQueue(remainingQueue);
  } finally {
    setFlushingStatus(false);
  }

  if (syncedCount > 0) onSuccess?.(syncedCount);
  return syncedCount;
}

export function useNetworkStatusWithSync() {
  const status = useNetworkStatus();
  return { ...status, triggerSync: () => flushOfflineQueue() };
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void flushOfflineQueue((count) => {
      console.info(`Automatická synchronizace dokončena: ${count} změn odesláno do cloudu.`);
    });
  });
}
