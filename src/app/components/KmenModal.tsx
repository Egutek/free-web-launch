import React, { useState, useMemo } from "react";
import {
  X,
  Users,
  AlertTriangle,
  CheckCircle2,
  UserPlus,
  Search,
  Plus,
  Trash2,
  Edit2,
  Save,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building2,
  Truck,
  Forklift,
  Info,
  Check,
  CheckSquare,
  Square,
  FileText,
  ChevronDown,
  Layers,
} from "lucide-react";
import {
  AbsenceReason,
  DepartmentId,
  MachineType,
  Operator,
  RosterMember,
  ShiftCode,
  TeamLeaderRole,
} from "../types";
import { DEPARTMENTS, getDepartmentById } from "../data/departments";
import { computeRosterDiscrepancies, normalizeNameForMatching } from "../utils/rosterMatcher";

interface KmenModalProps {
  isOpen: boolean;
  onClose: () => void;
  roster: RosterMember[];
  currentOperators: Operator[];
  activeShift: ShiftCode;
  onAddRosterMember: (member: Omit<RosterMember, "id" | "createdAt">) => void;
  onUpdateRosterMember: (member: RosterMember) => void;
  onDeleteRosterMember: (memberId: string) => void;
  onBulkAddRosterMembers?: (members: Omit<RosterMember, "id" | "createdAt">[]) => void;
  onBulkDeleteRosterMembers?: (memberIds: string[]) => void;
  onBulkUpdateRosterMembers?: (updatedMembers: RosterMember[]) => void;
  onAddAllExtraToRoster?: (extraOps: Operator[]) => void;
  onBulkAssignMissingToShift?: (
    missingMembers: RosterMember[],
    action: "dept" | "absence",
    reason?: AbsenceReason,
  ) => void;
  onResetRosterToDefaults: () => void;
  onQuickAssignMissingOperator: (
    member: RosterMember,
    action: "dept" | "absence",
    reason?: AbsenceReason,
  ) => void;
  onAddCurrentOperatorToRoster?: (operator: Operator) => void;
}

interface ParsedBulkEntry {
  name: string;
  teamLeader: TeamLeaderRole;
  defaultDepartmentId: DepartmentId;
  defaultMachineType: MachineType;
  shift: ShiftCode | "all";
  notes?: string;
  isExisting: boolean;
  existingId?: string;
}

