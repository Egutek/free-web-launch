import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, UserPlus, UserCheck, Trash2, Users, Sparkles, Check, ChevronDown } from "lucide-react";
import { DEPARTMENTS, getDepartmentById } from "../data/departments";
import {
  Department,
  DepartmentId,
  MachineType,
  Operator,
  OperatorStatus,
  ShiftCode,
  AbsenceReason,
  RosterMember,
  TeamLeaderRole,
} from "../types";
import { normalizeNameForMatching } from "../utils/rosterMatcher";

interface AddEditOperatorModalProps {
  operator: Operator | null;
  defaultDeptId?: DepartmentId;
  customDepartments?: Department[];
  activeShift?: ShiftCode;
  roster?: RosterMember[];
  currentOperators?: Operator[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (operatorData: Partial<Operator>) => void;
  onDelete?: (operatorId: string) => void;
  onAddRosterMember?: (member: Omit<RosterMember, "id" | "createdAt">) => void;
}

export const AddEditOperatorModal: React.FC<AddEditOperatorModalProps> = ({
  operator,
  defaultDeptId = "hovc",
  customDepartments = [],
  activeShift = "A",
  roster = [],
  currentOperators = [],
  isOpen,
  onClose,
  onSave,
  onDelete,
  onAddRosterMember,
}) => {
  const [name, setName] = useState("");
  const [machineType, setMachineType] = useState<MachineType>("NONE");
  const [departmentId, setDepartmentId] = useState<DepartmentId>(defaultDeptId);
  const [shift, setShift] = useState<ShiftCode>(activeShift);
  const [status, setStatus] = useState<OperatorStatus>("active");
  const [absenceReason, setAbsenceReason] = useState<AbsenceReason>("Absence");
  const [notes, setNotes] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Also add to permanent roster state
  const [addToRosterToo, setAddToRosterToo] = useState(false);
  const [rosterTL, setRosterTL] = useState<TeamLeaderRole>("transport");

  // Autocomplete suggestion state
  const [isNameDropdownOpen, setIsNameDropdownOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Active shift operators set for checking who is already active on shift
  const activeShiftOperatorNames = useMemo(() => {
    const names = new Set<string>();
    currentOperators
      .filter((o) => (o.shift || "A") === activeShift)
      .forEach((o) => {
        names.add(normalizeNameForMatching(o.name));
      });
    return names;
  }, [currentOperators, activeShift]);

  // Missing roster members for the selected department
  const deptMissingRoster = useMemo(() => {
    if (!roster || roster.length === 0) return [];
    return roster.filter((m) => {
      const matchDept = (m.defaultDepartmentId || "hovc") === departmentId;
      const matchShift = !m.shift || m.shift === "all" || m.shift === activeShift;
      const isAlreadyOnShift = activeShiftOperatorNames.has(normalizeNameForMatching(m.name));
      return matchDept && matchShift && !isAlreadyOnShift;
    });
  }, [roster, departmentId, activeShift, activeShiftOperatorNames]);

  // All missing roster members for autocomplete
  const filteredRosterSuggestions = useMemo(() => {
    if (!roster || roster.length === 0) return [];
    const q = normalizeNameForMatching(name);
    return roster
      .filter((m) => {
        const isShiftMatch = !m.shift || m.shift === "all" || m.shift === activeShift;
        if (!isShiftMatch) return false;
        if (!q) {
          // If empty query, show members for current department who are missing
          return (m.defaultDepartmentId || "hovc") === departmentId;
        }
        return normalizeNameForMatching(m.name).includes(q);
      })
      .slice(0, 6);
  }, [roster, name, activeShift, departmentId]);

  // Check if currently typed name matches any roster member
  const matchedRosterMember = useMemo(() => {
    if (!name.trim() || !roster) return null;
    const norm = normalizeNameForMatching(name);
    return roster.find((m) => normalizeNameForMatching(m.name) === norm) || null;
  }, [name, roster]);

  useEffect(() => {
    setIsConfirmingDelete(false);
    setIsNameDropdownOpen(false);
    setAddToRosterToo(false);

    if (operator) {
      setName(operator.name);
      setMachineType(operator.machineType || "NONE");
      setDepartmentId(operator.departmentId);
      setShift(operator.shift || activeShift);
      setStatus(operator.status);
      setAbsenceReason(operator.absenceReason || "Absence");
      setNotes(operator.notes || "");
    } else {
      setName("");
      const initialMachine =
        defaultDeptId === "vna" || defaultDeptId === "unassigned"
          ? "NONE"
          : defaultDeptId === "hovc" || defaultDeptId === "obwi" || defaultDeptId === "hovs"
            ? "RTR"
            : "LL";
      setMachineType(initialMachine);
      setDepartmentId(defaultDeptId);
      setShift(activeShift);
      setStatus(defaultDeptId === "unassigned" ? "absence" : "active");
      setAbsenceReason("Absence");
      setNotes("");
    }
  }, [operator, defaultDeptId, activeShift, isOpen]);

  if (!isOpen) return null;

  const handleSelectRosterMember = (member: RosterMember) => {
    setName(member.name);
    if (member.defaultDepartmentId && departmentId === "unassigned") {
      setDepartmentId(member.defaultDepartmentId);
    } else if (member.defaultDepartmentId) {
      setDepartmentId(member.defaultDepartmentId);
    }
    setMachineType(member.defaultMachineType || "LL");
    if (member.notes) {
      setNotes((prev) => (prev ? `${prev} • ${member.notes}` : member.notes || ""));
    }
    setIsNameDropdownOpen(false);
  };

  const handleDepartmentChange = (newDeptId: DepartmentId) => {
    setDepartmentId(newDeptId);
    if (newDeptId === "vna" || newDeptId === "unassigned") {
      setMachineType("NONE");
    } else if (
      (newDeptId === "hovc" || newDeptId === "obwi" || newDeptId === "hovs") &&
      machineType === "NONE"
    ) {
      setMachineType("RTR");
    } else if (newDeptId === "putaway" && machineType === "NONE") {
      setMachineType("LL");
    }

    if (newDeptId === "unassigned") {
      setStatus("absence");
    } else if (status === "absence") {
      setStatus("active");
    }
  };

  const handleStatusChange = (newStatus: OperatorStatus) => {
    setStatus(newStatus);
    if (newStatus === "absence" && departmentId !== "unassigned") {
      setDepartmentId("unassigned");
    } else if (newStatus !== "absence" && departmentId === "unassigned") {
      setDepartmentId(defaultDeptId === "unassigned" ? "hovc" : defaultDeptId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const trimmedName = name.trim();

    onSave({
      id: operator ? operator.id : `op-${Date.now()}`,
      name: trimmedName,
      shift,
      machineType,
      departmentId,
      isVnaOnly: departmentId === "vna",
      status,
      absenceReason:
        status === "absence" || departmentId === "unassigned" ? absenceReason : undefined,
      notes: notes.trim(),
      lastMovedAt: operator ? operator.lastMovedAt : new Date().toISOString(),
    });

    // If user requested to add to permanent roster as well
    if (addToRosterToo && !matchedRosterMember && onAddRosterMember) {
      onAddRosterMember({
        name: trimmedName,
        teamLeader: rosterTL,
        defaultDepartmentId: departmentId === "unassigned" ? "hovc" : departmentId,
        defaultMachineType: departmentId === "vna" ? "NONE" : machineType,
        shift: shift,
        isActiveInRoster: true,
        notes: notes.trim() || undefined,
      });
    }

    onClose();
  };

  return (
    <div
      id="add-edit-operator-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="add-edit-operator-dialog"
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              {operator ? <UserCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {operator ? "Upravit operátora" : "Přidat operátora do PICK"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {operator ? operator.name : "Rychlé zadání do systému"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Quick Roster Selection Chips (when adding new operator) */}
          {!operator && deptMissingRoster.length > 0 && (
            <div className="p-2.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
                <span className="font-bold flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>Doplnit z kmene ({deptMissingRoster.length} chybí):</span>
                </span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400">
                  1-klikem vyplní
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-0.5">
                {deptMissingRoster.map((m) => (
                  <button
                    key={`chip-${m.id}`}
                    type="button"
                    onClick={() => handleSelectRosterMember(m)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white text-slate-800 dark:text-slate-200 border border-blue-200 dark:border-blue-800/80 shadow-2xs transition-all cursor-pointer group active:scale-95"
                    title={`Vybrat ${m.name} (${m.defaultMachineType || "LL"})`}
                  >
                    <span>{m.name}</span>
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 group-hover:bg-blue-700 group-hover:text-white">
                      {m.defaultMachineType || "LL"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name input with smart autocomplete */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Jméno a příjmení *
              </label>
              {matchedRosterMember ? (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded flex items-center gap-1 border border-emerald-200 dark:border-emerald-800/60">
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>
                    Kmen: {matchedRosterMember.teamLeader === "transport" ? "Transport" : "VNA"}
                  </span>
                </span>
              ) : !operator && name.trim().length >= 2 ? (
                <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  Nový mimo kmen (výpomoc)
                </span>
              ) : null}
            </div>

            <div className="relative">
              <input
                ref={nameInputRef}
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setIsNameDropdownOpen(true);
                }}
                onFocus={() => {
                  if (filteredRosterSuggestions.length > 0) setIsNameDropdownOpen(true);
                }}
                placeholder="např. Jan Novák (nebo vyberte z kmene)"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />

              {!operator && roster.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsNameDropdownOpen((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  title="Rozbalit nabídku kmene"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Autocomplete Dropdown */}
            {!operator && isNameDropdownOpen && filteredRosterSuggestions.length > 0 && (
              <div
                className="absolute z-30 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden text-xs divide-y divide-slate-100 dark:divide-slate-700/80 animate-in fade-in"
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900/60 text-[10px] font-bold text-slate-500 flex items-center justify-between">
                  <span>Doporučení z kmene:</span>
                  <button
                    type="button"
                    onClick={() => setIsNameDropdownOpen(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    Zavřít
                  </button>
                </div>
                {filteredRosterSuggestions.map((m) => {
                  const mDept = getDepartmentById(m.defaultDepartmentId || "hovc");
                  const isOnShift = activeShiftOperatorNames.has(normalizeNameForMatching(m.name));

                  return (
                    <div
                      key={`sug-${m.id}`}
                      onClick={() => handleSelectRosterMember(m)}
                      className={`px-3 py-2 flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer transition-colors ${
                        isOnShift ? "opacity-60" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 dark:text-white block truncate">
                          {m.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <span>{m.teamLeader === "transport" ? "Transport" : "VNA"}</span>
                          <span>•</span>
                          <span>{mDept.name}</span>
                          {isOnShift && (
                            <span className="text-amber-600 font-semibold">(již na směně)</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {m.defaultMachineType || "LL"}
                        </span>
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          Vybrat →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Option to also add to permanent roster if entering a new person */}
          {!operator && !matchedRosterMember && name.trim().length >= 2 && onAddRosterMember && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200 select-none">
                <input
                  type="checkbox"
                  checked={addToRosterToo}
                  onChange={(e) => setAddToRosterToo(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span>Uložit také do trvalého kmene (rosteru)</span>
              </label>

              {addToRosterToo && (
                <div className="pl-6 pt-1 flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Kmenový Team Leader:</span>
                  <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => setRosterTL("transport")}
                      className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                        rosterTL === "transport"
                          ? "bg-blue-600 text-white shadow-2xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      Transport
                    </button>
                    <button
                      type="button"
                      onClick={() => setRosterTL("vna")}
                      className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                        rosterTL === "vna"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      VNA
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Machine qualification: LL, RTR or NONE */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Stroj / Oprávnění
              </label>
              <span className="text-[11px] text-slate-400">Volitelné (lze ignorovat)</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMachineType(machineType === "LL" ? "NONE" : "LL")}
                className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                  machineType === "LL"
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-extrabold ring-2 ring-amber-500/30"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                }`}
              >
                <div className="text-sm font-black">LL</div>
                <div className="text-[10px] opacity-75">Nízkozdvih</div>
              </button>

              <button
                type="button"
                onClick={() => setMachineType(machineType === "RTR" ? "NONE" : "RTR")}
                className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                  machineType === "RTR"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-extrabold ring-2 ring-blue-500/30"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                }`}
              >
                <div className="text-sm font-black">RTR</div>
                <div className="text-[10px] opacity-75">Retrak</div>
              </button>

              <button
                type="button"
                onClick={() => setMachineType("NONE")}
                className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                  machineType === "NONE"
                    ? "border-slate-500 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white font-extrabold ring-2 ring-slate-400/30"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100"
                }`}
              >
                <div className="text-sm font-bold">Žádný</div>
                <div className="text-[10px] opacity-75">Ignorovat</div>
              </button>
            </div>
            {machineType === "NONE" && (
              <p className="mt-1 text-[10px] text-slate-400 italic">
                U tohoto operátora se nebude zobrazovat žádný štítek stroje LL ani RTR.
              </p>
            )}
          </div>

          {/* Shift (Směna A / B / C) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Přiřazená směna *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["A", "B", "C"] as ShiftCode[]).map((sc) => (
                <button
                  key={`edit-op-shift-${sc}`}
                  type="button"
                  onClick={() => setShift(sc)}
                  className={`py-1.5 px-3 rounded-xl border text-center transition-all cursor-pointer font-bold text-xs ${
                    shift === sc
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/30"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                  }`}
                >
                  Směna {sc}
                </button>
              ))}
            </div>
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Oddělení v rámci PICK *
            </label>
            <select
              value={departmentId}
              onChange={(e) => handleDepartmentChange(e.target.value as DepartmentId)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold"
            >
              <optgroup label="Hlavní oddělení PICK">
                {DEPARTMENTS.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </optgroup>
              {customDepartments.length > 0 && (
                <optgroup label="Vícepráce a mimořádné úkoly">
                  {customDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Status (Active / Break / Absence) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Stav operátora
            </label>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as OperatorStatus)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">🟢 Aktivní (na hale)</option>
              <option value="break">🟡 Pauza</option>
              <option value="absence">🔴 Nepřítomen</option>
            </select>
          </div>

          {/* Důvod nepřítomnosti (Absence / Dovolená / PN) */}
          {(status === "absence" || departmentId === "unassigned") && (
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Důvod nepřítomnosti *
                </label>
                <span className="text-[11px] text-slate-400">Podkategorie</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["Absence", "Dovolená", "PN"] as AbsenceReason[]).map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setAbsenceReason(reason)}
                    className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                      absenceReason === reason
                        ? reason === "Dovolená"
                          ? "border-amber-400 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 font-bold ring-2 ring-amber-400/30"
                          : reason === "PN"
                            ? "border-rose-400 bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 font-bold ring-2 ring-rose-400/30"
                            : "border-slate-400 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-bold ring-2 ring-slate-400/30"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                    }`}
                  >
                    <div className="text-xs font-bold">{reason}</div>
                    <div className="text-[9.5px] opacity-75">
                      {reason === "Dovolená"
                        ? "Plánované volno"
                        : reason === "PN"
                          ? "Nemoc / PN"
                          : "Absence"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Poznámka (volitelné)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="např. zástup, školení..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            {operator && onDelete ? (
              isConfirmingDelete ? (
                <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(operator.id);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ano, smazat!</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg"
                  >
                    Zpět
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Smazat operátora</span>
                </button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Zrušit
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shadow-sm"
              >
                {operator ? "Uložit" : "Přidat"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
