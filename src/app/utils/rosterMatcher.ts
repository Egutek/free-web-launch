import { Operator, RosterMember, ShiftCode, TeamLeaderRole } from "../types";
import { ExtractedOperator } from "../services/aiServerFn";

/**
 * Normalizuje jméno pro porovnání: odstraní diakritiku, převede na malá písmena,
 * odstraní tituly/poznámky v závorkách a sjednotí mezery.
 */
export function normalizeNameForMatching(name: string): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .toLowerCase()
    .replace(/\(.*?\)/g, "") // remove parentheses notes like (TL), (SV), (PS)
    .replace(/[.,\-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Spočítá Levenshteinovu vzdálenost mezi dvěma řetězci.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost, // substitution
      );
    }
  }
  return dp[m][n];
}

/**
 * Zjistí, zda se zadané jméno shoduje s kmenovým pracovníkem.
 * Podporuje:
 * - Přesnou shodu (i bez diakritiky a bez ohledu na velikost písmen)
 * - Prohozené pořadí jméno/příjmení (např. "Svoboda David" vs "David Svoboda")
 * - Zkratky křestního jména (např. "D. Svoboda" nebo "Svoboda D.")
 * - Drobný překlep z OCR (Levenshtein do 2 znaků)
 */
export function matchOperatorWithRoster(
  name: string,
  roster: RosterMember[],
): { match: RosterMember | null; confidence: number; isExact: boolean } {
  const clean = normalizeNameForMatching(name);
  if (!clean || clean.length <= 1) {
    return { match: null, confidence: 0, isExact: false };
  }

  const cleanTokens = clean.split(" ").filter((t) => t.length > 0);

  // 1. Zkusíme přesnou shodu
  for (const member of roster) {
    const memberClean = normalizeNameForMatching(member.name);
    if (clean === memberClean) {
      return { match: member, confidence: 1.0, isExact: true };
    }
  }

  // 2. Zkusíme shodu tokenů (prohozené jméno/příjmení nebo zkratka)
  let bestMatch: RosterMember | null = null;
  let bestScore = 0;

  for (const member of roster) {
    const memberClean = normalizeNameForMatching(member.name);
    const memberTokens = memberClean.split(" ").filter((t) => t.length > 0);

    // Všechny tokeny se shodují v libovolném pořadí
    if (
      cleanTokens.length === memberTokens.length &&
      cleanTokens.every((t) => memberTokens.includes(t))
    ) {
      return { match: member, confidence: 0.98, isExact: true };
    }

    // Zkratka typu "D. Svoboda" vs "David Svoboda" nebo "Demianets D." vs "Demianets David"
    if (cleanTokens.length >= 2 && memberTokens.length >= 2) {
      const matchInitialAndSurname =
        (cleanTokens[0].length === 1 &&
          memberTokens[0].startsWith(cleanTokens[0]) &&
          cleanTokens[1] === memberTokens[1]) ||
        (cleanTokens[1].length === 1 &&
          memberTokens[1].startsWith(cleanTokens[1]) &&
          cleanTokens[0] === memberTokens[0]) ||
        (memberTokens[0].length === 1 &&
          cleanTokens[0].startsWith(memberTokens[0]) &&
          cleanTokens[1] === memberTokens[1]);

      if (matchInitialAndSurname) {
        return { match: member, confidence: 0.95, isExact: false };
      }
    }

    // Levenshtein fuzzy match
    const dist = levenshteinDistance(clean, memberClean);
    const maxLen = Math.max(clean.length, memberClean.length);
    const similarity = 1 - dist / maxLen;

    if (similarity > 0.78 && similarity > bestScore) {
      bestScore = similarity;
      bestMatch = member;
    }
  }

  if (bestMatch && bestScore >= 0.8) {
    return { match: bestMatch, confidence: bestScore, isExact: false };
  }

  return { match: null, confidence: 0, isExact: false };
}

export interface RosterDiscrepancyReport {
  totalRosterCount: number;
  presentInShiftCount: number;
  absentInShiftCount: number;
  totalAccountedCount: number;
  missingFromBoard: RosterMember[];
  extraOnBoard: Operator[];
  hasDiscrepancy: boolean;
  missingCount: number;
  extraCount: number;
  activeShift: ShiftCode;
  filterTL: TeamLeaderRole | "all";
}

