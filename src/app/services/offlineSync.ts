/**
 * Offline Synchronizační Služba pro mobilní obchůzku haly ZF Ostrov
 * Zajišťuje bezpečné uložení a automatické odeslání změn při výpadku signálu v uličkách mezi regály.
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
  queueOfflineAction,
  useNetworkStatus,
  notifySubscribers,
  setFlushingStatus,
  getFlushingStatus,
} from "./offlineQueue";

export * from "./offlineQueue";

// Flush all queued actions to Firestore when back online
export async function flushOfflineQueue(
  onSuccess?: (syncedCount: number) => void,
): Promise<number> {
  if (typeof window === "undefined") return 0;
  if (!navigator.onLine) return 0;
  if (getFlushingStatus()) return 0;

  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  setFlushingStatus(true);

  let syncedCount = 0;
  const remainingQueue: OfflineAction[] = [];

  for (const item of queue) {
    try {
      if (item.type === "sync_operator") {
        await syncOperatorToCloud(item.data as Operator, false);
        syncedCount++;
      } else if (item.type === "delete_operator") {
        await deleteOperatorFromCloud(item.data as string, false);
        syncedCount++;
      } else if (item.type === "sync_history") {
        await syncHistoryRecordToCloud(item.data as MoveHistoryRecord, false);
        syncedCount++;
      } else if (item.type === "sync_roster") {
        await syncRosterMemberToCloud(item.data as RosterMember, false);
        syncedCount++;
      } else if (item.type === "delete_roster") {
        await deleteRosterMemberFromCloud(item.data as string, false);
        syncedCount++;
      }
    } catch (err) {
      console.warn("Položka se nepodařila odeslat, zůstává ve frontě:", item, err);
      remainingQueue.push(item);
    }
  }

  setFlushingStatus(false);
  saveOfflineQueue(remainingQueue);

  if (syncedCount > 0 && onSuccess) {
    onSuccess(syncedCount);
  }

  return syncedCount;
}

// React hook extension with triggerSync
export function useNetworkStatusWithSync() {
  const status = useNetworkStatus();

  const triggerSync = async () => {
    return await flushOfflineQueue();
  };

  return {
    ...status,
    triggerSync,
  };
}

// Global automatic flush on online event
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushOfflineQueue((count) => {
      console.info(
        `Automatická synchronizace z regálů dokončena: ${count} změn odesláno do cloudu.`,
      );
    });
  });
}
