import {
  AILearningEvent,
  AbsenceReason,
  DepartmentId,
  MachineType,
  Operator,
  OperatorLearnedProfile,
  RosterMember,
  ShiftCode,
  TeamLeaderRole,
} from "../types";
import { normalizeNameForMatching } from "../utils/rosterMatcher";
import { DEPARTMENTS, getDepartmentById } from "../data/departments";
import { INITIAL_ROSTER_MEMBERS } from "../data/initialRoster";
import { INITIAL_OPERATORS_SHIFT_A } from "../data/initialOperators";

const AI_PROFILES_KEY = "zf_ai_learned_profiles_v2";
const AI_EVENTS_KEY = "zf_ai_learning_events_v2";

/**
 * Normalizuje jméno pro indexaci profilu
 */
export function getLearnedKey(name: string): string {
  return normalizeNameForMatching(name);
}

/**
 * Načte všechny naučené profily z localStorage
 */
export function loadLearnedProfiles(): Map<string, OperatorLearnedProfile> {
  const map = new Map<string, OperatorLearnedProfile>();
  try {
    const raw = localStorage.getItem(AI_PROFILES_KEY);
    if (raw) {
      const list: OperatorLearnedProfile[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const p of list) {
          if (p && p.normalizedName) {
            map.set(p.normalizedName, p);
          }
        }
      }
    }
  } catch (e) {
    console.warn("Chyba při načítání AI profilů z localStorage:", e);
  }

  // Pokud je paměť prázdná, inicializujeme ji výchozími znalostmi z kmenového stavu
  if (map.size === 0) {
    seedInitialKnowledge(map);
  }

  return map;
}

/**
 * Uloží profily do localStorage
 */
