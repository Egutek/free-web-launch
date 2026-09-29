import React, { useState, useMemo, useEffect } from "react";
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
  Truck,
  Forklift,
  Info,
  CheckSquare,
  Square,
  FileText,
  Copy,
  Check,
  Building2,
  ShieldCheck,
  ArrowRight,
  Filter,
  CheckCircle,
  HelpCircle,
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
import {
  computeRosterDiscrepancies,
  normalizeNameForMatching,
  matchOperatorWithRoster,
} from "../utils/rosterMatcher";

interface KmenModalProps {
  isOpen: boolean;
  onClose: () => void;
  roster: RosterMember[];
  currentOperators: Operator[];
  activeShift: ShiftCode;
  initialDepartmentId?: DepartmentId | "all";
  initialTab?: "check" | "list" | "add";
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
  onMoveOperator?: (operatorId: string, targetDeptId: DepartmentId, reason?: AbsenceReason) => void;
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

const teamLeaderMeta: Record<TeamLeaderRole, { name: string; team: string; className: string }> = {
  transport: { name: "Lukáš Hemzáček", team: "Transport", className: "bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200" },
  vna: { name: "Oto Pukančík", team: "VNA", className: "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" },
  other: { name: "Jiný Team Leader", team: "Ostatní", className: "bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-200" },
};

export const KmenModal: React.FC<KmenModalProps> = ({
  isOpen,
  onClose,
  roster,
  currentOperators,
  activeShift,
  initialDepartmentId = "all",
  initialTab = "list",
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
  onMoveOperator,
}) => {
  const [activeTab, setActiveTab] = useState<"check" | "list" | "add">(initialTab);
  const [addMode, setAddMode] = useState<"single" | "bulk">("bulk");
  const [selectedTLFilter, setSelectedTLFilter] = useState<TeamLeaderRole | "all">("transport");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<DepartmentId | "all">(
    initialDepartmentId,
  );
  const [selectedPresenceFilter, setSelectedPresenceFilter] = useState<
    "all" | "active" | "absence" | "missing" | "loaned"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Sync initial parameters when opening modal
  useEffect(() => {
    if (isOpen) {
      if (initialDepartmentId) setSelectedDeptFilter(initialDepartmentId);
      if (initialTab) setActiveTab(initialTab);
    }
  }, [isOpen, initialDepartmentId, initialTab]);

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

  // Discrepancy report calculation for the whole kmen
  const report = useMemo(() => {
    return computeRosterDiscrepancies(currentOperators, roster, activeShift, selectedTLFilter);
  }, [currentOperators, roster, activeShift, selectedTLFilter]);

  // Map active shift operators by matched roster member ID
  const shiftOperatorMatchMap = useMemo(() => {
    const map = new Map<string, Operator>();
    const shiftOps = currentOperators.filter((o) => (o.shift || "A") === activeShift);
    for (const member of roster) {
      const match = shiftOps.find(
        (op) => matchOperatorWithRoster(op.name, [member]).confidence >= 0.8,
      );
      if (match) {
        map.set(member.id, match);
      }
    }
    return map;
  }, [currentOperators, roster, activeShift]);

  // Filtered members list with TL, Department, Presence, and Search filters
  const filteredMembers = useMemo(() => {
    return roster.filter((m) => {
      const matchTL = selectedTLFilter === "all" || m.teamLeader === selectedTLFilter;
      const matchShift = !m.shift || m.shift === "all" || m.shift === activeShift;
      const matchDept =
        selectedDeptFilter === "all" || (m.defaultDepartmentId || "hovc") === selectedDeptFilter;

      // Presence filter
      const opOnShift = shiftOperatorMatchMap.get(m.id);
      let matchPresence = true;
      if (selectedPresenceFilter === "active") {
        matchPresence = Boolean(
          opOnShift && opOnShift.departmentId !== "unassigned" && opOnShift.status === "active",
        );
      } else if (selectedPresenceFilter === "absence") {
        matchPresence = Boolean(
          opOnShift && (opOnShift.departmentId === "unassigned" || opOnShift.status === "absence"),
        );
      } else if (selectedPresenceFilter === "missing") {
        matchPresence = !opOnShift;
      } else if (selectedPresenceFilter === "loaned") {
        matchPresence = Boolean(
          opOnShift &&
          opOnShift.departmentId !== "unassigned" &&
          opOnShift.status === "active" &&
          opOnShift.departmentId !== (m.defaultDepartmentId || "hovc"),
        );
      }

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.notes && m.notes.toLowerCase().includes(q)) ||
        getDepartmentById(m.defaultDepartmentId || "hovc")
          .name.toLowerCase()
          .includes(q);

      return matchTL && matchShift && matchDept && matchPresence && matchSearch;
    });
  }, [
    roster,
    selectedTLFilter,
    activeShift,
    selectedDeptFilter,
    selectedPresenceFilter,
    searchQuery,
    shiftOperatorMatchMap,
  ]);