/**
 * Spočítá nesrovnalosti mezi kmenem a aktuální směnou (tabulí):
 * - Kdo z kmene chybí v evidenci (není na oddělení ani v absenci)
 * - Kdo je na tabuli navíc mimo kmen (výpomoc / externista)
 */
export function computeRosterDiscrepancies(
  currentOperators: Operator[],
  roster: RosterMember[],
  activeShift: ShiftCode,
  filterTL: TeamLeaderRole | "all" = "transport",
): RosterDiscrepancyReport {
  // Filtrujeme kmen pro danou směnu a zvoleného Team Leadera
  const shiftRoster = roster.filter((m) => {
    const isRightShift = !m.shift || m.shift === "all" || m.shift === activeShift;
    const isRightTL = filterTL === "all" || m.teamLeader === filterTL;
    const isActive = m.isActiveInRoster !== false;
    return isRightShift && isRightTL && isActive;
  });

  // Operátoři na aktuální směně
  const shiftOperators = currentOperators.filter((op) => (op.shift || "A") === activeShift);

  const missingFromBoard: RosterMember[] = [];
  let presentInShiftCount = 0;
  let absentInShiftCount = 0;

  for (const member of shiftRoster) {
    // Hledáme kmenového člověka mezi operátory na směně
    const foundOp = shiftOperators.find((op) => {
      const { confidence } = matchOperatorWithRoster(op.name, [member]);
      return confidence >= 0.8;
    });

    if (foundOp) {
      if (foundOp.departmentId === "unassigned" || foundOp.status === "absence") {
        absentInShiftCount++;
      } else {
        presentInShiftCount++;
      }
    } else {
      // Člověk je v kmeni, ale není vůbec na tabuli ani v absenci!
      missingFromBoard.push(member);
    }
  }

  // Hledáme lidi na tabuli, kteří nejsou v celém kmeni (nebo v daném kmeni)
  const extraOnBoard: Operator[] = [];
  for (const op of shiftOperators) {
    const { match } = matchOperatorWithRoster(op.name, shiftRoster);
    if (!match) {
      extraOnBoard.push(op);
    }
  }

  const totalAccountedCount = presentInShiftCount + absentInShiftCount;
  const missingCount = missingFromBoard.length;
  const extraCount = extraOnBoard.length;

  return {
    totalRosterCount: shiftRoster.length,
    presentInShiftCount,
    absentInShiftCount,
    totalAccountedCount,
    missingFromBoard,
    extraOnBoard,
    hasDiscrepancy: missingCount > 0 || extraCount > 0,
    missingCount,
    extraCount,
    activeShift,
    filterTL,
  };
}

/**
 * Tichá automatická oprava jmen operátorů z OCR/fotky podle známého kmene.
 * Pokud je jméno z OCR mírně zkomolené nebo zkrácené, nahradí jej oficiálním
 * kmenovým jménem.
 */
export function reconcileExtractedOperatorsWithRoster(
  extracted: ExtractedOperator[],
  roster: RosterMember[],
): {
  operators: ExtractedOperator[];
  reconciledCount: number;
} {
  let reconciledCount = 0;

  const operators = extracted.map((op) => {
    const { match, confidence, isExact } = matchOperatorWithRoster(op.name, roster);
    if (match && !isExact && confidence >= 0.82) {
      reconciledCount++;
      return {
        ...op,
        name: match.name, // Tichá oprava na oficiální jméno z kmene
        machineType:
          op.machineType !== "NONE" ? op.machineType : match.defaultMachineType || op.machineType,
      };
    }
    if (match && isExact) {
      return {
        ...op,
        name: match.name,
      };
    }
    return op;
  });

  return { operators, reconciledCount };
}

export interface DepartmentHeadcountValidation {
  departmentId: DepartmentId;
  expectedRosterCount: number;
  actualActiveCount: number;
  actualTotalCount: number;
  diff: number; // actualActiveCount - expectedRosterCount
  hasDiscrepancy: boolean;
  hasSignificantDiscrepancy: boolean;
  status: "balanced" | "deficit" | "surplus";
  severity: "none" | "moderate" | "significant";
  label: string;
  tooltip: string;
}

/**
 * Validace obsazení oddělení oproti očekávanému kmeni pro danou směnu.
 * Sleduje počet aktivních operátorů v provozu vůči oficiálnímu kmenu.
 */
