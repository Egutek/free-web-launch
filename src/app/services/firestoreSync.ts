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
  authInfo: any;
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
      handleFirestoreError(error, OperationType.LIST, "operators");
      if (onError) onError(error);
    },
  );
}

export async function syncOperatorToCloud(operator: Operator): Promise<void> {
  try {
    const cleanOp: any = { ...operator };
    Object.keys(cleanOp).forEach((key) => cleanOp[key] === undefined && delete cleanOp[key]);
    await setDoc(getDocRef("operators", operator.id), cleanOp);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `operators/${operator.id}`);
  }
}

export async function deleteOperatorFromCloud(operatorId: string): Promise<void> {
  try {
    await deleteDoc(getDocRef("operators", operatorId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `operators/${operatorId}`);
  }
}

export async function bulkSyncOperatorsToCloud(operators: Operator[]): Promise<void> {
  const batch = writeBatch(db);
  for (const op of operators) {
    const cleanOp: any = { ...op, shift: op.shift || "A" };
    Object.keys(cleanOp).forEach((key) => cleanOp[key] === undefined && delete cleanOp[key]);
    batch.set(getDocRef("operators", op.id), cleanOp);
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "operators(batch)");
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
        !newOpIds.has(docSnap.id) &&
        (!shiftToReplace || docShift === shiftToReplace);

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
      const cleanOp: any = { ...op, shift: op.shift || "A" };
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

export async function syncHistoryRecordToCloud(record: MoveHistoryRecord): Promise<void> {
  try {
    const cleanRecord: any = { ...record };
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
      handleFirestoreError(error, OperationType.LIST, "templates");
      if (onError) onError(error);
    },
  );
}

export async function syncTemplateToCloud(template: ShiftTemplate): Promise<void> {
  try {
    const cleanTemplate: any = { ...template };
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
    const cleanDept: any = { ...dept };
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