  const orderedFilteredMembers = useMemo(
    () =>
      [...filteredMembers].sort(
        (a, b) =>
          (a.teamLeader === "transport" ? 0 : a.teamLeader === "vna" ? 1 : 2) -
          (b.teamLeader === "transport" ? 0 : b.teamLeader === "vna" ? 1 : 2),
      ),
    [filteredMembers],
  );

  // Counts by department for quick filter badges
  const departmentCounts = useMemo(() => {
    const counts = new Map<DepartmentId, number>();
    roster.forEach((m) => {
      if (selectedTLFilter !== "all" && m.teamLeader !== selectedTLFilter) return;
      if (m.shift && m.shift !== "all" && m.shift !== activeShift) return;
      const d = m.defaultDepartmentId || "hovc";
      counts.set(d, (counts.get(d) || 0) + 1);
    });
    return counts;
  }, [roster, selectedTLFilter, activeShift]);

  // Counts by presence on shift
  const presenceCounts = useMemo(() => {
    let active = 0;
    let absence = 0;
    let missing = 0;
    let loaned = 0;

    roster.forEach((m) => {
      if (selectedTLFilter !== "all" && m.teamLeader !== selectedTLFilter) return;
      if (m.shift && m.shift !== "all" && m.shift !== activeShift) return;
      if (selectedDeptFilter !== "all" && (m.defaultDepartmentId || "hovc") !== selectedDeptFilter)
        return;

      const op = shiftOperatorMatchMap.get(m.id);
      if (!op) {
        missing++;
      } else if (op.departmentId === "unassigned" || op.status === "absence") {
        absence++;
      } else {
        active++;
        if (op.departmentId !== (m.defaultDepartmentId || "hovc")) {
          loaned++;
        }
      }
    });

    return { active, absence, missing, loaned, total: active + absence + missing };
  }, [roster, selectedTLFilter, activeShift, selectedDeptFilter, shiftOperatorMatchMap]);

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

