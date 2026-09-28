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

export interface LoanedWorkerInfo {
  operator: Operator;
  homeTeam: "transport" | "vna";
  currentDeptId: DepartmentId;
  rosterMember: RosterMember;
}

export interface RosterDiscrepancyReport {
  totalRosterCount: number;
  presentInShiftCount: number;
  absentInShiftCount: number;
  totalAccountedCount: number;
  missingFromBoard: RosterMember[];
  extraOnBoard: Operator[]; // Pouze ti, kteří v celém kmeni vůbec nejsou (externisti/brigádníci)
  loanedWorkers: LoanedWorkerInfo[]; // Pracovníci zapůjčení z druhého týmu (z VNA na Transport nebo z Transportu na VNA)
  hasDiscrepancy: boolean;
  missingCount: number;
  extraCount: number;
  loanedCount: number;
  activeShift: ShiftCode;
  filterTL: TeamLeaderRole | "all";
}

/**
 * Zjistí, zda kmenový člen patří pod VNA (2. TL) nebo pod Transport (1. TL).
 */
export function isVnaRosterMember(member: RosterMember): boolean {
  return member.teamLeader === "vna" || member.defaultDepartmentId === "vna";
}

export function isTransportRosterMember(member: RosterMember): boolean {
  return !isVnaRosterMember(member);
}

/**
 * Zjistí, zda dané oddělení patří pod Transport (tj. Putaway, HOVS, Outbound/hovc, VAS, OBWF, OBWI).
 */
export function isTransportDepartment(deptId: DepartmentId | string): boolean {
  return deptId !== "vna" && deptId !== "unassigned";
}

