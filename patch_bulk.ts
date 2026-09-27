import fs from "fs";
let code = fs.readFileSync("src/app/services/firestoreSync.ts", "utf-8");
code = code.replace(
  "export async function bulkSyncOperatorsToCloud(operators: Operator[]): Promise<void> {",
  `import { writeBatch } from "firebase/firestore";
export async function bulkSyncOperatorsToCloud(operators: Operator[]): Promise<void> {
  const batch = writeBatch(db);
  for (const op of operators) {
    const cleanOp: any = { ...op };
    Object.keys(cleanOp).forEach(key => cleanOp[key] === undefined && delete cleanOp[key]);
    batch.set(getDocRef("operators", op.id), cleanOp);
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "operators(batch)");
  }
}`,
);
code = code.replace(`  for (const op of operators) {\n    await syncOperatorToCloud(op);\n  }`, ``);
fs.writeFileSync("src/app/services/firestoreSync.ts", code);
