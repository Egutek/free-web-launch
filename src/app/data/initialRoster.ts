import { RosterMember } from "../types";
import {
  INITIAL_OPERATORS,
  INITIAL_OPERATORS_SHIFT_B,
  INITIAL_OPERATORS_SHIFT_C,
} from "./initialOperators";

// Generates initial roster from the 65 ZF PICK operators
// Transport TL: HOVC, HOVS, Putaway, VAS, OBWF, OBWI
// VNA TL: VNA (Kolega)
export const INITIAL_ROSTER_MEMBERS: RosterMember[] = [
  // Shift A Members
  ...INITIAL_OPERATORS.map((op, idx) => ({
    id: `roster-a-${idx + 1}`,
    name: op.name,
    teamLeader: op.departmentId === "vna" ? ("vna" as const) : ("transport" as const),
    defaultDepartmentId: op.departmentId,
    defaultMachineType: op.machineType,
    shift: "A" as const,
    isActiveInRoster: true,
    notes: op.notes || (op.departmentId === "vna" ? "VNA kmen" : "Transport kmen"),
    createdAt: new Date().toISOString(),
  })),

  // Shift B Members
  ...INITIAL_OPERATORS_SHIFT_B.map((op, idx) => ({
    id: `roster-b-${idx + 1}`,
    name: op.name,
    teamLeader: op.departmentId === "vna" ? ("vna" as const) : ("transport" as const),
    defaultDepartmentId: op.departmentId,
    defaultMachineType: op.machineType,
    shift: "B" as const,
    isActiveInRoster: true,
    notes: op.notes || (op.departmentId === "vna" ? "VNA kmen" : "Transport kmen"),
    createdAt: new Date().toISOString(),
  })),

  // Shift C Members
  ...INITIAL_OPERATORS_SHIFT_C.map((op, idx) => ({
    id: `roster-c-${idx + 1}`,
    name: op.name,
    teamLeader: op.departmentId === "vna" ? ("vna" as const) : ("transport" as const),
    defaultDepartmentId: op.departmentId,
    defaultMachineType: op.machineType,
    shift: "C" as const,
    isActiveInRoster: true,
    notes: op.notes || (op.departmentId === "vna" ? "VNA kmen" : "Transport kmen"),
    createdAt: new Date().toISOString(),
  })),
];
