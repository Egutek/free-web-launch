import React, { useState } from "react";
import {
  X,
  PackageCheck,
  Boxes,
  ArrowDownToLine,
  Wrench,
  Layers,
  GitCommitVertical,
  Globe,
  UserX,
  Coffee,
  Check,
  Truck,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Shield,
  Smartphone,
} from "lucide-react";
import {
  Operator,
  DepartmentId,
  MachineType,
  OperatorStatus,
  AbsenceReason,
  Department,
} from "../types";
import { DEPARTMENTS } from "../data/departments";

interface MobileOperatorDrawerProps {
  operator: Operator | null;
  customDepartments?: Department[];
  onClose: () => void;
  onMoveDepartment: (
    operatorId: string,
    targetDeptId: DepartmentId,
    absenceReason?: AbsenceReason,
  ) => void;
  onChangeMachineType: (operatorId: string, machineType: MachineType) => void;
  onChangeStatus: (operatorId: string, status: OperatorStatus) => void;
  onChangeAbsenceReason?: (operatorId: string, reason: AbsenceReason) => void;
  onEditOperator?: (operator: Operator) => void;
}

const COMMON_DEPARTMENTS: {
  id: DepartmentId;
  name: string;
  code: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  border: string;
  defaultMachine: MachineType;
}[] = [
  {
    id: "hovc",
    name: "Outbound",
    code: "HOVC",
    icon: PackageCheck,
    color: "text-blue-400",
    bg: "bg-blue-500/10 active:bg-blue-500/25",
    border: "border-blue-500/30",
    defaultMachine: "RTR",
  },
  {
    id: "hovs",
    name: "HOVS",
    code: "HOVS",
    icon: Boxes,
    color: "text-sky-400",
    bg: "bg-sky-500/10 active:bg-sky-500/25",
    border: "border-sky-500/30",
    defaultMachine: "LL",
  },
  {
    id: "putaway",
    name: "Putaway",
    code: "PUT",
    icon: ArrowDownToLine,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10 active:bg-indigo-500/25",
    border: "border-indigo-500/30",
    defaultMachine: "LL",
  },
  {
    id: "vas",
    name: "VAS",
    code: "VAS",
    icon: Wrench,
    color: "text-amber-400",
    bg: "bg-amber-500/10 active:bg-amber-500/25",
    border: "border-amber-500/30",
    defaultMachine: "LL",
  },
  {
    id: "obwf",
    name: "OBWF",
    code: "OBWF",
    icon: Layers,
    color: "text-purple-400",
    bg: "bg-purple-500/10 active:bg-purple-500/25",
    border: "border-purple-500/30",
    defaultMachine: "LL",
  },
  {
    id: "vna",
    name: "VNA",
    code: "VNA",
    icon: GitCommitVertical,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 active:bg-emerald-500/25",
    border: "border-emerald-500/30",
    defaultMachine: "NONE",
  },
  {
    id: "obwi",
    name: "OBWI",
    code: "OBWI",
    icon: Globe,
    color: "text-rose-400",
    bg: "bg-rose-500/10 active:bg-rose-500/25",
    border: "border-rose-500/30",
    defaultMachine: "RTR",
  },
  {
    id: "unassigned",
    name: "Absence",
    code: "ABS",
    icon: UserX,
    color: "text-red-400",
    bg: "bg-red-500/10 active:bg-red-500/25",
    border: "border-red-500/30",
    defaultMachine: "NONE",
  },
];

const ABSENCE_REASONS: AbsenceReason[] = [
  "Absence",
  "Lékař",
  "Nemoc / PN",
  "Dovolená",
  "Neomluveno",
  "Školení",
  "Jiné",
];

