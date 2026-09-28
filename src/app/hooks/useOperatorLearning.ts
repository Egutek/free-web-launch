import { useState, useEffect, useCallback, useRef } from "react";
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
import {
  loadLearnedProfiles,
  loadAILearningEvents,
  recordOperatorActivity,
  recordBatchActivity,
  findLearnedProfile,
  getSmartTeamForOperator,
  generateAISuggestionsForUnassigned,
} from "../services/operatorLearningEngine";

export function useOperatorLearning(
  operators: Operator[],
  activeShift: ShiftCode,
  roster: RosterMember[] = [],
) {
  const [profiles, setProfiles] = useState<Map<string, OperatorLearnedProfile>>(() =>
    loadLearnedProfiles(),
  );
  const [events, setEvents] = useState<AILearningEvent[]>(() => loadAILearningEvents());

  // Obnovení stavu paměti
  const refreshLearningData = useCallback(() => {
    setProfiles(loadLearnedProfiles());
    setEvents(loadAILearningEvents());
  }, []);

  // Lehké učení na pozadí: při běžné změně zpracuje jen operátory,
  // jejichž stav se skutečně změnil. Tím se zabrání opakovanému přepočtu celé směny
  // při každém Firestore snapshotu nebo renderu.
  const previousOperatorStateRef = useRef<Map<string, string>>(new Map());
  const initializedShiftRef = useRef<Set<ShiftCode>>(new Set());

  useEffect(() => {
    const shiftOperators = operators.filter((op) => (op.shift || "A") === activeShift);
    if (shiftOperators.length === 0) return;

    const nextState = new Map<string, string>();
    const changedOperators: Operator[] = [];

    for (const op of shiftOperators) {
      const signature = [
        op.name,
        op.departmentId,
        op.machineType,
        op.status,
        op.shift || activeShift,
        op.absenceReason || "",
        op.isVnaOnly ? "1" : "0",
      ].join("|");

      nextState.set(op.id, signature);

      const previousSignature = previousOperatorStateRef.current.get(op.id);
      if (previousSignature && previousSignature !== signature) {
        changedOperators.push(op);
      }
    }

    if (!initializedShiftRef.current.has(activeShift)) {
      recordBatchActivity(shiftOperators, activeShift, roster);
      initializedShiftRef.current.add(activeShift);
    } else {
      for (const op of changedOperators) {
        recordOperatorActivity(
          {
            name: op.name,
            departmentId: op.departmentId,
            machineType: op.machineType,
            status: op.status,
            shift: op.shift || activeShift,
            absenceReason: op.absenceReason,
            isVnaOnly: op.isVnaOnly,
          },
          op.departmentId === "unassigned" || op.status === "absence" ? "absence" : "status",
          "Průběžná změna stavu směny",
        );
      }
    }

    previousOperatorStateRef.current = nextState;
    if (changedOperators.length > 0 || !initializedShiftRef.current.has(activeShift)) {
      refreshLearningData();
    }
  }, [operators, activeShift, roster, refreshLearningData]);

  // Záznam jednotlivé operace
  const trackOperatorChange = useCallback(
    (
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
    ) => {
      recordOperatorActivity(op, action, details);
      refreshLearningData();
    },
    [refreshLearningData],
  );

  // Inteligentní určení týmu s vysvětlením
  const getSmartTeam = useCallback(
    (name: string, currentDeptId?: DepartmentId, absenceReason?: AbsenceReason) => {
      return getSmartTeamForOperator(name, currentDeptId, absenceReason, roster);
    },
    [roster],
  );

  // Vygenerování návrhů pro nezařazené
  const unassignedOps = operators.filter(
    (o) => (o.shift || "A") === activeShift && o.departmentId === "unassigned" && !o.absenceReason,
  );

  const aiSuggestions = generateAISuggestionsForUnassigned(unassignedOps, roster);

  return {
    learnedProfilesCount: profiles.size,
    recentEvents: events,
    profiles,
    trackOperatorChange,
    getSmartTeam,
    findLearnedProfile,
    aiSuggestions,
    refreshLearningData,
  };
}
