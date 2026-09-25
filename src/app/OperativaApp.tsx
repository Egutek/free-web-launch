import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  DEPARTMENTS,
  getDepartmentById,
  loadCustomDepartments,
  saveCustomDepartments,
  addCustomDepartment,
  removeCustomDepartment,
} from "./data/departments";
import {
  AbsenceReason,
  Department,
  DepartmentId,
  MoveHistoryRecord,
  Operator,
  OperatorStatus,
  ShiftCode,
  UndoOperation,
} from "./types";
import {
  loadOperators,
  saveOperators,
  loadHistory,
  saveHistory,
  loadUndoStack,
  saveUndoStack,
  resetToInitialOperators,
  loadActiveShift,
  saveActiveShift,
} from "./utils/storage";
import { Header } from "./components/Header";
import { BossAnswerCard } from "./components/BossAnswerCard";
import { DepartmentColumn } from "./components/DepartmentColumn";
import { TableView } from "./components/TableView";
import { WidgetView } from "./components/WidgetView";
import { QuickMoveModal } from "./components/QuickMoveModal";
import { BossReportModal } from "./components/BossReportModal";
import { AddEditOperatorModal } from "./components/AddEditOperatorModal";
import { AddCustomDepartmentModal } from "./components/AddCustomDepartmentModal";
import { ConfirmDialogModal } from "./components/ConfirmDialogModal";
import { HistoryModal } from "./components/HistoryModal";
import { PhotoImportModal } from "./components/PhotoImportModal";
import { ShiftTemplatesModal } from "./components/ShiftTemplatesModal";
import { ShiftTemplate } from "./types";
import { applyTemplateToOperators } from "./data/templates";
import {
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  ArrowDownToLine,
  Move,
  Plus,
  Wrench,
  Users,
  CheckSquare,
  Trash2,
  Sparkles,
  X,
} from "lucide-react";
import { FilteredOutRecord } from "./services/aiServerFn";
import { ensureFirebaseAuth } from "./firebase";
import {
  resolveOperatorFromDrop,
  resolveOperatorIdsFromDrop,
  getGlobalDragState,
} from "./utils/dragState";
import {
  subscribeToOperators,
  syncOperatorToCloud,
  bulkSyncOperatorsToCloud,
  replaceOperatorsInCloud,
  deleteOperatorFromCloud,
  syncHistoryRecordToCloud,
  clearHistoryFromCloud,
  subscribeToHistory,
  subscribeToCustomDepartments,
  syncCustomDepartmentToCloud,
  deleteCustomDepartmentFromCloud,
} from "./services/firestoreSync";

const JUMP_THEMES: Record<
  DepartmentId,
  {
    border: string;
    activeBorder: string;
    activeBg: string;
    dragHoverBg: string;
    badgeBg: string;
    badgeActive: string;
  }
> = {
  hovc: {
    border: "hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30",
    activeBorder: "border-blue-500 ring-4 ring-blue-500/30",
    activeBg: "bg-blue-600 text-white",
    dragHoverBg: "bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 border-dashed",
    badgeBg: "bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300",
    badgeActive: "bg-white/25 text-white",
  },
  hovs: {
    border: "hover:border-sky-400 hover:bg-sky-50/50 dark:hover:bg-sky-950/30",
    activeBorder: "border-sky-500 ring-4 ring-sky-500/30",
    activeBg: "bg-sky-600 text-white",
    dragHoverBg: "bg-sky-50/80 dark:bg-sky-950/40 border-sky-400 border-dashed",
    badgeBg: "bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300",
    badgeActive: "bg-white/25 text-white",
  },
  putaway: {
    border: "hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30",
    activeBorder: "border-indigo-500 ring-4 ring-indigo-500/30",
    activeBg: "bg-indigo-600 text-white",
    dragHoverBg: "bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-400 border-dashed",
    badgeBg: "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300",
    badgeActive: "bg-white/25 text-white",
  },
  vas: {
    border: "hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/30",
    activeBorder: "border-amber-500 ring-4 ring-amber-500/30",
    activeBg: "bg-amber-600 text-white",
    dragHoverBg: "bg-amber-50/80 dark:bg-amber-950/40 border-amber-400 border-dashed",
    badgeBg: "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300",
    badgeActive: "bg-white/25 text-white",
  },
  obwf: {
    border: "hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-950/30",
    activeBorder: "border-purple-500 ring-4 ring-purple-500/30",
    activeBg: "bg-purple-600 text-white",
    dragHoverBg: "bg-purple-50/80 dark:bg-purple-950/40 border-purple-400 border-dashed",
    badgeBg: "bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300",
    badgeActive: "bg-white/25 text-white",
  },
  vna: {
    border: "hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30",
    activeBorder: "border-emerald-500 ring-4 ring-emerald-500/30",
    activeBg: "bg-emerald-600 text-white",
    dragHoverBg: "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 border-dashed",
    badgeBg: "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300",
    badgeActive: "bg-white/25 text-white",
  },
  obwi: {
    border: "hover:border-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/30",
    activeBorder: "border-rose-500 ring-4 ring-rose-500/30",
    activeBg: "bg-rose-600 text-white",
    dragHoverBg: "bg-rose-50/80 dark:bg-rose-950/40 border-rose-400 border-dashed",
    badgeBg: "bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300",
    badgeActive: "bg-white/25 text-white",
  },
  unassigned: {
    border: "hover:border-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/30",
    activeBorder: "border-rose-600 ring-4 ring-rose-600/30",
    activeBg: "bg-rose-700 text-white",
    dragHoverBg: "bg-rose-50/80 dark:bg-rose-950/40 border-rose-400 border-dashed",
    badgeBg: "bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300",
    badgeActive: "bg-white/25 text-white",
  },
};

const DEFAULT_CUSTOM_JUMP_THEME = {
  border: "hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 border-dashed",
  activeBorder: "border-amber-500 ring-4 ring-amber-500/30",
  activeBg: "bg-amber-600 text-white",
  dragHoverBg: "bg-amber-50/80 dark:bg-amber-950/40 border-amber-400 border-dashed",
  badgeBg: "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300",
  badgeActive: "bg-white/25 text-white",
};