export const MobileOperatorDrawer: React.FC<MobileOperatorDrawerProps> = ({
  operator,
  customDepartments = [],
  onClose,
  onMoveDepartment,
  onChangeMachineType,
  onChangeStatus,
  onChangeAbsenceReason,
  onEditOperator,
}) => {
  const [showAbsenceOptions, setShowAbsenceOptions] = useState(false);

  if (!operator) return null;

  const currentDept =
    DEPARTMENTS.find((d) => d.id === operator.departmentId) ||
    customDepartments.find((d) => d.id === operator.departmentId);

  const handleSelectDept = (deptId: DepartmentId) => {
    if (deptId === "unassigned") {
      setShowAbsenceOptions(true);
      return;
    }
    onMoveDepartment(operator.id, deptId);
    onClose();
  };

  const handleSelectAbsenceReason = (reason: AbsenceReason) => {
    onMoveDepartment(operator.id, "unassigned", reason);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-slate-900 border-t border-slate-700/80 rounded-t-3xl shadow-2xl p-4 sm:p-5 max-h-[90vh] overflow-y-auto space-y-4 animate-in slide-in-from-bottom duration-200"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* Top Handle */}
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-1" />

        {/* Operator Header Bar */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white truncate tracking-tight">
                {operator.name}
              </h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                Směna {operator.shift || "A"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>Aktuálně:</span>
              <span className="font-semibold text-sky-400">
                {currentDept?.name || "Nepřiřazen"}
              </span>
              <span>•</span>
              <span className="font-mono text-slate-300">
                {operator.machineType === "NONE" ? "Bez stroje" : operator.machineType}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Shift Target - 1-Click Thumb Presets */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span>Rychlý přesun na oddělení (1 klik)</span>
            <span className="text-[10px] text-sky-400 font-normal">Ovládání palcem</span>
          </div>

          {!showAbsenceOptions ? (
            <div className="grid grid-cols-2 gap-2">
              {COMMON_DEPARTMENTS.map((dept) => {
                const isCurrent = operator.departmentId === dept.id;
                const Icon = dept.icon;
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => handleSelectDept(dept.id)}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer active:scale-95 ${
                      isCurrent
                        ? "bg-sky-600 border-sky-400 text-white shadow-md ring-2 ring-sky-400/30"
                        : `${dept.bg} ${dept.border} text-slate-200 hover:border-slate-500`
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`p-2 rounded-xl ${
                          isCurrent ? "bg-white/20 text-white" : dept.color
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm truncate leading-tight">
                          {dept.name}
                        </div>
                        <div
                          className={`text-[10px] font-mono ${
                            isCurrent ? "text-sky-100" : "text-slate-400"
                          }`}
                        >
                          {dept.code}
                        </div>
                      </div>
                    </div>
                    {isCurrent && <Check className="w-4 h-4 shrink-0 text-white" />}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Absence sub-selection */
            <div className="space-y-2 bg-red-950/20 border border-red-500/30 p-3 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-300">Vyberte důvod absence:</span>
                <button
                  type="button"
                  onClick={() => setShowAbsenceOptions(false)}
                  className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Zpět na oddělení
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {ABSENCE_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => handleSelectAbsenceReason(reason)}
                    className="p-2.5 rounded-xl bg-slate-900 border border-red-500/30 hover:border-red-400 active:bg-red-500/30 text-xs font-medium text-slate-200 text-left cursor-pointer transition-colors active:scale-95"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom departments if any */}
          {customDepartments.length > 0 && !showAbsenceOptions && (
            <div className="mt-2.5 pt-2 border-t border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-1.5">
                Mimořádné úkoly / Vícepráce:
              </span>
              <div className="grid grid-cols-2 gap-2">
                {customDepartments.map((dept) => {
                  const isCurrent = operator.departmentId === dept.id;
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => handleSelectDept(dept.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer active:scale-95 ${
                        isCurrent
                          ? "bg-amber-600 border-amber-400 text-white shadow-md"
                          : "bg-amber-950/20 border-amber-500/30 text-amber-200 hover:border-amber-400"
                      }`}
                    >
                      <span className="text-xs font-bold truncate">{dept.name}</span>
                      {isCurrent && <Check className="w-3.5 h-3.5 shrink-0 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Machine Type Selection (LL / RTR / Bez stroje) */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Technika / Vozík
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { type: "LL", label: "LL Nízkozdvih", icon: "🚜", color: "border-amber-500/50" },
                { type: "RTR", label: "RTR Retrak", icon: "⚡", color: "border-blue-500/50" },
                { type: "NONE", label: "Bez stroje", icon: "🚶", color: "border-slate-700" },
              ] as const
            ).map((item) => {
              const isSelected = operator.machineType === item.type;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => onChangeMachineType(operator.id, item.type)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all cursor-pointer active:scale-95 ${
                    isSelected
                      ? "bg-slate-800 border-sky-400 text-white ring-2 ring-sky-400/40 font-bold"
                      : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <span className="text-base mb-0.5">{item.icon}</span>
                  <span className="text-xs">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Selection (Aktivní / Pauza) */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Stav pracovníka
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                onChangeStatus(operator.id, "active");
                if (operator.departmentId === "unassigned") {
                  onMoveDepartment(operator.id, "hovc");
                }
              }}
              className={`flex items-center justify-center gap-2 p-3 rounded-2xl border transition-all cursor-pointer active:scale-95 ${
                operator.status === "active"
                  ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold ring-2 ring-emerald-500/30"
                  : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold">V provozu (Aktivní)</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeStatus(operator.id, "break")}
              className={`flex items-center justify-center gap-2 p-3 rounded-2xl border transition-all cursor-pointer active:scale-95 ${
                operator.status === "break"
                  ? "bg-amber-950/60 border-amber-500 text-amber-300 font-bold ring-2 ring-amber-500/30"
                  : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
              }`}
            >
              <Coffee className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold">Na pauze (Svačina)</span>
            </button>
          </div>
        </div>

        {/* Footer with full edit button if needed */}
        {onEditOperator && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditOperator(operator);
              }}
              className="w-full py-2.5 rounded-xl border border-slate-700/80 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors text-center cursor-pointer active:scale-98"
            >
              Upravit jméno nebo poznámku k pracovníkovi...
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
