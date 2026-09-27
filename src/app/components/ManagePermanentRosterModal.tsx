import React, { useState, useMemo } from "react";
import {
  X,
  Users,
  UserPlus,
  FileText,
  CheckSquare,
  Square,
  Search,
  Trash2,
  Check,
  AlertCircle,
  ShieldCheck,
  Plus,
} from "lucide-react";
import { Operator, ShiftCode, MachineType, DepartmentId } from "../types";
import { getRosterGroup } from "../utils/roster";

interface ManagePermanentRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeShift: ShiftCode;
  operators: Operator[];
  onAddPermanentOperators: (newOps: Operator[]) => void;
  onUpdatePermanentStatus: (operatorIds: string[], isPermanent: boolean) => void;
  onRemoveFromPermanent: (operatorId: string) => void;
}

export const ManagePermanentRosterModal: React.FC<ManagePermanentRosterModalProps> = ({
  isOpen,
  onClose,
  activeShift,
  operators,
  onAddPermanentOperators,
  onUpdatePermanentStatus,
  onRemoveFromPermanent,
}) => {
  const [activeTab, setActiveTab] = useState<
    "bulk_select" | "bulk_text" | "single_manual" | "roster_list"
  >("bulk_select");

  // --- Sub-state for: Hromadně nakliknutím ze stávajících ---
  const [searchQuery, setSearchQuery] = useState("");
  const shiftOperators = useMemo(() => {
    return operators.filter((o) => (o.shift || "A") === activeShift);
  }, [operators, activeShift]);

  // Selected operator IDs for permanent roster (initialized from current isPermanent flags)
  const [selectedPermanentIds, setSelectedPermanentIds] = useState<Set<string>>(() => {
    const initSet = new Set<string>();
    operators.forEach((o) => {
      if ((o.shift || "A") === activeShift && o.isPermanent !== false) {
        initSet.add(o.id);
      }
    });
    return initSet;
  });

  // Re-sync when modal opens or shift changes
  React.useEffect(() => {
    if (isOpen) {
      const initSet = new Set<string>();
      operators.forEach((o) => {
        if ((o.shift || "A") === activeShift && o.isPermanent !== false) {
          initSet.add(o.id);
        }
      });
      setSelectedPermanentIds(initSet);
    }
  }, [isOpen, activeShift, operators]);

  // --- Sub-state for: Hromadné vložení textem ---
  const [bulkText, setBulkText] = useState("");
  const [bulkMachine, setBulkMachine] = useState<MachineType>("LL");
  const [bulkIsVna, setBulkIsVna] = useState(false);

  // --- Sub-state for: Ruční přidání jednoho ---
  const [singleName, setSingleName] = useState("");
  const [singleMachine, setSingleMachine] = useState<MachineType>("LL");
  const [singleIsVna, setSingleIsVna] = useState(false);

  // Current permanent operators for active shift
  const currentPermanentOps = useMemo(() => {
    return shiftOperators.filter((o) => o.isPermanent !== false);
  }, [shiftOperators]);

  const vnaCount = currentPermanentOps.filter(
    (o) => getRosterGroup(o) === "vna",
  ).length;
  const pickCount = currentPermanentOps.length - vnaCount;

  if (!isOpen) return null;

  // Toggle selection for bulk click
  const handleTogglePermanent = (opId: string) => {
    setSelectedPermanentIds((prev) => {
      const next = new Set(prev);
      if (next.has(opId)) {
        next.delete(opId);
      } else {
        next.add(opId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allIds = new Set(shiftOperators.map((o) => o.id));
    setSelectedPermanentIds(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedPermanentIds(new Set());
  };

  const handleSaveBulkSelection = () => {
    const toMakePermanent = Array.from(selectedPermanentIds);
    const toRemovePermanent = shiftOperators
      .filter((o) => !selectedPermanentIds.has(o.id))
      .map((o) => o.id);

    if (toMakePermanent.length > 0) {
      onUpdatePermanentStatus(toMakePermanent, true);
    }
    if (toRemovePermanent.length > 0) {
      onUpdatePermanentStatus(toRemovePermanent, false);
    }
    onClose();
  };

  // Submit bulk text paste
  const handleSaveBulkText = () => {
    const lines = bulkText
      .split(/[\n,;]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 1);

    if (lines.length === 0) return;

    const now = new Date().toISOString();
    const newOps: Operator[] = lines.map((name, idx) => ({
      id: `op-perm-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      machineType: bulkIsVna ? "NONE" : bulkMachine,
      departmentId: "unassigned",
      isVnaOnly: bulkIsVna,
      rosterGroup: bulkIsVna ? "vna" : "transport",
      status: "active",
      shift: activeShift,
      isPermanent: true,
      lastMovedAt: now,
      notes: "Stálý stav ze seznamu",
    }));

    onAddPermanentOperators(newOps);
    setBulkText("");
    onClose();
  };

  // Submit single manual entry
  const handleSaveSingleManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleName.trim()) return;

    const now = new Date().toISOString();
    const newOp: Operator = {
      id: `op-perm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: singleName.trim(),
      machineType: singleIsVna ? "NONE" : singleMachine,
      departmentId: "unassigned",
      isVnaOnly: singleIsVna,
      rosterGroup: singleIsVna ? "vna" : "transport",
      status: "active",
      shift: activeShift,
      isPermanent: true,
      lastMovedAt: now,
      notes: "Stálý stav ručně",
    };

    onAddPermanentOperators([newOp]);
    setSingleName("");
    onClose();
  };

  const filteredShiftOperators = shiftOperators.filter((o) =>
    o.name.toLowerCase().includes(searchQuery.toLowerCase().trim()),
  );

  return (
    <div
      id="manage-permanent-roster-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="manage-permanent-roster-modal"
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Stálí zaměstnanci směny {activeShift}
                </h3>
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {currentPermanentOps.length} lidí
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {pickCount} PICK + {vnaCount} VNA • Tito pracovníci jsou natrvalo v paměti vaší
                směny
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Pills */}
        <div className="px-4 sm:px-5 pt-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={() => setActiveTab("bulk_select")}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === "bulk_select"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 shadow-2xs"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Hromadně naklikat ({selectedPermanentIds.size})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("bulk_text")}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === "bulk_text"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 shadow-2xs"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Vložit seznam textem</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("single_manual")}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === "single_manual"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 shadow-2xs"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ 1 ručně</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("roster_list")}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 shrink-0 ${
              activeTab === "roster_list"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 shadow-2xs"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Seznam stálých ({currentPermanentOps.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* TAB 1: HROMADNĚ NAKLIKNOUT ZE STÁVAJÍCÍCH */}
          {activeTab === "bulk_select" && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs text-blue-950 dark:text-blue-200 space-y-1">
                <p className="font-semibold">
                  Zaškrtněte operátory, kteří patří pod váš stálý kmen směny {activeShift}:
                </p>
                <p className="text-[11px] text-blue-800 dark:text-blue-300">
                  Pokud máte např. 30 lidí, zaškrtněte je zde. Při každém resetu směny budou
                  připraveni v nezařazených. Po vyfocení tabule vás systém upozorní, pokud některý z
                  těchto lidí na tabuli chybí.
                </p>
              </div>

              {/* Search & Actions */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Hledat operátora dle jména..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold"
                  >
                    Vybrat vše
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold"
                  >
                    Zrušit výběr
                  </button>
                </div>
              </div>

              {/* Operators Checkbox Grid */}
              <div className="max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
                {filteredShiftOperators.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    Žádný operátor neodpovídá filtru.
                  </div>
                ) : (
                  filteredShiftOperators.map((op) => {
                    const isChecked = selectedPermanentIds.has(op.id);
                    const isVna = getRosterGroup(op) === "vna";

                    return (
                      <div
                        key={op.id}
                        onClick={() => handleTogglePermanent(op.id)}
                        className={`px-3 py-2 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-blue-50/60 dark:bg-blue-950/30"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                          )}
                          <span
                            className={`truncate ${
                              isChecked
                                ? "font-bold text-slate-900 dark:text-white"
                                : "text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {op.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isVna && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              VNA
                            </span>
                          )}
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {op.machineType || "Bez"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: VLOŽIT SEZNAM TEXTEM */}
          {activeTab === "bulk_text" && (
            <div className="space-y-3.5">
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs text-blue-950 dark:text-blue-200 space-y-1">
                <p className="font-semibold">
                  Vložte seznam jmen vašich stálých pracovníků (jedno jméno na řádek):
                </p>
                <p className="text-[11px] text-blue-800 dark:text-blue-300">
                  Tato jména budou natrvalo uložena pro směnu {activeShift}. V OCR i na tabuli budou
                  automaticky spárována.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Seznam jmen (jedno na řádek, např. Novák Jan, Svoboda Petr...):
                </label>
                <textarea
                  rows={6}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`Jan Novák\nPetr Svoboda\nMartin Mazánek\nDavid Burget\nDavid Kurcius`}
                  className="w-full p-3 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <div className="text-[11px] text-slate-400 mt-1">
                  Rozpoznáno jmen:{" "}
                  <strong className="text-slate-700 dark:text-slate-200 font-bold">
                    {
                      bulkText
                        .split(/[\n,;]+/)
                        .map((l) => l.trim())
                        .filter((l) => l.length > 1).length
                    }
                  </strong>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Výchozí stroj pro vložená jména:
                  </label>
                  <select
                    value={bulkMachine}
                    onChange={(e) => setBulkMachine(e.target.value as MachineType)}
                    className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="LL">LL (Nízkozdvih)</option>
                    <option value="RTR">RTR (Retrak)</option>
                    <option value="NONE">Bez stroje (NONE)</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={bulkIsVna}
                      onChange={(e) => setBulkIsVna(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-0"
                    />
                    <span className="font-semibold">Všichni jsou VNA specialisté (2. TL)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RUČNĚ 1 OPERÁTOR */}
          {activeTab === "single_manual" && (
            <form onSubmit={handleSaveSingleManual} className="space-y-4">
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs text-blue-950 dark:text-blue-200">
                Přidání jednoho nového stálého zaměstnance (např. nový nástup do firmy).
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Jméno a příjmení operátora:
                </label>
                <input
                  type="text"
                  required
                  value={singleName}
                  onChange={(e) => setSingleName(e.target.value)}
                  placeholder="např. Tomáš Horák"
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Kvalifikace / Stroj:
                  </label>
                  <select
                    value={singleMachine}
                    onChange={(e) => setSingleMachine(e.target.value as MachineType)}
                    className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="LL">LL (Nízkozdvih)</option>
                    <option value="RTR">RTR (Retrak)</option>
                    <option value="NONE">Bez stroje (NONE)</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={singleIsVna}
                      onChange={(e) => setSingleIsVna(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-0"
                    />
                    <span className="font-semibold">VNA operátor (2. TL)</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={!singleName.trim()}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                + Přidat operátora do stálého stavu směny {activeShift}
              </button>
            </form>
          )}

          {/* TAB 4: SEZNAM STÁLÝCH S MOŽNOSTÍ ODEBRÁNÍ */}
          {activeTab === "roster_list" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                <span>
                  Celkem v kmeni směny {activeShift}:{" "}
                  <strong className="text-slate-900 dark:text-white font-bold">
                    {currentPermanentOps.length} lidí
                  </strong>
                </span>
                <span className="text-[11px]">
                  (Odebráním se sníží stálý stav – např. odchod z firmy)
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
                {currentPermanentOps.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    Zatím nemáte označené žádné stálé zaměstnance pro směnu {activeShift}.
                  </div>
                ) : (
                  currentPermanentOps.map((op) => {
                    const isVna = getRosterGroup(op) === "vna";
                    return (
                      <div
                        key={op.id}
                        className="px-3 py-2 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {op.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {op.machineType || "Bez"}
                          </span>
                          {isVna && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              VNA
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => onRemoveFromPermanent(op.id)}
                          className="px-2 py-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                          title="Odebrat ze stálého stavu"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Odebrat</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 gap-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {activeTab === "bulk_select" && (
              <span>
                Vybráno do kmene: <strong>{selectedPermanentIds.size} operátorů</strong>
              </span>
            )}
            {activeTab === "bulk_text" && (
              <span>
                Připraveno ke vložení:{" "}
                <strong>
                  {
                    bulkText
                      .split(/[\n,;]+/)
                      .map((l) => l.trim())
                      .filter((l) => l.length > 1).length
                  }{" "}
                  lidí
                </strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Zavřít
            </button>

            {activeTab === "bulk_select" && (
              <button
                type="button"
                onClick={handleSaveBulkSelection}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Uložit stálý stav ({selectedPermanentIds.size})
              </button>
            )}

            {activeTab === "bulk_text" && (
              <button
                type="button"
                onClick={handleSaveBulkText}
                disabled={
                  bulkText
                    .split(/[\n,;]+/)
                    .map((l) => l.trim())
                    .filter((l) => l.length > 1).length === 0
                }
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer"
              >
                Přidat všechny do kmene
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