      let tokens: string[] = [];
      if (trimmed.includes(";")) {
        tokens = trimmed.split(";").map((t) => t.trim());
      } else if (trimmed.includes("\t")) {
        tokens = trimmed.split("\t").map((t) => t.trim());
      } else if (trimmed.includes(",")) {
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

      const norm = normalizeNameForMatching(name);
      if (seenInBatch.has(norm)) continue;
      seenInBatch.add(norm);

      let itemTL = bulkDefaultTL;
      let itemDept = bulkDefaultDept;
      let itemMachine = bulkDefaultMachine;
      let itemShift = bulkDefaultShift;
      let itemNotes: string | undefined = undefined;

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

      if (tokens.length >= 4 && tokens[3]) {
        const val3 = tokens[3].toUpperCase();
        if (val3.includes("RTR")) itemMachine = "RTR";
        else if (val3.includes("LL")) itemMachine = "LL";
        else if (val3.includes("NONE")) itemMachine = "NONE";
      }

      if (tokens.length >= 5 && tokens[4]) {
        const val4 = tokens[4].toUpperCase();
        if (val4 === "A" || val4 === "B" || val4 === "C") {
          itemShift = val4 as ShiftCode;
        } else if (val4 === "VŠE" || val4 === "ALL") {
          itemShift = "all";
        }
      }

      if (tokens.length >= 6 && tokens[5]) {
        itemNotes = tokens[5];
      }

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
      description: `Opravdu chcete odebrat z kmene ${ids.length} vybraných pracovníků (${preview})?`,
    });
  };

  const handleTriggerDeleteSingle = (member: RosterMember) => {
    setConfirmDeleteData({
      ids: [member.id],
      title: `Odstranění pracovníka z kmene`,
      description: `Opravdu chcete odebrat z kmene pracovníka "${member.name}"?`,
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

  // Bulk Deploy selected missing members to shift
  const handleBulkDeploySelectedToShift = () => {
    const selectedMembers = roster.filter((m) => selectedMemberIds.has(m.id));
    if (selectedMembers.length === 0) return;

    selectedMembers.forEach((member) => {
      const existingOp = shiftOperatorMatchMap.get(member.id);
      if (existingOp) {
        if (existingOp.departmentId === "unassigned" || existingOp.status === "absence") {
          onMoveOperator?.(existingOp.id, member.defaultDepartmentId || "hovc");
        }
      } else {
        onQuickAssignMissingOperator(member, "dept");
      }
    });

    handleClearSelection();
  };

  // Bulk assign selected to Vacation / PN
  const handleBulkAssignSelectedAbsence = (reason: AbsenceReason) => {
    const selectedMembers = roster.filter((m) => selectedMemberIds.has(m.id));
    if (selectedMembers.length === 0) return;

    selectedMembers.forEach((member) => {
      const existingOp = shiftOperatorMatchMap.get(member.id);
      if (existingOp) {
        onMoveOperator?.(existingOp.id, "unassigned", reason);
      } else {
        onQuickAssignMissingOperator(member, "absence", reason);
      }
    });

    handleClearSelection();
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

  // Bulk change Machine for selected
  const handleBulkChangeMachine = (machine: MachineType) => {
    const targetMembers = roster.filter((m) => selectedMemberIds.has(m.id));
    if (targetMembers.length === 0) return;

    const updated = targetMembers.map((m) => ({
      ...m,
      defaultMachineType: machine,
    }));

    if (onBulkUpdateRosterMembers) {
      onBulkUpdateRosterMembers(updated);
    } else {
      updated.forEach((m) => onUpdateRosterMember(m));
    }
    setSelectedMemberIds(new Set());
  };

  // Return all loaned workers belonging to the current filter back to their home department
  const handleReturnAllLoanedToDefaultDept = () => {
    roster.forEach((member) => {
      if (selectedTLFilter !== "all" && member.teamLeader !== selectedTLFilter) return;
      const op = shiftOperatorMatchMap.get(member.id);
      if (
        op &&
        op.departmentId !== "unassigned" &&
        op.status === "active" &&
        member.defaultDepartmentId &&
        op.departmentId !== member.defaultDepartmentId
      ) {
        onMoveOperator?.(op.id, member.defaultDepartmentId);
      }
    });
  };

  // Deploy all missing workers of current filter to their default department on shift
  const handleDeployAllMissingToShift = () => {
    roster.forEach((member) => {
      if (selectedTLFilter !== "all" && member.teamLeader !== selectedTLFilter) return;
      if (member.shift && member.shift !== "all" && member.shift !== activeShift) return;
      const op = shiftOperatorMatchMap.get(member.id);
      if (!op) {
        onQuickAssignMissingOperator(member, "dept");
      } else if (op.departmentId === "unassigned" || op.status === "absence") {
        onMoveOperator?.(op.id, member.defaultDepartmentId || "hovc");
      }
    });
  };

  // Copy roster list to clipboard
  const handleCopyRosterToClipboard = () => {
    const lines = filteredMembers.map((m) => {
      const dept = getDepartmentById(m.defaultDepartmentId || "hovc");
      const op = shiftOperatorMatchMap.get(m.id);
      const statusText = !op
        ? "Chybí"
        : op.departmentId === "unassigned" || op.status === "absence"
          ? `Absence: ${op.absenceReason || "Dovolená"}`
          : `V provozu: ${getDepartmentById(op.departmentId).name}`;
      return `${m.name}\t${m.teamLeader === "transport" ? "Transport" : "VNA"}\t${dept.name}\t${m.defaultMachineType || "LL"}\t${statusText}`;
    });

    const header = "Jméno\tTeam Leader\tVýchozí oddělení\tStroj\tStav na směně";
    const text = [header, ...lines].join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-700 dark:bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Stálý stav zaměstnanců & Docházka
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                  Směna {activeShift}
                </span>
                {copiedNotification && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1 animate-in fade-in">
                    <Check className="w-3 h-3 text-emerald-600" />
                    Zkopírováno do schránky!
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Přehledné nasazení stálých pracovníků na pracoviště, rychlé přesuny a hromadné
                úpravy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyRosterToClipboard}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              title="Zkopírovat aktuálně zobrazený seznam do schránky (pro Excel nebo report)"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Kopírovat seznam</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Zavřít okno (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
              <span>Můj tým (Transport)</span>
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
              <span>Vše ({roster.length})</span>
            </button>
          </div>

          {/* Decent metrics summary */}
          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold shadow-2xs">
              <span className="text-slate-400 font-normal">Stálý stav:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {report.totalRosterCount}
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 font-semibold shadow-2xs">
              <span className="text-emerald-600 dark:text-emerald-400 font-normal">
                Na pracovištích:
              </span>
              <span className="font-mono font-bold">{report.presentInShiftCount}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 font-semibold shadow-2xs">
              <span className="text-amber-600 dark:text-amber-400 font-normal">Absence:</span>
              <span className="font-mono font-bold">{report.absentInShiftCount}</span>
            </div>

            {report.missingCount > 0 ? (
              <div
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200 font-bold shadow-2xs animate-pulse"
                title={`${report.missingCount} stálých pracovníků není zapsáno na směně ani v absenci!`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
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
            onClick={() => setActiveTab("list")}
            className={`py-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "list"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Stálí pracovníci ({filteredMembers.length})</span>
            {selectedMemberIds.size > 0 && (
              <span className="text-[10px] bg-blue-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                {selectedMemberIds.size}
              </span>
            )}
          </button>

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
              <span className="text-[10px] bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                {report.missingCount}
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
            <span>+ Přidat do stálého stavu</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3.5">
          {/* TAB 1: KMENOVÍ PRACOVNÍCI (SEZNAM + RYCHLÁ MANIPULACE + HROMADNÉ AKCE) */}
          {activeTab === "list" && (
            <div className="space-y-3">
              {/* Department Filter Pills (Single-click department filtering) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                <span className="text-slate-400 font-semibold shrink-0 text-[11px] flex items-center gap-1 mr-1">
                  <Filter className="w-3 h-3" />
                  Oddělení:
                </span>

                <button
                  type="button"
                  onClick={() => setSelectedDeptFilter("all")}
                  className={`px-2.5 py-1 rounded-xl font-bold shrink-0 transition-all cursor-pointer text-xs ${
                    selectedDeptFilter === "all"
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs"
                      : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  Všechna oddělení
                </button>

                {DEPARTMENTS.filter((d) => d.id !== "unassigned").map((dept) => {
                  const count = departmentCounts.get(dept.id) || 0;
                  const isSelected = selectedDeptFilter === dept.id;

                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => setSelectedDeptFilter(isSelected ? "all" : dept.id)}
                      className={`px-2.5 py-1 rounded-xl font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 text-xs ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-2xs"
                          : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60"
                      }`}
                    >
                      <span>{dept.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                          isSelected
                            ? "bg-blue-800 text-white"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Status on shift filter pills (All / Na směně / V absenci / Chybí) */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                  <span className="text-slate-400 font-semibold shrink-0 text-[11px]">
                    Stav na směně {activeShift}:
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedPresenceFilter("all")}
                    className={`px-2 py-0.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                      selectedPresenceFilter === "all"
                        ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Všichni ({presenceCounts.total})
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPresenceFilter("active")}
                    className={`px-2 py-0.5 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                      selectedPresenceFilter === "active"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Na směně ({presenceCounts.active})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPresenceFilter("absence")}
                    className={`px-2 py-0.5 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                      selectedPresenceFilter === "absence"
                        ? "bg-amber-600 text-white shadow-2xs"
                        : "text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>V absenci ({presenceCounts.absence})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPresenceFilter("missing")}
                    className={`px-2 py-0.5 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                      selectedPresenceFilter === "missing"
                        ? "bg-rose-600 text-white shadow-2xs"
                        : "text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    <span>Chybí ({presenceCounts.missing})</span>
                  </button>

                  {presenceCounts.loaned > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedPresenceFilter("loaned")}
                      className={`px-2 py-0.5 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                        selectedPresenceFilter === "loaned"
                          ? "bg-amber-600 text-white shadow-2xs"
                          : "text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                      }`}
                      title="Stálí pracovníci, kteří na směně pracují na jiném oddělení než je jejich výchozí"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <span>Zapůjčení ({presenceCounts.loaned})</span>
                    </button>
                  )}

                  {/* Fast 1-click batch utilities for shift supervisors */}
                  {presenceCounts.loaned > 0 && (
                    <button
                      type="button"
                      onClick={handleReturnAllLoanedToDefaultDept}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 cursor-pointer shadow-2xs active:scale-95 transition-all ml-1"
                      title="Přesunout všechny zapůjčené pracovníky zpět na jejich úsek (Transport / VNA)"
                    >
                      <span>🔄 Vrátit na výchozí tým ({presenceCounts.loaned})</span>
                    </button>
                  )}

                  {presenceCounts.missing > 0 && (
                    <button
                      type="button"
                      onClick={handleDeployAllMissingToShift}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-blue-100 hover:bg-blue-200 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700 cursor-pointer shadow-2xs active:scale-95 transition-all ml-1"
                      title="Zařadit všechny dosud neevidované stálé pracovníky na jejich výchozí pracoviště"
                    >
                      <span>⚡ Zařadit ({presenceCounts.missing})</span>
                    </button>
                  )}
                </div>

                {/* Search Bar */}
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Hledat v kmeni..."
                    className="w-full pl-8 pr-7 py-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Floating Multi-Select Quick Action Bar */}
              {selectedMemberIds.size > 0 && (
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg flex flex-wrap items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-blue-200" />
                    <span className="font-extrabold text-xs">
                      Vybráno:{" "}
                      <span className="font-mono text-sm underline">{selectedMemberIds.size}</span>{" "}
                      pracovníků
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Bulk deploy to shift */}
                    <button
                      type="button"
                      onClick={handleBulkDeploySelectedToShift}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-xs transition-transform active:scale-95 cursor-pointer"
                      title="Zařadit všechny vybrané na jejich výchozí oddělení na směně"
                    >
                      + Zařadit na směnu ({selectedMemberIds.size})
                    </button>

                    {/* Bulk Absence */}
                    <button
                      type="button"
                      onClick={() => handleBulkAssignSelectedAbsence("Dovolená")}
                      className="px-2 py-1 text-xs font-bold rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
                      title="Zapsat všechny vybrané jako Dovolená"
                    >
                      Dovolená
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBulkAssignSelectedAbsence("PN")}
                      className="px-2 py-1 text-xs font-bold rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
                      title="Zapsat všechny vybrané jako PN"
                    >
                      PN
                    </button>

                    {/* Machine switch */}
                    <button
                      type="button"
                      onClick={() => handleBulkChangeMachine("LL")}
                      className="px-2 py-1 text-xs font-bold rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
                      title="Nastavit stroj LL pro vybrané"
                    >
                      Stroj LL
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBulkChangeMachine("RTR")}
                      className="px-2 py-1 text-xs font-bold rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
                      title="Nastavit stroj RTR pro vybrané"
                    >
                      Stroj RTR
                    </button>

                    {/* TL Switch */}
                    <button
                      type="button"
                      onClick={() => handleBulkChangeTL("transport")}
                      className="px-2 py-1 text-xs font-bold rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
                      title="Přenést pod TL Transport"
                    >
                      TL: Transport
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBulkChangeTL("vna")}
                      className="px-2 py-1 text-xs font-bold rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
                      title="Přenést pod TL VNA"
                    >
                      TL: VNA
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={handleTriggerBulkDeleteSelected}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-700 hover:bg-rose-800 text-white transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="Smazat vybrané z kmene"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Smazat</span>
                    </button>

                    {/* Clear selection */}
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="px-2 py-1 text-xs font-semibold text-white/80 hover:text-white cursor-pointer ml-1"
                    >
                      Zrušit
                    </button>
                  </div>
                </div>
              )}

              {/* Members Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                <div className="max-h-[52vh] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/90 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
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
                        <th className="py-2.5 px-3">Pracovník</th>
                        <th className="py-2.5 px-3">Team Leader</th>
                        <th className="py-2.5 px-3">Výchozí pracoviště</th>
                        <th className="py-2.5 px-3 text-center">Stroj</th>
                        <th className="py-2.5 px-3">Aktuální stav na směně {activeShift}</th>
                        <th className="py-2.5 px-3 text-right">Rychlá akce</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {orderedFilteredMembers.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-8 text-center text-slate-400 dark:text-slate-500"
                          >
                            Nenalezeni žádní pracovníci odpovídající filtru.
                          </td>
                        </tr>
                      ) : (
                        orderedFilteredMembers.map((member, index) => {
                          const isEditing = editingMemberId === member.id;
                          const isSelected = selectedMemberIds.has(member.id);
                          const dept = getDepartmentById(member.defaultDepartmentId || "hovc");
                          const opOnShift = shiftOperatorMatchMap.get(member.id);
                          const leader = teamLeaderMeta[member.teamLeader || "other"];
                          const previousLeader = orderedFilteredMembers[index - 1]?.teamLeader;

                          if (isEditing) {
                            return (
                              <React.Fragment key={member.id}>
                                {previousLeader !== member.teamLeader && (
                                  <tr className={leader.className}>
                                    <td colSpan={7} className="px-3 py-2 text-xs font-black">
                                      Team Leader: {leader.name} · {leader.team}
                                    </td>
                                  </tr>
                                )}
                                <tr className="bg-blue-50/50 dark:bg-blue-950/30 p-2">
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
                                <td className="p-2 text-center">
                                  <select
                                    value={editMachine}
                                    onChange={(e) => setEditMachine(e.target.value as MachineType)}
                                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                                  >
                                    <option value="LL">LL</option>
                                    <option value="RTR">RTR</option>
                                    <option value="NONE">NONE</option>
                                  </select>
                                </td>
                                <td className="p-2 text-slate-500 text-[11px]" colSpan={2}>
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={handleSaveEdit}
                                      className="px-2.5 py-1 rounded bg-blue-600 text-white font-bold hover:bg-blue-500 cursor-pointer shadow-2xs flex items-center gap-1"
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                      <span>Uložit</span>
                                    </button>
                                    <button
                                      onClick={() => setEditingMemberId(null)}
                                      className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
                                    >
                                      Zrušit
                                    </button>
                                  </div>
                                </td>
                                </tr>
                              </React.Fragment>
                            );
                          }

                          return (
                            <React.Fragment key={member.id}>
                              {previousLeader !== member.teamLeader && (
                                <tr className={leader.className}>
                                  <td colSpan={7} className="px-3 py-2 text-xs font-black">
                                    Team Leader: {leader.name} · {leader.team}
                                  </td>
                                </tr>
                              )}
                              <tr
                                className={`transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-blue-50/70 dark:bg-blue-950/40"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                              }`}
                              onClick={() => handleToggleSelectMember(member.id)}
                            >
                              <td
                                className="py-2.5 px-3 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectMember(member.id)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>

                              <td className="py-2.5 px-3">
                                <span className="font-bold text-slate-900 dark:text-white block">
                                  {member.name}
                                </span>
                                {member.notes && (
                                  <span className="text-[10px] text-slate-400 line-clamp-1">
                                    {member.notes}
                                  </span>
                                )}
                              </td>

                              {/* Team Leader column: 1-click toggle */}
                              <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextTL: TeamLeaderRole =
                                      member.teamLeader === "transport" ? "vna" : "transport";
                                    onUpdateRosterMember({
                                      ...member,
                                      teamLeader: nextTL,
                                    });
                                  }}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-transform active:scale-95 cursor-pointer ${
                                    member.teamLeader === "transport"
                                      ? "bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100"
                                      : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                                  }`}
                                  title={`Team Leader: ${member.teamLeader === "transport" ? "Transport" : "VNA"}. Kliknutím přepnout.`}
                                >
                                  {member.teamLeader === "transport" ? (
                                    <Truck className="w-2.5 h-2.5" />
                                  ) : (
                                    <Forklift className="w-2.5 h-2.5" />
                                  )}
                                  <span>
                                    {member.teamLeader === "transport" ? "Transport" : "VNA"}
                                  </span>
                                </button>
                              </td>

                              {/* Department column: direct select dropdown */}
                              <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={member.defaultDepartmentId || "hovc"}
                                  onChange={(e) => {
                                    const newDept = e.target.value as DepartmentId;
                                    onUpdateRosterMember({
                                      ...member,
                                      defaultDepartmentId: newDept,
                                      defaultMachineType:
                                        newDept === "vna"
                                          ? ("NONE" as MachineType)
                                          : member.defaultMachineType,
                                    });
                                  }}
                                  className="px-2 py-0.5 rounded text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer hover:border-blue-400 focus:ring-1 focus:ring-blue-500 shadow-2xs"
                                  title="Změnit výchozí kmenové pracoviště"
                                >
                                  {DEPARTMENTS.filter((d) => d.id !== "unassigned").map((d) => (
                                    <option key={d.id} value={d.id}>
                                      {d.name}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* 1-Click Toggle Machine Type LL <-> RTR */}
                              <td
                                className="py-2.5 px-3 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextMachine: MachineType =
                                      member.defaultMachineType === "LL" ? "RTR" : "LL";
                                    onUpdateRosterMember({
                                      ...member,
                                      defaultMachineType: nextMachine,
                                    });
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-black font-mono tracking-wider border cursor-pointer transition-transform active:scale-90 ${
                                    member.defaultMachineType === "RTR"
                                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border-blue-300 dark:border-blue-700"
                                      : member.defaultMachineType === "LL"
                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-amber-300 dark:border-amber-700"
                                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300"
                                  }`}
                                  title={`Výchozí stroj: ${member.defaultMachineType || "LL"}. Kliknutím přepnout LL/RTR.`}
                                >
                                  {member.defaultMachineType || "LL"}
                                </button>
                              </td>

                              {/* Live Status on Shift */}
                              <td className="py-2.5 px-3">
                                {!opOnShift ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    <span>Chybí na směně</span>
                                  </span>
                                ) : opOnShift.departmentId === "unassigned" ||
                                  opOnShift.status === "absence" ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    <span>{opOnShift.absenceReason || "Dovolená"}</span>
                                  </span>
                                ) : opOnShift.departmentId !==
                                  (member.defaultDepartmentId || "hovc") ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700"
                                    title={`Kmenové oddělení: ${dept.name}, aktuálně na oddělení: ${getDepartmentById(opOnShift.departmentId).name}`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    <span>
                                      Na {getDepartmentById(opOnShift.departmentId).name} (zapůjčen)
                                    </span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>
                                      V provozu: {getDepartmentById(opOnShift.departmentId).name}
                                    </span>
                                  </span>
                                )}
                              </td>

                              {/* Quick 1-Click Action Buttons */}
                              <td
                                className="py-2.5 px-3 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="inline-flex items-center gap-1">
                                  {!opOnShift ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => onQuickAssignMissingOperator(member, "dept")}
                                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white border border-blue-200 dark:border-blue-800 transition-colors shadow-2xs cursor-pointer"
                                        title={`Zařadit na výchozí oddělení ${dept.name}`}
                                      >
                                        + Zařadit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onQuickAssignMissingOperator(
                                            member,
                                            "absence",
                                            "Dovolená",
                                          )
                                        }
                                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500 hover:text-white border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                                        title="Zapsat do Dovolená"
                                      >
                                        Dov.
                                      </button>
                                    </>
                                  ) : opOnShift.departmentId === "unassigned" ||
                                    opOnShift.status === "absence" ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onMoveOperator?.(
                                          opOnShift.id,
                                          member.defaultDepartmentId || "hovc",
                                        )
                                      }
                                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white border border-emerald-200 dark:border-emerald-800 transition-colors shadow-2xs cursor-pointer"
                                      title="Povolat z absence zpět na oddělení"
                                    >
                                      + Do provozu
                                    </button>
                                  ) : opOnShift.departmentId !==
                                    (member.defaultDepartmentId || "hovc") ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onMoveOperator?.(
                                          opOnShift.id,
                                          member.defaultDepartmentId || "hovc",
                                        )
                                      }
                                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-0.5"
                                      title={`Vrátit operátora z ${getDepartmentById(opOnShift.departmentId).name} domů do ${dept.name}`}
                                    >
                                      <span>🏠 Domů</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onMoveOperator?.(opOnShift.id, "unassigned", "Dovolená")
                                      }
                                      className="px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-500 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                                      title="Přesunout do Dovolená"
                                    >
                                      Do absence
                                    </button>
                                  )}

                                  <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

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
                                </div>
                              </td>
                              </tr>
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom bulk summary & tools */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500 pt-1">
                <span>
                  Celkem v kmeni:{" "}
                  <span className="font-bold text-slate-900 dark:text-white">{roster.length}</span>{" "}
                  lidí
                  {filteredMembers.length !== roster.length &&
                    ` (zobrazeno ${filteredMembers.length})`}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={onResetRosterToDefaults}
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    title="Obnovit výchozí kmen ZF PICK (65 lidí)"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Obnovit výchozí stav</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: POROVNÁNÍ SE SMĚNOU (KONTROLA DOCHÁZKY) */}
          {activeTab === "check" && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">
                    Kontrola docházky oproti kmeni pro Směnu {activeShift} (
                    {selectedTLFilter === "transport"
                      ? "Můj kmen Transport"
                      : selectedTLFilter === "vna"
                        ? "Kmen VNA"
                        : "Všechny kmeny"}
                    )
                  </p>
                  <p className="text-blue-700 dark:text-blue-300">
                    Aplikace porovnává kmen s tabulí směny. Kmenový pracovník musí být buď na
                    oddělení, nebo v absenci (dovolená, PN).
                  </p>
                </div>
              </div>

              {/* Status Section 1: Missing Roster Members */}
              {report.missingFromBoard.length > 0 ? (
                <div className="space-y-2.5 p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-700/80">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      <h3 className="font-bold text-xs sm:text-sm text-rose-950 dark:text-rose-200">
                        Neevidovaní lidé z kmene ({report.missingFromBoard.length})
                      </h3>
                      <span className="text-[11px] text-rose-800 dark:text-rose-300 hidden sm:inline">
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
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-2xs transition-colors cursor-pointer"
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                    {report.missingFromBoard.map((member) => {
                      const defDept = getDepartmentById(member.defaultDepartmentId || "hovc");
                      return (
                        <div
                          key={member.id}
                          className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800/60 shadow-2xs space-y-2"
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
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-300/60">
                              Chybí
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/60 text-[11px]">
                            <button
                              onClick={() => onQuickAssignMissingOperator(member, "dept")}
                              className="px-2 py-1 rounded font-bold bg-blue-50 hover:bg-blue-600 hover:text-white dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors shrink-0 cursor-pointer shadow-2xs"
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
                              + Dov.
                            </button>

                            <button
                              onClick={() => onQuickAssignMissingOperator(member, "absence", "PN")}
                              className="px-2 py-1 rounded font-semibold bg-rose-50 hover:bg-rose-600 hover:text-white dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800 transition-colors shrink-0 cursor-pointer shadow-2xs"
                              title="Zapsat jako PN"
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
                      Žádný pracovník z vašeho kmene nechybí. Všichni jsou buď na odděleních, nebo
                      omluveni v absenci.
                    </p>
                  </div>
                </div>
              )}

              {/* Status Section 2: Cross-team loaned workers (Výpomoc mezi Transportem a VNA) */}
              {report.loanedWorkers && report.loanedWorkers.length > 0 && (
                <div className="space-y-2.5 p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <h3 className="font-bold text-xs sm:text-sm text-amber-950 dark:text-amber-100">
                        {selectedTLFilter === "transport"
                          ? `Zapůjčení z VNA kmene (${report.loanedWorkers.length})`
                          : selectedTLFilter === "vna"
                            ? `Zapůjčení z Transport kmene (${report.loanedWorkers.length})`
                            : `Výpomoc mezi týmy (${report.loanedWorkers.length})`}
                      </h3>
                      <span className="text-[11px] text-amber-800/80 dark:text-amber-300/80 hidden sm:inline">
                        — Stálí zaměstnanci ZF dočasně vypomáhající na druhém úseku
                      </span>
                    </div>

                    {onMoveOperator && (
                      <button
                        onClick={() => {
                          report.loanedWorkers.forEach((lw) => {
                            const returnDept: DepartmentId = lw.homeTeam === "vna" ? "vna" : "hovc";
                            onMoveOperator(lw.operator.id, returnDept);
                          });
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
                        title="Přesunout všechny zapůjčené pracovníky zpět na jejich úsek (Transport / VNA)"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Přesunout všechny na výchozí úsek</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {report.loanedWorkers.map((lw) => {
                      const currentDept = getDepartmentById(lw.currentDeptId);
                      const homeName = lw.homeTeam === "vna" ? "VNA kmen" : "Transport kmen";
                      return (
                        <div
                          key={lw.operator.id}
                          className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/70 text-xs flex items-center justify-between gap-1.5 shadow-2xs"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-white truncate block">
                              {lw.operator.name}
                            </span>
                            <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold block">
                              {homeName} • Nyní na: {currentDept.name}
                            </span>
                          </div>

                          {onMoveOperator && (
                            <button
                              type="button"
                              onClick={() => {
                                const returnDept: DepartmentId =
                                  lw.homeTeam === "vna" ? "vna" : "hovc";
                                onMoveOperator(lw.operator.id, returnDept);
                              }}
                              className="px-2 py-1 rounded text-[10px] font-bold bg-amber-100 hover:bg-amber-600 hover:text-white dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 transition-colors shrink-0 cursor-pointer flex items-center gap-1"
                              title={`Přesunout zpět na ${homeName}`}
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Přesunout zpět</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Status Section 3: Extra workers on shift (Truly Out of Roster / Externisti / Brigádníci) */}
              {report.extraOnBoard.length > 0 && (
                <div className="space-y-2.5 p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/80">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <h3 className="font-bold text-xs sm:text-sm text-purple-950 dark:text-purple-100">
                        Lidé navíc na směně / mimo kmen ({report.extraOnBoard.length})
                      </h3>
                      <span className="text-[11px] text-purple-800/80 dark:text-purple-300/80 hidden sm:inline">
                        — Externisté, brigádníci a pracovníci bez záznamu v kmeni
                      </span>
                    </div>

                    {onAddAllExtraToRoster && (
                      <button
                        onClick={() => onAddAllExtraToRoster(report.extraOnBoard)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
                        title="Přidat všechny tyto pracovníky najednou do kmene"
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
                          className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800/70 text-xs flex items-center justify-between gap-1.5 shadow-2xs"
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
                              title="Zařadit do stálého stavu"
                            >
                              + Do stálého stavu
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

          {/* TAB 3: PŘIDAT DO KMENE (HROMADNĚ TEXTEM NEBO JEDNOTLIVĚ) */}
          {activeTab === "add" && (
            <div className="space-y-4 max-w-2xl mx-auto py-1">
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
                  <span>Hromadné vložení (text / Excel)</span>
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

              {/* Bulk Form */}
              {addMode === "bulk" && (
                <div className="space-y-3.5 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-900 dark:text-white block">
                      Vložte seznam jmen (jedno jméno na řádek, nebo zkopírováno ze schránky):
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Podporuje prostý seznam jmen i formát s oddělovači:{" "}
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
                      Výchozí hodnoty pro vkládanou skupinu:
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
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
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

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700/80">
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={skipDuplicates}
                        onChange={(e) => setSkipDuplicates(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Přeskočit pracovníky, kteří už ve stálém stavu existují</span>
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
                              {item.defaultMachineType}
                            </span>
                          </div>

                          {item.isExisting ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                              Již evidován
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
                      <span>Uložit {bulkToAddCount} pracovníků do stálého stavu</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Single Member Form */}
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
                        Team Leader (Tým):
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
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
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
                      placeholder="Např. Stálý tým, zástupce mistra, specializace..."
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
                      <span>Uložit do stálého stavu</span>
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
            <span>AI asistent automaticky páruje OCR jména z fotografií tabule s tímto kmenem</span>
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
