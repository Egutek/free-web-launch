import { Operator, DepartmentId, MachineType, AbsenceReason } from "../types";

/**
 * Normalizes a name string for reliable comparison across OCR, handwriting,
 * and roster entries (removes diacritics, punctuation, cart codes, whitespace).
 */
export function cleanNameForMatching(name: string): string {
  if (!name) return "";

  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics (háčky, čárky)
    .replace(/\b(v\d{1,4}|rtr|ll|none|retrak|nizkozdvih)\b/gi, "") // strip vehicle codes like V47, V107 and machine indicators
    .replace(/[[\].,/#!$%^&*;:{}=\-_`~()]/g, " ") // remove punctuation
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Splits normalized name into significant word tokens (ignoring single char initials if other tokens exist).
 */
export function getNameTokens(name: string): string[] {
  const cleaned = cleanNameForMatching(name);
  return cleaned.split(" ").filter((t) => t.length > 0);
}

/**
 * Checks whether an OCR recognized name matches a roster operator name.
 * Handles:
 * - "Jan Novák" === "Novák Jan"
 * - "David Svoboda" === "Svoboda" (single surname match)
 * - "Demianets D." === "Demianets"
 * - Accent-insensitive, case-insensitive
 */
export function isNameMatch(nameA: string, nameB: string): boolean {
  const cleanedA = cleanNameForMatching(nameA);
  const cleanedB = cleanNameForMatching(nameB);

  if (!cleanedA || !cleanedB) return false;

  // 1. Direct match
  if (cleanedA === cleanedB) return true;

  const tokensA = getNameTokens(nameA);
  const tokensB = getNameTokens(nameB);

  if (tokensA.length === 0 || tokensB.length === 0) return false;

  // 2. Exact token set match in any order ("Jan Novák" vs "Novák Jan")
  if (tokensA.length === tokensB.length) {
    const setA = new Set(tokensA);
    const allMatch = tokensB.every((t) => setA.has(t));
    if (allMatch) return true;
  }

  // 3. Substring / surname token match:
  // If one name is just one word >= 3 letters (e.g. "Svoboda", "Zamrii", "Pitec")
  // and that word is in the other tokens
  if (tokensA.length === 1 && tokensA[0].length >= 3) {
    if (tokensB.includes(tokensA[0])) return true;
  }
  if (tokensB.length === 1 && tokensB[0].length >= 3) {
    if (tokensA.includes(tokensB[0])) return true;
  }

  // 4. Surname + initial match (e.g. "Pitec S" vs "Stanislav Pitec", "Demianets D" vs "Demianets")
  const mainTokensA = tokensA.filter((t) => t.length > 1);
  const mainTokensB = tokensB.filter((t) => t.length > 1);
  if (mainTokensA.length > 0 && mainTokensB.length > 0) {
    const setMainA = new Set(mainTokensA);
    const sharedCount = mainTokensB.filter((t) => setMainA.has(t)).length;
    if (sharedCount > 0 && sharedCount === Math.min(mainTokensA.length, mainTokensB.length)) {
      return true;
    }
  }

  return false;
}

/**
 * Finds the matching operator in a candidate list.
 */
export function findMatchingOperator(ocrName: string, candidates: Operator[]): Operator | null {
  if (!ocrName || candidates.length === 0) return null;

  const cleanedOcr = cleanNameForMatching(ocrName);

  // 1. Exact match, only when it identifies one person.
  const exact = candidates.filter((op) => cleanNameForMatching(op.name) === cleanedOcr);
  if (exact.length > 1) return null;
  if (exact.length === 1) return exact[0];

  // 2. Token match (reverse order / all tokens match)
  const ocrTokens = getNameTokens(ocrName);
  const sameTokens = candidates.filter((op) => {
    const opTokens = getNameTokens(op.name);
    return ocrTokens.length === opTokens.length && ocrTokens.every((t) => opTokens.includes(t));
  });
  if (sameTokens.length > 1) return null;
  if (sameTokens.length === 1) return sameTokens[0];

  // A shortened OCR name can match several people. Never silently choose the
  // first one: leave ambiguous names for manual review.
  const possible = candidates.filter((op) => isNameMatch(ocrName, op.name));
  return possible.length === 1 ? possible[0] : null;
}

export interface ReconciliationResult {
  matchedPermanent: {
    operator: Operator;
    matchedOcrName: string;
    departmentId: DepartmentId;
    machineType: MachineType;
    absenceReason?: AbsenceReason;
  }[];
  unassignedPermanent: Operator[];
  extraDetected: {
    name: string;
    departmentId: DepartmentId;
    machineType: MachineType;
    absenceReason?: AbsenceReason;
    notes?: string;
  }[];
}

/**
 * Reconciles the permanent roster of a shift with OCR recognized entries.
 */
export function reconcileRosterWithOcr(
  permanentOperators: Operator[],
  ocrItems: {
    name: string;
    departmentId: DepartmentId;
    machineType?: MachineType;
    absenceReason?: AbsenceReason;
    notes?: string;
  }[],
): ReconciliationResult {
  const matchedPermanentIds = new Set<string>();
  const matchedPermanent: ReconciliationResult["matchedPermanent"] = [];
  const extraDetected: ReconciliationResult["extraDetected"] = [];

  for (const item of ocrItems) {
    const match = findMatchingOperator(item.name, permanentOperators);
    if (match && !matchedPermanentIds.has(match.id)) {
      matchedPermanentIds.add(match.id);
      matchedPermanent.push({
        operator: match,
        matchedOcrName: item.name,
        departmentId: item.departmentId,
        machineType: item.machineType || match.machineType || "LL",
        absenceReason: item.absenceReason,
      });
    } else {
      // Name not found in permanent roster of this shift (or duplicate)
      extraDetected.push({
        name: item.name,
        departmentId: item.departmentId,
        machineType: item.machineType || "LL",
        absenceReason: item.absenceReason,
        notes: item.notes,
      });
    }
  }

  const unassignedPermanent = permanentOperators.filter((op) => !matchedPermanentIds.has(op.id));

  return {
    matchedPermanent,
    unassignedPermanent,
    extraDetected,
  };
}

/**
 * Checks if two operators represent the same person
 */
export function isSamePerson(a: Operator, b: Operator): boolean {
  // Two distinct employees can have the same name. Personnel IDs, unlike OCR
  // spellings, are safe to use for automatic deduplication and deletion.
  return a.id === b.id;
}

/**
 * Deduplicates an array of operators so that each person exists at most ONCE per shift.
 * Keeps the record with the newest `lastMovedAt` as requested by user.
 * Merges permanent status and vital flags so kmen status is never accidentally lost.
 * Returns the deduplicated list and the list of obsolete/duplicate IDs that should be cleaned up.
 */
export function deduplicateOperators(operatorsList: Operator[]): {
  deduplicated: Operator[];
  duplicateIds: string[];
} {
  const result: Operator[] = [];
  const duplicateIds: string[] = [];

  for (const op of operatorsList) {
    if (!op || !op.name) continue;
    const opShift = op.shift || "A";

    const existingIdx = result.findIndex(
      (r) => (r.shift || "A") === opShift && isSamePerson(r, op),
    );

    if (existingIdx === -1) {
      result.push({ ...op, shift: opShift });
    } else {
      const existing = result[existingIdx];

      // Compare lastMovedAt: strictly determine which record is newer
      const opTime = op.lastMovedAt ? new Date(op.lastMovedAt).getTime() : 0;
      const existingTime = existing.lastMovedAt ? new Date(existing.lastMovedAt).getTime() : 0;
      const isOpNewer = opTime > existingTime;

      const newest = isOpNewer ? op : existing;
      const older = isOpNewer ? existing : op;

      // Ensure permanent status and VNA flags are preserved
      const isPerm = existing.isPermanent === true || op.isPermanent === true;
      const isVna = existing.isVnaOnly === true || op.isVnaOnly === true;

      // Choose canonical ID: prefer stable id (e.g. op-1..op-30) over generated imported/extra ids
      const isEphemeral = (id: string) =>
        id.includes("imported") ||
        id.includes("omitted") ||
        id.includes("extra") ||
        id.includes("draft");

      let canonicalId = newest.id;
      let obsoleteId = older.id;

      if (isEphemeral(newest.id) && !isEphemeral(older.id)) {
        canonicalId = older.id;
        obsoleteId = newest.id;
      }

      if (obsoleteId && obsoleteId !== canonicalId && !duplicateIds.includes(obsoleteId)) {
        duplicateIds.push(obsoleteId);
      }

      // Preserve valid machine type
      let machine = newest.machineType;
      if (newest.departmentId === "vna" || newest.departmentId === "unassigned") {
        machine = "NONE";
      } else if (!machine || machine === "NONE") {
        machine = older.machineType || (newest.departmentId === "hovs" ? "LL" : "RTR");
      }

      const mergedNotes = [newest.notes, older.notes]
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(" | ");

      result[existingIdx] = {
        ...newest,
        id: canonicalId,
        name: newest.name || older.name,
        shift: opShift,
        departmentId: newest.departmentId,
        machineType: machine,
        status: newest.status,
        absenceReason: newest.absenceReason,
        isPermanent: isPerm,
        rosterGroup: newest.rosterGroup ?? older.rosterGroup,
        revision: newest.revision ?? older.revision,
        isVnaOnly: isVna,
        notes: mergedNotes,
        lastMovedAt: newest.lastMovedAt || older.lastMovedAt || new Date().toISOString(),
      };
    }
  }

  return { deduplicated: result, duplicateIds };
}