export default function App() {
  const [activeShift, setActiveShift] = useState<ShiftCode>(() => loadActiveShift());
  const [operators, setOperators] = useState<Operator[]>(() => loadOperators());
  const [history, setHistory] = useState<MoveHistoryRecord[]>(() => loadHistory());
  const [undoStack, setUndoStack] = useState<UndoOperation[]>(() => loadUndoStack());
  const [customDepartments, setCustomDepartments] = useState<Department[]>(() =>
    loadCustomDepartments(),
  );

  const handleShiftChange = useCallback((shift: ShiftCode) => {
    setActiveShift(shift);
    saveActiveShift(shift);
    setSelectedOperatorId(null);
    setBulkSelectedIds(new Set());
    showToast(`Přepnuto na Směnu ${shift}`);
  }, []);

  // Cloud Sync state (bez přihlašování)
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  // Bulk Selection of Operators (subtle checkboxes)
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());

  // Search & View Mode (persisted across sessions or set via URL ?view=widget)
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"board" | "widget" | "table">(() => {
    try {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const urlView = params.get("view") || params.get("mode");
        if (urlView === "widget" || urlView === "board" || urlView === "table") {
          return urlView;
        }
      }
      return (
        (localStorage.getItem("zf_ostrov_view_mode") as "board" | "widget" | "table") || "board"
      );
    } catch {
      return "board";
    }
  });

  // Auto-scroll state & container ref
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);

  // Mouse pan/drag-to-scroll state for horizontal board
  const [isPanningBoard, setIsPanningBoard] = useState(false);
  const isPanActiveRef = useRef(false);
  const panStartXRef = useRef(0);
  const panScrollLeftRef = useRef(0);
  const panHasMovedRef = useRef(false);

  // Modals state
  const [quickMoveOperator, setQuickMoveOperator] = useState<Operator | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isPhotoImportOpen, setIsPhotoImportOpen] = useState(false);
  const [omittedFromImport, setOmittedFromImport] = useState<FilteredOutRecord[]>([]);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [isAddCustomDeptOpen, setIsAddCustomDeptOpen] = useState(false);
  const [deptToDeleteConfirm, setDeptToDeleteConfirm] = useState<Department | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [addEditOperator, setAddEditOperator] = useState<{
    operator: Operator | null;
    defaultDeptId?: DepartmentId;
  } | null>(null);

  // Drag-and-drop hover state for quick top bar drop zones
  const [dragOverJumpDept, setDragOverJumpDept] = useState<DepartmentId | null>(null);

  // Click-to-move / Touch-to-move selected operator state
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    isWarning?: boolean;
    undoAction?: () => void;
  } | null>(null);

  // Synchronous references for instant persistence on tab close / unload
  const operatorsRef = useRef(operators);
  operatorsRef.current = operators;
  const historyRef = useRef(history);
  historyRef.current = history;
  const undoStackRef = useRef(undoStack);
  undoStackRef.current = undoStack;

  // Persist undo stack on update
  useEffect(() => {
    saveUndoStack(undoStack);
  }, [undoStack]);

  // Login-free Firebase authentication + real-time cloud sync.
  // Anonymous auth runs before Firestore listeners so rules can safely require
  // request.auth without introducing a visible login screen.
  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;

    setIsCloudSyncing(true);
    ensureFirebaseAuth()
      .then(() => {
        if (cancelled) return;
        unsub = subscribeToOperators(
          (cloudOps) => {
            setIsCloudSyncing(false);
            setIsCloudConnected(true);
            if (cloudOps.length > 0) {
              // Do not let an older snapshot arriving over the network overwrite
              // a newer local edit that is still being synchronized.
              const localById = new Map(operatorsRef.current.map((op) => [op.id, op]));
              const mergedOps = cloudOps.map((cloudOp) => {
                const localOp = localById.get(cloudOp.id);
                if (localOp) {
                  if (
                    typeof localOp.revision === "number" &&
                    typeof cloudOp.revision === "number"
                  ) {
                    return localOp.revision > cloudOp.revision ? localOp : cloudOp;
                  }

                  // Local edits made before the first revisioned cloud write do not
                  // have a revision yet, so fall back to the existing timestamp.
                  return new Date(localOp.lastMovedAt).getTime() >
                    new Date(cloudOp.lastMovedAt).getTime()
                    ? localOp
                    : cloudOp;
                }
                return cloudOp;
              });
              setOperators(mergedOps);
              saveOperators(mergedOps);
            } else {
              // If cloud is empty on first setup, seed initial operators.
              bulkSyncOperatorsToCloud(operatorsRef.current).catch((err) =>
                console.warn("Initial cloud seed failed:", err),
              );
            }
          },
          (err) => {
            setIsCloudSyncing(false);
            setIsCloudConnected(false);
            console.warn("Firestore subscription error:", err);
          },
        );
      })
      .catch((err) => {
        setIsCloudSyncing(false);
        setIsCloudConnected(false);
        console.warn("Firebase anonymous authentication failed:", err);
      });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  // Real-time Firestore sync for History.
  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;

    ensureFirebaseAuth()
      .then(() => {
        if (cancelled) return;
        unsub = subscribeToHistory(
          (cloudHistory) => {
            // An empty cloud collection is meaningful (for example after reset)
            // and must clear the local history as well.
            setHistory(cloudHistory);
            saveHistory(cloudHistory);
          },
          (err) => console.warn("Firestore history subscription error:", err),
        );
      })
      .catch((err) => console.warn("Firebase history authentication failed:", err));

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  // Real-time Firestore sync for Custom Departments.
  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;

    ensureFirebaseAuth()
      .then(() => {
        if (cancelled) return;
        unsub = subscribeToCustomDepartments(
          (cloudCustomDepts) => {
            setCustomDepartments(cloudCustomDepts);
            saveCustomDepartments(cloudCustomDepts);
          },
          (err) => console.warn("Firestore custom departments subscription error:", err),
        );
      })
      .catch((err) => console.warn("Firebase custom-department authentication failed:", err));

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  // Persist view mode
  useEffect(() => {
    try {
      localStorage.setItem("zf_ostrov_view_mode", viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  // Flush persistence synchronously before window closes / unloads
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveOperators(operatorsRef.current);
      saveHistory(historyRef.current);
      saveUndoStack(undoStackRef.current);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Keyboard shortcut listener (Esc deselects everything)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedOperatorId(null);
        setBulkSelectedIds(new Set());
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Show auto-dismissing toast
  const showToast = (text: string, isWarning?: boolean, undoAction?: () => void) => {
    setToastMessage({ text, isWarning, undoAction });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // Smoothly scroll and highlight a department column
  const scrollToDepartment = useCallback((deptId: DepartmentId) => {
    const el = document.getElementById(`dept-col-${deptId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      el.classList.add(
        "ring-4",
        "ring-amber-400",
        "dark:ring-amber-400",
        "transition-all",
        "duration-300",
      );
      setTimeout(() => {
        el.classList.remove("ring-4", "ring-amber-400", "dark:ring-amber-400");
      }, 1600);
    }
  }, []);

  // Single Undo operation (reverts the latest move)
  const handleUndoSingle = useCallback(() => {
    setUndoStack((currentStack) => {
      if (currentStack.length === 0) return currentStack;
      const [lastOp, ...remainingStack] = currentStack;

      const undoTimestamp = new Date().toISOString();
      const updatedOperators = operatorsRef.current.map((o) =>
        o.id === lastOp.operatorId
          ? {
              ...o,
              departmentId: lastOp.fromDept,
              machineType: lastOp.machineType,
              status:
                lastOp.fromStatus ?? (lastOp.fromDept === "unassigned" ? "absence" : "active"),
              absenceReason: lastOp.fromAbsenceReason,
              lastMovedAt: undoTimestamp,
            }
          : o,
      );
      setOperators(updatedOperators);
      saveOperators(updatedOperators);

      const fromDept = getDepartmentById(lastOp.fromDept);
      const toDept = getDepartmentById(lastOp.toDept);

      const historyItem: MoveHistoryRecord = {
        id: `hist-undo-${Date.now()}`,
        operatorId: lastOp.operatorId,
        operatorName: lastOp.operatorName,
        machineType: lastOp.machineType,
        fromDept: lastOp.toDept,
        toDept: lastOp.fromDept,
        timestamp: new Date().toISOString(),
        reason: `Vrácení zpět: ${lastOp.operatorName} vrácen z ${toDept.name} do ${fromDept.name}`,
      };
      setHistory((prev) => [historyItem, ...prev]);

      // Cloud synchronization for undo
      const revertedOp = updatedOperators.find((o) => o.id === lastOp.operatorId);
      if (revertedOp) {
        syncOperatorToCloud(revertedOp).catch((e) =>
          console.warn("Cloud undo sync error:", e),
        );
      }
      syncHistoryRecordToCloud(historyItem).catch((e) =>
        console.warn("Cloud history sync error:", e),
      );

      scrollToDepartment(lastOp.fromDept);
      showToast(`Krok vrácen: ${lastOp.operatorName} je zpět v ${fromDept.name}`);

      return remainingStack;
    });
  }, [scrollToDepartment]);

  // Bulk Undo operation (reverts the last count operations, up to 5)
  const handleUndoBulk = useCallback(
    (count: number) => {
      setUndoStack((currentStack) => {
        if (currentStack.length === 0) return currentStack;
        const countToRevert = Math.min(count, currentStack.length);
        const opsToRevert = currentStack.slice(0, countToRevert);
        const remainingStack = currentStack.slice(countToRevert);

        // Apply reversions in order from newest to oldest and persist immediately.
        const undoTimestamp = new Date().toISOString();
        const updatedOperators = operatorsRef.current.map((o) => {
          // undoStack is newest-first. When several recent operations affected
          // the same operator, restore the state from the oldest reverted entry.
          const op = [...opsToRevert]
            .reverse()
            .find((candidate) => candidate.operatorId === o.id);
          if (!op) return o;
          return {
            ...o,
            departmentId: op.fromDept,
            machineType: op.machineType,
            status: op.fromStatus ?? (op.fromDept === "unassigned" ? "absence" : "active"),
            absenceReason: op.fromAbsenceReason,
            lastMovedAt: undoTimestamp,
          };
        });
        setOperators(updatedOperators);
        saveOperators(updatedOperators);

        // Record bulk undo in history
        const historyEntries: MoveHistoryRecord[] = opsToRevert.map((op, i) => ({
          id: `hist-bulk-undo-${Date.now()}-${i}`,
          operatorId: op.operatorId,
          operatorName: op.operatorName,
          machineType: op.machineType,
          fromDept: op.toDept,
          toDept: op.fromDept,
          timestamp: new Date().toISOString(),
          reason: `Hromadné vrácení: obnoveno zpět do ${getDepartmentById(op.fromDept).name}`,
        }));
        setHistory((prev) => [...historyEntries, ...prev]);

        // Cloud synchronization for bulk undo
        const revertedOps: Operator[] = updatedOperators.filter((o) =>
          opsToRevert.some((op) => op.operatorId === o.id),
        );
        if (revertedOps.length > 0) {
          bulkSyncOperatorsToCloud(revertedOps).catch((e) =>
            console.warn("Cloud bulk undo sync error:", e),
          );
        }
        historyEntries.forEach((h) =>
          syncHistoryRecordToCloud(h).catch((e) =>
            console.warn("Cloud history undo sync error:", e),
          ),
        );

        if (opsToRevert.length > 0) {
          scrollToDepartment(opsToRevert[0].fromDept);
        }

        showToast(
          `Hromadné vrácení dokončeno: ${countToRevert} operací vráceno zpět do původních oddělení.`,
        );

        return remainingStack;
      });
    },
    [scrollToDepartment],
  );

  // Keyboard shortcut: Ctrl+Z / Cmd+Z for quick undo, Escape to deselect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedOperatorId(null);
        setBulkSelectedIds(new Set());
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        handleUndoSingle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndoSingle]);

  // Bulk selection toggle handler
  const handleToggleBulkSelect = useCallback((operatorId: string) => {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(operatorId)) {
        next.delete(operatorId);
      } else {
        next.add(operatorId);
      }
      return next;
    });
  }, []);

  // Select all operators
  const handleSelectAll = useCallback(() => {
    setBulkSelectedIds(
      new Set(operators.filter((o) => (o.shift || "A") === activeShift).map((o) => o.id)),
    );
  }, [operators, activeShift]);

  // Clear bulk selection
  const handleClearBulkSelection = useCallback(() => {
    setBulkSelectedIds(new Set());
  }, []);

  // Execute move of multiple operators (or single) to target department
  const handleMoveMultipleOperators = (
    operatorIds: string[],
    targetDeptId: DepartmentId,
    absenceReason?: AbsenceReason,
  ) => {
    if (operatorIds.length === 0) return;
    if (operatorIds.length === 1) {
      handleMoveOperator(operatorIds[0], targetDeptId, absenceReason);
      return;
    }

    setSelectedOperatorId(null);
    const targetDept = getDepartmentById(targetDeptId, customDepartments);
    const idSet = new Set(operatorIds);
    const toMove = operators.filter((o) => idSet.has(o.id));
    if (toMove.length === 0) return;

    const count = toMove.length;
    const newStatus: OperatorStatus = targetDeptId === "unassigned" ? "absence" : "active";
    const now = new Date().toISOString();

    const updatedOperators = operators.map((o) => {
      if (idSet.has(o.id)) {
        let finalMachineType = o.machineType;
        if (targetDeptId === "vna" || targetDeptId === "unassigned") {
          // Automatic removal of LL/RTR when moving to VNA or Absence
          finalMachineType = "NONE";
        } else if (
          o.departmentId === "vna" ||
          o.departmentId === "unassigned" ||
          finalMachineType === "NONE"
        ) {
          if (targetDeptId === "hovs") {
            finalMachineType = "LL";
          } else if (targetDeptId === "hovc" || targetDeptId === "obwi") {
            finalMachineType = "RTR";
          } else {
            finalMachineType = "LL";
          }
        }

        return {
          ...o,
          departmentId: targetDeptId,
          machineType: finalMachineType,
          status: newStatus,
          absenceReason:
            targetDeptId === "unassigned"
              ? absenceReason || o.absenceReason || "Absence"
              : undefined,
          isVnaOnly: false,
          lastMovedAt: now,
        };
      }
      return o;
    });

    setOperators(updatedOperators);
    saveOperators(updatedOperators);

    // Add undo operations for all moved operators
    const undoOps: UndoOperation[] = toMove.map((op) => ({
      id: `undo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      operatorId: op.id,
      operatorName: op.name,
      machineType: op.machineType,
      fromDept: op.departmentId,
      toDept: targetDeptId,
      fromStatus: op.status,
      toStatus: newStatus,
      fromAbsenceReason: op.absenceReason,
      toAbsenceReason:
        targetDeptId === "unassigned"
          ? absenceReason || op.absenceReason || "Absence"
          : undefined,
      timestamp: now,
    }));
    setUndoStack((prev) => [...undoOps, ...prev].slice(0, 5));

    // Append to audit history
    const historyItem: MoveHistoryRecord = {
      id: `hist-bulk-${Date.now()}`,
      operatorId: "bulk",
      operatorName: `${count} operátorů`,
      machineType: "NONE",
      fromDept: toMove[0]?.departmentId || "unassigned",
      toDept: targetDeptId,
      timestamp: now,
      reason: `Hromadný přesun: ${count} operátorů přesunuto do ${targetDept.name}`,
    };
    setHistory((prev) => [historyItem, ...prev]);

    // Cloud synchronization
    const movedOps = updatedOperators.filter((o) => idSet.has(o.id));
    bulkSyncOperatorsToCloud(movedOps).catch((e) => console.warn("Cloud bulk sync error:", e));
    syncHistoryRecordToCloud(historyItem).catch((e) =>
      console.warn("Cloud history sync error:", e),
    );

    // Clear selection
    setBulkSelectedIds(new Set());
    showToast(`Hromadně přesunuto ${count} operátorů do oddělení ${targetDept.name}`);
  };

  // Execute bulk move of all currently selected operators
  const handleBulkMove = (targetDeptId: DepartmentId) => {
    if (bulkSelectedIds.size === 0) return;
    handleMoveMultipleOperators(Array.from(bulkSelectedIds), targetDeptId);
  };

  const handleBulkChangeMachine = (machineType: "LL" | "RTR" | "NONE") => {
    if (bulkSelectedIds.size === 0) return;
    
    const count = bulkSelectedIds.size;
    const now = new Date().toISOString();
    const idSet = new Set(bulkSelectedIds);
    const toChange = operators.filter((o) => idSet.has(o.id));
    if (toChange.length === 0) return;

    const undoOps: UndoOperation[] = toChange.map((op) => ({
      id: `undo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${op.id}`,
      operatorId: op.id,
      operatorName: op.name,
      machineType: op.machineType,
      fromDept: op.departmentId,
      toDept: op.departmentId,
      fromStatus: op.status,
      toStatus: op.status,
      fromAbsenceReason: op.absenceReason,
      toAbsenceReason: op.absenceReason,
      timestamp: now,
    }));
    setUndoStack((prev) => [...undoOps, ...prev].slice(0, 5));

    const updatedOperators = operators.map((op) => {
      if (idSet.has(op.id)) {
        return {
          ...op,
          machineType,
          lastMovedAt: now,
        };
      }
      return op;
    });

    setOperators(updatedOperators);
    saveOperators(updatedOperators);

    const historyItem: MoveHistoryRecord = {
      id: `hist-${Date.now()}-bulk-machine`,
      operatorId: "BULK",
      operatorName: `Hromadná změna stroje (${count} operátorů)`,
      machineType,
      fromDept: "unassigned", // not moving depts, just tracking history
      toDept: "unassigned",
      timestamp: now,
      reason: `Hromadná změna stroje na ${machineType} u ${count} operátorů`,
    };
    setHistory((prev) => [historyItem, ...prev]);

    const movedOps = updatedOperators.filter((o) => idSet.has(o.id));
    bulkSyncOperatorsToCloud(movedOps).catch((e) => console.warn("Cloud bulk sync error:", e));
    syncHistoryRecordToCloud(historyItem).catch((e) =>
      console.warn("Cloud history sync error:", e),
    );

    setBulkSelectedIds(new Set());
    showToast(`Hromadně změněn stroj na ${machineType} u ${count} operátorů`);
  };

  // Move operator handler with strict VNA rule & undo tracking
  const handleMoveOperator = (
    operatorId: string,
    targetDeptId: DepartmentId,
    absenceReason?: AbsenceReason,
  ) => {
    setSelectedOperatorId(null);
    // Robust find: by id or full name
    const targetOp =
      operators.find((o) => o.id === operatorId) ||
      operators.find((o) => o.name.toLowerCase() === operatorId.trim().toLowerCase());
    if (!targetOp) return;

    const resolvedId = targetOp.id;

    // Auto-update status when moving to/from Absence department
    const newStatus: OperatorStatus =
      targetDeptId === "unassigned"
        ? "absence"
        : targetOp.departmentId === "unassigned" || targetOp.status === "absence"
          ? "active"
          : targetOp.status;

    if (
      targetOp.departmentId === targetDeptId &&
      targetOp.status === newStatus &&
      targetOp.absenceReason === absenceReason
    )
      return;

    const previousDeptId = targetOp.departmentId;
    const fromDept = getDepartmentById(previousDeptId, customDepartments);
    const toDept = getDepartmentById(targetDeptId, customDepartments);

    let finalMachineType = targetOp.machineType;
    if (targetDeptId === "vna" || targetDeptId === "unassigned") {
      // Automatic removal of LL/RTR when moving to VNA or Absence
      finalMachineType = "NONE";
    } else if (
      targetOp.departmentId === "vna" ||
      targetOp.departmentId === "unassigned" ||
      finalMachineType === "NONE"
    ) {
      if (targetDeptId === "hovs") {
        finalMachineType = "LL";
      } else if (targetDeptId === "hovc" || targetDeptId === "obwi") {
        finalMachineType = "RTR";
      } else {
        finalMachineType = "LL";
      }
    }

    // Update operator
    const updatedOperators = operators.map((op) => {
      if (op.id === resolvedId) {
        return {
          ...op,
          departmentId: targetDeptId,
          machineType: finalMachineType,
          status: newStatus,
          absenceReason:
            targetDeptId === "unassigned"
              ? absenceReason || op.absenceReason || "Absence"
              : undefined,
          isVnaOnly: false,
          lastMovedAt: new Date().toISOString(),
        };
      }
      return op;
    });

    setOperators(updatedOperators);
    saveOperators(updatedOperators);

    // Push into undo stack (capped at last 5 operations)
    const undoOp: UndoOperation = {
      id: `undo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      operatorId: resolvedId,
      operatorName: targetOp.name,
      machineType: targetOp.machineType,
      fromDept: previousDeptId,
      toDept: targetDeptId,
      fromStatus: targetOp.status,
      toStatus: newStatus,
      fromAbsenceReason: targetOp.absenceReason,
      toAbsenceReason:
        targetDeptId === "unassigned"
          ? absenceReason || targetOp.absenceReason || "Absence"
          : undefined,
      timestamp: new Date().toISOString(),
    };
    setUndoStack((prev) => [undoOp, ...prev.slice(0, 4)]);

    // Append to history
    const historyItem: MoveHistoryRecord = {
      id: `hist-${Date.now()}`,
      operatorId: resolvedId,
      operatorName: targetOp.name,
      machineType: targetOp.machineType,
      fromDept: previousDeptId,
      toDept: targetDeptId,
      timestamp: new Date().toISOString(),
      reason: `Přesun z ${fromDept.name} do ${toDept.name}${absenceReason ? ` (Důvod: ${absenceReason})` : ""}`,
    };
    setHistory((prev) => [historyItem, ...prev]);

    // Cloud synchronization for everyone with the link
    const movedOp = updatedOperators.find((o) => o.id === resolvedId);
    if (movedOp) {
      syncOperatorToCloud(movedOp).catch((e) => console.warn("Cloud sync error:", e));
    }
    syncHistoryRecordToCloud(historyItem).catch((e) =>
      console.warn("Cloud history sync error:", e),
    );

    // Toast feedback with direct undo (no auto-scroll away from current view)
    const msg = `Operátor ${targetOp.name} přesunut z ${fromDept.name} ➔ ${toDept.name}`;
    showToast(msg, false, () => {
      handleUndoSingle();
    });
  };

  // Jump bar drag-and-drop quick-move handlers
  const handleJumpPillDragOver = (e: React.DragEvent, deptId: DepartmentId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverJumpDept !== deptId) {
      setDragOverJumpDept(deptId);
    }
  };

  const handleJumpPillDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverJumpDept(null);
    }
  };

  const handleJumpPillDrop = (e: React.DragEvent, targetDeptId: DepartmentId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverJumpDept(null);

    const resolvedIds = resolveOperatorIdsFromDrop(e, operators);
    const operatorIds =
      resolvedIds.length > 0
        ? resolvedIds
        : getGlobalDragState().operatorIds.length > 0
          ? getGlobalDragState().operatorIds
          : getGlobalDragState().operatorId
            ? [getGlobalDragState().operatorId!]
            : [];

    if (operatorIds.length > 0) {
      handleMoveMultipleOperators(operatorIds, targetDeptId);
    }
  };

  // Edge auto-scrolling when dragging near horizontal board boundaries during HTML5 drag
  const handleBoardContainerDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!boardContainerRef.current) return;
    const container = boardContainerRef.current;
    const rect = container.getBoundingClientRect();
    const x = e.clientX;
    const edgeThreshold = 90;

    if (x > rect.right - edgeThreshold) {
      const scrollStep = Math.min(25, Math.max(8, (x - (rect.right - edgeThreshold)) / 2));
      container.scrollLeft += scrollStep;
    } else if (x < rect.left + edgeThreshold) {
      const scrollStep = Math.min(25, Math.max(8, (rect.left + edgeThreshold - x) / 2));
      container.scrollLeft -= scrollStep;
    }
  };

  // Mouse pan/drag-to-scroll on board container (grab and slide columns horizontally)
  const handleBoardMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only primary mouse button (left-click)
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    // Don't pan if clicking inside interactive buttons, inputs, selects, links, or draggable cards
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("textarea") ||
      target.closest("a") ||
      target.closest('[draggable="true"]') ||
      target.closest('[data-no-pan="true"]')
    ) {
      return;
    }

    if (!boardContainerRef.current) return;
    isPanActiveRef.current = true;
    panStartXRef.current = e.pageX - boardContainerRef.current.offsetLeft;
    panScrollLeftRef.current = boardContainerRef.current.scrollLeft;
    panHasMovedRef.current = false;
    setIsPanningBoard(true);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isPanActiveRef.current || !boardContainerRef.current) return;
      const x = e.pageX - boardContainerRef.current.offsetLeft;
      const walk = (x - panStartXRef.current) * 1.25;
      if (Math.abs(walk) > 3) {
        panHasMovedRef.current = true;
        boardContainerRef.current.scrollLeft = panScrollLeftRef.current - walk;
      }
    };

    const handleGlobalMouseUp = () => {
      if (isPanActiveRef.current) {
        isPanActiveRef.current = false;
        setIsPanningBoard(false);
      }
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, []);

  // Change operator status (active, break, absence)
  const handleChangeStatus = (operatorId: string, newStatus: OperatorStatus) => {
    const targetOp = operators.find((o) => o.id === operatorId);
    if (!targetOp) return;

    // Moving to absence also moves to unassigned (Absence) department
    // Moving from absence to active/break moves back to previous department or hovc
    const targetDeptId: DepartmentId =
      newStatus === "absence"
        ? "unassigned"
        : targetOp.departmentId === "unassigned"
          ? "hovc"
          : targetOp.departmentId;

    const previousDeptId = targetOp.departmentId;
    const previousStatus = targetOp.status;

    let targetMachine = targetOp.machineType;
    if (targetDeptId === "unassigned" || newStatus === "absence") {
      targetMachine = "NONE";
    } else if (targetOp.departmentId === "unassigned" || targetMachine === "NONE") {
      if (targetDeptId === "hovs") {
        targetMachine = "LL";
      } else if (targetDeptId === "hovc" || targetDeptId === "obwi") {
        targetMachine = "RTR";
      } else if (targetDeptId === "vna") {
        targetMachine = "NONE";
      } else {
        targetMachine = "LL";
      }
    }

    const updated = operators.map((op) => {
      if (op.id === operatorId) {
        return {
          ...op,
          status: newStatus,
          departmentId: targetDeptId,
          machineType: targetMachine,
          lastMovedAt: new Date().toISOString(),
        };
      }
      return op;
    });

    setOperators(updated);
    saveOperators(updated);

    const changedOp = updated.find((o) => o.id === operatorId);
    if (changedOp) {
      syncOperatorToCloud(changedOp).catch((e) => console.warn("Cloud status sync error:", e));
    }

    if (previousDeptId !== targetDeptId || previousStatus !== newStatus) {
      const undoOp: UndoOperation = {
        id: `undo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        operatorId,
        operatorName: targetOp.name,
        machineType: targetOp.machineType,
        fromDept: previousDeptId,
        toDept: targetDeptId,
        fromStatus: previousStatus,
        toStatus: newStatus,
        timestamp: new Date().toISOString(),
      };
      setUndoStack((prev) => [undoOp, ...prev.slice(0, 4)]);
    }

    const statusLabel =
      newStatus === "active"
        ? "aktivní v provozu na hale"
        : newStatus === "break"
          ? "na pauze"
          : "v absenci / doma (odečteno z provozu)";
    showToast(`Stav operátora ${targetOp.name} byl změněn na: ${statusLabel}`);
  };

  const handleChangeAbsenceReason = (operatorId: string, reason: AbsenceReason) => {
    const updated = operators.map((op) => {
      if (op.id === operatorId) {
        return {
          ...op,
          absenceReason: reason,
          lastMovedAt: new Date().toISOString(),
        };
      }
      return op;
    });
    setOperators(updated);
    saveOperators(updated);

    const changedOp = updated.find((o) => o.id === operatorId);
    if (changedOp) {
      syncOperatorToCloud(changedOp).catch((e) => console.warn("Cloud sync error:", e));
    }
  };

  const handleChangeMachineType = (operatorId: string, machineType: MachineType) => {
    const targetOp = operators.find((o) => o.id === operatorId);
    if (!targetOp) return;

    const updated = operators.map((op) => {
      if (op.id === operatorId) {
        return {
          ...op,
          machineType,
          lastMovedAt: new Date().toISOString(),
        };
      }
      return op;
    });
    setOperators(updated);
    saveOperators(updated);

    const changedOp = updated.find((o) => o.id === operatorId);
    if (changedOp) {
      syncOperatorToCloud(changedOp).catch((e) => console.warn("Cloud machine sync error:", e));
    }

    showToast(
      `Stroj u ${targetOp.name} přepnut na: ${
        machineType === "RTR"
          ? "RTR (Retrak)"
          : machineType === "LL"
            ? "LL (Nízkozdvih)"
            : "Bez stroje"
      }`,
    );
  };

  // Apply shift template
  const handleApplyTemplate = (template: ShiftTemplate) => {
    const updated = applyTemplateToOperators(template, operators);
    setOperators(updated);
    saveOperators(updated);
    bulkSyncOperatorsToCloud(updated).catch((e) => console.warn("Cloud template sync error:", e));
    showToast(`Šablona „${template.name}“ byla načtena do směny (${updated.length} lidí).`);
  };

  // Save (add or edit) operator
  const handleSaveOperator = (opData: Partial<Operator>) => {
    if (!opData.id) return;

    const finalStatus: OperatorStatus =
      opData.departmentId === "unassigned" ? "absence" : opData.status || "active";
    const finalDeptId: DepartmentId =
      finalStatus === "absence"
        ? "unassigned"
        : opData.departmentId === "unassigned"
          ? "hovc"
          : opData.departmentId || "hovc";

    let finalMachineType = opData.machineType || "NONE";
    if (finalDeptId === "vna" || finalDeptId === "unassigned") {
      finalMachineType = "NONE";
    }

    const sanitizedOpData = {
      ...opData,
      machineType: finalMachineType,
      status: finalStatus,
      departmentId: finalDeptId,
    };

    const isNew = !operators.some((o) => o.id === sanitizedOpData.id);

    const updated = operators.some((o) => o.id === sanitizedOpData.id)
      ? operators.map((o) =>
          o.id === sanitizedOpData.id ? ({ ...o, ...sanitizedOpData } as Operator) : o,
        )
      : [sanitizedOpData as Operator, ...operators];

    setOperators(updated);
    saveOperators(updated);

    const savedOp = updated.find((o) => o.id === sanitizedOpData.id);
    if (savedOp) {
      syncOperatorToCloud(savedOp).catch((e) => console.warn("Cloud operator save error:", e));
    }

    if (sanitizedOpData.departmentId) {
      scrollToDepartment(sanitizedOpData.departmentId);
    }

    if (isNew) {
      showToast(`Operátor ${sanitizedOpData.name} byl úspěšně přidán do oddělení.`);
    } else {
      showToast(`Údaje operátora ${sanitizedOpData.name} uloženy.`);
    }
  };

  // Import operators from photo OCR or text list
  const handleImportOperators = async (
    newOps: Operator[],
    replaceAll: boolean,
    omittedCandidates?: FilteredOutRecord[],
  ) => {
    // If candidates were filtered out during OCR, save them for quick one-click absence addition
    if (omittedCandidates && omittedCandidates.length > 0) {
      setOmittedFromImport(omittedCandidates);
    } else {
      setOmittedFromImport([]);
    }

    // Ensure all new operators are assigned to the current active shift and have correct machine types
    const shiftedOps = newOps.map((op) => {
      const deptId = op.departmentId || "hovc";
      let machine = op.machineType;
      if (deptId === "vna" || deptId === "unassigned") {
        machine = "NONE";
      } else if (deptId === "hovs") {
        // HOVS department operators mostly drive LL unless RTR was detected
        machine = machine === "RTR" ? "RTR" : "LL";
      } else if (
        (deptId === "hovc" || deptId === "obwi") &&
        (!machine || machine === "NONE")
      ) {
        machine = "RTR";
      } else if (!machine) {
        machine = "LL";
      }
      return {
        ...op,
        machineType: machine,
        shift: activeShift,
      };
    });

    // If replaceAll is true, replace all operators for the current shift (treating undefined as shift 'A')
    const otherShiftsOps = replaceAll
      ? operators.filter((o) => (o.shift || "A") !== activeShift)
      : operators;

    let updated: Operator[];
    if (replaceAll) {
      updated = [...shiftedOps, ...otherShiftsOps];
    } else {
      const existingNames = new Set(operators.map((o) => o.name.toLowerCase().trim()));
      const uniqueNew = shiftedOps.filter((o) => !existingNames.has(o.name.toLowerCase().trim()));
      updated = [...uniqueNew, ...operators];
    }

    setOperators(updated);
    saveOperators(updated);

    if (replaceAll) {
      await replaceOperatorsInCloud(updated, activeShift).catch((e) =>
        console.warn("Cloud import sync error:", e),
      );
      showToast(
        `Načteno ${shiftedOps.length} operátorů. Směna ${activeShift} byla kompletně nahrazena (${updated.filter((o) => (o.shift || "A") === activeShift).length} lidí na směně).`,
      );
    } else {
      await bulkSyncOperatorsToCloud(shiftedOps).catch((e) =>
        console.warn("Cloud import sync error:", e),
      );
      showToast(
        `Přidáno ${shiftedOps.length} operátorů ze snímku k existujícímu týmu (Směna ${activeShift}).`,
      );
    }
    setIsPhotoImportOpen(false);
  };

  // Quick addition of an omitted candidate from the import banner directly into absences
  const handleAddOmittedToAbsence = (item: FilteredOutRecord, reason: AbsenceReason) => {
    const newOp: Operator = {
      id: `op-omitted-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: item.name,
      machineType: "NONE",
      departmentId: "unassigned",
      isVnaOnly: false,
      status: "absence",
      absenceReason: reason,
      notes: item.detail || "Absence zjištěná z importu",
      shift: activeShift,
      lastMovedAt: new Date().toISOString(),
    };
    const updated = [newOp, ...operators];
    setOperators(updated);
    saveOperators(updated);
    syncOperatorToCloud(newOp).catch((e) => console.warn("Cloud sync error:", e));
    setOmittedFromImport((prev) => prev.filter((f) => f.name !== item.name));
    showToast(`${item.name} zařazen(a) pod Absenci (${reason})`);
  };

  // Add all remaining omitted candidates from the import banner directly into absences
  const handleAddAllOmittedToAbsence = () => {
    if (omittedFromImport.length === 0) return;
    const newOps: Operator[] = omittedFromImport.map((item, idx) => {
      let reason: AbsenceReason = "Absence";
      const combined = `${item.name} ${item.detail}`.toLowerCase();
      if (combined.includes("dovol")) {
        reason = "Dovolená";
      } else if (
        combined.includes("pn") ||
        combined.includes("nemoc") ||
        combined.includes("neschop")
      ) {
        reason = "PN";
      }
      return {
        id: `op-omitted-all-${Date.now()}-${idx}`,
        name: item.name,
        machineType: "NONE",
        departmentId: "unassigned",
        isVnaOnly: false,
        status: "absence",
        absenceReason: reason,
        notes: item.detail || "Absence z importu",
        shift: activeShift,
        lastMovedAt: new Date().toISOString(),
      };
    });

    const updated = [...newOps, ...operators];
    setOperators(updated);
    saveOperators(updated);
    bulkSyncOperatorsToCloud(newOps).catch((e) => console.warn("Cloud sync error:", e));
    showToast(`Všech ${newOps.length} vynechaných pracovníků bylo zařazeno do absencí.`);
    setOmittedFromImport([]);
  };

  // Bulk delete operators (from selection or from a specific department)
  const handleBulkDeleteOperators = (idsToDelete?: string[]) => {
    const targetIds = idsToDelete || Array.from(bulkSelectedIds);
    if (targetIds.length === 0) return;

    const idSet = new Set(targetIds);
    const toDelete = operators.filter((o) => idSet.has(o.id));
    if (toDelete.length === 0) return;

    const count = toDelete.length;
    const namesPreview =
      toDelete.length <= 3
        ? toDelete.map((o) => o.name).join(", ")
        : `${toDelete.slice(0, 2).map((o) => o.name).join(", ")} a dalších ${count - 2}`;

    const confirmed = window.confirm(
      `Opravdu chcete hromadně smazat ${count} operátorů (${namesPreview}) ze směny ${activeShift}?`,
    );
    if (!confirmed) return;

    const updated = operators.filter((o) => !idSet.has(o.id));
    setOperators(updated);
    saveOperators(updated);

    targetIds.forEach((id) => {
      deleteOperatorFromCloud(id).catch((e) =>
        console.warn("Cloud operator delete error:", e),
      );
    });

    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      targetIds.forEach((id) => next.delete(id));
      return next;
    });

    if (selectedOperatorId && idSet.has(selectedOperatorId)) {
      setSelectedOperatorId(null);
    }

    showToast(`Hromadně smazáno ${count} operátorů ze směny.`);
  };

  // Delete operator
  const handleDeleteOperator = (operatorId: string) => {
    const op = operators.find((o) => o.id === operatorId);
    const updated = operators.filter((o) => o.id !== operatorId);
    setOperators(updated);
    saveOperators(updated);
    deleteOperatorFromCloud(operatorId).catch((e) =>
      console.warn("Cloud operator delete error:", e),
    );
    if (op) {
      showToast(`Operátor ${op.name} byl odebrán.`);
    }
  };

  // Create custom department (Vícepráce)
  const handleCreateCustomDepartment = async (newDept: Department) => {
    const deptWithShift: Department = {
      ...newDept,
      shift: newDept.shift || activeShift,
    };
    const updated = addCustomDepartment(deptWithShift);
    setCustomDepartments(updated);
    showToast(
      `Vytvořeno oddělení pro vícepráce (Směna ${activeShift}): ${newDept.name} (${newDept.code})`,
    );

    // Sync to cloud for real-time collaboration
    try {
      await syncCustomDepartmentToCloud(deptWithShift);
    } catch (err) {
      console.warn("Failed to sync custom department to cloud:", err);
    }
  };

  // Delete custom department (Vícepráce) - open in-app confirmation modal
  const handleDeleteCustomDepartment = (deptId: string) => {
    const deptToDelete = customDepartments.find((d) => d.id === deptId);
    if (deptToDelete) {
      setDeptToDeleteConfirm(deptToDelete);
    } else {
      // Force remove if found only by ID
      handleConfirmDeleteCustomDepartmentById(deptId, "Vícepráce");
    }
  };

  const handleConfirmDeleteCustomDepartment = async () => {
    if (!deptToDeleteConfirm) return;
    const deptId = deptToDeleteConfirm.id;
    const deptName = deptToDeleteConfirm.name;
    setDeptToDeleteConfirm(null);
    await handleConfirmDeleteCustomDepartmentById(deptId, deptName);
  };

  const handleConfirmDeleteCustomDepartmentById = async (deptId: string, deptName: string) => {
    // Move any operators currently assigned to this custom department IN THIS SHIFT to 'hovc' (Outbound)
    const affectedOps = operators.filter(
      (o) => (o.shift || "A") === activeShift && o.departmentId === deptId,
    );
    if (affectedOps.length > 0) {
      const now = new Date().toISOString();
      const updatedOperators = operators.map((o) => {
        if ((o.shift || "A") === activeShift && o.departmentId === deptId) {
          return {
            ...o,
            departmentId: "hovc" as DepartmentId,
            lastMovedAt: now,
          };
        }
        return o;
      });
      setOperators(updatedOperators);
      saveOperators(updatedOperators);
      for (const op of affectedOps) {
        syncOperatorToCloud({ ...op, departmentId: "hovc", lastMovedAt: now }).catch(() => {});
      }
    }

    const updated = removeCustomDepartment(deptId);
    setCustomDepartments(updated);
    showToast(`Oddělení víceprací "${deptName}" bylo zrušeno ze Směny ${activeShift}.`);

    try {
      await deleteCustomDepartmentFromCloud(deptId);
    } catch (err) {
      console.warn("Failed to delete custom department from cloud:", err);
    }
  };

  // Open reset confirmation dialog
  const handleResetData = () => {
    setIsResetConfirmOpen(true);
  };

  const handleConfirmResetData = async () => {
    setIsResetConfirmOpen(false);
    const reset = resetToInitialOperators();
    setOperators(reset);
    saveOperators(reset);
    setHistory([]);
    saveHistory([]);
    setUndoStack([]);
    await Promise.all([
      replaceOperatorsInCloud(reset).catch((e) => console.warn("Cloud reset sync error:", e)),
      clearHistoryFromCloud().catch((e) => console.warn("Cloud history reset error:", e)),
    ]);
    showToast("Data obnovena na 65 operátorů oddělení PICK.");
  };

  // Drag-and-drop auto-scroll: automatically scrolls horizontal columns when dragging near edge
  useEffect(() => {
    if (viewMode !== "board") return;

    const container = boardContainerRef.current;
    if (!container) return;

    let animationFrameId: number | null = null;
    let scrollSpeed = 0;

    const stopScroll = () => {
      scrollSpeed = 0;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    const step = () => {
      if (container && scrollSpeed !== 0) {
        container.scrollLeft += scrollSpeed;
        animationFrameId = requestAnimationFrame(step);
      } else {
        animationFrameId = null;
      }
    };

    const handleDragOver = (e: DragEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX;
      const edgeThreshold = 110; // px distance from left/right container edge

      if (x >= rect.left - 20 && x <= rect.left + edgeThreshold) {
        // Dragging near left edge: scroll left
        const distance = Math.max(0, x - rect.left);
        const ratio = 1 - distance / edgeThreshold;
        scrollSpeed = -Math.max(4, ratio * 24);
      } else if (x <= rect.right + 20 && x >= rect.right - edgeThreshold) {
        // Dragging near right edge: scroll right
        const distance = Math.max(0, rect.right - x);
        const ratio = 1 - distance / edgeThreshold;
        scrollSpeed = Math.max(4, ratio * 24);
      } else {
        scrollSpeed = 0;
      }

      if (scrollSpeed !== 0 && animationFrameId === null) {
        animationFrameId = requestAnimationFrame(step);
      } else if (scrollSpeed === 0 && animationFrameId !== null) {
        stopScroll();
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragend", stopScroll);
    window.addEventListener("drop", stopScroll);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragend", stopScroll);
      window.removeEventListener("drop", stopScroll);
      stopScroll();
    };
  }, [viewMode]);

  // Continuous hands-free auto-scroll (e.g. for TV display or warehouse dashboard wallboards)
  useEffect(() => {
    if (!isAutoScrolling || viewMode !== "board") return;

    const container = boardContainerRef.current;
    if (!container) return;

    let rafId: number | null = null;
    let pauseUntil = 0;
    let direction = 1; // 1 = right, -1 = left

    const tick = (now: number) => {
      if (now < pauseUntil) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      if (container) {
        const maxScroll = container.scrollWidth - container.clientWidth;
        if (maxScroll > 10) {
          container.scrollLeft += direction * 0.9;

          if (direction === 1 && container.scrollLeft >= maxScroll - 3) {
            direction = -1;
            pauseUntil = now + 2500; // pause for 2.5s at right end
          } else if (direction === -1 && container.scrollLeft <= 3) {
            direction = 1;
            pauseUntil = now + 2500; // pause for 2.5s at left end
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isAutoScrolling, viewMode]);

  // 1. Filter operators by the currently selected shift
  const shiftOperators = useMemo(() => {
    return operators.filter((op) => (op.shift || "A") === activeShift);
  }, [operators, activeShift]);

  // 2. Filtered operators by search (name, machineType, department, notes)
  const filteredOperators = useMemo(() => {
    if (!searchQuery.trim()) return shiftOperators;

    const q = searchQuery.toLowerCase().trim();
    return shiftOperators.filter((op) => {
      const matchesName = op.name.toLowerCase().includes(q);
      const matchesMachine = op.machineType.toLowerCase() === q;
      const matchesNotes = op.notes?.toLowerCase().includes(q);
      const dept = getDepartmentById(op.departmentId, customDepartments);
      const matchesDept = dept.name.toLowerCase().includes(q);

      return matchesName || matchesMachine || matchesNotes || matchesDept;
    });
  }, [shiftOperators, searchQuery, customDepartments]);

  // Custom departments for current active shift
  const shiftCustomDepartments = useMemo(() => {
    return customDepartments.filter((d) => (d.shift || "A") === activeShift);
  }, [customDepartments, activeShift]);

  // Combined built-in and custom departments for current active shift
  const allDepartments = useMemo(() => {
    const deptMap = new Map<string, Department>();
    for (const d of DEPARTMENTS) {
      deptMap.set(d.id, d);
    }
    for (const d of shiftCustomDepartments) {
      deptMap.set(d.id, d);
    }
    return Array.from(deptMap.values());
  }, [shiftCustomDepartments]);

  // Key metrics - accurate calculations for floor operation and absence
  const selectedOperator = shiftOperators.find((o) => o.id === selectedOperatorId) || null;
  const isOperatorInOperation = (o: Operator) =>
    o.departmentId !== "unassigned" && o.status === "active";
  const isOperatorInAbsence = (o: Operator) =>
    o.departmentId === "unassigned" || o.status === "absence";

  const totalCount = shiftOperators.length;
  const activeCount = shiftOperators.filter(isOperatorInOperation).length;
  const absenceCount = shiftOperators.filter(isOperatorInAbsence).length;
  const breakCount = shiftOperators.filter(
    (o) => o.departmentId !== "unassigned" && o.status === "break",
  ).length;
  const llCount = shiftOperators.filter(
    (o) => o.machineType === "LL" && isOperatorInOperation(o),
  ).length;
  const rtrCount = shiftOperators.filter(
    (o) => o.machineType === "RTR" && isOperatorInOperation(o),
  ).length;
  const vnaCount = shiftOperators.filter(
    (o) => o.departmentId === "vna" && isOperatorInOperation(o),
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Application Header with Global Undo & Auto-scroll */}
      <Header
        totalCount={totalCount}
        activeCount={activeCount}
        llCount={llCount}
        rtrCount={rtrCount}
        vnaCount={vnaCount}
        absenceCount={absenceCount}
        activeShift={activeShift}
        onShiftChange={handleShiftChange}
        searchQuery={searchQuery}
        viewMode={viewMode}
        undoOperations={undoStack}
        onUndoSingle={handleUndoSingle}
        onUndoBulk={handleUndoBulk}
        isAutoScrolling={isAutoScrolling}
        onToggleAutoScroll={() => setIsAutoScrolling((prev) => !prev)}
        onSearchChange={setSearchQuery}
        onViewModeChange={setViewMode}
        onOpenAddModal={() => setAddEditOperator({ operator: null, defaultDeptId: "hovc" })}
        onOpenAddCustomDept={() => setIsAddCustomDeptOpen(true)}
        onOpenPhotoImport={() => setIsPhotoImportOpen(true)}
        onOpenTemplatesModal={() => setIsTemplatesModalOpen(true)}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
        onResetData={handleResetData}
        isCloudConnected={isCloudConnected}
        isCloudSyncing={isCloudSyncing}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full px-3 sm:px-6 2xl:px-8 py-2.5 sm:py-4 space-y-2.5 sm:space-y-3">
        {/* PICK Overview & Quick Report for Boss (Collapsible & Compact) */}
        <BossAnswerCard
          operators={shiftOperators}
          customDepartments={shiftCustomDepartments}
          onOpenReportModal={() => setIsReportModalOpen(true)}
        />

        {/* View Mode 1: Department Columns (Board) */}
        {viewMode === "board" && (
          <div className="space-y-2.5">
            {/* Quick jump & Drag-to-move pills bar (Non-sticky, clean drop target) */}
            <div
              className={`relative transition-all rounded-xl py-1.5 px-2.5 border shadow-2xs backdrop-blur-md ${
                dragOverJumpDept
                  ? "bg-blue-50/95 dark:bg-slate-900/95 border-blue-400 dark:border-blue-600 ring-2 ring-blue-400/30 shadow-md"
                  : bulkSelectedIds.size > 0
                    ? "bg-blue-50/70 dark:bg-slate-900/90 border-blue-300 dark:border-blue-700 shadow-sm"
                    : "bg-white/95 dark:bg-slate-900/95 border-slate-200/80 dark:border-slate-800/80"
              }`}
            >
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 scrollbar-none">
                {bulkSelectedIds.size > 0 ? (
                  <div className="flex items-center gap-1.5 shrink-0 bg-blue-600 text-white px-2.5 py-1 rounded-xl text-xs font-extrabold shadow-xs mr-0.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Hromadný přesun ({bulkSelectedIds.size}):</span>
                  </div>
                ) : (
                  <span className="text-xs font-bold shrink-0 flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mr-0.5">
                    <Move className="w-3 h-3 hidden sm:inline" />
                    <span>Rychlý přesun / Skok:</span>
                  </span>
                )}

                {allDepartments.map((dept) => {
                  const count = filteredOperators.filter((o) => o.departmentId === dept.id).length;
                  const isHovered = dragOverJumpDept === dept.id;
                  const isBulkActive = bulkSelectedIds.size > 0;
                  const theme = JUMP_THEMES[dept.id] || DEFAULT_CUSTOM_JUMP_THEME;

                  return (
                    <button
                      key={dept.id}
                      id={`jump-btn-${dept.id}`}
                      onClick={() => {
                        if (bulkSelectedIds.size > 0) {
                          handleMoveMultipleOperators(Array.from(bulkSelectedIds), dept.id);
                        } else if (selectedOperatorId) {
                          handleMoveOperator(selectedOperatorId, dept.id);
                          setSelectedOperatorId(null);
                        } else {
                          scrollToDepartment(dept.id);
                        }
                      }}
                      onDragOver={(e) => handleJumpPillDragOver(e, dept.id)}
                      onDragLeave={handleJumpPillDragLeave}
                      onDrop={(e) => handleJumpPillDrop(e, dept.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all border shadow-2xs flex items-center gap-1.5 cursor-pointer select-none ${
                        isHovered
                          ? `${theme.activeBg} ${theme.activeBorder} scale-110 shadow-lg z-30 ring-4`
                          : isBulkActive
                            ? `ring-2 ring-blue-500 border-blue-400 bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-200 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 shadow-sm active:scale-95`
                            : selectedOperatorId
                              ? `${theme.border} ring-2 ring-blue-400 bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 animate-pulse`
                              : `bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 ${theme.border} active:scale-95`
                      }`}
                      title={
                        isBulkActive
                          ? `Kliknutím sem okamžitě přesunete všech ${bulkSelectedIds.size} označených lidí do ${dept.name}`
                          : selectedOperatorId
                            ? `Kliknutím sem okamžitě přesunete ${selectedOperator?.name || "vybraného člověka"} do ${dept.name}`
                            : `Kliknutím přeskočit na ${dept.name} • Přetažením operátora sem jej okamžitě přesunete`
                      }
                    >
                      <span className="pointer-events-none flex items-center gap-1">
                        {isHovered && <ArrowDownToLine className="w-3.5 h-3.5 animate-bounce" />}
                        <span>{dept.name}</span>
                      </span>
                      <span
                        className={`pointer-events-none text-[11px] px-1.5 py-0.2 rounded-full font-extrabold transition-colors ${
                          isHovered ? theme.badgeActive : theme.badgeBg
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}

                {/* Subtle Add Custom Department pill */}
                <button
                  id="jump-bar-add-dept-btn"
                  onClick={() => setIsAddCustomDeptOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all border border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50/60 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 flex items-center gap-1 active:scale-95 cursor-pointer"
                  title="Vytvořit oddělení pro vícepráce mimo standardní tabulku"
                >
                  <Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>+ Vícepráce</span>
                </button>

                {/* Quick selection actions when bulk is active */}
                {bulkSelectedIds.size > 0 && (
                  <div className="flex items-center gap-1 shrink-0 ml-auto mr-1">
                    <button
                      id="jump-bar-change-ll-btn"
                      onClick={() => handleBulkChangeMachine("LL")}
                      className="px-2 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-all cursor-pointer"
                      title="Změnit stroj na LL pro vybrané"
                    >
                      Nastavit LL
                    </button>
                    <button
                      id="jump-bar-change-rtr-btn"
                      onClick={() => handleBulkChangeMachine("RTR")}
                      className="px-2 py-1 text-[11px] font-bold rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition-all cursor-pointer"
                      title="Změnit stroj na RTR pro vybrané"
                    >
                      Nastavit RTR
                    </button>
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
                    <button
                      id="jump-bar-delete-bulk-btn"
                      onClick={() => handleBulkDeleteOperators()}
                      className="px-2 py-1 text-[11px] font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                      title="Smazat všechny vybrané operátory ze směny"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Smazat ({bulkSelectedIds.size})</span>
                    </button>
                    <button
                      id="jump-bar-select-all-btn"
                      onClick={handleSelectAll}
                      className="px-2 py-1 text-[11px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all cursor-pointer"
                      title="Vybrat všechny operátory na směně"
                    >
                      Vybrat vše
                    </button>
                    <button
                      id="jump-bar-cancel-bulk-btn"
                      onClick={handleClearBulkSelection}
                      className="px-2 py-1 text-[11px] font-bold rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-all cursor-pointer"
                      title="Zrušit výběr (Esc)"
                    >
                      Zrušit (Esc)
                    </button>
                  </div>
                )}

                {/* Quick Auto-scroll toggle in Jump bar */}
                <button
                  id="jump-bar-autoscroll-btn"
                  onClick={() => setIsAutoScrolling((prev) => !prev)}
                  className={`${bulkSelectedIds.size > 0 ? "" : "ml-auto"} px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all border flex items-center gap-1.5 active:scale-95 ${
                    isAutoScrolling
                      ? "bg-emerald-600 text-white border-emerald-500 shadow-sm animate-pulse"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                  title={
                    isAutoScrolling
                      ? "Zastavit plynulý posuv sloupců"
                      : "Plynulý automatický posuv sloupců (hands-free pro TV/nástěnku)"
                  }
                >
                  {isAutoScrolling ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Auto-scroll: Zapnuto</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Auto-scroll</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Omitted/Absence notification banner after OCR import */}
            {omittedFromImport.length > 0 && (
              <div
                id="omitted-import-banner"
                className="p-3 sm:p-3.5 bg-amber-50/95 dark:bg-amber-950/50 border-2 border-amber-300 dark:border-amber-700/80 rounded-2xl text-xs text-amber-950 dark:text-amber-100 shadow-sm space-y-2 animate-in fade-in"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-extrabold text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                        Zjištěné vynechané osoby ze snímku ({omittedFromImport.length})
                      </span>
                      <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                        Tyto lidi OCR vynechalo (Absence, PN, Dovolená, PS). Kliknutím je můžete rovnou naklikat pod absenci:
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      id="omitted-add-all-btn"
                      onClick={handleAddAllOmittedToAbsence}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>⚡ Přidat všechny do Absencí</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOmittedFromImport([])}
                      className="p-1.5 rounded-xl text-amber-800 dark:text-amber-300 hover:bg-amber-200/60 dark:hover:bg-amber-800/40 cursor-pointer"
                      title="Zavřít lištu"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                  {omittedFromImport.map((item, idx) => (
                    <div
                      key={`omitted-top-${idx}`}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/80 shadow-2xs text-xs"
                    >
                      <span className="font-bold text-slate-800 dark:text-slate-200 mr-1">
                        {item.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddOmittedToAbsence(item, "Absence")}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 border border-amber-400/50 cursor-pointer"
                        title="Přidat pod standardní Absenci"
                      >
                        + Absence
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddOmittedToAbsence(item, "Dovolená")}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-900 dark:text-sky-200 border border-sky-400/50 cursor-pointer"
                        title="Přidat pod Dovolená"
                      >
                        + Dovolená
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddOmittedToAbsence(item, "PN")}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-900 dark:text-rose-200 border border-rose-400/50 cursor-pointer"
                        title="Přidat pod PN"
                      >
                        + PN
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setOmittedFromImport((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="p-0.5 text-slate-400 hover:text-rose-500 cursor-pointer ml-0.5"
                        title="Odebrat z nabídky"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notice bar */}
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Pododdělení PICK:
                </span>
                <span>
                  Přetáhněte kartu operátora na jakýkoliv sloupec nebo klikněte na tlačítko{" "}
                  <strong>Přesun</strong>. Kliknutím mimo kartu nebo klávesou <strong>Esc</strong>{" "}
                  výběr kdykoliv zrušíte.
                </span>
              </div>
              {searchQuery && (
                <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 px-2 py-0.5 rounded">
                  Filtrováno: {filteredOperators.length} z {operators.length} operátorů
                </span>
              )}
            </div>

            {/* Bulk Selection Move Banner */}
            {bulkSelectedIds.size > 0 && (
              <div
                id="bulk-selected-move-banner"
                className="flex items-center justify-between gap-3 px-4 py-2.5 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white rounded-2xl shadow-xl border border-blue-400/80 animate-in fade-in slide-in-from-top-2 duration-150"
              >
                <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20 text-white">
                    <Users className="w-4 h-4" />
                  </span>
                  <div>
                    <span>
                      Hromadný výběr:{" "}
                      <span className="font-black text-amber-200">{bulkSelectedIds.size}</span>{" "}
                      operátorů
                    </span>
                    <span className="text-[11px] font-normal text-blue-100 ml-2 hidden sm:inline">
                      (Klikněte na další operátory pro přidání/odebrání • Přetáhněte myší nebo
                      klikněte na horní zkratku)
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="bulk-selected-delete-btn"
                    onClick={() => handleBulkDeleteOperators()}
                    className="px-3 py-1 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all cursor-pointer border border-rose-400/80 shadow-md active:scale-95 flex items-center gap-1.5"
                    title={`Smazat ${bulkSelectedIds.size} vybraných operátorů`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Smazat vybrané ({bulkSelectedIds.size})</span>
                  </button>
                  {bulkSelectedIds.size < shiftOperators.length && (
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="px-3 py-1 text-xs font-bold rounded-xl bg-white/20 hover:bg-white/30 text-white transition-all cursor-pointer border border-white/30 active:scale-95"
                    >
                      Vybrat vše ({shiftOperators.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleClearBulkSelection}
                    className="px-3 py-1 text-xs font-bold rounded-xl bg-white/20 hover:bg-white/30 text-white transition-all cursor-pointer border border-white/30 active:scale-95"
                  >
                    Zrušit výběr (Esc)
                  </button>
                </div>
              </div>
            )}

            {/* Selected Operator Banner */}
            {selectedOperator && bulkSelectedIds.size === 0 && (
              <div
                id="selected-operator-move-banner"
                className="flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white rounded-2xl shadow-xl border-2 border-blue-400/80 animate-in fade-in slide-in-from-top-2 duration-150"
              >
                <div className="flex items-center gap-3 text-xs sm:text-sm font-bold">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                  </span>
                  <div>
                    <span>
                      Vybrán operátor:{" "}
                      <span className="underline decoration-white/60 font-black text-amber-200">
                        {selectedOperator.name}
                      </span>{" "}
                      ({selectedOperator.machineType})
                    </span>
                    <p className="text-[11px] font-normal text-blue-100 mt-0.5">
                      Pro přesun použijte tlačítko Přesun na kartě, přetažení myší nebo horní
                      zkratky
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickMoveOperator(selectedOperator)}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 transition-all cursor-pointer shadow-md shrink-0 active:scale-95"
                  >
                    Přesunout...
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOperatorId(null)}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white/20 hover:bg-white/30 text-white transition-all cursor-pointer border border-white/30 shrink-0 active:scale-95"
                  >
                    Zrušit výběr (Esc)
                  </button>
                </div>
              </div>
            )}

            {/* Horizontal scrollable columns: Outbound, HOVS, Putaway, VAS, OBWF, VNA, OBWI + Custom Depts */}
            <div
              id="board-columns-container"
              ref={boardContainerRef}
              onMouseDown={handleBoardMouseDown}
              onDragOver={handleBoardContainerDragOver}
              onClickCapture={(e) => {
                if (panHasMovedRef.current) {
                  e.stopPropagation();
                  panHasMovedRef.current = false;
                }
              }}
              onClick={(e) => {
                if (panHasMovedRef.current) {
                  panHasMovedRef.current = false;
                  return;
                }
                const target = e.target as HTMLElement;
                if (
                  !target.closest('[id^="operator-card-"]') &&
                  !target.closest("button") &&
                  !target.closest("input") &&
                  !target.closest("select")
                ) {
                  if (selectedOperatorId) {
                    setSelectedOperatorId(null);
                  }
                }
              }}
              className={`flex gap-4 overflow-x-auto pb-4 pt-1 items-start scrollbar-thin select-none ${
                isPanningBoard ? "cursor-grabbing scroll-auto" : "cursor-grab scroll-smooth"
              }`}
            >
              {allDepartments.map((dept) => {
                const deptOps = filteredOperators.filter((o) => o.departmentId === dept.id);

                return (
                  <DepartmentColumn
                    key={dept.id}
                    department={dept}
                    operators={deptOps}
                    allOperators={operators}
                    totalOperatorsCount={filteredOperators.length}
                    selectedOperatorId={selectedOperatorId}
                    bulkSelectedIds={bulkSelectedIds}
                    onToggleBulkSelect={handleToggleBulkSelect}
                    onSelectOperator={(op) => {
                      setSelectedOperatorId((prev) => (prev === op.id ? null : op.id));
                    }}
                    onDeselectOperator={() => setSelectedOperatorId(null)}
                    onOpenQuickMove={(op) => setQuickMoveOperator(op)}
                    onEditOperator={(op) => setAddEditOperator({ operator: op })}
                    onChangeStatus={handleChangeStatus}
                    onChangeAbsenceReason={handleChangeAbsenceReason}
                    onChangeMachineType={handleChangeMachineType}
                    onAddOperatorToDept={(deptId) =>
                      setAddEditOperator({ operator: null, defaultDeptId: deptId })
                    }
                    onDropOperator={(operatorIds, targetDeptId) =>
                      handleMoveMultipleOperators(operatorIds, targetDeptId)
                    }
                    onDeleteDepartment={
                      dept.isCustom ? () => handleDeleteCustomDepartment(dept.id) : undefined
                    }
                    onDeleteMultipleOperators={handleBulkDeleteOperators}
                  />
                );
              })}

              {/* Subtle card to add custom department (Vícepráce) at the end of the board */}
              <div
                id="board-add-custom-dept-card"
                className="w-[280px] sm:w-[290px] shrink-0 min-h-[420px] flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-white/40 dark:bg-slate-900/40 text-center hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50/20 dark:hover:bg-amber-950/20 transition-all group select-none"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Wrench className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Další oddělení / Vícepráce
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 max-w-[220px]">
                  Mimořádné úkoly mimo tabulku (úklid, inventura, výpomoc na příjmu, rework).
                </p>
                <button
                  id="board-add-custom-dept-btn"
                  type="button"
                  onClick={() => setIsAddCustomDeptOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80 transition-all shadow-2xs cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Vytvořit oddělení</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Mode 2: Phone Wallpaper & Online Mobile Widget View */}
        {viewMode === "widget" && (
          <WidgetView
            operators={filteredOperators}
            customDepartments={shiftCustomDepartments}
            activeShift={activeShift}
            onShiftChange={handleShiftChange}
            isCloudConnected={isCloudConnected}
            isCloudSyncing={isCloudSyncing}
            onSelectDepartment={() => {
              setViewMode("board");
            }}
            onSwitchToBoard={() => {
              setViewMode("board");
            }}
          />
        )}

        {/* View Mode 3: Table View */}
        {viewMode === "table" && (
          <TableView
            operators={filteredOperators}
            customDepartments={shiftCustomDepartments}
            bulkSelectedIds={bulkSelectedIds}
            onToggleBulkSelect={handleToggleBulkSelect}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearBulkSelection}
            onOpenQuickMove={(op) => setQuickMoveOperator(op)}
            onEditOperator={(op) => setAddEditOperator({ operator: op })}
            onChangeDepartment={(operatorId, targetDeptId) =>
              handleMoveOperator(operatorId, targetDeptId)
            }
            onChangeStatus={handleChangeStatus}
            onChangeMachineType={handleChangeMachineType}
            onDeleteOperator={handleDeleteOperator}
            onDeleteMultipleOperators={handleBulkDeleteOperators}
          />
        )}
      </main>

      {/* Floating Bottom Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium ${
              toastMessage.isWarning
                ? "bg-amber-50 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800"
                : "bg-slate-900/95 dark:bg-white text-white dark:text-slate-900 border-slate-700/60 dark:border-slate-300"
            }`}
          >
            {toastMessage.isWarning ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 dark:text-emerald-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
            {toastMessage.undoAction && (
              <button
                onClick={toastMessage.undoAction}
                className="ml-2 px-2.5 py-1 text-xs font-black rounded-lg bg-white/20 dark:bg-slate-900/20 hover:bg-white/30 dark:hover:bg-slate-900/30 transition-colors"
              >
                Vrátit zpět
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick Move Operator Modal */}
      {quickMoveOperator && (
        <QuickMoveModal
          isOpen={Boolean(quickMoveOperator)}
          operator={quickMoveOperator}
          operators={shiftOperators}
          customDepartments={shiftCustomDepartments}
          onClose={() => setQuickMoveOperator(null)}
          onMove={(targetDeptId, reason) => {
            handleMoveOperator(quickMoveOperator.id, targetDeptId, reason);
            setQuickMoveOperator(null);
          }}
        />
      )}

      {/* Boss Shift Report Export Modal */}
      {isReportModalOpen && (
        <BossReportModal
          isOpen={isReportModalOpen}
          operators={shiftOperators}
          customDepartments={shiftCustomDepartments}
          activeShift={activeShift}
          onClose={() => setIsReportModalOpen(false)}
        />
      )}

      {/* Move Audit History Modal */}
      {isHistoryModalOpen && (
        <HistoryModal
          isOpen={isHistoryModalOpen}
          history={history}
          onClose={() => setIsHistoryModalOpen(false)}
          onClearHistory={() => setHistory([])}
        />
      )}

      {/* Add / Edit Operator Modal */}
      {addEditOperator && (
        <AddEditOperatorModal
          isOpen={Boolean(addEditOperator)}
          operator={addEditOperator.operator}
          defaultDeptId={addEditOperator.defaultDeptId}
          customDepartments={shiftCustomDepartments}
          activeShift={activeShift}
          onClose={() => setAddEditOperator(null)}
          onSave={handleSaveOperator}
          onDelete={handleDeleteOperator}
        />
      )}

      {/* Add Custom Department (Vícepráce) Modal */}
      <AddCustomDepartmentModal
        isOpen={isAddCustomDeptOpen}
        onClose={() => setIsAddCustomDeptOpen(false)}
        onCreateDepartment={handleCreateCustomDepartment}
        customDepartments={customDepartments}
        operators={shiftOperators}
        onDeleteDepartment={handleDeleteCustomDepartment}
        activeShift={activeShift}
      />

      {/* Confirm Delete Custom Department Modal */}
      {deptToDeleteConfirm && (
        <ConfirmDialogModal
          isOpen={Boolean(deptToDeleteConfirm)}
          title={`Zrušit oddělení víceprací?`}
          message={`Opravdu chcete zrušit oddělení "${deptToDeleteConfirm.name}" ze Směny ${activeShift}? Případní přiřazení operátoři budou přesunuti zpět do Outbound.`}
          confirmLabel="Zrušit oddělení"
          cancelLabel="Ponechat"
          variant="danger"
          onConfirm={handleConfirmDeleteCustomDepartment}
          onCancel={() => setDeptToDeleteConfirm(null)}
        />
      )}

      {/* Confirm Reset Data Modal */}
      {isResetConfirmOpen && (
        <ConfirmDialogModal
          isOpen={isResetConfirmOpen}
          title="Obnovit výchozí stav 65 operátorů?"
          message="Opravdu chcete obnovit stav na původních 65 operátorů ZF PICK? Všechny úpravy budou resetovány."
          confirmLabel="Obnovit výchozí stav"
          cancelLabel="Zpět"
          variant="warning"
          onConfirm={handleConfirmResetData}
          onCancel={() => setIsResetConfirmOpen(false)}
        />
      )}

      {/* Photo OCR Import Modal */}
      {isPhotoImportOpen && (
        <PhotoImportModal
          isOpen={isPhotoImportOpen}
          onClose={() => setIsPhotoImportOpen(false)}
          onImportOperators={handleImportOperators}
          currentCount={shiftOperators.length}
        />
      )}

      {/* Shift Templates Modal */}
      {isTemplatesModalOpen && (
        <ShiftTemplatesModal
          isOpen={isTemplatesModalOpen}
          onClose={() => setIsTemplatesModalOpen(false)}
          currentOperators={shiftOperators}
          activeShift={activeShift}
          onApplyTemplate={handleApplyTemplate}
          customDepartments={shiftCustomDepartments}
        />
      )}
    </div>
  );
}