export function saveLearnedProfiles(map: Map<string, OperatorLearnedProfile>): void {
  try {
    const list = Array.from(map.values());
    localStorage.setItem(AI_PROFILES_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("Chyba při ukládání AI profilů:", e);
  }
}

/**
 * Načte nedávné události AI na pozadí
 */
export function loadAILearningEvents(): AILearningEvent[] {
  try {
    const raw = localStorage.getItem(AI_EVENTS_KEY);
    if (raw) {
      const list: AILearningEvent[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        return list;
      }
    }
  } catch (e) {
    console.warn("Chyba při načítání událostí AI:", e);
  }
  return [];
}

/**
 * Uloží událost AI do auditního logu (uchovává posledních 60 událostí)
 */
export function logAILearningEvent(
  event: Omit<AILearningEvent, "id" | "timestamp">,
): AILearningEvent {
  const newEvent: AILearningEvent = {
    id: `ai-ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };

  try {
    const current = loadAILearningEvents();
    const updated = [newEvent, ...current].slice(0, 60);
    localStorage.setItem(AI_EVENTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Chyba při ukládání AI události:", e);
  }

  return newEvent;
}

/**
 * Inicializuje základní paměť AI ze stávajícího kmenového stavu a operátorů
 */
function seedInitialKnowledge(map: Map<string, OperatorLearnedProfile>): void {
  // 1. Z kmenového stavu
  for (const m of INITIAL_ROSTER_MEMBERS) {
    const key = getLearnedKey(m.name);
    const isVna = m.teamLeader === "vna" || m.defaultDepartmentId === "vna";
    const primaryDept = m.defaultDepartmentId || (isVna ? "vna" : "hovc");
    const machine = m.defaultMachineType || (isVna ? "NONE" : "LL");
    const team: TeamLeaderRole = isVna ? "vna" : "transport";

    map.set(key, {
      name: m.name,
      normalizedName: key,
      totalObservations: 12,
      primaryTeam: team,
      primaryDepartmentId: primaryDept,
      frequentMachineType: machine,
      departmentFrequency: { [primaryDept]: 10 },
      machineFrequency: { [machine]: 10 },
      absenceFrequency: {},
      shiftFrequency: { [m.shift && m.shift !== "all" ? m.shift : "A"]: 10 },
      lastObservedAt: new Date().toISOString(),
      confidence: 0.95,
      learnedRuleDescription: isVna
        ? "Stálý tým VNA (2. Team Leader) – uličky vysokozdvižných zakladačů."
        : `Dlouhodobě jezdí Transport (obvykle ${getDepartmentById(primaryDept).name}, stroj ${machine}). Při PN/absenci spadá pod Tým Transport (1. TL).`,
    });
  }

  // 2. Ze směny A
  for (const op of INITIAL_OPERATORS_SHIFT_A) {
    const key = getLearnedKey(op.name);
    const existing = map.get(key);
    const isVna = op.departmentId === "vna" || op.isVnaOnly;
    const team: TeamLeaderRole = isVna ? "vna" : "transport";

    if (!existing) {
      map.set(key, {
        name: op.name,
        normalizedName: key,
        totalObservations: 8,
        primaryTeam: team,
        primaryDepartmentId: op.departmentId === "unassigned" ? "hovc" : op.departmentId,
        frequentMachineType: op.machineType,
        departmentFrequency: {
          [op.departmentId === "unassigned" ? "hovc" : op.departmentId]: 6,
        },
        machineFrequency: { [op.machineType]: 6 },
        absenceFrequency: op.absenceReason ? { [op.absenceReason]: 1 } : {},
        shiftFrequency: { A: 8 },
        lastObservedAt: new Date().toISOString(),
        confidence: 0.9,
        learnedRuleDescription: isVna
          ? "Specialista na VNA uličky."
          : `Transport operátor (${getDepartmentById(op.departmentId).name}). Přiřazován pod 1. Team Leadera.`,
      });
    }
  }

  saveLearnedProfiles(map);
}

/**
 * Zaznamená a naučí se chování z operace na webu (pohyb, změna stroje, označení PN)
 */
export function recordOperatorActivity(
  op: {
    name: string;
    departmentId: DepartmentId;
    machineType?: MachineType;
    status?: string;
    shift?: ShiftCode;
    absenceReason?: AbsenceReason;
    isVnaOnly?: boolean;
  },
  action: "move" | "machine" | "absence" | "import" | "status",
  details?: string,
): OperatorLearnedProfile {
  const map = loadLearnedProfiles();
  const key = getLearnedKey(op.name);

  const existing: OperatorLearnedProfile = map.get(key) || {
    name: op.name,
    normalizedName: key,
    totalObservations: 0,
    primaryTeam: op.departmentId === "vna" || op.isVnaOnly ? "vna" : "transport",
    primaryDepartmentId: op.departmentId !== "unassigned" ? op.departmentId : "hovc",
    frequentMachineType: op.machineType || "LL",
    departmentFrequency: {},
    machineFrequency: {},
    absenceFrequency: {},
    shiftFrequency: {},
    lastObservedAt: new Date().toISOString(),
    confidence: 0.5,
    learnedRuleDescription: "",
  };

  // 1. Inkrementace pozorování
  existing.totalObservations += 1;
  existing.lastObservedAt = new Date().toISOString();

  // 2. Aktualizace oddělení (pokud není unassigned)
  if (op.departmentId && op.departmentId !== "unassigned") {
    existing.departmentFrequency[op.departmentId] =
      (existing.departmentFrequency[op.departmentId] || 0) + 1;
  }

  // 3. Aktualizace strojů
  if (op.machineType && op.machineType !== "NONE") {
    existing.machineFrequency[op.machineType] =
      (existing.machineFrequency[op.machineType] || 0) + 1;
  }

  // 4. Aktualizace absencí (PN, Dovolená)
  if (op.absenceReason) {
    existing.absenceFrequency[op.absenceReason] =
      (existing.absenceFrequency[op.absenceReason] || 0) + 1;
  }

  // 5. Aktualizace směny
  if (op.shift) {
    existing.shiftFrequency[op.shift] = (existing.shiftFrequency[op.shift] || 0) + 1;
  }

  // 6. Přepočet dominantního oddělení
  let topDept: DepartmentId = existing.primaryDepartmentId;
  let maxDeptCount = 0;
  for (const [dept, count] of Object.entries(existing.departmentFrequency)) {
    if (count > maxDeptCount) {
      maxDeptCount = count;
      topDept = dept as DepartmentId;
    }
  }
  existing.primaryDepartmentId = topDept;

  // 7. Přepočet dominantního stroje
  let topMachine: MachineType = existing.frequentMachineType;
  let maxMachineCount = 0;
  for (const [mach, count] of Object.entries(existing.machineFrequency)) {
    if (count > maxMachineCount) {
      maxMachineCount = count;
      topMachine = mach as MachineType;
    }
  }
  existing.frequentMachineType = topMachine;

  // 8. Určení dominantního týmu (Transport vs VNA)
  const isVnaHeavy =
    (existing.departmentFrequency["vna"] || 0) >
      maxDeptCount - (existing.departmentFrequency["vna"] || 0) || op.isVnaOnly;
  existing.primaryTeam = isVnaHeavy ? "vna" : "transport";

  // 9. Výpočet míry spolehlivosti (confidence 0.5 -> 0.99)
  existing.confidence = Math.min(0.99, 0.5 + Math.min(0.48, existing.totalObservations * 0.05));

  // 10. Formulace slovního pravidla
  const deptObj = getDepartmentById(existing.primaryDepartmentId);
  if (existing.primaryTeam === "vna") {
    existing.learnedRuleDescription = `AI: Profil VNA týmu (2. TL) na základě ${existing.totalObservations} záznamů docházky.`;
  } else {
    existing.learnedRuleDescription = `AI: Dlouhodobě jezdí Transport (dominantně ${deptObj.name}, stroj ${existing.frequentMachineType}). Při PN/absenci spadá pod Tým Transport (1. TL).`;
  }

  map.set(key, existing);
  saveLearnedProfiles(map);

  // Zalogovat událost
  if (action === "absence" && op.absenceReason === "PN") {
    logAILearningEvent({
      operatorName: op.name,
      eventType: "absence_pn",
      appliedTeam: existing.primaryTeam,
      departmentId: existing.primaryDepartmentId,
      details: `Operátor ${op.name} označen na PN. AI jej na základě ${existing.totalObservations} historických směn automaticky započetla pod ${existing.primaryTeam === "vna" ? "Tým VNA" : "Tým Transport"}.`,
    });
  } else if (action === "move") {
    logAILearningEvent({
      operatorName: op.name,
      eventType: "move",
      appliedTeam: existing.primaryTeam,
      departmentId: op.departmentId,
      details: `Přesun na oddělení ${deptObj.name}. Znalostní báze aktualizována (${existing.totalObservations} pozorování).`,
    });
  }

  return existing;
}

/**
 * Hromadné naučení všech operátorů na směně
 */
export function recordBatchActivity(
  operators: Operator[],
  shift: ShiftCode,
  roster: RosterMember[] = [],
): void {
  for (const op of operators) {
    if (op.departmentId && op.departmentId !== "unassigned") {
      recordOperatorActivity(
        {
          name: op.name,
          departmentId: op.departmentId,
          machineType: op.machineType,
          status: op.status,
          shift: op.shift || shift,
          absenceReason: op.absenceReason,
          isVnaOnly: op.isVnaOnly,
        },
        "move",
        "Dávkové naučení směny",
      );
    } else if (op.absenceReason) {
      recordOperatorActivity(
        {
          name: op.name,
          departmentId: "unassigned",
          machineType: op.machineType,
          status: "absence",
          shift: op.shift || shift,
          absenceReason: op.absenceReason,
          isVnaOnly: op.isVnaOnly,
        },
        "absence",
        `Absence ${op.absenceReason}`,
      );
    }
  }
}

/**
 * Najde naučený profil pro dané jméno (s fuzzy tolerancí)
 */
export function findLearnedProfile(name: string): OperatorLearnedProfile | null {
  const map = loadLearnedProfiles();
  const key = getLearnedKey(name);

  // Přesná shoda
  if (map.has(key)) {
    return map.get(key)!;
  }

  // Hledání shody tokenů (např. "Novák Jan" vs "Jan Novák")
  const searchTokens = key.split(" ").filter((t) => t.length > 0);
  for (const profile of map.values()) {
    const profTokens = profile.normalizedName.split(" ").filter((t) => t.length > 0);
    if (
      searchTokens.length === profTokens.length &&
      searchTokens.every((t) => profTokens.includes(t))
    ) {
      return profile;
    }
  }

  return null;
}

/**
 * Zjistí tým pro daného operátora (Transport vs VNA) s prioritou pro naučené chování AI.
 * Řeší přesně: "kdo je na PN tak rovnou ho přiřadila pod transport protože tam jezdí"
 */
export function getSmartTeamForOperator(
  name: string,
  currentDeptId?: DepartmentId,
  absenceReason?: AbsenceReason,
  roster: RosterMember[] = [],
): {
  team: TeamLeaderRole;
  confidence: number;
  reason: string;
  learnedProfile: OperatorLearnedProfile | null;
} {
  // 1. Zkusíme najít naučený AI profil
  const profile = findLearnedProfile(name);

  if (profile) {
    if (absenceReason === "PN" || absenceReason === "Absence" || absenceReason === "Dovolená") {
      return {
        team: profile.primaryTeam,
        confidence: profile.confidence,
        reason: `🤖 AI pravidlo: Dlouhodobě jezdí ${profile.primaryTeam === "vna" ? "VNA" : "Transport"} (${profile.totalObservations} směn). Při absenci (${absenceReason}) započten pod ${profile.primaryTeam === "vna" ? "Tým VNA" : "Tým Transport"}.`,
        learnedProfile: profile,
      };
    }

    if (currentDeptId === "vna") {
      return {
        team: "vna",
        confidence: 0.95,
        reason: "Aktuálně nasazen na uličkách VNA.",
        learnedProfile: profile,
      };
    }

    return {
      team: profile.primaryTeam,
      confidence: profile.confidence,
      reason: profile.learnedRuleDescription,
      learnedProfile: profile,
    };
  }

  // 2. Fallback na kmenový stav (roster)
  const clean = getLearnedKey(name);
  const rosterMatch = roster.find((r) => getLearnedKey(r.name) === clean);
  if (rosterMatch) {
    const isVna = rosterMatch.teamLeader === "vna" || rosterMatch.defaultDepartmentId === "vna";
    return {
      team: isVna ? "vna" : "transport",
      confidence: 0.85,
      reason: `Podle stálého stavu spadá pod ${isVna ? "Tým VNA (2. TL)" : "Tým Transport (1. TL)"}.`,
      learnedProfile: null,
    };
  }

  // 3. Výchozí pravidlo pro ZF Ostrov: 90% lidí jezdí Transport
  const isVnaDept = currentDeptId === "vna";
  return {
    team: isVnaDept ? "vna" : "transport",
    confidence: 0.6,
    reason: isVnaDept
      ? "Přiřazen do oddělení VNA."
      : "Nový pracovník – výchozí zařazení do Týmu Transport.",
    learnedProfile: null,
  };
}

/**
 * Vygeneruje inteligentní návrhy AI pro všechny nezařazené operátory
 */
export function generateAISuggestionsForUnassigned(
  unassignedOperators: Operator[],
  roster: RosterMember[] = [],
): Array<{
  operator: Operator;
  suggestedDeptId: DepartmentId;
  suggestedMachine: MachineType;
  suggestedTeam: TeamLeaderRole;
  confidencePercent: number;
  explanation: string;
}> {
  const suggestions = [];

  for (const op of unassignedOperators) {
    const profile = findLearnedProfile(op.name);
    if (profile) {
      const dept = getDepartmentById(profile.primaryDepartmentId);
      suggestions.push({
        operator: op,
        suggestedDeptId: profile.primaryDepartmentId,
        suggestedMachine: profile.frequentMachineType || "LL",
        suggestedTeam: profile.primaryTeam,
        confidencePercent: Math.round(profile.confidence * 100),
        explanation: `Na základě ${profile.totalObservations} předchozích směn obvykle jezdí v ${dept.name} se strojem ${profile.frequentMachineType}.`,
      });
    } else {
      // Fallback ze stálého stavu
      const clean = getLearnedKey(op.name);
      const rm = roster.find((r) => getLearnedKey(r.name) === clean);
      if (rm && rm.defaultDepartmentId && rm.defaultDepartmentId !== "unassigned") {
        const dept = getDepartmentById(rm.defaultDepartmentId);
        suggestions.push({
          operator: op,
          suggestedDeptId: rm.defaultDepartmentId,
          suggestedMachine: rm.defaultMachineType || "LL",
          suggestedTeam: rm.teamLeader || "transport",
          confidencePercent: 75,
          explanation: `Výchozí oddělení ze stálého stavu: ${dept.name}.`,
        });
      }
    }
  }

  return suggestions;
}
