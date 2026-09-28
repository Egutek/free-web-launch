/**
 * Online synchronizace přes Firebase Firestore
 */
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import {
  Operator,
  MoveHistoryRecord,
  ShiftTemplate,
  Department,
  ShiftCode,
  RosterMember,
} from "../types";
import { queueOfflineAction } from "./offlineQueue";

export type Unsubscribe = () => void;

const WORKSPACE_ID = "zf_ostrov";

const getCollectionRef = (subPath: string) =>
  collection(db, `workspaces/${WORKSPACE_ID}/${subPath}`);
const getDocRef = (subPath: string, id: string) =>
  doc(db, `workspaces/${WORKSPACE_ID}/${subPath}`, id);

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ---------- Operátoři ----------
export function subscribeToOperators(
  onUpdate: (operators: Operator[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(getCollectionRef("operators"), limit(2000));
  return onSnapshot(
    q,
    (snapshot) => {
      const ops = snapshot.docs.map((doc) => doc.data() as Operator);
      onUpdate(ops);
    },
    (error) => {
      console.error("Firestore subscription failed:", "operators", error);
      if (onError) onError(error);
    },
  );
}

export async function syncOperatorToCloud(
  operator: Operator,
  shouldQueueIfOffline = true,
): Promise<void> {
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  if (isOffline) {
    if (shouldQueueIfOffline) {
      queueOfflineAction("sync_operator", operator);
    }
    return;
  }
  try {
    const cleanOp: Record<string, unknown> = { ...operator };
    Object.keys(cleanOp).forEach((key) => cleanOp[key] === undefined && delete cleanOp[key]);
    await setDoc(getDocRef("operators", operator.id), cleanOp);
  } catch (error) {
    if (shouldQueueIfOffline) {
      queueOfflineAction("sync_operator", operator);
    }
    console.warn(`Firestore sync operator ${operator.name} failed (queued offline):`, error);
    if (!shouldQueueIfOffline) throw error;
  }
}

export async function deleteOperatorFromCloud(
  operatorId: string,
  shouldQueueIfOffline = true,
): Promise<void> {
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  if (isOffline) {
    if (shouldQueueIfOffline) {
      queueOfflineAction("delete_operator", operatorId);
    }
    return;
  }
  try {
    await deleteDoc(getDocRef("operators", operatorId));
  } catch (error) {
    if (shouldQueueIfOffline) {
      queueOfflineAction("delete_operator", operatorId);
    }
    console.warn(`Firestore delete operator ${operatorId} failed (queued offline):`, error);
    if (!shouldQueueIfOffline) throw error;
  }
}

export async function bulkDeleteOperatorsFromCloud(
  operatorIds: string[],
  shouldQueueIfOffline = true,
): Promise<void> {
  if (operatorIds.length === 0) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    if (shouldQueueIfOffline) operatorIds.forEach((id) => queueOfflineAction("delete_operator", id));
    return;
  }
  try {
    for (let start = 0; start < operatorIds.length; start += 400) {
      const batch = writeBatch(db);
      operatorIds.slice(start, start + 400).forEach((id) => batch.delete(getDocRef("operators", id)));
      await batch.commit();
    }
  } catch (error) {
    if (shouldQueueIfOffline) operatorIds.forEach((id) => queueOfflineAction("delete_operator", id));
    if (!shouldQueueIfOffline) throw error;
    console.warn("Firestore bulk delete operators failed (queued offline):", error);
  }
}

export async function bulkSyncOperatorsToCloud(
  operators: Operator[],
  shouldQueueIfOffline = true,
): Promise<void> {
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  if (isOffline) {
    if (shouldQueueIfOffline) {
      for (const op of operators) {
        queueOfflineAction("sync_operator", op);
      }
    }
    return;
  }
  try {
    for (let start = 0; start < operators.length; start += 400) {
      const batch = writeBatch(db);
      for (const op of operators.slice(start, start + 400)) {
        const cleanOp: Record<string, unknown> = { ...op, shift: op.shift || "A" };
        Object.keys(cleanOp).forEach((key) => cleanOp[key] === undefined && delete cleanOp[key]);
        batch.set(getDocRef("operators", op.id), cleanOp);
      }
      await batch.commit();
    }
  } catch (error) {
    if (shouldQueueIfOffline) {
      for (const op of operators) {
        queueOfflineAction("sync_operator", op);
      }
    }
    console.warn("Firestore bulk sync failed (queued offline):", error);
  }
}

/**
 * Replaces operators in Firestore by deleting obsolete documents and writing current ones.
 * If shiftToReplace is passed, only documents matching that shift (or missing shift) are deleted.
 */
export async function replaceOperatorsInCloud(
  allCurrentOperators: Operator[],
  shiftToReplace?: ShiftCode,
): Promise<void> {
  try {
    const querySnapshot = await getDocs(getCollectionRef("operators"));
    const newOpIds = new Set(allCurrentOperators.map((o) => o.id));

    let batch = writeBatch(db);
    let opCount = 0;

    // 1. Delete old documents in cloud that belonged to the replaced shift (or no longer exist)
    for (const docSnap of querySnapshot.docs) {
      const docData = docSnap.data() as Partial<Operator>;
      const docShift = docData.shift || "A";
      const shouldDelete =
        !newOpIds.has(docSnap.id) && (!shiftToReplace || docShift === shiftToReplace);

      if (shouldDelete) {
        batch.delete(docSnap.ref);
        opCount++;
        if (opCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      }
    }

    // 2. Save all current operators
    for (const op of allCurrentOperators) {
      const cleanOp: Record<string, unknown> = { ...op, shift: op.shift || "A" };
      Object.keys(cleanOp).forEach((key) => cleanOp[key] === undefined && delete cleanOp[key]);
      batch.set(getDocRef("operators", op.id), cleanOp);
      opCount++;
      if (opCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "operators(replaceBatch)");
  }
}

// ---------- Historie ----------
export function subscribeToHistory(
  onUpdate: (history: MoveHistoryRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(getCollectionRef("history"), orderBy("timestamp", "desc"), limit(100));
  return onSnapshot(
    q,
    (snapshot) => {
      const records = snapshot.docs.map((doc) => doc.data() as MoveHistoryRecord);
      onUpdate(records);
    },
    (error) => {
      console.error("Firestore subscription failed:", "history", error);
      if (onError) onError(error);
    },
  );
}

export async function syncHistoryRecordToCloud(
  record: MoveHistoryRecord,
  shouldQueueIfOffline = true,
): Promise<void> {
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  if (isOffline) {
    if (shouldQueueIfOffline) {
      queueOfflineAction("sync_history", record);
    }
    return;
  }
  try {
    const cleanRecord: Record<string, unknown> = { ...record };
    Object.keys(cleanRecord).forEach(
      (key) => cleanRecord[key] === undefined && delete cleanRecord[key],
    );
    await setDoc(getDocRef("history", record.id), cleanRecord);
  } catch (error) {
    if (shouldQueueIfOffline) {
      queueOfflineAction("sync_history", record);
    }
    console.warn(`Firestore sync history record ${record.id} failed (queued offline):`, error);
    if (!shouldQueueIfOffline) throw error;
  }
}

// ---------- Šablony ----------
export function subscribeToTemplates(
  onUpdate: (templates: ShiftTemplate[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(getCollectionRef("templates"), orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(
    q,
    (snapshot) => {
      const templates = snapshot.docs.map((doc) => doc.data() as ShiftTemplate);
      onUpdate(templates);
    },
    (error) => {
      console.error("Firestore subscription failed:", "templates", error);
      if (onError) onError(error);
    },
  );
}

export async function syncTemplateToCloud(template: ShiftTemplate): Promise<void> {
  try {
    const cleanTemplate: Record<string, unknown> = { ...template };
    Object.keys(cleanTemplate).forEach(
      (key) => cleanTemplate[key] === undefined && delete cleanTemplate[key],
    );
    await setDoc(getDocRef("templates", template.id), cleanTemplate);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `templates/${template.id}`);
  }
}

export async function deleteTemplateFromCloud(templateId: string): Promise<void> {
  try {
    await deleteDoc(getDocRef("templates", templateId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `templates/${templateId}`);
  }
}

export async function migrateLocalTemplatesToCloud(localTemplates: ShiftTemplate[]): Promise<void> {
  if (!localTemplates || localTemplates.length === 0) return;
  try {
    for (const t of localTemplates) {
      await syncTemplateToCloud(t);
    }
  } catch (error) {
    console.warn("Chyba při migraci šablon do cloudu:", error);
  }
}

export async function restoreBuiltInTemplatesToCloud(): Promise<void> {
  try {
    const q = query(getCollectionRef("templates"));
    const snapshot = await getDocs(q);
    let batch = writeBatch(db);
    let count = 0;
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as ShiftTemplate;
      if (data.isBuiltIn && data.isDeleted) {
        batch.delete(docSnap.ref);
        count++;
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  } catch (error) {
    console.warn("Chyba při obnově výchozích šablon v cloudu:", error);
  }
}

// ---------- Vlastní oddělení (Vícepráce) ----------
export function subscribeToCustomDepartments(
  onUpdate: (depts: Department[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(getCollectionRef("custom_departments"), orderBy("createdAt", "desc"), limit(200));
  return onSnapshot(
    q,
    (snapshot) => {
      const depts = snapshot.docs.map((doc) => doc.data() as Department);
      onUpdate(depts);
    },
    (error) => {
      console.error("Firestore subscription failed:", "custom_departments", error);
      if (onError) onError(error);
    },
  );
}

export async function syncCustomDepartmentToCloud(dept: Department): Promise<void> {
  try {
    const cleanDept: Record<string, unknown> = { ...dept };
    Object.keys(cleanDept).forEach((key) => cleanDept[key] === undefined && delete cleanDept[key]);
    await setDoc(getDocRef("custom_departments", dept.id), cleanDept);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `custom_departments/${dept.id}`);
  }
}

export async function deleteCustomDepartmentFromCloud(deptId: string): Promise<void> {
  try {
    await deleteDoc(getDocRef("custom_departments", deptId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `custom_departments/${deptId}`);
  }
}

// ---------- Nastavení OCR instrukcí pro AI (s pamětí) ----------
export function subscribeToOcrInstructions(
  onUpdate: (instructions: string) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    getDocRef("settings", "ocr_instructions"),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as { value?: string };
        if (typeof data.value === "string") {
          onUpdate(data.value);
        }
      }
    },
    (error) => {
      console.warn("Chyba při načítání OCR instrukcí z cloudu:", error);
      if (onError) onError(error);
    },
  );
}

export async function syncOcrInstructionsToCloud(instructions: string): Promise<void> {
  try {
    await setDoc(getDocRef("settings", "ocr_instructions"), {
      value: instructions,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("Chyba při ukládání OCR instrukcí do cloudu:", error);
  }
}

// ---------- Kmenoví pracovníci (Roster) ----------
export function subscribeToRoster(
  onUpdate: (roster: RosterMember[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(getCollectionRef("roster"), limit(1000));
  return onSnapshot(
    q,
    (snapshot) => {
      const roster = snapshot.docs.map((doc) => doc.data() as RosterMember);
      if (roster.length > 0) {
        onUpdate(roster);
      }
    },
    (error) => {
      console.error("Firestore subscription failed:", "roster", error);
      if (onError) onError(error);
    },
  );
}

export async function syncRosterMemberToCloud(
  member: RosterMember,
  shouldQueueIfOffline = true,
): Promise<void> {
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  if (isOffline) {
    if (shouldQueueIfOffline) {
      queueOfflineAction("sync_roster", member);
    }
    return;
  }
  try {
    const cleanMember: Record<string, unknown> = { ...member };
    Object.keys(cleanMember).forEach(
      (key) => cleanMember[key] === undefined && delete cleanMember[key],
    );
    await setDoc(getDocRef("roster", member.id), cleanMember);
  } catch (error) {
    if (shouldQueueIfOffline) {
      queueOfflineAction("sync_roster", member);
    }
    console.warn(`Firestore sync roster member ${member.name} failed (queued offline):`, error);
    if (!shouldQueueIfOffline) throw error;
  }
}

export async function bulkSyncRosterToCloud(
  members: RosterMember[],
  shouldQueueIfOffline = true,
): Promise<void> {
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  if (isOffline) {
    if (shouldQueueIfOffline) {
      for (const m of members) {
        queueOfflineAction("sync_roster", m);
      }
    }
    return;
  }
  try {
    for (let start = 0; start < members.length; start += 400) {
      const batch = writeBatch(db);
      for (const m of members.slice(start, start + 400)) {
        const cleanMember: Record<string, unknown> = { ...m };
        Object.keys(cleanMember).forEach(
          (key) => cleanMember[key] === undefined && delete cleanMember[key],
        );
        batch.set(getDocRef("roster", m.id), cleanMember);
      }
      await batch.commit();
    }
  } catch (error) {
    if (shouldQueueIfOffline) {
      for (const m of members) {
        queueOfflineAction("sync_roster", m);
      }
    }
    console.warn("Firestore bulk sync roster failed (queued offline):", error);
  }
}

export async function deleteRosterMemberFromCloud(
  memberId: string,
  shouldQueueIfOffline = true,
): Promise<void> {
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  if (isOffline) {
    if (shouldQueueIfOffline) {
      queueOfflineAction("delete_roster", memberId);
    }
    return;
  }
  try {
    await deleteDoc(getDocRef("roster", memberId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `roster/${memberId}`);
  }
}

export async function bulkDeleteRosterMembersFromCloud(
  memberIds: string[],
  shouldQueueIfOffline = true,
): Promise<void> {
  if (memberIds.length === 0) return;
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  if (isOffline) {
    if (shouldQueueIfOffline) {
      for (const id of memberIds) {
        queueOfflineAction("delete_roster", id);
      }
    }
    return;
  }
  try {
    let batch = writeBatch(db);
    let count = 0;
    for (const id of memberIds) {
      batch.delete(getDocRef("roster", id));
      count++;
      if (count >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `roster(bulkDelete:${memberIds.length})`);
  }
}

export async function replaceRosterInCloud(members: RosterMember[]): Promise<void> {
  try {
    const querySnapshot = await getDocs(getCollectionRef("roster"));
    const newMemberIds = new Set(members.map((m) => m.id));

    let batch = writeBatch(db);
    let count = 0;

    for (const docSnap of querySnapshot.docs) {
      if (!newMemberIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
        count++;
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
    }

    for (const m of members) {
      const cleanMember: Record<string, unknown> = { ...m };
      Object.keys(cleanMember).forEach(
        (key) => cleanMember[key] === undefined && delete cleanMember[key],
      );
      batch.set(getDocRef("roster", m.id), cleanMember);
      count++;
      if (count >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "roster(replaceBatch)");
  }
}