export const KmenModal: React.FC<KmenModalProps> = ({
  isOpen,
  onClose,
  roster,
  currentOperators,
  activeShift,
  onAddRosterMember,
  onUpdateRosterMember,
  onDeleteRosterMember,
  onBulkAddRosterMembers,
  onBulkDeleteRosterMembers,
  onBulkUpdateRosterMembers,
  onAddAllExtraToRoster,
  onBulkAssignMissingToShift,
  onResetRosterToDefaults,
  onQuickAssignMissingOperator,
  onAddCurrentOperatorToRoster,
}) => {
  const [activeTab, setActiveTab] = useState<"check" | "list" | "add">("check");
  const [addMode, setAddMode] = useState<"single" | "bulk">("bulk");
  const [selectedTLFilter, setSelectedTLFilter] = useState<TeamLeaderRole | "all">("transport");
  const [searchQuery, setSearchQuery] = useState("");

  // Bulk selection in members list
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  // In-modal confirmation dialog for delete
  const [confirmDeleteData, setConfirmDeleteData] = useState<{
    ids: string[];
    title: string;
    description: string;
  } | null>(null);

  // Edit form state
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTL, setEditTL] = useState<TeamLeaderRole>("transport");
  const [editDept, setEditDept] = useState<DepartmentId>("hovc");
  const [editMachine, setEditMachine] = useState<MachineType>("LL");
  const [editShift, setEditShift] = useState<ShiftCode | "all">("A");
  const [editNotes, setEditNotes] = useState("");

  // Single new member form state
  const [newName, setNewName] = useState("");
  const [newTL, setNewTL] = useState<TeamLeaderRole>("transport");
  const [newDept, setNewDept] = useState<DepartmentId>("hovc");
  const [newMachine, setNewMachine] = useState<MachineType>("LL");
  const [newShift, setNewShift] = useState<ShiftCode | "all">("all");
  const [newNotes, setNewNotes] = useState("");

  // Bulk text import state
  const [bulkTextInput, setBulkTextInput] = useState("");
  const [bulkDefaultTL, setBulkDefaultTL] = useState<TeamLeaderRole>("transport");
  const [bulkDefaultDept, setBulkDefaultDept] = useState<DepartmentId>("hovc");
  const [bulkDefaultMachine, setBulkDefaultMachine] = useState<MachineType>("LL");
  const [bulkDefaultShift, setBulkDefaultShift] = useState<ShiftCode | "all">("all");
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  // Discrepancy report calculation
  const report = useMemo(() => {
    return computeRosterDiscrepancies(currentOperators, roster, activeShift, selectedTLFilter);
  }, [currentOperators, roster, activeShift, selectedTLFilter]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return roster.filter((m) => {
      const matchTL = selectedTLFilter === "all" || m.teamLeader === selectedTLFilter;
      const matchShift = !m.shift || m.shift === "all" || m.shift === activeShift;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.notes && m.notes.toLowerCase().includes(q)) ||
        getDepartmentById(m.defaultDepartmentId || "hovc")
          .name.toLowerCase()
          .includes(q);
      return matchTL && matchShift && matchSearch;
    });
  }, [roster, selectedTLFilter, activeShift, searchQuery]);

  // Existing names map for duplicate detection
  const existingNamesMap = useMemo(() => {
    const map = new Map<string, RosterMember>();
    roster.forEach((m) => {
      map.set(normalizeNameForMatching(m.name), m);
    });
    return map;
  }, [roster]);

  // Parse bulk text input in real-time
  const parsedBulkEntries = useMemo<ParsedBulkEntry[]>(() => {
    if (!bulkTextInput.trim()) return [];

    const lines = bulkTextInput.split(/\r?\n/);
    const results: ParsedBulkEntry[] = [];
    const seenInBatch = new Set<string>();

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

      // Check if line has separators: semicolon, tab, or comma
      let tokens: string[] = [];
      if (trimmed.includes(";")) {
        tokens = trimmed.split(";").map((t) => t.trim());
      } else if (trimmed.includes("\t")) {
        tokens = trimmed.split("\t").map((t) => t.trim());
      } else if (trimmed.includes(",")) {
        // Only split by comma if there's no single whole name like "Novák, Jan"
        const commaParts = trimmed.split(",").map((t) => t.trim());
        if (commaParts.length > 2) {
          tokens = commaParts;
        } else {
          tokens = [trimmed];
        }
      } else {
        tokens = [trimmed];
      }

      const name = tokens[0]?.trim();
      if (!name || name.length < 2) continue;

      // Prevent exact duplicates inside the same pasted batch
      const norm = normalizeNameForMatching(name);
      if (seenInBatch.has(norm)) continue;
      seenInBatch.add(norm);

      // Parse optional columns or fall back to defaults
      let itemTL = bulkDefaultTL;
      let itemDept = bulkDefaultDept;
      let itemMachine = bulkDefaultMachine;
      let itemShift = bulkDefaultShift;
      let itemNotes: string | undefined = undefined;

      // Optional column 1: TL or Dept
      if (tokens.length >= 2 && tokens[1]) {
        const val1 = tokens[1].toLowerCase();
        if (val1.includes("vna")) {
          itemTL = "vna";
        } else if (val1.includes("trans")) {
          itemTL = "transport";
        } else {
          const matchedDept = DEPARTMENTS.find(
            (d) =>
              d.id.toLowerCase() === val1 ||
              d.name.toLowerCase() === val1 ||
              d.fullName.toLowerCase().includes(val1),
          );
          if (matchedDept && matchedDept.id !== "unassigned") {
            itemDept = matchedDept.id;
          }
        }
      }

      // Optional column 2: Dept or Machine
      if (tokens.length >= 3 && tokens[2]) {
        const val2 = tokens[2].toLowerCase();
        const matchedDept = DEPARTMENTS.find(
          (d) =>
            d.id.toLowerCase() === val2 ||
            d.name.toLowerCase() === val2 ||
            d.fullName.toLowerCase().includes(val2),
        );
        if (matchedDept && matchedDept.id !== "unassigned") {
          itemDept = matchedDept.id;
        } else if (val2.includes("rtr")) {
          itemMachine = "RTR";
        } else if (val2.includes("ll")) {
          itemMachine = "LL";
        } else if (val2.includes("none")) {
          itemMachine = "NONE";
        }
      }

      // Optional column 3: Machine
      if (tokens.length >= 4 && tokens[3]) {
        const val3 = tokens[3].toUpperCase();
        if (val3.includes("RTR")) itemMachine = "RTR";
        else if (val3.includes("LL")) itemMachine = "LL";
        else if (val3.includes("NONE")) itemMachine = "NONE";
      }

      // Optional column 4: Shift
      if (tokens.length >= 5 && tokens[4]) {
        const val4 = tokens[4].toUpperCase();
        if (val4 === "A" || val4 === "B" || val4 === "C") {
          itemShift = val4 as ShiftCode;
        } else if (val4 === "VŠE" || val4 === "ALL") {
          itemShift = "all";
        }
      }

      // Optional column 5: Notes
      if (tokens.length >= 6 && tokens[5]) {
        itemNotes = tokens[5];
      }

      // Machine adjustment for VNA
      if (itemDept === "vna") {
        itemMachine = "NONE";
      }

      const existingMatch = existingNamesMap.get(norm);

      results.push({
        name,
        teamLeader: itemTL,
        defaultDepartmentId: itemDept,
        defaultMachineType: itemMachine,
        shift: itemShift,
        notes: itemNotes,
        isExisting: Boolean(existingMatch),
        existingId: existingMatch?.id,
      });
    }

    return results;
  }, [
    bulkTextInput,
    bulkDefaultTL,
    bulkDefaultDept,
    bulkDefaultMachine,
    bulkDefaultShift,
    existingNamesMap,
  ]);

  const bulkToAddCount = useMemo(() => {
    return parsedBulkEntries.filter((e) => !skipDuplicates || !e.isExisting).length;
  }, [parsedBulkEntries, skipDuplicates]);

  if (!isOpen) return null;

  // Single item edit handlers
  const handleStartEdit = (member: RosterMember) => {
    setEditingMemberId(member.id);
    setEditName(member.name);
    setEditTL(member.teamLeader || "transport");
    setEditDept(member.defaultDepartmentId || "hovc");
    setEditMachine(member.defaultMachineType || "LL");
    setEditShift(member.shift || "all");
    setEditNotes(member.notes || "");
  };

  const handleSaveEdit = () => {
    if (!editingMemberId || !editName.trim()) return;
    const existing = roster.find((m) => m.id === editingMemberId);
    if (!existing) return;

    onUpdateRosterMember({
      ...existing,
      name: editName.trim(),
      teamLeader: editTL,
      defaultDepartmentId: editDept,
      defaultMachineType: editDept === "vna" ? "NONE" : editMachine,
      shift: editShift,
      notes: editNotes.trim() || undefined,
    });
    setEditingMemberId(null);
  };

  const handleCreateSingleMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    onAddRosterMember({
      name: newName.trim(),
      teamLeader: newTL,
      defaultDepartmentId: newDept,
      defaultMachineType: newDept === "vna" ? "NONE" : newMachine,
      shift: newShift,
      isActiveInRoster: true,
      notes: newNotes.trim() || undefined,
    });

    setNewName("");
    setNewNotes("");
    setActiveTab("list");
  };

  // Bulk add execution handler
  const handleExecuteBulkAdd = () => {
    const toAdd = parsedBulkEntries.filter((e) => !skipDuplicates || !e.isExisting);
    if (toAdd.length === 0) return;

    const payload: Omit<RosterMember, "id" | "createdAt">[] = toAdd.map((item) => ({
      name: item.name,
      teamLeader: item.teamLeader,
      defaultDepartmentId: item.defaultDepartmentId,
      defaultMachineType: item.defaultMachineType,
      shift: item.shift,
      isActiveInRoster: true,
      notes: item.notes,
    }));

    if (onBulkAddRosterMembers) {
      onBulkAddRosterMembers(payload);
    } else {
      payload.forEach((p) => onAddRosterMember(p));
    }

    setBulkTextInput("");
    setActiveTab("list");
  };

  // Selection toggle handlers
  const handleToggleSelectMember = (memberId: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const isAllFilteredSelected =
    filteredMembers.length > 0 && filteredMembers.every((m) => selectedMemberIds.has(m.id));

  const handleToggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      setSelectedMemberIds((prev) => {
        const next = new Set(prev);
        filteredMembers.forEach((m) => next.delete(m.id));
        return next;
      });
    } else {
      setSelectedMemberIds((prev) => {
        const next = new Set(prev);
        filteredMembers.forEach((m) => next.add(m.id));
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedMemberIds(new Set());
  };

  // Bulk actions on selected members
  const handleTriggerBulkDeleteSelected = () => {
    const ids = Array.from(selectedMemberIds);
    if (ids.length === 0) return;

    const names = roster.filter((m) => selectedMemberIds.has(m.id)).map((m) => m.name);

    const preview =
      names.length <= 4
        ? names.join(", ")
        : `${names.slice(0, 3).join(", ")} a dalších ${names.length - 3}`;

    setConfirmDeleteData({
      ids,
      title: `Hromadné odstranění ${ids.length} pracovníků z kmene`,
      description: `Opravdu chcete odebrat z kmene ${ids.length} vybraných pracovníků (${preview})? Tuto akci nelze vrátit jedním kliknutím.`,
    });
  };

  const handleTriggerDeleteSingle = (member: RosterMember) => {
    setConfirmDeleteData({
      ids: [member.id],
      title: `Odstranění pracovníka z kmene`,
      description: `Opravdu chcete odebrat z kmene pracovníka "${member.name}"?`,
    });
  };

  const handleTriggerDeleteAllFiltered = () => {
    if (filteredMembers.length === 0) return;
    const ids = filteredMembers.map((m) => m.id);
    setConfirmDeleteData({
      ids,
      title: `Smazat všech ${ids.length} zobrazených pracovníků z kmene`,
      description: `Opravdu chcete odebrat všech ${ids.length} pracovníků odpovídajících aktuálnímu filtru?`,
    });
  };

  const handleConfirmDelete = () => {
    if (!confirmDeleteData) return;
    const { ids } = confirmDeleteData;
    if (onBulkDeleteRosterMembers) {
      onBulkDeleteRosterMembers(ids);
    } else {
      ids.forEach((id) => onDeleteRosterMember(id));
    }
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setConfirmDeleteData(null);
  };

  // Bulk change TL for selected
  const handleBulkChangeTL = (newTL: TeamLeaderRole) => {
    const targetMembers = roster.filter((m) => selectedMemberIds.has(m.id));
    if (targetMembers.length === 0) return;

    const updated = targetMembers.map((m) => ({
      ...m,
      teamLeader: newTL,
    }));

    if (onBulkUpdateRosterMembers) {
      onBulkUpdateRosterMembers(updated);
    } else {
      updated.forEach((m) => onUpdateRosterMember(m));
    }
    setSelectedMemberIds(new Set());
  };

  // Bulk change Department for selected
  const handleBulkChangeDept = (deptId: DepartmentId) => {
    const targetMembers = roster.filter((m) => selectedMemberIds.has(m.id));
    if (targetMembers.length === 0) return;

    const updated = targetMembers.map((m) => ({
      ...m,
      defaultDepartmentId: deptId,
      defaultMachineType: deptId === "vna" ? ("NONE" as MachineType) : m.defaultMachineType,
    }));

    if (onBulkUpdateRosterMembers) {
      onBulkUpdateRosterMembers(updated);
    } else {
      updated.forEach((m) => onUpdateRosterMember(m));
    }
    setSelectedMemberIds(new Set());
  };

  // Bulk change Shift for selected
  const handleBulkChangeShift = (shift: ShiftCode | "all") => {
    const targetMembers = roster.filter((m) => selectedMemberIds.has(m.id));
    if (targetMembers.length === 0) return;

    const updated = targetMembers.map((m) => ({
      ...m,
      shift,
    }));

    if (onBulkUpdateRosterMembers) {
      onBulkUpdateRosterMembers(updated);
    } else {
      updated.forEach((m) => onUpdateRosterMember(m));
    }
    setSelectedMemberIds(new Set());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-700 dark:bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Kmen zaměstnanců & Kontrola docházky
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                  Směna {activeShift}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Oficiální kmen lidí pod Team Leadery, hromadná správa a porovnání s tabulí směny
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Zavřít okno"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TL Role Selector & Top Metrics Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-100/70 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          {/* TL Filter buttons */}
          <div className="flex items-center bg-white dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <button
              onClick={() => setSelectedTLFilter("transport")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedTLFilter === "transport"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Můj kmen (Transport)</span>
            </button>

            <button
              onClick={() => setSelectedTLFilter("vna")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedTLFilter === "vna"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Forklift className="w-3.5 h-3.5" />
              <span>Kolega (VNA)</span>
            </button>

            <button
              onClick={() => setSelectedTLFilter("all")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedTLFilter === "all"
                  ? "bg-slate-800 dark:bg-slate-700 text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span>Vše</span>
            </button>
          </div>

          {/* Decent metrics summary */}
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold shadow-2xs">
              <span className="text-slate-400 font-normal">Kmen:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {report.totalRosterCount}
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 font-semibold shadow-2xs">
              <span className="text-emerald-600 dark:text-emerald-400 font-normal">Na odd.:</span>
              <span className="font-mono font-bold">{report.presentInShiftCount}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold shadow-2xs">
              <span className="text-slate-400 font-normal">Absence:</span>
              <span className="font-mono font-bold">{report.absentInShiftCount}</span>
            </div>

            {report.missingCount > 0 ? (
              <div
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-bold shadow-2xs"
                title={`${report.missingCount} kmenových pracovníků není zapsáno na směně ani v absenci`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Chybí: {report.missingCount}</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 font-bold shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Vše sedí</span>
              </div>
            )}
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 bg-white dark:bg-slate-900 text-xs font-bold">
          <button
            onClick={() => setActiveTab("check")}
            className={`py-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "check"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Porovnání se směnou (Kontrola)</span>
            {report.missingCount > 0 && (
              <span className="text-[10px] bg-amber-500 text-white font-bold px-1.5 py-0.2 rounded-full">
                {report.missingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("list")}
            className={`py-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "list"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Seznam kmenových lidí ({filteredMembers.length})</span>
            {selectedMemberIds.size > 0 && (
              <span className="text-[10px] bg-blue-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                {selectedMemberIds.size}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("add")}
            className={`py-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "add"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Přidat do kmene (jednotlivě i hromadně)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: KONTROLA A POROVNÁNÍ SE SMĚNOU */}
          {activeTab === "check" && (
            <div className="space-y-4">
              {/* Informative banner */}
              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">
                    Automatická tichá kontrola docházky oproti kmeni (
                    {selectedTLFilter === "transport"
                      ? "Můj kmen Transport"
                      : selectedTLFilter === "vna"
                        ? "Kmen VNA"
                        : "Všechny kmeny"}
                    )
                  </p>
                  <p className="text-blue-700 dark:text-blue-300">
                    Aplikace na pozadí hlídá, zda jsou všichni vaši kmenoví lidé buď přiřazeni na
                    oddělení, nebo zapsáni v absenci (dovolená, PN). OCR z fotografie jména
                    automaticky v tichosti páruje s tímto kmenem.
                  </p>
                </div>
              </div>

              {/* Status Section 1: Missing Roster Members */}
              {report.missingFromBoard.length > 0 ? (
                <div className="space-y-2.5 p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/80">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <h3 className="font-bold text-xs sm:text-sm text-amber-950 dark:text-amber-200">
                        Neevidovaní lidé z kmene ({report.missingFromBoard.length})
                      </h3>
                      <span className="text-[11px] text-amber-800 dark:text-amber-300 hidden sm:inline">
                        — Nejsou na žádném oddělení ani v absenci
                      </span>
                    </div>

                    {/* Bulk actions for missing */}
                    {onBulkAssignMissingToShift && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() =>
                            onBulkAssignMissingToShift(report.missingFromBoard, "dept")
                          }
                          className="px-2 py-1 text-[11px] font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-2xs transition-colors cursor-pointer"
                          title="Hromadně zapsat všechny chybějící na jejich výchozí oddělení"
                        >
                          + Všechny na výchozí oddělení
                        </button>
                        <button
                          onClick={() =>
                            onBulkAssignMissingToShift(
                              report.missingFromBoard,
                              "absence",
                              "Dovolená",
                            )
                          }
                          className="px-2 py-1 text-[11px] font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-2xs transition-colors cursor-pointer"
                          title="Hromadně zapsat všechny chybějící do absence Dovolená"
                        >
                          + Všechny: Dovolená
                        </button>
                        <button
                          onClick={() =>
                            onBulkAssignMissingToShift(report.missingFromBoard, "absence", "PN")
                          }
                          className="px-2 py-1 text-[11px] font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-2xs transition-colors cursor-pointer"
                          title="Hromadně zapsat všechny chybějící do absence PN"
                        >
                          + Všechny: PN
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {report.missingFromBoard.map((member) => {
                      const defDept = getDepartmentById(member.defaultDepartmentId || "hovc");
                      return (
                        <div
                          key={member.id}
                          className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/60 shadow-2xs space-y-2"
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div>
                              <span className="font-bold text-xs text-slate-900 dark:text-white block">
                                {member.name}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                Výchozí: {defDept.name} • {member.defaultMachineType || "LL"}
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300/60">
                              Chybí na směně
                            </span>
                          </div>

                          {/* Quick 1-click action buttons */}
                          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/60 text-[11px]">
                            <button
                              onClick={() => onQuickAssignMissingOperator(member, "dept")}
                              className="px-2 py-1 rounded font-semibold bg-blue-50 hover:bg-blue-600 hover:text-white dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors shrink-0 cursor-pointer shadow-2xs"
                              title={`Přiřadit na výchozí oddělení ${defDept.name}`}
                            >
                              + Na {defDept.name}
                            </button>

                            <button
                              onClick={() =>
                                onQuickAssignMissingOperator(member, "absence", "Dovolená")
                              }
                              className="px-2 py-1 rounded font-semibold bg-amber-100/70 hover:bg-amber-600 hover:text-white dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 transition-colors shrink-0 cursor-pointer shadow-2xs"
                              title="Zapsat jako Dovolená"
                            >
                              + Dovolená
                            </button>

                            <button
                              onClick={() => onQuickAssignMissingOperator(member, "absence", "PN")}
                              className="px-2 py-1 rounded font-semibold bg-rose-50 hover:bg-rose-600 hover:text-white dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800 transition-colors shrink-0 cursor-pointer shadow-2xs"
                              title="Zapsat jako PN (nemoc)"
                            >
                              + PN
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="font-bold text-xs sm:text-sm text-emerald-950 dark:text-emerald-200">
                      Všichni kmenoví lidé jsou evidováni
                    </h3>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      Žádný pracovník z vašeho kmene nechybí. Všichni jsou buď v provozu na
                      odděleních, nebo omluveni v absenci.
                    </p>
                  </div>
                </div>
              )}

              {/* Status Section 2: Extra workers on shift (Out of Roster / Výpomoc) with Bulk Add */}
              {report.extraOnBoard.length > 0 && (
                <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-500" />
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        Lidé navíc na směně / mimo kmen ({report.extraOnBoard.length})
                      </h3>
                      <span className="text-[11px] text-slate-500 hidden sm:inline">
                        — Výpomoc, externisté, hosté
                      </span>
                    </div>

                    {/* Bulk add all extra to roster button */}
                    {onAddAllExtraToRoster && (
                      <button
                        onClick={() => onAddAllExtraToRoster(report.extraOnBoard)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
                        title="Přidat všech tyto pracovníky najednou do kmene"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ Přidat všech {report.extraOnBoard.length} lidí do kmene</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {report.extraOnBoard.map((op) => {
                      const dept = getDepartmentById(op.departmentId);
                      return (
                        <div
                          key={op.id}
                          className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between gap-1.5 shadow-2xs"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-white truncate block">
                              {op.name}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {dept.name} • {op.machineType}
                            </span>
                          </div>

                          {onAddCurrentOperatorToRoster && (
                            <button
                              onClick={() => onAddCurrentOperatorToRoster(op)}
                              className="px-2 py-1 rounded text-[10px] font-semibold bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 transition-colors shrink-0 cursor-pointer"
                              title="Přidat do kmene"
                            >
                              + Do kmene
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SEZNAM KMENOVÝCH LIDÍ + HROMADNÝ VÝBĚR A MAZÁNÍ */}
          {activeTab === "list" && (
            <div className="space-y-3">
              {/* Search, Reset & Add Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Hledat v kmeni..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {filteredMembers.length > 0 && (
                    <button
                      onClick={handleToggleSelectAllFiltered}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                      title={
                        isAllFilteredSelected
                          ? "Zrušit výběr zobrazených"
                          : "Vybrat všechny zobrazené"
                      }
                    >
                      {isAllFilteredSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span>
                        {isAllFilteredSelected ? "Odznačit vše" : "Označit vše"} (
                        {filteredMembers.length})
                      </span>
                    </button>
                  )}

                  <button
                    onClick={onResetRosterToDefaults}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                    title="Obnovit výchozí kmen 65 operátorů ZF PICK"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Obnovit výchozí</span>
                  </button>

                  <button
                    onClick={() => {
                      setAddMode("bulk");
                      setActiveTab("add");
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Přidat do kmene</span>
                  </button>
                </div>
              </div>

              {/* Floating / Sticky Bulk Action Bar for Selected Members */}
              {selectedMemberIds.size > 0 && (
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-100">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-blue-900 dark:text-blue-100 flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Vybráno: <span className="font-mono text-sm">
                        {selectedMemberIds.size}
                      </span>{" "}
                      pracovníků
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Bulk Change TL dropdown */}
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                      <span className="text-[11px] text-slate-500">Přenést pod TL:</span>
                      <button
                        onClick={() => handleBulkChangeTL("transport")}
                        className="px-1.5 py-0.5 rounded font-bold text-[11px] text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/40 cursor-pointer"
                        title="Přenést všechny vybrané pod Transport"
                      >
                        Transport
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        onClick={() => handleBulkChangeTL("vna")}
                        className="px-1.5 py-0.5 rounded font-bold text-[11px] text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/40 cursor-pointer"
                        title="Přenést všechny vybrané pod VNA"
                      >
                        VNA
                      </button>
                    </div>

                    {/* Bulk Delete Button */}
                    <button
                      onClick={handleTriggerBulkDeleteSelected}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-2xs transition-colors cursor-pointer"
                      title="Smazat vybrané pracovníky z kmene"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Smazat vybrané ({selectedMemberIds.size})</span>
                    </button>

                    {/* Clear selection */}
                    <button
                      onClick={handleClearSelection}
                      className="px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      Zrušit výběr
                    </button>
                  </div>
                </div>
              )}

              {/* Members table/cards */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                <div className="max-h-[48vh] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                      <tr>
                        <th className="py-2.5 px-3 w-8 text-center">
                          <input
                            type="checkbox"
                            checked={isAllFilteredSelected}
                            onChange={handleToggleSelectAllFiltered}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            title="Vybrat všechny zobrazené"
                          />
                        </th>
                        <th className="py-2.5 px-3">Jméno pracovníka</th>
                        <th className="py-2.5 px-3">Team Leader</th>
                        <th className="py-2.5 px-3">Výchozí oddělení</th>
                        <th className="py-2.5 px-3">Výchozí stroj</th>
                        <th className="py-2.5 px-3">Směna</th>
                        <th className="py-2.5 px-3 text-right">Akce</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredMembers.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-8 text-center text-slate-400 dark:text-slate-500"
                          >
                            Nenalezeni žádní pracovníci odpovídající filtru.
                          </td>
                        </tr>
                      ) : (
                        filteredMembers.map((member) => {
                          const isEditing = editingMemberId === member.id;
                          const isSelected = selectedMemberIds.has(member.id);
                          const dept = getDepartmentById(member.defaultDepartmentId || "hovc");

                          if (isEditing) {
                            return (
                              <tr key={member.id} className="bg-blue-50/50 dark:bg-blue-950/30 p-2">
                                <td className="p-2 text-center">
                                  <Edit2 className="w-3.5 h-3.5 text-blue-500 mx-auto" />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full px-2 py-1 text-xs rounded border border-blue-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                  />
                                </td>
                                <td className="p-2">
                                  <select
                                    value={editTL}
                                    onChange={(e) => setEditTL(e.target.value as TeamLeaderRole)}
                                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                                  >
                                    <option value="transport">Transport (já)</option>
                                    <option value="vna">VNA (kolega)</option>
                                    <option value="other">Jiné</option>
                                  </select>
                                </td>
                                <td className="p-2">
                                  <select
                                    value={editDept}
                                    onChange={(e) => setEditDept(e.target.value as DepartmentId)}
                                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                                  >
                                    {DEPARTMENTS.filter((d) => d.id !== "unassigned").map((d) => (
                                      <option key={d.id} value={d.id}>
                                        {d.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-2">
                                  <select
                                    value={editMachine}
                                    onChange={(e) => setEditMachine(e.target.value as MachineType)}
                                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                                  >
                                    <option value="LL">LL</option>
                                    <option value="RTR">RTR</option>
                                    <option value="NONE">NONE</option>
                                  </select>
                                </td>
                                <td className="p-2">
                                  <select
                                    value={editShift}
                                    onChange={(e) =>
                                      setEditShift(e.target.value as ShiftCode | "all")
                                    }
                                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                                  >
                                    <option value="A">Směna A</option>
                                    <option value="B">Směna B</option>
                                    <option value="C">Směna C</option>
                                    <option value="all">Všechny</option>
                                  </select>
                                </td>
                                <td className="p-2 text-right space-x-1">
                                  <button
                                    onClick={handleSaveEdit}
                                    className="p-1 rounded bg-blue-600 text-white hover:bg-blue-500 cursor-pointer shadow-2xs"
                                    title="Uložit změny"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingMemberId(null)}
                                    className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
                                    title="Zrušit úpravu"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr
                              key={member.id}
                              className={`transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-blue-50/70 dark:bg-blue-950/40"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                              }`}
                              onClick={() => handleToggleSelectMember(member.id)}
                            >
                              <td
                                className="py-2 px-3 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectMember(member.id)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                                {member.name}
                              </td>
                              <td className="py-2 px-3">
                                {member.teamLeader === "transport" ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                    <Truck className="w-2.5 h-2.5" />
                                    <span>Transport (já)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                    <Forklift className="w-2.5 h-2.5" />
                                    <span>VNA (kolega)</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                                <span
                                  className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${dept.badgeBg}`}
                                >
                                  {dept.name}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                                {member.defaultMachineType || "LL"}
                              </td>
                              <td className="py-2 px-3 text-slate-500">
                                {member.shift === "all" || !member.shift
                                  ? "Vše"
                                  : `Směna ${member.shift}`}
                              </td>
                              <td
                                className="py-2 px-3 text-right space-x-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => handleStartEdit(member)}
                                  className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Upravit kmenového pracovníka"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleTriggerDeleteSingle(member)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Odstranit z kmene"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom bulk summary and actions */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>
                  Celkem v kmeni:{" "}
                  <span className="font-bold text-slate-900 dark:text-white">{roster.length}</span>{" "}
                  lidí
                  {filteredMembers.length !== roster.length &&
                    ` (zobrazeno ${filteredMembers.length})`}
                </span>

                {filteredMembers.length > 0 && (
                  <button
                    onClick={handleTriggerDeleteAllFiltered}
                    className="text-xs text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    Odstranit všechny zobrazené ({filteredMembers.length})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PŘIDAT DO KMENE (JEDNOTLIVĚ I HROMADNĚ) */}
          {activeTab === "add" && (
            <div className="space-y-4 max-w-2xl mx-auto py-1">
              {/* Mode switch */}
              <div className="flex items-center justify-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 max-w-sm mx-auto">
                <button
                  type="button"
                  onClick={() => setAddMode("bulk")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    addMode === "bulk"
                      ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Hromadné vložení (text / seznam)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAddMode("single")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    addMode === "single"
                      ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Jeden pracovník</span>
                </button>
              </div>

              {/* MODE 1: BULK ADD FORM */}
              {addMode === "bulk" && (
                <div className="space-y-3.5 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-900 dark:text-white block">
                      Vložte seznam jmen (jedno jméno na řádek, nebo zkopírováno z Excelu):
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Můžete vložit prostý seznam jmen, nebo formát s oddělovačem:{" "}
                      <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-[10px]">
                        Jan Novák; Transport; HOVC; LL; A
                      </code>
                    </p>
                  </div>

                  <textarea
                    rows={6}
                    value={bulkTextInput}
                    onChange={(e) => setBulkTextInput(e.target.value)}
                    placeholder={`Jan Novák\nPetr Svoboda\nDavid Dvořák\nTomáš Kučera\n...`}
                    className="w-full p-3 font-mono text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />

                  {/* Batch Defaults */}
                  <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-700/80">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Výchozí hodnoty pro vkládané pracovníky:
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">
                          Team Leader:
                        </label>
                        <select
                          value={bulkDefaultTL}
                          onChange={(e) => setBulkDefaultTL(e.target.value as TeamLeaderRole)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                          <option value="transport">Transport (já)</option>
                          <option value="vna">VNA (kolega)</option>
                          <option value="other">Jiné</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">
                          Výchozí oddělení:
                        </label>
                        <select
                          value={bulkDefaultDept}
                          onChange={(e) => setBulkDefaultDept(e.target.value as DepartmentId)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                          {DEPARTMENTS.filter((d) => d.id !== "unassigned").map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">
                          Výchozí stroj:
                        </label>
                        <select
                          value={bulkDefaultMachine}
                          onChange={(e) => setBulkDefaultMachine(e.target.value as MachineType)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                          <option value="LL">LL</option>
                          <option value="RTR">RTR</option>
                          <option value="NONE">NONE</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Směna:</label>
                        <select
                          value={bulkDefaultShift}
                          onChange={(e) => setBulkDefaultShift(e.target.value as ShiftCode | "all")}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                          <option value="all">Všechny</option>
                          <option value="A">Směna A</option>
                          <option value="B">Směna B</option>
                          <option value="C">Směna C</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Duplicate Filter option & Live Parse Summary */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700/80">
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={skipDuplicates}
                        onChange={(e) => setSkipDuplicates(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Přeskočit pracovníky, kteří už v kmeni existují</span>
                    </label>

                    {parsedBulkEntries.length > 0 && (
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Nalezeno:{" "}
                        <span className="font-mono text-blue-600">{parsedBulkEntries.length}</span>{" "}
                        ( k přidání:{" "}
                        <span className="font-mono text-emerald-600">{bulkToAddCount}</span>)
                      </span>
                    )}
                  </div>

                  {/* Live preview list of parsed entries */}
                  {parsedBulkEntries.length > 0 && (
                    <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {parsedBulkEntries.map((item, idx) => (
                        <div key={idx} className="p-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {item.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {item.teamLeader} • {item.defaultDepartmentId} •{" "}
                              {item.defaultMachineType} •{" "}
                              {item.shift === "all" ? "Vše" : `Směna ${item.shift}`}
                            </span>
                          </div>

                          {item.isExisting ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {skipDuplicates ? "Bude přeskočeno (již existuje)" : "Duplikát"}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              Nový
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Submit bulk */}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("list")}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Zpět na seznam
                    </button>

                    <button
                      type="button"
                      onClick={handleExecuteBulkAdd}
                      disabled={bulkToAddCount === 0}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none text-white shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Uložit {bulkToAddCount} pracovníků do kmene</span>
                    </button>
                  </div>
                </div>
              )}

              {/* MODE 2: SINGLE MEMBER FORM */}
              {addMode === "single" && (
                <form
                  onSubmit={handleCreateSingleMember}
                  className="space-y-3.5 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700"
                >
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Jméno a příjmení pracovníka:
                    </label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Např. Jan Novák"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        Team Leader (Kmen):
                      </label>
                      <select
                        value={newTL}
                        onChange={(e) => setNewTL(e.target.value as TeamLeaderRole)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      >
                        <option value="transport">
                          Transport (já - Outbound, HOVS, Put, VAS...)
                        </option>
                        <option value="vna">VNA (kolega)</option>
                        <option value="other">Jiné</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        Výchozí oddělení:
                      </label>
                      <select
                        value={newDept}
                        onChange={(e) => setNewDept(e.target.value as DepartmentId)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      >
                        {DEPARTMENTS.filter((d) => d.id !== "unassigned").map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.fullName})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        Výchozí stroj / kvalifikace:
                      </label>
                      <select
                        value={newMachine}
                        onChange={(e) => setNewMachine(e.target.value as MachineType)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      >
                        <option value="LL">LL (Nízkozdvih)</option>
                        <option value="RTR">RTR (Retrak)</option>
                        <option value="NONE">NONE (Bez stroje / VNA)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        Přiřazení ke směně:
                      </label>
                      <select
                        value={newShift}
                        onChange={(e) => setNewShift(e.target.value as ShiftCode | "all")}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      >
                        <option value="all">Všechny směny</option>
                        <option value="A">Směna A</option>
                        <option value="B">Směna B</option>
                        <option value="C">Směna C</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Poznámka (nepovinné):
                    </label>
                    <input
                      type="text"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="Např. Stálý kmen, zástupce mistra, specializace..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("list")}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Zpět na seznam
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Uložit do kmene</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>AI na pozadí automaticky opravuje jména z OCR fotky podle tohoto kmene</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white shadow-2xs transition-colors cursor-pointer"
          >
            Zavřít
          </button>
        </div>
      </div>

      {/* In-Modal Delete Confirmation Dialog */}
      {confirmDeleteData && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {confirmDeleteData.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {confirmDeleteData.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteData(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                Potvrdit smazání ({confirmDeleteData.ids.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
