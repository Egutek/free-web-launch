import React, { useState, useMemo } from "react";
import { X, Plus, Trash2, Users, Search } from "lucide-react";
import { Operator, ShiftCode } from "../types";
import { deduplicateOperators, isNameMatch, cleanNameForMatching } from "../utils/nameMatching";

interface KmenRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "transport" | "vna";
  activeShift: ShiftCode;
  operators: Operator[];
  onAdd: (name: string, type: "transport" | "vna") => void;
  onRemove: (operatorId: string) => void;
}

export const KmenRosterModal: React.FC<KmenRosterModalProps> = ({
  isOpen,
  onClose,
  type,
  activeShift,
  operators,
  onAdd,
  onRemove,
}) => {
  const [newName, setNewName] = useState("");
  const [filterQuery, setFilterQuery] = useState("");

  const uniqueOperators = useMemo(() => {
    return deduplicateOperators(operators).deduplicated;
  }, [operators]);

  if (!isOpen) return null;

  const title = type === "transport" ? "Kmen Transport" : "Kmen VNA";
  const filtered = uniqueOperators.filter((o) =>
    o.name.toLowerCase().includes(filterQuery.toLowerCase().trim()),
  );

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAdd(trimmed, type);
    setNewName("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl text-white flex items-center justify-center font-bold text-sm shadow-xs ${
                type === "transport" ? "bg-blue-600" : "bg-emerald-600"
              }`}
            >
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{title}</h3>
                <span
                  className={`text-xs font-black px-2 py-0.5 rounded-full ${
                    type === "transport"
                      ? "bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300"
                      : "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300"
                  }`}
                >
                  {uniqueOperators.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Směna {activeShift} • Stálý evidenční stav operátorů
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Add Form: Just name and Add button */}
        <form
          onSubmit={handleAddSubmit}
          className="p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Jméno nového zaměstnance..."
            className="flex-1 px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-xs flex items-center gap-1 transition-all cursor-pointer shrink-0 active:scale-95 disabled:opacity-40 ${
              type === "transport"
                ? "bg-blue-600 hover:bg-blue-500"
                : "bg-emerald-600 hover:bg-emerald-500"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Přidat</span>
          </button>
        </form>

        {/* Search filter if more than 6 employees */}
        {operators.length > 6 && (
          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Hledat v seznamu..."
                className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* List of Employees: Only Name and Remove */}
        <div className="p-2 overflow-y-auto space-y-0.5 flex-1 divide-y divide-slate-100 dark:divide-slate-800/60 max-h-96">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              {filterQuery ? "Žádný zaměstnanec neodpovídá." : "Žádní zaměstnanci v kmeni."}
            </div>
          ) : (
            filtered.map((op, idx) => (
              <div
                key={op.id}
                className="flex items-center justify-between py-2 px-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 text-[11px] font-mono text-slate-400 text-right shrink-0">
                    {idx + 1}.
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    {op.name}
                  </span>
                  {op.departmentId === "unassigned" && !op.absenceReason && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/60 shrink-0 animate-pulse">
                      ! Chybí na tabuli
                    </span>
                  )}
                  {op.departmentId === "unassigned" && op.absenceReason && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 shrink-0">
                      {op.absenceReason}
                    </span>
                  )}
                  {op.departmentId !== "unassigned" && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 shrink-0">
                      {op.departmentId.toUpperCase()}
                      {op.machineType && op.machineType !== "NONE" ? ` (${op.machineType})` : ""}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(op.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                  title={`Odebrat ${op.name} ze stálého stavu`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Celkem: <strong>{operators.length}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
};
