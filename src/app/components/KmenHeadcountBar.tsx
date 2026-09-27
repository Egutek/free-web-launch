import React, { useMemo } from "react";
import { Users, RotateCcw, AlertCircle } from "lucide-react";
import { Operator, ShiftCode } from "../types";
import { deduplicateOperators } from "../utils/nameMatching";
import { getRosterGroup, isPermanentOperator } from "../utils/roster";

interface KmenHeadcountBarProps {
  operators: Operator[];
  activeShift: ShiftCode;
  onOpenTransport: () => void;
  onOpenVna: () => void;
  onOpenResetShift?: () => void;
  onQuickAssign?: (operatorId: string) => void;
}

export const KmenHeadcountBar: React.FC<KmenHeadcountBarProps> = ({
  operators,
  activeShift,
  onOpenTransport,
  onOpenVna,
  onOpenResetShift,
}) => {
  const cleanOperators = useMemo(() => {
    return deduplicateOperators(operators).deduplicated;
  }, [operators]);

  // Transport operators: permanent operators in this shift not belonging to VNA
  const transportOps = cleanOperators.filter(
    (o) =>
      (o.shift || "A") === activeShift &&
      isPermanentOperator(o) && getRosterGroup(o) === "transport",
  );

  // VNA operators: permanent operators in this shift for VNA
  const vnaOps = cleanOperators.filter(
    (o) =>
      (o.shift || "A") === activeShift &&
      isPermanentOperator(o) && getRosterGroup(o) === "vna",
  );

  // Missing from board (waiting in unassigned without absence)
  const transportMissing = transportOps.filter(
    (o) => o.departmentId === "unassigned" && !o.absenceReason,
  );
  const vnaMissing = vnaOps.filter((o) => o.departmentId === "unassigned" && !o.absenceReason);
  const allMissing = [...transportMissing, ...vnaMissing];

  // Extra operators in this shift (mimo stálý stav - výpomoc / brigáda)
  const transportExtra = cleanOperators.filter(
    (o) => (o.shift || "A") === activeShift && o.isPermanent === false && o.departmentId !== "vna",
  );
  const vnaExtra = cleanOperators.filter(
    (o) => (o.shift || "A") === activeShift && o.isPermanent === false && o.departmentId === "vna",
  );
  const allExtra = [...transportExtra, ...vnaExtra];

  return (
    <div
      id="kmen-headcount-bar"
      className="bg-white/95 dark:bg-slate-900/95 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs px-3 py-1.5 flex items-center justify-between gap-2.5 flex-wrap backdrop-blur-md select-none"
    >
      {/* Left: Just the core numbers */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 hidden sm:inline">
          Kmen (Směna {activeShift}):
        </span>

        {/* Transport Pill Button */}
        <button
          type="button"
          id="kmen-transport-btn"
          onClick={onOpenTransport}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-all cursor-pointer active:scale-95 shadow-2xs"
          title={`Stálí zaměstnanci Transport (${transportOps.length})${transportMissing.length > 0 ? ` • ${transportMissing.length} chybí na tabuli!` : ""}${transportExtra.length > 0 ? ` • ${transportExtra.length} navíc mimo kmen` : ""}`}
        >
          <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Transport:</span>
          <span className="font-black text-sm text-blue-800 dark:text-blue-200">
            {transportOps.length}
          </span>
          {transportMissing.length > 0 && (
            <span
              className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-black text-[10px] animate-pulse leading-none flex items-center justify-center shadow-xs"
              title={`${transportMissing.length} stálých operátorů Transport nebylo nalezeno na tabuli (${transportMissing.map((o) => o.name).join(", ")})`}
            >
              ! {transportMissing.length}
            </span>
          )}
          {transportExtra.length > 0 && (
            <span
              className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] leading-none flex items-center justify-center shadow-xs"
              title={`${transportExtra.length} pracovníků navíc mimo stálý stav (${transportExtra.map((o) => o.name).join(", ")})`}
            >
              ! +{transportExtra.length}
            </span>
          )}
        </button>

        {/* VNA Pill Button */}
        <button
          type="button"
          id="kmen-vna-btn"
          onClick={onOpenVna}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-all cursor-pointer active:scale-95 shadow-2xs"
          title={`Stálí zaměstnanci VNA (${vnaOps.length})${vnaMissing.length > 0 ? ` • ${vnaMissing.length} chybí na tabuli!` : ""}${vnaExtra.length > 0 ? ` • ${vnaExtra.length} navíc mimo kmen` : ""}`}
        >
          <span>VNA:</span>
          <span className="font-black text-sm text-emerald-800 dark:text-emerald-200">
            {vnaOps.length}
          </span>
          {vnaMissing.length > 0 && (
            <span
              className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-black text-[10px] animate-pulse leading-none flex items-center justify-center shadow-xs"
              title={`${vnaMissing.length} stálých operátorů VNA nebylo nalezeno na tabuli (${vnaMissing.map((o) => o.name).join(", ")})`}
            >
              ! {vnaMissing.length}
            </span>
          )}
          {vnaExtra.length > 0 && (
            <span
              className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] leading-none flex items-center justify-center shadow-xs"
              title={`${vnaExtra.length} pracovníků navíc mimo stálý stav (${vnaExtra.map((o) => o.name).join(", ")})`}
            >
              ! +{vnaExtra.length}
            </span>
          )}
        </button>

        {/* Unobtrusive alert if someone is missing from whiteboard */}
        {allMissing.length > 0 && (
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-300/70 dark:border-rose-800/80 animate-in fade-in"
            title={`Tito stálí operátoři nebyli na tabuli nalezeni a čekají v nezařazených: ${allMissing
              .map((o) => o.name)
              .join(", ")}`}
          >
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">
              !
            </span>
            <span>
              {allMissing.length} {allMissing.length === 1 ? "chybí na tabuli" : "chybí na tabuli"}
              {allMissing.length <= 2 && (
                <span className="font-normal ml-1">
                  ({allMissing.map((o) => o.name).join(", ")})
                </span>
              )}
            </span>
          </div>
        )}

        {/* Unobtrusive alert if someone is extra (navíc mimo kmen) */}
        {allExtra.length > 0 && (
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300/70 dark:border-amber-700/80 animate-in fade-in"
            title={`Tito pracovníci jsou na tabuli navíc mimo stálý stav (výpomoc / brigáda): ${allExtra
              .map((o) => o.name)
              .join(", ")}`}
          >
            <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center shrink-0">
              !
            </span>
            <span>
              {allExtra.length} {allExtra.length === 1 ? "navíc mimo kmen" : "navíc mimo kmen"}
              {allExtra.length <= 2 && (
                <span className="font-normal ml-1">({allExtra.map((o) => o.name).join(", ")})</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Right: Reset shift */}
      {onOpenResetShift && (
        <button
          type="button"
          id="kmen-reset-shift-btn"
          onClick={onOpenResetShift}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          title="Resetovat směnu (přesunout k novému rozřazení)"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset směny</span>
        </button>
      )}
    </div>
  );
};
