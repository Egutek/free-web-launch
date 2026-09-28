export type BuiltinDepartmentId =
  "hovc" | "hovs" | "putaway" | "vas" | "obwf" | "vna" | "obwi" | "unassigned";

export type DepartmentId = BuiltinDepartmentId | (string & {});

export type MachineType = "LL" | "RTR" | "NONE";

export type OperatorStatus = "active" | "break" | "absence";

export type ShiftCode = "A" | "B" | "C";
export type ShiftType = ShiftCode;

export type AbsenceReason = string;

export type TeamLeaderRole = "transport" | "vna" | "other";

export interface RosterMember {
  id: string;
  name: string;
  teamLeader: TeamLeaderRole; // 'transport' (já) | 'vna' (kolega) | 'other'
  defaultDepartmentId?: DepartmentId;
  defaultMachineType?: MachineType;
  shift?: ShiftCode | "all";
  isActiveInRoster?: boolean;
  notes?: string;
  createdAt?: string;
}

export interface Department {
  id: DepartmentId;
  name: string;
  fullName: string;
  code: string;
  description: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  iconName: string;
  targetCount: number;
  isSecondTl?: boolean;
  isCustom?: boolean;
  shift?: ShiftCode;
  createdAt?: string;
}

export interface Operator {
  id: string;
  name: string;
  machineType: MachineType; // jen LL nebo RTR
  departmentId: DepartmentId;
  isVnaOnly?: boolean; // Volitelný příznak (odemčeno pro volný přesun)
  status: OperatorStatus;
  shift?: ShiftCode; // 'A' | 'B' | 'C'
  absenceReason?: AbsenceReason; // 'Absence' | 'Dovolená' | 'PN'
  notes?: string;
  isPermanent?: boolean;
  lastMovedAt: string; // ISO string
}

export interface MoveHistoryRecord {
  id: string;
  operatorId: string;
  operatorName: string;
  machineType: MachineType;
  fromDept: DepartmentId;
  toDept: DepartmentId;
  timestamp: string;
  shift?: ShiftCode;
  reason?: string;
}

export interface UndoOperation {
  id: string;
  operatorId: string;
  operatorName: string;
  machineType: MachineType;
  fromDept: DepartmentId;
  toDept: DepartmentId;
  fromStatus?: OperatorStatus;
  toStatus?: OperatorStatus;
  shift?: ShiftCode;
  fromAbsenceReason?: AbsenceReason;
  toAbsenceReason?: AbsenceReason;
  timestamp: string;
}

export interface ShiftTemplateAssignment {
  operatorId: string;
  operatorName: string;
  departmentId: DepartmentId;
  status: OperatorStatus;
  machineType: MachineType;
  notes?: string;
}

export interface ShiftTemplate {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  isBuiltIn?: boolean;
  isDeleted?: boolean;
  operatorCount: number;
  activeCount: number;
  shift?: ShiftCode | "all";
  assignments: ShiftTemplateAssignment[];
}

export interface OperatorLearnedProfile {
  name: string;
  normalizedName: string;
  totalObservations: number;
  primaryTeam: TeamLeaderRole; // 'transport' | 'vna'
  primaryDepartmentId: DepartmentId;
  frequentMachineType: MachineType;
  departmentFrequency: Record<string, number>;
  machineFrequency: Record<string, number>;
  absenceFrequency: Record<string, number>;
  shiftFrequency: Record<string, number>;
  lastObservedAt: string;
  confidence: number; // 0.0 to 1.0
  learnedRuleDescription: string;
}

export interface AILearningEvent {
  id: string;
  timestamp: string;
  operatorName: string;
  eventType:
    | "move"
    | "absence_pn"
    | "absence_vacation"
    | "machine_change"
    | "ocr_match"
    | "auto_assigned"
    | "team_learned";
  details: string;
  appliedTeam: TeamLeaderRole;
  departmentId?: DepartmentId;
}
