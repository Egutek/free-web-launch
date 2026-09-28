import React, { useMemo } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Lightbulb,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Department, DepartmentId, Operator } from "../types";

interface DistributionAssistantProps {
  operators: Operator[];
  departments: Department[];
  onMoveOperator: (operatorId: string, targetDepartmentId: DepartmentId) => void;
  onFocusDepartment: (departmentId: DepartmentId) => void;
}

interface Recommendation {
  operator: Operator;
  from: Department;
  to: Department;
  reason: string;
}

function isCounted(operator: Operator) {
  return operator.departmentId !== "unassigned" && operator.status !== "absence";
}

function acceptsMachine(department: Department, operator: Operator) {
  if (department.id === "vna") return true;
  if (operator.machineType === "NONE") return true;
  if (department.id === "hovs") return operator.machineType === "LL";
  if (department.id === "hovc" || department.id === "obwi") return operator.machineType === "RTR";
  return true;
}

export function DistributionAssistant({
  operators,
  departments,
  onMoveOperator,
  onFocusDepartment,
}: DistributionAssistantProps) {
  const recommendations = useMemo<Recommendation[]>(() => {
    const operationalDepartments = departments.filter(
      (department) => department.id !== "unassigned" && department.targetCount > 0,
    );
    const counts = new Map(
      operationalDepartments.map((department) => [
        department.id,
        operators.filter(
          (operator) => operator.departmentId === department.id && isCounted(operator),
        ).length,
      ]),
    );
    const underfilled = operationalDepartments
      .map((department) => ({
        department,
        missing: Math.max(0, department.targetCount - (counts.get(department.id) ?? 0)),
      }))
      .filter((item) => item.missing > 0)
      .sort((a, b) => b.missing - a.missing);
    const overfilled = operationalDepartments
      .map((department) => ({
        department,
        extra: Math.max(0, (counts.get(department.id) ?? 0) - department.targetCount),
      }))
      .filter((item) => item.extra > 0)
      .sort((a, b) => b.extra - a.extra);

    const used = new Set<string>();
    const result: Recommendation[] = [];

    for (const target of underfilled) {
      let remaining = target.missing;
      for (const source of overfilled) {
        if (remaining <= 0 || source.extra <= 0) continue;
        const candidates = operators
          .filter(
            (operator) =>
              operator.departmentId === source.department.id &&
              isCounted(operator) &&
              !operator.isPermanent &&
              !used.has(operator.id) &&
              acceptsMachine(target.department, operator),
          )
          .sort((a, b) => {
            const aFlexible = a.machineType === "NONE" || !a.isVnaOnly ? 0 : 1;
            const bFlexible = b.machineType === "NONE" || !b.isVnaOnly ? 0 : 1;
            return aFlexible - bFlexible || a.name.localeCompare(b.name, "cs");
          });

        for (const operator of candidates) {
          if (remaining <= 0 || source.extra <= 0 || result.length >= 6) break;
          used.add(operator.id);
          result.push({
            operator,
            from: source.department,
            to: target.department,
            reason: `${target.department.code || target.department.name} chybí ${target.missing} lidí`,
          });
          remaining -= 1;
          source.extra -= 1;
        }
        if (result.length >= 6) break;
      }
      if (result.length >= 6) break;
    }

    return result;
  }, [departments, operators]);

  const underfilledCount = departments.filter((department) => {
    if (department.id === "unassigned" || department.targetCount <= 0) return false;
    const count = operators.filter(
      (operator) => operator.departmentId === department.id && isCounted(operator),
    ).length;
    return count < department.targetCount;
  }).length;

  return (
    <section
      aria-label="Asistent rozdělení operátorů"
      className="rounded-2xl border border-indigo-200/80 bg-indigo-50/60 p-3 shadow-sm dark:border-indigo-900/70 dark:bg-indigo-950/20"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Asistent rozdělení
            </h2>
            <p className="mt-0.5 max-w-2xl text-xs text-slate-600 dark:text-slate-300">
              Doporučení vychází z cílových stavů oddělení a dostupných lidí. Nic se nepřesune bez tvého kliknutí.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-black text-indigo-700 dark:bg-slate-900/70 dark:text-indigo-300">
          <Users className="h-3.5 w-3.5" />
          {underfilledCount} oddělení pod cílem
        </div>
      </div>

      {recommendations.length === 0 ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Nenašel jsem bezpečný přesun z přebytečného oddělení. Stav je buď vyrovnaný, nebo chybí volní lidé.
        </div>
      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {recommendations.map(({ operator, from, to, reason }) => (
            <div
              key={`${operator.id}-${to.id}`}
              className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-white/90 p-2.5 dark:border-indigo-900/60 dark:bg-slate-900/80"
            >
              <button
                type="button"
                onClick={() => onFocusDepartment(from.id)}
                className="min-w-0 flex-1 text-left"
                title={`Zobrazit oddělení ${from.name}`}
              >
                <span className="block truncate text-xs font-extrabold text-slate-800 dark:text-slate-100">
                  {operator.name}
                </span>
                <span className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-slate-500 dark:text-slate-400">
                  {from.code || from.name}
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  {to.code || to.name}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onMoveOperator(operator.id, to.id)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-extrabold text-white transition hover:bg-indigo-700 active:scale-95"
                title={reason}
              >
                Přesunout
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
          Stálí pracovníci a lidé s omezením VNA jsou z automatického návrhu vynecháni.
        </div>
      )}
    </section>
  );
}