/**
 * Spočítá nesrovnalosti mezi kmenem a aktuální směnou (tabulí):
 * - Kdo z kmene chybí v evidenci (není na žádném oddělení ani v absenci)
 * - Kdo z druhého týmu aktuálně vypomáhá (zapůjčen mezi Transportem a VNA)
 * - Kdo je na tabuli skutečně navíc mimo kmen (externista / brigádník bez záznamu v kmeni)
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
    const isRightTL =
      filterTL === "all"
        ? true
        : filterTL === "vna"
          ? isVnaRosterMember(m)
          : isTransportRosterMember(m);
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

  // Hledáme:
  // 1. Skutečné lidi navíc mimo kmen (nemají žádný záznam v celém kmeni)
  // 2. Zapůjčené pracovníky mezi Transportem a VNA (patří do kmenu, ale vypomáhají druhému týmu)
  const extraOnBoard: Operator[] = [];
  const loanedWorkers: LoanedWorkerInfo[] = [];

  for (const op of shiftOperators) {
    // Nepočítáme lidi v absenci jako "navíc"
    if (op.departmentId === "unassigned" || op.status === "absence") {
      continue;
    }

    // Shoda operátora s celým kmenem (Transport + VNA)
    const fullMatch = matchOperatorWithRoster(op.name, roster).match;

    if (!fullMatch) {
      // Člověk vůbec není v žádném kmeni -> skutečně navíc (externista / brigádník)
      if (filterTL === "transport") {
        if (isTransportDepartment(op.departmentId)) {
          extraOnBoard.push(op);
        }
      } else if (filterTL === "vna") {
        if (op.departmentId === "vna") {
          extraOnBoard.push(op);
        }
      } else {
        extraOnBoard.push(op);
      }
      continue;
    }

    // Člověk JE v kmeni -> NIKDY nesmí být označen jako "Lidé navíc na směně / mimo kmen"!
    const isVnaMember = isVnaRosterMember(fullMatch);

    if (filterTL === "transport") {
      // Díváme se na Transport:
      // Pokud VNA člověk pracuje na Transportním oddělení -> je to VÝPOMOC z VNA, nikoliv člověk navíc!
      if (isVnaMember && isTransportDepartment(op.departmentId)) {
        loanedWorkers.push({
          operator: op,
          homeTeam: "vna",
          currentDeptId: op.departmentId,
          rosterMember: fullMatch,
        });
      }
    } else if (filterTL === "vna") {
      // Díváme se na VNA:
      // Pokud Transportní člověk pracuje na VNA -> je to VÝPOMOC z Transportu, nikoliv člověk navíc!
      if (!isVnaMember && op.departmentId === "vna") {
        loanedWorkers.push({
          operator: op,
          homeTeam: "transport",
          currentDeptId: op.departmentId,
          rosterMember: fullMatch,
        });
      }
    } else {
      // Celý sklad: zachytit jakékoliv křížové výpomoci mezi týmy
      if (isVnaMember && isTransportDepartment(op.departmentId)) {
        loanedWorkers.push({
          operator: op,
          homeTeam: "vna",
          currentDeptId: op.departmentId,
          rosterMember: fullMatch,
        });
      } else if (!isVnaMember && op.departmentId === "vna") {
        loanedWorkers.push({
          operator: op,
          homeTeam: "transport",
          currentDeptId: op.departmentId,
          rosterMember: fullMatch,
        });
      }
    }
  }

  const totalAccountedCount = presentInShiftCount + absentInShiftCount;
  const missingCount = missingFromBoard.length;
  const extraCount = extraOnBoard.length;
  const loanedCount = loanedWorkers.length;

  return {
    totalRosterCount: shiftRoster.length,
    presentInShiftCount,
    absentInShiftCount,
    totalAccountedCount,
    missingFromBoard,
    extraOnBoard,
    loanedWorkers,
    hasDiscrepancy: missingCount > 0 || extraCount > 0 || loanedCount > 0,
    missingCount,
    extraCount,
    loanedCount,
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

export interface MissingDepartmentRosterMember {
  member: RosterMember;
  status: "missing_from_shift" | "in_absence" | "on_other_department";
  currentDeptId?: DepartmentId;
  absenceReason?: AbsenceReason;
  existingOperatorId?: string;
}

export interface DepartmentHeadcountValidation {
  departmentId: DepartmentId;
  expectedRosterCount: number;
  actualActiveCount: number;
  actualTotalCount: number;
  targetCount: number;
  diff: number; // actualActiveCount - expectedRosterCount
  hasDiscrepancy: boolean;
  hasSignificantDiscrepancy: boolean;
  status: "balanced" | "deficit" | "surplus";
  severity: "none" | "moderate" | "significant";
  label: string;
  tooltip: string;
  expectedMembers: RosterMember[];
  missingMembers: MissingDepartmentRosterMember[];
  extraOperators: Operator[];
  loanedOperators: Operator[];
}

/**
 * Validace obsazení oddělení oproti očekávanému kmeni pro danou směnu.
 * Sleduje počet aktivních operátorů v provozu vůči oficiálnímu kmenu.
 * Klíčové pravidlo:
 * Všechna transportní oddělení (Putaway, HOVS, Outbound, VAS, OBWF, OBWI)
 * patří pod jednotný KMEN TRANSPORT (1. TL). Kmenoví operátoři Transportu
 * zde nejsou falešně označováni za "navíc" ani "zapůjčené z Outboundu"!
 * VNA (2. TL) má svůj samostatný kmen.
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
      targetCount: 0,
      diff: 0,
      hasDiscrepancy: false,
      hasSignificantDiscrepancy: false,
      status: "balanced",
      severity: "none",
      label: "Absence",
      tooltip: "Evidence absencí (dovolené, PN, absence)",
      expectedMembers: [],
      missingMembers: [],
      extraOperators: [],
      loanedOperators: [],
    };
  }

  // Operátoři na aktuální směně
  const shiftOperators = operators.filter((o) => (o.shift || "A") === activeShift || !o.shift);

  // Operátoři přímo na tomto oddělení
  const deptOps = shiftOperators.filter((o) => o.departmentId === departmentId);
  const actualActiveCount = deptOps.filter((o) => o.status === "active").length;
  const actualTotalCount = deptOps.length;

  // 1. ODDĚLENÍ VNA (spravováno 2. Team Leaderem)
  if (departmentId === "vna") {
    const expectedMembers = roster.filter((m) => {
      const isActive = m.isActiveInRoster !== false;
      const isShiftMatch = !m.shift || m.shift === "all" || m.shift === activeShift;
      return isActive && isShiftMatch && isVnaRosterMember(m);
    });
    const expectedRosterCount = expectedMembers.length;
    const targetCount = 7;

    const missingMembers: MissingDepartmentRosterMember[] = [];
    for (const member of expectedMembers) {
      const foundOp = shiftOperators.find((o) => {
        return matchOperatorWithRoster(o.name, [member]).confidence >= 0.8;
      });

      if (!foundOp) {
        missingMembers.push({
          member,
          status: "missing_from_shift",
        });
      } else if (foundOp.departmentId === "unassigned" || foundOp.status === "absence") {
        missingMembers.push({
          member,
          status: "in_absence",
          currentDeptId: "unassigned",
          absenceReason: foundOp.absenceReason || "Absence",
          existingOperatorId: foundOp.id,
        });
      } else if (foundOp.departmentId !== "vna") {
        missingMembers.push({
          member,
          status: "on_other_department",
          currentDeptId: foundOp.departmentId,
          existingOperatorId: foundOp.id,
        });
      }
    }

    // Výpomoc z Transportu: stálí operátoři Transport kmene pracující na VNA
    const loanedOperators: Operator[] = deptOps.filter((op) => {
      if (op.status !== "active") return false;
      const match = matchOperatorWithRoster(op.name, roster).match;
      return match && isTransportRosterMember(match);
    });

    // Skutečně mimo kmen: externisté / brigádníci bez záznamu v kmeni
    const extraOperators: Operator[] = deptOps.filter((op) => {
      if (op.status !== "active") return false;
      const match = matchOperatorWithRoster(op.name, roster).match;
      return !match;
    });

    const diff = actualActiveCount - expectedRosterCount;
    const absDiff = Math.abs(diff);
    const hasDiscrepancy = absDiff > 0 || loanedOperators.length > 0 || extraOperators.length > 0;
    const isSignificant = absDiff >= 2 || extraOperators.length > 0;

    let status: "balanced" | "deficit" | "surplus" = "balanced";
    let severity: "none" | "moderate" | "significant" = "none";
    let label = `Stálý stav VNA: ${expectedRosterCount} • Nyní: ${actualActiveCount}`;
    let tooltip = `Stálý stav VNA: ${actualActiveCount} z ${expectedRosterCount} stálých VNA operátorů.`;

    if (diff < 0) {
      status = "deficit";
      severity = isSignificant ? "significant" : "moderate";
      label = `Stálý stav VNA: ${expectedRosterCount} • Nyní: ${actualActiveCount} (${diff})`;
      tooltip = `VNA podstav (${diff}): na směně je ${actualActiveCount} z ${expectedRosterCount} stálých VNA operátorů.`;
    } else if (diff > 0) {
      status = "surplus";
      severity = isSignificant ? "significant" : "moderate";
      label = `Stálý stav VNA: ${expectedRosterCount} • Nyní: ${actualActiveCount} (+${diff})`;
      tooltip = `VNA posílení (+${diff}): na směně je ${actualActiveCount} operátorů oproti ${expectedRosterCount} stálým.`;
    }

    return {
      departmentId,
      expectedRosterCount,
      actualActiveCount,
      actualTotalCount,
      targetCount,
      diff,
      hasDiscrepancy,
      hasSignificantDiscrepancy: hasDiscrepancy && isSignificant,
      status,
      severity,
      label,
      tooltip,
      expectedMembers,
      missingMembers,
      extraOperators,
      loanedOperators,
    };
  }

  // 2. TRANSPORTNÍ ODDĚLENÍ (HOVC / Outbound, Putaway, HOVS, VAS, OBWF, OBWI)
  // Všechna tato oddělení tvoří jeden společný KMEN TRANSPORT pod 1. Team Leaderem.
  // Kmenoví lidé Transportu nejsou uzamčeni na Outboundu, pracují flexibilně kdekoliv v Transportu.
  const transportRoster = roster.filter((m) => {
    const isActive = m.isActiveInRoster !== false;
    const isShiftMatch = !m.shift || m.shift === "all" || m.shift === activeShift;
    return isActive && isShiftMatch && isTransportRosterMember(m);
  });

  // Operátoři z VNA kmene, kteří vypomáhají na tomto Transportním oddělení
  const loanedOperators: Operator[] = deptOps.filter((op) => {
    if (op.status !== "active") return false;
    const match = matchOperatorWithRoster(op.name, roster).match;
    return match && isVnaRosterMember(match);
  });

  // Operátoři bez kmenového záznamu (externisté / brigádníci)
  const extraOperators: Operator[] = deptOps.filter((op) => {
    if (op.status !== "active") return false;
    const match = matchOperatorWithRoster(op.name, roster).match;
    return !match;
  });

  const hasLoaned = loanedOperators.length > 0;
  const hasExtra = extraOperators.length > 0;
  const hasDiscrepancy = hasLoaned || hasExtra;

  return {
    departmentId,
    expectedRosterCount: transportRoster.length,
    actualActiveCount,
    actualTotalCount,
    targetCount: 10,
    diff: 0,
    hasDiscrepancy,
    hasSignificantDiscrepancy: hasExtra,
    status: "balanced",
    severity: hasExtra ? "moderate" : "none",
    label: `Tým Transport (${actualActiveCount})`,
    tooltip: `Oddělení spadá pod Tým Transport (celkem ${transportRoster.length} stálých operátorů). Na tomto oddělení je ${actualActiveCount} operátorů.${hasLoaned ? ` Z toho ${loanedOperators.length} zapůjčeno z VNA.` : ""}${hasExtra ? ` Z toho ${extraOperators.length} externistů mimo stálý stav.` : ""}`,
    expectedMembers: [],
    missingMembers: [],
    extraOperators,
    loanedOperators,
  };
}
