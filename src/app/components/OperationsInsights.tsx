import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Copy,
  ExternalLink,
  History,
  LayoutDashboard,
  ListChecks,
  Maximize2,
  Minimize2,
  RefreshCw,
  Users,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Department, MoveHistoryRecord, Operator, ShiftCode } from "../types";

interface OperationsInsightsProps {
  operators: Operator[];
  departments: Department[];
  history: MoveHistoryRecord[];
  activeShift: ShiftCode;
  isCloudConnected: boolean;
  isCloudSyncing: boolean;
  onOpenHistory: () => void;
  onOpenRoster: () => void;
  onOpenReport: () => void;
  onSetView: (view: "board" | "table" | "widget") => void;
  onEditOperator: (operator: Operator) => void;
}

const statusLabels: Record<Operator["status"], string> = {
  active: "V provozu",
  break: "Pauza",
  absence: "Absence",
};

const statusClasses: Record<Operator["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  break: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  absence: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

function formatTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
}

export function OperationsInsights({
  operators,
  departments,
  history,
  activeShift,
  isCloudConnected,
  isCloudSyncing,
  onOpenHistory,
  onOpenRoster,
  onOpenReport,
  onSetView,
  onEditOperator,
}: OperationsInsightsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const metrics = useMemo(() => {
    const active = operators.filter(
      (operator) => operator.departmentId !== "unassigned" && operator.status === "active",
    ).length;
    const breaks = operators.filter(
      (operator) => operator.departmentId !== "unassigned" && operator.status === "break",
    ).length;
    const absences = operators.filter(
      (operator) => operator.departmentId === "unassigned" || operator.status === "absence",
    ).length;
    const staffed = operators.filter((operator) => operator.departmentId !== "unassigned").length;
    return { active, breaks, absences, staffed };
  }, [operators]);

  const attentionOperators = useMemo(
    () =>
      [...operators]
        .filter(
          (operator) =>
            operator.departmentId === "unassigned" ||
            operator.status === "absence" ||
            operator.status === "break",
        )
        .sort((a, b) => {
          const priority = (operator: Operator) =>
            operator.departmentId === "unassigned" || operator.status === "absence" ? 0 : 1;
          return priority(a) - priority(b) || a.name.localeCompare(b.name, "cs");
        })
        .slice(0, 5),
    [operators],
  );

  const coverage = useMemo(
    () =>
      departments
        .filter((department) => department.id !== "unassigned")
        .map((department) => {
          const count = operators.filter(
            (operator) =>
              operator.departmentId === department.id &&
              operator.status !== "absence",
          ).length;
          const target = Math.max(0, department.targetCount || 0);
          return {
            department,
            count,
            target,
            delta: target > 0 ? count - target : 0,
            percentage: target > 0 ? Math.min(100, Math.round((count / target) * 100)) : 100,
          };
        })
        .sort((a, b) => a.percentage - b.percentage),
    [departments, operators],
  );

  const copySummary = async () => {
    const summary = [
      `ZF Operativa • směna ${activeShift}`,
      `Obsazeno: ${metrics.staffed} | V provozu: ${metrics.active} | Pauza: ${metrics.breaks} | Absence: ${metrics.absences}`,
      ...coverage.slice(0, 7).map(
        ({ department, count, target }) =>
          `${department.code || department.name}: ${count}${target ? `/${target}` : ""}`,
      ),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      aria-label="Operační přehled směny"
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/90"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3 dark:border-slate-800/80">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <Activity className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
                Operační přehled
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                Směna {activeShift}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Co potřebuje pozornost právě teď
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              isCloudSyncing
                ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                : isCloudConnected
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
            }`}
          >
            {isCloudSyncing ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : isCloudConnected ? (
              <Wifi className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            {isCloudSyncing ? "Synchronizuji" : isCloudConnected ? "Živě" : "Offline"}
          </span>
          <button
            type="button"
            onClick={copySummary}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:text-blue-300"
          >
            {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Zkopírováno" : "Kopírovat stav"}
          </button>
          <button
            type="button"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((value) => !value)}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300"
            title={isExpanded ? "Sbalit přehled" : "Rozbalit přehled"}
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="grid gap-3 p-3 lg:grid-cols-[1.1fr_1.4fr_1.2fr]">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
            {[
              { label: "Obsazeno", value: metrics.staffed, icon: Users, tone: "text-blue-600 bg-blue-500/10" },
              { label: "V provozu", value: metrics.active, icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-500/10" },
              { label: "Pauza", value: metrics.breaks, icon: Clock3, tone: "text-amber-600 bg-amber-500/10" },
              { label: "Absence", value: metrics.absences, icon: AlertTriangle, tone: "text-rose-600 bg-rose-500/10" },
            ].map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{value}</div>
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{label}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-800">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Obsazenost oddělení</h3>
                <p className="mt-0.5 text-[11px] text-slate-400">Nejnižší pokrytí je nahoře</p>
              </div>
              <BarChart3 className="h-4 w-4 text-slate-400" />
            </div>
            <div className="space-y-2">
              {coverage.slice(0, 5).map(({ department, count, target, delta, percentage }) => (
                <button
                  key={department.id}
                  type="button"
                  onClick={() => onSetView("board")}
                  className="group w-full text-left"
                  title={`Otevřít oddělení ${department.name}`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate font-bold text-slate-700 group-hover:text-blue-700 dark:text-slate-200 dark:group-hover:text-blue-300">
                      {department.code || department.name}
                    </span>
                    <span className={`shrink-0 font-black ${delta < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {count}{target ? `/${target}` : ""}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${delta < 0 ? "bg-rose-500" : "bg-emerald-500"}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-800">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pozornost</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {attentionOperators.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {attentionOperators.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-2.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Všichni jsou správně zařazeni.
                </div>
              ) : (
                attentionOperators.map((operator) => (
                  <button
                    key={operator.id}
                    type="button"
                    onClick={() => onEditOperator(operator)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <UserRound className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{operator.name}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${statusClasses[operator.status]}`}>
                      {operator.departmentId === "unassigned" ? "Nezařazen" : statusLabels[operator.status]}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 border-t border-slate-200/70 px-3 py-2 dark:border-slate-800/80">
        <button type="button" onClick={() => onSetView("board")} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-extrabold text-white transition hover:bg-blue-700">
          <LayoutDashboard className="h-3.5 w-3.5" /> Tabule
        </button>
        <button type="button" onClick={() => onSetView("table")} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300">
          <ListChecks className="h-3.5 w-3.5" /> Tabulka
        </button>
        <button type="button" onClick={onOpenRoster} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300">
          <ClipboardList className="h-3.5 w-3.5" /> Kmen
        </button>
        <button type="button" onClick={onOpenHistory} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300">
          <History className="h-3.5 w-3.5" /> Historie ({history.length})
        </button>
        <button type="button" onClick={onOpenReport} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300">
          <ExternalLink className="h-3.5 w-3.5" /> Report
        </button>
      </div>
    </section>
  );
}
