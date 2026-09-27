import type { Operator, RosterGroup } from "../types";

/** Legacy records had no rosterGroup. Infer it once for display, without changing today's assignment. */
export function getRosterGroup(operator: Operator): RosterGroup {
  return operator.rosterGroup ?? (operator.isVnaOnly || operator.departmentId === "vna" ? "vna" : "transport");
}

export function isPermanentOperator(operator: Operator): boolean {
  return operator.isPermanent !== false;
}