export function validateDepartmentHeadcount(
  departmentId: DepartmentId,
  operators: Operator[],
  roster: RosterMember[],
  activeShift: ShiftCode = "A",
): DepartmentHeadcountValidation {
  // Absence (unassigned) nemá fixní kmenový stav
  if (departmentId === "unassigned") {
    return {
      departmentId,
      expectedRosterCount: 0,
      actualActiveCount: 0,
      actualTotalCount: operators.filter((o) => o.departmentId === "unassigned").length,
      diff: 0,
      hasDiscrepancy: false,
      hasSignificantDiscrepancy: false,
      status: "balanced",
      severity: "none",
      label: "Absence",
      tooltip: "Evidence absencí (dovolené, PN, absence)",
    };
  }

  // Očekávaný počet kmenových lidí pro toto oddělení a směnu
  const expectedMembers = roster.filter((m) => {
    const isActive = m.isActiveInRoster !== false;
    const isShiftMatch = !m.shift || m.shift === "all" || m.shift === activeShift;
    const isDeptMatch = (m.defaultDepartmentId || "hovc") === departmentId;
    return isActive && isShiftMatch && isDeptMatch;
  });
  const expectedRosterCount = expectedMembers.length;

  // Operátoři na tomto oddělení
  const deptOps = operators.filter(
    (o) => o.departmentId === departmentId && ((o.shift || "A") === activeShift || !o.shift),
  );
  const actualActiveCount = deptOps.filter((o) => o.status === "active").length;
  const actualTotalCount = deptOps.length;

  const diff = actualActiveCount - expectedRosterCount;
  const absDiff = Math.abs(diff);

  // Pokud pro oddělení není kmen definován (např. dočasné vícepráce)
  if (expectedRosterCount === 0) {
    return {
      departmentId,
      expectedRosterCount: 0,
      actualActiveCount,
      actualTotalCount,
      diff: 0,
      hasDiscrepancy: false,
      hasSignificantDiscrepancy: false,
      status: "balanced",
      severity: "none",
      label: "Bez kmenového plánu",
      tooltip: "Pro toto oddělení není stanoven kmenový počet.",
    };
  }

  // Určení významnosti odchylky:
  // - malá oddělení (do 3 lidí): odchylka >= 1 je významná
  // - střední oddělení (4-7 lidí): odchylka >= 2 je významná
  // - velká oddělení (8+ lidí): odchylka >= 3 nebo relativní odchylka >= 25 %
  let isSignificant = false;
  if (expectedRosterCount <= 3) {
    isSignificant = absDiff >= 1;
  } else if (expectedRosterCount <= 7) {
    isSignificant = absDiff >= 2;
  } else {
    isSignificant = absDiff >= 3 || absDiff / expectedRosterCount >= 0.25;
  }

  const hasDiscrepancy = absDiff > 0;
  const hasSignificantDiscrepancy = hasDiscrepancy && isSignificant;

  let status: "balanced" | "deficit" | "surplus" = "balanced";
  let severity: "none" | "moderate" | "significant" = "none";
  let label = `Kmen: ${expectedRosterCount} • Nyní: ${actualActiveCount}`;
  let tooltip = `Obsazení odpovídá kmeni (${actualActiveCount} z ${expectedRosterCount} kmenových operátorů).`;

  if (diff < 0) {
    status = "deficit";
    severity = hasSignificantDiscrepancy ? "significant" : "moderate";
    label = `Kmen: ${expectedRosterCount} • Nyní: ${actualActiveCount} (${diff})`;
    tooltip = `Kmenová kontrola: Podstav na oddělení (${diff}). Na směně je ${actualActiveCount} operátorů z očekávaných ${expectedRosterCount} kmenových.`;
  } else if (diff > 0) {
    status = "surplus";
    severity = hasSignificantDiscrepancy ? "significant" : "moderate";
    label = `Kmen: ${expectedRosterCount} • Nyní: ${actualActiveCount} (+${diff})`;
    tooltip = `Kmenová kontrola: Přestav na oddělení (+${diff}). Na směně je ${actualActiveCount} operátorů oproti ${expectedRosterCount} kmenovým (výpomoc / posílení).`;
  }

  return {
    departmentId,
    expectedRosterCount,
    actualActiveCount,
    actualTotalCount,
    diff,
    hasDiscrepancy,
    hasSignificantDiscrepancy,
    status,
    severity,
    label,
    tooltip,
  };
}
