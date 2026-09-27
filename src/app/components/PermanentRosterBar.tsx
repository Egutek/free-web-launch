import React, { useState } from "react";
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  GripVertical,
  Plus,
  HelpCircle,
  Eye,
  ShieldCheck,
  PackageCheck,
  Calendar,
} from "lucide-react";
import {
  Department,
  DepartmentId,
  Operator,
  ShiftCode,
  MachineType,
  AbsenceReason,
} from "../types";
import { startGlobalDrag, endGlobalDrag } from "../utils/dragState";

interface PermanentRosterBarProps {
  operators: Operator[];
  allDepartments: Department[];
  customDepartments?: Department[];
  activeShift: ShiftCode;
  onMoveOperator?: (
    operatorId: string,
    targetDeptId: DepartmentId,
    absenceReason?: AbsenceReason,
  ) => void;
  onOpenResetShift: () => void;
  onOpenManagePermanent: () => void;
  onOpenAddOperator?: () => void;
  onEditOperator: (operator: Operator) => void;
}

export const PermanentRosterBar: React.FC<PermanentRosterBarProps> = ({
  operators,
  allDepartments,
  customDepartments = [],
  activeShift,
  onMoveOperator,
  onOpenResetShift,
  onOpenManagePermanent,
  onOpenAddOperator,
  onEditOperator,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem("zf_roster_bar_expanded") === "true";
    } catch {
      return false;
    }
  });

  const [activeTab, setActiveTab] = useState<"waiting" | "all" | "vna">("waiting");

  const toggleExpand = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("zf_roster_bar_expanded", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Permanent operators vs non-permanent (extra/výpomoc)
  const permanentOps = operators.filter((o) => o.isPermanent !== false);
  const extraOps = operators.filter((o) => o.isPermanent === false);

  // VNA operators (managed by 2nd TL) - separated from the user's primary team
  const vnaOperators = permanentOps.filter((o) => o.departmentId === "vna" || o.isVnaOnly === true);

  // My permanent operators (excluding VNA specialists, so user doesn't get false warnings for 2nd TL)
  const myOperators = permanentOps.filter((o) => o.departmentId !== "vna" && o.isVnaOnly !== true);

  // Operators waiting for department assignment:
  // Either unassigned AND have no absenceReason, or waiting in the unassigned pool
  const waitingOperators = myOperators.filter(
    (o) => o.departmentId === "unassigned" && !o.absenceReason,
  );

  // Operators with assigned absence (Dovolená, PN, Absence)
  const absenceOperators = myOperators.filter(
    (o) => o.departmentId === "unassigned" && Boolean(o.absenceReason),
  );

  // Operators actively assigned to a department
  const assignedOperators = myOperators.filter((o) => o.departmentId !== "unassigned");

  // Total permanent count for active shift:
  // "to cislo se bude menit pouze pokud prijde nekdo nebo odejde z firmy"
  const permanentTotal = permanentOps.length;
  const myPermanentTotal = myOperators.length;

  const hasForgotten = waitingOperators.length > 0;

  // Primary operational departments for quick 1-click assignment
  const quickDepts = allDepartments.filter((d) => d.id !== "unassigned" && d.id !== "vna");

  return (
    <div
      id="permanent-roster-bar"
      className="bg-white/95 dark:bg-slate-900/95 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs backdrop-blur-md overflow-hidden transition-all duration-200 select-none"
    >
      {/* 1. COMPACT TOP SUMMARY BAR (Always visible, elegant and unobtrusive) */}
      <div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-2.5 flex-wrap">
        {/* Left: Title, Permanent Headcount & Assignment Status */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            type="button"
            onClick={toggleExpand}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
          >
            <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5" />
            </div>
            <span>Stálý stav operátorů</span>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-md">
              Směna {activeShift}
            </span>
          </button>

          {/* Stálý stav counter: changes only on join / leave */}
          <div
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border border-blue-200/80 dark:border-blue-800/80"
            title="Stálý evidenční stav operátorů na směně."
          >
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tight">
              Stálý stav:
            </span>
            <span className="text-sm font-black">{permanentTotal}</span>
          </div>

          {/* Quick Stat: Assigned count */}
          <span className="text-xs text-slate-600 dark:text-slate-300 hidden lg:inline-flex items-center gap-1">
            <span>Přiřazeno:</span>
            <strong className="font-bold text-slate-900 dark:text-white">
              {assignedOperators.length}
            </strong>
          </span>

          {/* Quick Stat: Absence count */}
          {absenceOperators.length > 0 && (
            <span className="text-xs text-slate-600 dark:text-slate-300 hidden lg:inline-flex items-center gap-1">
              <span>Absence:</span>
              <strong className="font-semibold text-slate-700 dark:text-slate-200">
                {absenceOperators.length}
              </strong>
            </span>
          )}

          {/* Warning Badge: Small exclamation mark `!` when someone is unassigned without absence */}
          {hasForgotten ? (
            <div
              onClick={() => {
                setIsExpanded(true);
                setActiveTab("waiting");
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-400/50 dark:border-amber-600/50 cursor-pointer shadow-2xs transition-all animate-pulse"
              title="Kliknutím rozbalit tabulku operátorů, kteří ještě nemají přidělené oddělení ani absenci!"
            >
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-black text-[11px] leading-none shrink-0 shadow-2xs">
                !
              </span>
              <span>
                {waitingOperators.length}{" "}
                {waitingOperators.length === 1
                  ? "operátor čeká na oddělení"
                  : waitingOperators.length < 5
                    ? "operátoři čekají na oddělení"
                    : "operátorů čeká na oddělení"}
              </span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Všichni rozřazeni (nikdo nechybí)</span>
              <span className="sm:hidden">Rozřazeno</span>
            </span>
          )}

          {/* VNA 2nd TL pill (discreet badge) */}
          <button
            type="button"
            onClick={() => {
              setIsExpanded(true);
              setActiveTab("vna");
            }}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50/70 hover:bg-emerald-100/80 dark:bg-emerald-950/30 px-2 py-0.5 rounded-lg border border-emerald-200/70 dark:border-emerald-800/40 cursor-pointer transition-colors"
            title="VNA spravuje druhý Team Leader. Klikněte pro zobrazení přehledu VNA operátorů."
          >
            <span>VNA (2. TL):</span>
            <span className="font-bold">{vnaOperators.length}</span>
          </button>

          {/* Extra operators outside permanent roster (výpomoc / jiná směna) */}
          {extraOps.length > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-lg border border-purple-200 dark:border-purple-800/60"
              title={`Operátoři navíc mimo stálý stav (${extraOps.map((o) => o.name).join(", ")}): výpomoc / jiná směna / brigádníci`}
            >
              <span>+{extraOps.length} navíc (výpomoc)</span>
            </span>
          )}
        </div>

        {/* Right: Actions (Resetovat směnu, Správa stálých, Expand/Collapse) */}
        <div className="flex items-center gap-2">
          {/* Main Action: Resetovat směnu */}
          <button
            type="button"
            id="roster-reset-shift-btn"
            onClick={onOpenResetShift}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-2xs transition-all cursor-pointer active:scale-95"
            title="Začátek směny: Přesunout všechny stálé operátory sem do nezařazených k novému rozřazení"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Resetovat směnu</span>
            <span className="sm:hidden">Reset</span>
          </button>

          {/* Manage permanent roster (add single or bulk) */}
          <button
            type="button"
            id="roster-manage-permanent-btn"
            onClick={onOpenManagePermanent}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
            title="Správa stálých zaměstnanců směny (přidat ručně nebo hromadně ze seznamu či textem)"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Stálí zaměstnanci</span>
            <span className="sm:hidden">Stálí</span>
          </button>

          {/* Expand/Collapse button */}
          <button
            type="button"
            id="roster-expand-toggle-btn"
            onClick={toggleExpand}
            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1"
            title={isExpanded ? "Sbalit přehled operátorů" : "Rozbalit přehled operátorů"}
          >
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 hidden sm:inline">
              {isExpanded ? "Skrýt" : "Zobrazit přehled"}
            </span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. EXPANDED DISCREET DRAWER (Minimal table/list, not loud or cluttered) */}
      {isExpanded && (
        <div className="border-t border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 bg-slate-50/50 dark:bg-slate-950/40 space-y-3 animate-in fade-in duration-150">
          {/* Sub-tab navigation pills */}
          <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="roster-tab-waiting"
                onClick={() => setActiveTab("waiting")}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "waiting"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700"
                }`}
              >
                <span>Čekající na oddělení ({waitingOperators.length})</span>
                {hasForgotten && (
                  <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] flex items-center justify-center shrink-0">
                    !
                  </span>
                )}
              </button>

              <button
                type="button"
                id="roster-tab-all"
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "all"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700"
                }`}
              >
                <span>Celý kmen směny ({myPermanentTotal})</span>
              </button>

              <button
                type="button"
                id="roster-tab-vna"
                onClick={() => setActiveTab("vna")}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "vna"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700"
                }`}
              >
                <span>VNA • 2. Team Leader ({vnaOperators.length})</span>
              </button>
            </div>
          </div>

          {/* TAB 1: Čekající na oddělení (Primary waiting room after shift reset) */}
          {activeTab === "waiting" && (
            <div className="space-y-2">
              {waitingOperators.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-1">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Všichni stálí operátoři mají přidělené oddělení!
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Nikdo nezůstal neobsazen. Žádný vykřičník není aktivní. Pokud potřebujete
                    připravit novou směnu, klikněte na <strong>Resetovat směnu</strong>.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* AI Watchdog banner for unassigned / missing permanent operators */}
                  <div className="p-3 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/70 rounded-xl space-y-1.5 text-xs text-amber-950 dark:text-amber-200">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-100">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          AI kontrola: {waitingOperators.length}{" "}
                          {waitingOperators.length === 1
                            ? "stálý operátor nebyl rozřazen"
                            : waitingOperators.length < 5
                              ? "stálí operátoři nebyli rozřazeni"
                              : "stálých operátorů nebylo rozřazeno"}{" "}
                          (chybí na tabuli / OCR nerozpoznalo)
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-200/80 dark:bg-amber-900/60 font-bold text-amber-900 dark:text-amber-200">
                        {waitingOperators.length} / {myPermanentTotal} PICK
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">
                      Tito operátoři jsou v paměti vašeho stálého stavu, ale zatím nemají oddělení
                      ani absenci. Můžete vyfotit tabuli a nechat AI jména přiřadit, nebo je
                      přetáhněte myší do oddělení níže.
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {waitingOperators.map((op) => (
                        <span
                          key={`waiting-chip-${op.id}`}
                          className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/80 font-bold text-[11px] text-amber-900 dark:text-amber-200 shadow-2xs flex items-center gap-1"
                        >
                          <span className="w-3.5 h-3.5 rounded-full bg-rose-500 text-white font-black text-[9px] flex items-center justify-center">
                            !
                          </span>
                          <span>{op.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 pt-1">
                    {waitingOperators.map((op) => {
                      return (
                        <div
                          key={op.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", op.id);
                            startGlobalDrag(op);
                          }}
                          onDragEnd={() => endGlobalDrag()}
                          className="bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-700/80 rounded-xl p-2.5 shadow-2xs hover:shadow-xs transition-all space-y-1.5 group cursor-grab active:cursor-grabbing"
                        >
                          {/* Operator Header: Name, Machine & Warning ! */}
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0 cursor-grab group-hover:text-blue-500" />
                              <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                                {op.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {/* Machine pill */}
                              <span
                                className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                                  op.machineType === "RTR"
                                    ? "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800"
                                    : op.machineType === "LL"
                                      ? "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800"
                                      : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                                }`}
                              >
                                {op.machineType || "Bez"}
                              </span>

                              {/* Warning Exclamation mark ! pill */}
                              <span
                                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500 text-white font-black text-[11px] leading-none shrink-0 shadow-2xs cursor-help"
                                title="Pozor: Tento stálý operátor zatím nemá přidělené oddělení ani absenci!"
                              >
                                !
                              </span>
                            </div>
                          </div>

                          {/* Minimal discreet info footer (NO department assignment clicking inside table) */}
                          <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                            <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                              <span>⚠️ Čeká na rozřazení</span>
                            </span>
                            {op.notes && (
                              <span
                                className="text-[10px] text-slate-400 truncate max-w-[120px]"
                                title={op.notes}
                              >
                                {op.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Celý kmen směny (Full roster overview) */}
          {activeTab === "all" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 gap-2 flex-wrap">
                <span>
                  Kompletní stálý kmen operátorů směny {activeShift} ({myPermanentTotal} lidí):
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">
                    Změna nastává pouze při nástupu/odchodu z firmy
                  </span>
                  <button
                    type="button"
                    onClick={onOpenManagePermanent}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-2xs cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Přidat / Upravit stálé</span>
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 scrollbar-thin">
                  {myOperators.map((op) => {
                    const dept = allDepartments.find((d) => d.id === op.departmentId);
                    const isUnassigned = op.departmentId === "unassigned";
                    const isMissing = isUnassigned && !op.absenceReason;

                    return (
                      <div
                        key={`all-roster-${op.id}`}
                        className="px-3 py-2 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {op.name}
                          </span>
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {op.machineType}
                          </span>
                          {isMissing && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                              ! Nemá oddělení
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              isUnassigned
                                ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                : "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            }`}
                          >
                            {isUnassigned
                              ? op.absenceReason || "Čeká na přiřazení"
                              : dept?.name || op.departmentId}
                          </span>

                          <button
                            type="button"
                            onClick={() => onEditOperator(op)}
                            className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            Upravit
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VNA • 2. Team Leader (Kept clean and segregated) */}
          {activeTab === "vna" && (
            <div className="space-y-2.5">
              <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-1 text-xs text-emerald-950 dark:text-emerald-200">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-100">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Oddělení VNA (správa: 2. Team Leader):</span>
                </div>
                <p className="text-emerald-800 dark:text-emerald-300 text-[11px]">
                  VNA operátory má na starosti druhý mistr. Tento přehled slouží pouze pro vaši
                  informaci. VNA operátoři se neresetují s vaší směnou a nezobrazují se ve vašem
                  čekacím přehledu s vykřičníkem.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {vnaOperators.map((op) => (
                  <div
                    key={`vna-op-${op.id}`}
                    className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80 shadow-2xs flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-extrabold text-slate-900 dark:text-white truncate">
                        {op.name}
                      </div>
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
                        Specialista pro úzké uličky VNA
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-bold border border-emerald-300 dark:border-emerald-800 shrink-0">
                      VNA
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
