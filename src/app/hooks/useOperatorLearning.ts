import { useState, useEffect, useCallback } from "react";
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

  // Automatické průběžné učení z aktuálního stavu směny
  useEffect(() => {
    if (operators.length > 0) {
      recordBatchActivity(operators, activeShift, roster);
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
