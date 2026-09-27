/**
 * Služba pro automatické a periodické čištění dat operátorů:
 * - Provádí kontrolu duplicitních záznamů (podle jména / ID v rámci směny)
 * - Ponechává ten s nejnovějším `lastMovedAt`
 * - Zachovává kmenový status (isPermanent: true)
 * - Odstraňuje staré a neplatné duplicity z paměti i Cloud Firestore
 */
import { Operator } from "../types";
import { deduplicateOperators } from "../utils/nameMatching";
import { bulkDeleteOperatorsFromCloud } from "./firestoreSync";
import { saveOperators } from "../utils/storage";

export interface DataCleanResult {
  cleanedOperators: Operator[];
  removedCount: number;
  duplicateIds: string[];
}

/**
 * Zkontroluje seznam operátorů a automaticky odstraní duplicitní záznamy.
 * Ponechá záznam s nejnovějším `lastMovedAt`.
 */
export async function runOperatorsDataCleaning(
  currentOperators: Operator[],
  options: { syncCloud?: boolean; persistLocal?: boolean } = {
    syncCloud: true,
    persistLocal: true,
  },
): Promise<DataCleanResult> {
  if (!currentOperators || currentOperators.length === 0) {
    return { cleanedOperators: [], removedCount: 0, duplicateIds: [] };
  }

  const { deduplicated, duplicateIds } = deduplicateOperators(currentOperators);
  const removedCount = duplicateIds.length;

  if (removedCount > 0) {
    console.info(
      `[DataCleaning] Nalezeno a vyčištěno ${removedCount} duplicitních operátorů:`,
      duplicateIds,
    );

    if (options.persistLocal) {
      saveOperators(deduplicated);
    }

    if (options.syncCloud) {
      try {
        await bulkDeleteOperatorsFromCloud(duplicateIds);
      } catch (err) {
        console.warn("[DataCleaning] Chyba při mazání duplicit z Firestore cloudu:", err);
      }
    }
  }

  return {
    cleanedOperators: deduplicated,
    removedCount,
    duplicateIds,
  };
}
