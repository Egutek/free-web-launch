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
  runTransaction,
} from "firebase/firestore";
import { db, auth, ensureFirebaseAuth } from "../firebase";
import { Operator, MoveHistoryRecord, ShiftTemplate, Department, ShiftCode } from "../types";

export type Unsubscribe = () => void;

const writeErrorListeners = new Set<(error: Error) => void>();

export function subscribeToCloudWriteErrors(listener: (error: Error) => void): Unsubscribe {
  writeErrorListeners.add(listener);
  return () => writeErrorListeners.delete(listener);
}

function reportWriteError(error: Error) {
  writeErrorListeners.forEach((listener) => listener(error));
}

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
  if (
    [
      OperationType.CREATE,
      OperationType.UPDATE,
      OperationType.DELETE,
      OperationType.WRITE,
    ].includes(operationType)
  ) {
    reportWriteError(error instanceof Error ? error : new Error(String(error)));
  }
  throw new Error(JSON.stringify(errInfo));
}

// ---------- Operátoři ----------
export function subscribeToOperators(
  onUpdate: (operators: Operator[], fromCache: boolean) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(getCollectionRef("operators"), limit(2000));
  return onSnapshot(
    q,
    // Receive metadata-only transitions as well: the document contents may be
    // identical while Firestore changes from cache to server (or vice versa).
    { includeMetadataChanges: true },
    (snapshot) => {
      const ops = snapshot.docs.map((doc) => doc.data() as Operator);
      // A cached snapshot is not proof of a live Firestore connection.
      onUpdate(ops, snapshot.metadata.fromCache);
    },
    (error) => {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Firestore operators subscription error:", err);
      onError?.(err);
    },
  );
}

export async function syncOperatorToCloud(operator: Operator): Promise<void> {
  await ensureFirebaseAuth();
  try {
    const operatorRef = getDocRef("operators", operator.id);

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(operatorRef);
      const currentRevision =
        snapshot.exists() && typeof snapshot.data()["revision"] === "number"
          ? snapshot.data()["revision"]
          : 0;

      // A second device may have changed this operator since our snapshot.
      // Reject its stale state instead of silently overwriting that change.
      if (currentRevision !== (operator.revision ?? 0)) {
        throw new Error("Konflikt změn: operátor byl mezitím upraven na jiném zařízení.");
      }

      const cleanOp: Record<string, unknown> = {
        ...operator,
        revision: currentRevision + 1,
      };
      Object.keys(cleanOp).forEach((key) => cleanOp[key] === undefined && delete cleanOp[key]);
      transaction.set(operatorRef, cleanOp);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `operators/${operator.id}`);
  }
}

export async function deleteOperatorFromCloud(operatorId: string): Promise<void> {
  await ensureFirebaseAuth();
  try {
    await deleteDoc(getDocRef("operators", operatorId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `operators/${operatorId}`);
  }
}

export async function bulkSyncOperatorsToCloud(operators: Operator[]): Promise<void> {
  await ensureFirebaseAuth();
  if (operators.length === 0) return;

  try {
    // Use the same per-document transaction as single moves so a stale client
    // cannot overwrite a newer edit made on another device.
    const concurrency = 20;
    for (let start = 0; start < operators.length; start += concurrency) {
      const chunk = operators.slice(start, start + concurrency);
      await Promise.all(chunk.map((operator) => syncOperatorToCloud(operator)));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "operators(transaction-batch)");
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
  await ensureFirebaseAuth();
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
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Firestore history subscription error:", err);
      onError?.(err);
    },
  );
}

export async function clearHistoryFromCloud(): Promise<void> {
  await ensureFirebaseAuth();
  try {
    const snapshot = await getDocs(getCollectionRef("history"));

    for (let start = 0; start < snapshot.docs.length; start += 400) {
      const batch = writeBatch(db);
      snapshot.docs.slice(start, start + 400).forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, "history(clear)");
  }
}

export async function syncHistoryRecordToCloud(record: MoveHistoryRecord): Promise<void> {
  await ensureFirebaseAuth();
  try {
    const cleanRecord: Record<string, unknown> = { ...record };
    Object.keys(cleanRecord).forEach(
      (key) => cleanRecord[key] === undefined && delete cleanRecord[key],
    );
    await setDoc(getDocRef("history", record.id), cleanRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `history/${record.id}`);
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
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Firestore templates subscription error:", err);
      onError?.(err);
    },
  );
}

export async function migrateLocalTemplatesToCloud(
  templates: ShiftTemplate[],
): Promise<void> {
  await ensureFirebaseAuth();
  for (const template of templates) {
    const templateRef = getDocRef("templates", template.id);
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(templateRef);
      if (!existing.exists()) {
        const cleanTemplate: Record<string, unknown> = { ...template };
        Object.keys(cleanTemplate).forEach(
          (key) => cleanTemplate[key] === undefined && delete cleanTemplate[key],
        );
        transaction.set(templateRef, cleanTemplate);
      }
    });
  }
}

export async function restoreBuiltInTemplatesToCloud(): Promise<void> {
  await ensureFirebaseAuth();
  const snapshot = await getDocs(
    query(getCollectionRef("templates"), orderBy("createdAt", "desc"), limit(50)),
  );
  const deletedBuiltIns = snapshot.docs.filter(
    (template) =>
      template.data()["isBuiltIn"] === true && template.data()["isDeleted"] === true,
  );
  await Promise.all(deletedBuiltIns.map((template) => deleteDoc(template.ref)));
}

export async function syncTemplateToCloud(template: ShiftTemplate): Promise<void> {
  await ensureFirebaseAuth();
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
  await ensureFirebaseAuth();
  try {
    await deleteDoc(getDocRef("templates", templateId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `templates/${templateId}`);
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
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Firestore custom departments subscription error:", err);
      onError?.(err);
    },
  );
}

export async function syncCustomDepartmentToCloud(dept: Department): Promise<void> {
  await ensureFirebaseAuth();
  try {
    const cleanDept: Record<string, unknown> = { ...dept };
    Object.keys(cleanDept).forEach((key) => cleanDept[key] === undefined && delete cleanDept[key]);
    await setDoc(getDocRef("custom_departments", dept.id), cleanDept);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `custom_departments/${dept.id}`);
  }
}

export async function deleteCustomDepartmentFromCloud(deptId: string): Promise<void> {
  await ensureFirebaseAuth();
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
  await ensureFirebaseAuth();
  try {
    await setDoc(getDocRef("settings", "ocr_instructions"), {
      value: instructions,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("Chyba při ukládání OCR instrukcí do cloudu:", error);
  }
}
