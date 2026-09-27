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
import { Operator, MoveHistoryRecord, ShiftTemplate, Department, ShiftCode } from "../types";
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
  const errMsg = error instanceof Error ? error.message : String(error);
  const isOfflineOrUnavailable =
    errMsg.includes("unavailable") ||
    errMsg.includes("Could not reach Cloud Firestore") ||
    errMsg.includes("the client is offline") ||
    (typeof navigator !== "undefined" && !navigator.onLine);

  if (isOfflineOrUnavailable) {
    console.warn(`[Firestore Offline] ${operationType} na ${path} přechází do offline mezipaměti.`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
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
      handleFirestoreError(error, OperationType.LIST, "operators");
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
  }
}

export async function bulkDeleteOperatorsFromCloud(
  operatorIds: string[],
  shouldQueueIfOffline = true,
): Promise<void> {
  if (!operatorIds || operatorIds.length === 0) return;
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  if (isOffline) {
    if (shouldQueueIfOffline) {
      for (const id of operatorIds) {
        queueOfflineAction("delete_operator", id);
      }
    }
    return;
  }
  try {
    let batch = writeBatch(db);
    let count = 0;
    for (const id of operatorIds) {
      batch.delete(getDocRef("operators", id));
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
    if (shouldQueueIfOffline) {
      for (const id of operatorIds) {
        queueOfflineAction("delete_operator", id);
      }
    }
    console.warn("Firestore bulk delete failed (queued offline):", error);
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
  const batch = writeBatch(db);
  for (const op of operators) {
    const cleanOp: Record<string, unknown> = { ...op, shift: op.shift || "A" };
    Object.keys(cleanOp).forEach((key) => cleanOp[key] === undefined && delete cleanOp[key]);
    batch.set(getDocRef("operators", op.id), cleanOp);
  }
  try {
    await batch.commit();
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
      handleFirestoreError(error, OperationType.LIST, "history");
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
      handleFirestoreError(error, OperationType.LIST, "templates");
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
    const snapshot = await getDocs(getCollectionRef("templates"));
    const existingIds = new Set(snapshot.docs.map((doc) => doc.id));

    const batch = writeBatch(db);
    let count = 0;

    for (const template of localTemplates) {
      if (!template.id || existingIds.has(template.id)) continue;
      const cleanTemplate: Record<string, unknown> = { ...template };
      Object.keys(cleanTemplate).forEach(
        (key) => cleanTemplate[key] === undefined && delete cleanTemplate[key],
      );
      batch.set(getDocRef("templates", template.id), cleanTemplate);
      count++;
      if (count >= 400) break; // Firestore batch limit safety
    }

    if (count > 0) {
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "templates/migration");
  }
}

export async function restoreBuiltInTemplatesToCloud(): Promise<void> {
  try {
    const snapshot = await getDocs(getCollectionRef("templates"));
    const batch = writeBatch(db);
    let count = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as Partial<ShiftTemplate>;
      if (data.isBuiltIn && data.isDeleted) {
        batch.delete(docSnap.ref);
        count++;
      }
    }

    if (count > 0) {
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "templates/restoreBuiltIns");
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
      handleFirestoreError(error, OperationType.LIST, "custom_departments");
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
