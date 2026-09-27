import React, { useState, useEffect, useMemo } from "react";
import {
  Smartphone,
  PackageCheck,
  Boxes,
  ArrowDownToLine,
  Wrench,
  Layers,
  GitCommitVertical,
  Globe,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Users,
  Download,
  Wifi,
  WifiOff,
  Sparkles,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Info,
  Clock,
  ExternalLink,
  ShieldCheck,
  Coffee,
  UserX,
  X,
  Share,
  Search,
  Plus,
  Undo2,
  UserCheck,
  ArrowRight,
  Filter,
} from "lucide-react";
import { DEPARTMENTS } from "../data/departments";
import {
  Department,
  Operator,
  ShiftType,
  DepartmentId,
  MachineType,
  OperatorStatus,
  AbsenceReason,
} from "../types";
import { usePWAInstall } from "../hooks/usePWAInstall";
import { useNetworkStatus } from "../services/offlineSync";
import { MobileOperatorDrawer } from "./MobileOperatorDrawer";

interface WidgetViewProps {
  operators: Operator[];
  customDepartments?: Department[];
  activeShift?: ShiftType;
  onShiftChange?: (shift: ShiftType) => void;
  isCloudConnected?: boolean;
  isCloudSyncing?: boolean;
  onSelectDepartment?: (deptId: string) => void;
  onSwitchToBoard?: () => void;
  onMoveOperator?: (
    operatorId: string,
    targetDeptId: DepartmentId,
    absenceReason?: AbsenceReason,
  ) => void;
  onChangeStatus?: (operatorId: string, status: OperatorStatus) => void;
  onChangeMachineType?: (operatorId: string, machineType: MachineType) => void;
  onChangeAbsenceReason?: (operatorId: string, reason: AbsenceReason) => void;
  onEditOperator?: (operator: Operator) => void;
  onAddNewOperator?: () => void;
  onUndoSingle?: () => void;
  hasUndo?: boolean;
}

export const WidgetView: React.FC<WidgetViewProps> = ({
  operators,
  customDepartments = [],
  activeShift = "A",
  onShiftChange,
  isCloudConnected = true,
  isCloudSyncing = false,
  onSelectDepartment,
  onSwitchToBoard,
  onMoveOperator,
  onChangeStatus,
  onChangeMachineType,
  onChangeAbsenceReason,
  onEditOperator,
  onAddNewOperator,
  onUndoSingle,
  hasUndo = false,
}) => {
  // Mobile sub-tab: "pocket" (Obchůzka haly 1 rukou) or "summary" (Přehled & Widget)
  const [mobileTab, setMobileTab] = useState<"pocket" | "summary">("pocket");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("all");
  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>("all");
  const [activeDrawerOp, setActiveDrawerOp] = useState<Operator | null>(null);

  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [showAbsenceList, setShowAbsenceList] = useState(false);

  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { isOnline, pendingCount } = useNetworkStatus();

  // Live real-time clock update every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (!success) {
        setShowInstallModal(true);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  const getDeptOps = (deptId: string) => operators.filter((o) => o.departmentId === deptId);

  const total = operators.length;
  const activeOps = operators.filter(
    (o) => o.departmentId !== "unassigned" && o.status === "active",
  );
  const activeTotal = activeOps.length;
  const breakOps = operators.filter((o) => o.departmentId !== "unassigned" && o.status === "break");
  const breakTotal = breakOps.length;
  const absenceOps = operators.filter(
    (o) => o.departmentId === "unassigned" || o.status === "absence",
  );
  const absenceTotal = absenceOps.length;

  const llTotal = activeOps.filter((o) => o.machineType === "LL").length;
  const rtrTotal = activeOps.filter((o) => o.machineType === "RTR").length;

  const hovcOps = getDeptOps("hovc");
  const hovsOps = getDeptOps("hovs");
  const putawayOps = getDeptOps("putaway");
  const vasOps = getDeptOps("vas");
  const obwfOps = getDeptOps("obwf");
  const vnaOps = getDeptOps("vna");
  const obwiOps = getDeptOps("obwi");

  const timeStr = currentTime.toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = currentTime.toLocaleDateString("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });

  const copyWidgetText = () => {
    const text = `📊 ZF OSTROV - ODDĚLENÍ PICK (Směna ${activeShift} • ${dateStr} ${timeStr})
👥 Celkem PICK: ${total} lidí (${llTotal}× LL, ${rtrTotal}× RTR)
📦 Outbound: ${hovcOps.length} (${hovcOps.filter((o) => o.machineType === "LL").length} LL / ${hovcOps.filter((o) => o.machineType === "RTR").length} RTR)
🏢 HOVS: ${hovsOps.length} (${hovsOps.filter((o) => o.machineType === "LL").length} LL / ${hovsOps.filter((o) => o.machineType === "RTR").length} RTR)
📥 Putaway: ${putawayOps.length} (${putawayOps.filter((o) => o.machineType === "LL").length} LL / ${putawayOps.filter((o) => o.machineType === "RTR").length} RTR)
🔧 VAS: ${vasOps.length} (${vasOps.filter((o) => o.machineType === "LL").length} LL / ${vasOps.filter((o) => o.machineType === "RTR").length} RTR)
🌊 OBWF: ${obwfOps.length} (${obwfOps.filter((o) => o.machineType === "LL").length} LL / ${obwfOps.filter((o) => o.machineType === "RTR").length} RTR)
⚡ VNA: ${vnaOps.length} (${vnaOps.filter((o) => o.machineType === "LL").length} LL / ${vnaOps.filter((o) => o.machineType === "RTR").length} RTR)
🌐 OBWI: ${obwiOps.length} (${obwiOps.filter((o) => o.machineType === "LL").length} LL / ${obwiOps.filter((o) => o.machineType === "RTR").length} RTR)
${customDepartments.length > 0 ? customDepartments.map((d) => `🛠️ ${d.name}: ${getDeptOps(d.id).length}`).join("\n") + "\n" : ""}
🟢 V provozu: ${activeTotal} | ☕ Pauza: ${breakTotal} | 🏠 Absence: ${absenceTotal}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const DEPT_DEFINITIONS = [
    {
      id: "hovc",
      name: "Outbound",
      code: "HOVC",
      icon: PackageCheck,
      color: "text-blue-400",
      border: "border-blue-500/40",
      bg: "bg-blue-500/10",
      ops: hovcOps,
    },
    {
      id: "hovs",
      name: "HOVS",
      code: "HOVS",
      icon: Boxes,
      color: "text-sky-400",
      border: "border-sky-500/40",
      bg: "bg-sky-500/10",
      ops: hovsOps,
    },
    {
      id: "putaway",
      name: "Putaway",
      code: "PUT",
      icon: ArrowDownToLine,
      color: "text-indigo-400",
      border: "border-indigo-500/40",
      bg: "bg-indigo-500/10",
      ops: putawayOps,
    },
    {
      id: "vas",
      name: "VAS",
      code: "VAS",
      icon: Wrench,
      color: "text-amber-400",
      border: "border-amber-500/40",
      bg: "bg-amber-500/10",
      ops: vasOps,
    },
    {
      id: "obwf",
      name: "OBWF",
      code: "OBWF",
      icon: Layers,
      color: "text-purple-400",
      border: "border-purple-500/40",
      bg: "bg-purple-500/10",
      ops: obwfOps,
    },
    {
      id: "vna",
      name: "VNA",
      code: "VNA",
      icon: GitCommitVertical,
      color: "text-emerald-400",
      border: "border-emerald-500/40",
      bg: "bg-emerald-500/10",
      ops: vnaOps,
    },
  ];

  // Filtering for Pocket Mode
  const filteredPocketOps = useMemo(() => {
    return operators.filter((op) => {
      // Name search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = op.name.toLowerCase().includes(query);
        const matchesNote = op.note ? op.note.toLowerCase().includes(query) : false;
        if (!matchesName && !matchesNote) return false;
      }
      // Department filter
      if (selectedDeptFilter !== "all") {
        if (selectedDeptFilter === "absence") {
          if (op.departmentId !== "unassigned") return false;
        } else if (op.departmentId !== selectedDeptFilter) {
          return false;
        }
      }
      // Machine filter
      if (selectedMachineFilter !== "all") {
        if (op.machineType !== selectedMachineFilter) return false;
      }
      return true;
    });
  }, [operators, searchQuery, selectedDeptFilter, selectedMachineFilter]);

  const allDeptsMap = useMemo(() => {
    const map = new Map<string, string>();
    DEPARTMENTS.forEach((d) => map.set(d.id, d.name));
    customDepartments.forEach((d) => map.set(d.id, d.name));
    map.set("unassigned", "Absence");
    return map;
  }, [customDepartments]);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3 pb-24 px-1 sm:px-0">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3.5 sm:p-4 text-white shadow-xl space-y-3">
        {/* Title & Quick Controls */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-500 text-white shadow-md shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black truncate">Kapesní mistr haly</h2>
                {!isOnline ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                    <WifiOff className="w-3 h-3" />
                    <span>Offline (Regály)</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Live Cloud</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Rychlé ovládání jednou rukou přímo mezi regály
              </p>
            </div>
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-1.5">
            {!isInstalled && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm active:scale-95 cursor-pointer"
                title="Nainstalovat na plochu mobilu jako PWA"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Instalovat</span>
              </button>
            )}

            {onSwitchToBoard && (
              <button
                type="button"
                onClick={onSwitchToBoard}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Přepnout na velkou tabuli"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tabule</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Celá obrazovka"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Shift switcher & Mode Switcher tabs */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-800">
          {/* Shift Picker pills */}
          {onShiftChange && (
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 px-2 uppercase">Směna:</span>
              {(["A", "B", "C"] as ShiftType[]).map((shift) => (
                <button
                  key={`widget-shift-btn-${shift}`}
                  type="button"
                  onClick={() => onShiftChange(shift)}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 ${
                    activeShift === shift
                      ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-400"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {shift}
                </button>
              ))}
            </div>
          )}

          {/* Sub-view toggle (Pocket vs Summary) */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setMobileTab("pocket")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mobileTab === "pocket"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              📱 Obchůzka (1 ruka)
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("summary")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mobileTab === "summary"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              📊 Widget & Přehled
            </button>
          </div>
        </div>
      </div>

      {/* OFFLINE NOTICE BANNER FOR AISLES */}
      {!isOnline && (
        <div className="bg-amber-950/80 border border-amber-500/40 rounded-2xl p-3 text-amber-200 text-xs flex items-center justify-between gap-2.5 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Slabý signál v uličkách mezi regály:</span>{" "}
              <span>Aplikace funguje 100% offline. Změny se samy odešlou po návratu na Wi-Fi.</span>
            </div>
          </div>
          {pendingCount > 0 && (
            <span className="font-mono px-2 py-0.5 rounded-lg bg-amber-500/30 text-amber-100 font-bold shrink-0">
              {pendingCount} ve frontě
            </span>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODE 1: POCKET HALL WALK (KAPESNÍ OBCHŮZKA PRO JEDNU RUKU) */}
      {/* ========================================================= */}
      {mobileTab === "pocket" && (
        <div className="space-y-3 animate-in fade-in duration-150">
          {/* Search bar + filter reset */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rychlé vyhledání operátora v hale..."
              className="w-full pl-10 pr-10 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Department Filter Pills (Horizontal scroll for thumb) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none select-none text-xs">
            <button
              type="button"
              onClick={() => setSelectedDeptFilter("all")}
              className={`px-3 py-2 rounded-xl font-bold shrink-0 transition-all cursor-pointer active:scale-95 ${
                selectedDeptFilter === "all"
                  ? "bg-sky-600 text-white shadow-md ring-2 ring-sky-400/40"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
              }`}
            >
              Všichni ({total})
            </button>

            {DEPT_DEFINITIONS.map((dept) => {
              const count = dept.ops.length;
              const isSelected = selectedDeptFilter === dept.id;
              return (
                <button
                  key={`pill-${dept.id}`}
                  type="button"
                  onClick={() => setSelectedDeptFilter(dept.id)}
                  className={`px-3 py-2 rounded-xl font-bold shrink-0 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-slate-800 border-sky-400 text-white ring-2 ring-sky-400/40 border"
                      : "bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <span className={dept.color}>{dept.code}</span>
                  <span className="font-mono opacity-80">({count})</span>
                </button>
              );
            })}

            {/* OBWI pill */}
            <button
              type="button"
              onClick={() => setSelectedDeptFilter("obwi")}
              className={`px-3 py-2 rounded-xl font-bold shrink-0 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                selectedDeptFilter === "obwi"
                  ? "bg-slate-800 border-rose-400 text-white ring-2 ring-rose-400/40 border"
                  : "bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700"
              }`}
            >
              <span className="text-rose-400">OBWI</span>
              <span className="font-mono opacity-80">({obwiOps.length})</span>
            </button>

            {/* Custom depts */}
            {customDepartments.map((dept) => {
              const count = getDeptOps(dept.id).length;
              const isSelected = selectedDeptFilter === dept.id;
              return (
                <button
                  key={`pill-${dept.id}`}
                  type="button"
                  onClick={() => setSelectedDeptFilter(dept.id)}
                  className={`px-3 py-2 rounded-xl font-bold shrink-0 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-amber-600 text-white ring-2 ring-amber-400/40"
                      : "bg-amber-950/20 text-amber-300 border border-amber-500/30 hover:border-amber-400"
                  }`}
                >
                  <span>{dept.code || dept.name}</span>
                  <span className="font-mono opacity-80">({count})</span>
                </button>
              );
            })}

            {/* Absence pill */}
            <button
              type="button"
              onClick={() => setSelectedDeptFilter("absence")}
              className={`px-3 py-2 rounded-xl font-bold shrink-0 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                selectedDeptFilter === "absence"
                  ? "bg-red-600 text-white ring-2 ring-red-400/40"
                  : "bg-red-950/20 text-red-300 border border-red-500/30 hover:border-red-400"
              }`}
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Absence</span>
              <span className="font-mono opacity-80">({absenceTotal})</span>
            </button>
          </div>

          {/* Machine Filter Quick Bar */}
          <div className="flex items-center gap-1.5 text-xs px-1">
            <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
              <Filter className="w-3 h-3" /> Stroj:
            </span>
            {(
              [
                { id: "all", label: "Vše" },
                { id: "LL", label: "🚜 LL" },
                { id: "RTR", label: "⚡ RTR" },
                { id: "NONE", label: "🚶 Pěší" },
              ] as const
            ).map((item) => (
              <button
                key={`machine-pill-${item.id}`}
                type="button"
                onClick={() => setSelectedMachineFilter(item.id)}
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition-all cursor-pointer ${
                  selectedMachineFilter === item.id
                    ? "bg-slate-700 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Operator Cards List - Thumb Friendly Size */}
          <div className="space-y-2">
            {filteredPocketOps.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/60 rounded-3xl border border-slate-800 text-slate-400 space-y-2">
                <Users className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-sm font-semibold">Žádný pracovník neodpovídá filtru</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedDeptFilter("all");
                    setSelectedMachineFilter("all");
                  }}
                  className="text-xs text-sky-400 underline font-medium cursor-pointer"
                >
                  Zrušit vyhledávací filtry
                </button>
              </div>
            ) : (
              filteredPocketOps.map((op) => {
                const deptName = allDeptsMap.get(op.departmentId) || "Nepřiřazen";
                const isAbsence = op.departmentId === "unassigned";

                return (
                  <div
                    key={op.id}
                    onClick={() => setActiveDrawerOp(op)}
                    className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-sky-500/50 active:scale-[0.99] transition-all cursor-pointer shadow-sm group select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Status indicator dot */}
                      <div className="shrink-0">
                        {isAbsence ? (
                          <div className="w-3.5 h-3.5 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          </div>
                        ) : op.status === "break" ? (
                          <div className="w-3.5 h-3.5 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          </div>
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          </div>
                        )}
                      </div>

                      {/* Name & Department details */}
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-100 group-hover:text-sky-300 truncate">
                          {op.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5 truncate">
                          <span
                            className={`font-semibold ${
                              isAbsence ? "text-red-400" : "text-sky-400"
                            }`}
                          >
                            {deptName}
                          </span>
                          {op.absenceReason && isAbsence && (
                            <span className="text-[10px] text-red-300">• {op.absenceReason}</span>
                          )}
                          {op.status === "break" && !isAbsence && (
                            <span className="text-[10px] text-amber-300 font-bold">• Pauza</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Machine badge & Tap action arrow */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-mono font-bold px-2 py-1 rounded-xl ${
                          op.machineType === "LL"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : op.machineType === "RTR"
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {op.machineType === "NONE" ? "Pěší" : op.machineType}
                      </span>
                      <div className="p-1 rounded-xl text-slate-500 group-hover:text-sky-400 transition-colors">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODE 2: SUMMARY & WIDGET (PŮVODNÍ DETAILNÍ PŘEHLED SMĚNY) */}
      {/* ========================================================= */}
      {mobileTab === "summary" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Main Widget Card */}
          <div className="bg-slate-950 text-white rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-2xl relative overflow-hidden">
            {/* Top Bar of Widget */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-black text-xs sm:text-sm tracking-wide text-slate-200">
                  ZF OSTROV • PICK
                </span>
                <span className="bg-blue-600/30 text-blue-300 border border-blue-500/40 text-[10px] font-bold px-1.5 py-0.2 rounded-md font-mono">
                  Směna {activeShift}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>{timeStr}</span>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-2.5 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                  Celkem na směně
                </div>
                <div className="text-xl sm:text-2xl font-black text-white">{total}</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {llTotal}× LL • {rtrTotal}× RTR
                </div>
              </div>

              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-2.5 text-center">
                <div className="text-[10px] text-emerald-400 uppercase font-semibold">
                  V provozu
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400">{activeTotal}</div>
                <div className="text-[10px] text-emerald-500/80 font-mono">
                  {total > 0 ? Math.round((activeTotal / total) * 100) : 0} % kapacity
                </div>
              </div>

              <div className="bg-rose-950/30 border border-rose-500/30 rounded-2xl p-2.5 text-center">
                <div className="text-[10px] text-rose-400 uppercase font-semibold">
                  Absence / Pauza
                </div>
                <div className="text-xl sm:text-2xl font-black text-rose-400">
                  {absenceTotal + breakTotal}
                </div>
                <div className="text-[10px] text-rose-400/80 font-mono">
                  {breakTotal} ☕ • {absenceTotal} 🏠
                </div>
              </div>
            </div>

            {/* Department Grid */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {DEPT_DEFINITIONS.map((dept) => {
                const isExpanded = expandedDeptId === dept.id;
                const Icon = dept.icon;
                return (
                  <div
                    key={dept.id}
                    onClick={() => setExpandedDeptId(isExpanded ? null : dept.id)}
                    className={`bg-slate-900/90 border ${
                      isExpanded ? `${dept.border} ring-2 ring-blue-500/30` : "border-slate-800"
                    } hover:${dept.border} rounded-2xl p-2.5 flex flex-col justify-between transition-all cursor-pointer active:scale-[0.98] shadow-sm`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className={`p-1.5 rounded-lg ${dept.bg} ${dept.color}`}>
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-white truncate block">
                            {dept.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{dept.code}</span>
                        </div>
                      </div>
                      <span className={`text-xl font-black ${dept.color} shrink-0 pl-1`}>
                        {dept.ops.length}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 mt-1 font-mono flex items-center justify-between">
                      <span>
                        {dept.ops.filter((o) => o.machineType === "LL").length} LL •{" "}
                        {dept.ops.filter((o) => o.machineType === "RTR").length} RTR
                      </span>
                      <span>
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-slate-500" />
                        )}
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-slate-800 space-y-1 animate-in fade-in duration-150">
                        {dept.ops.length === 0 ? (
                          <p className="text-[10px] text-slate-500 italic">Nikdo není přiřazen</p>
                        ) : (
                          dept.ops.map((op) => (
                            <div
                              key={op.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDrawerOp(op);
                              }}
                              className="flex items-center justify-between text-[11px] bg-slate-950/60 hover:bg-slate-800 px-2 py-1 rounded-lg cursor-pointer transition-colors"
                            >
                              <span className="font-bold text-slate-200 truncate pr-1">
                                {op.name}
                              </span>
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.2 rounded font-mono ${
                                  op.machineType === "LL"
                                    ? "bg-amber-500/20 text-amber-300"
                                    : "bg-blue-500/20 text-blue-300"
                                }`}
                              >
                                {op.machineType}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* OBWI card */}
            <div
              onClick={() => setExpandedDeptId(expandedDeptId === "obwi" ? null : "obwi")}
              className={`bg-slate-900/90 border ${
                expandedDeptId === "obwi"
                  ? "border-rose-500/60 ring-2 ring-rose-500/40"
                  : "border-slate-800"
              } hover:border-rose-500/50 rounded-2xl p-3 flex flex-col mb-3 transition-all cursor-pointer active:scale-[0.98] shadow-sm`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-sm text-white">OBWI</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {obwiOps.filter((o) => o.machineType === "LL").length}× LL •{" "}
                      {obwiOps.filter((o) => o.machineType === "RTR").length}× RTR
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-rose-400">{obwiOps.length}</span>
                  <span className="text-slate-500 text-[10px]">
                    {expandedDeptId === "obwi" ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </span>
                </div>
              </div>

              {expandedDeptId === "obwi" && (
                <div className="mt-2 pt-2 border-t border-slate-800 space-y-1 animate-in fade-in duration-150">
                  {obwiOps.length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic">Nikdo není přiřazen</p>
                  ) : (
                    obwiOps.map((op) => (
                      <div
                        key={op.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDrawerOp(op);
                        }}
                        className="flex items-center justify-between text-[11px] bg-slate-950/60 hover:bg-slate-800 px-2 py-1 rounded-lg cursor-pointer"
                      >
                        <span className="font-bold text-slate-200 truncate pr-1">{op.name}</span>
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.2 rounded font-mono ${
                            op.machineType === "LL"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-blue-500/20 text-blue-300"
                          }`}
                        >
                          {op.machineType}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Custom Departments */}
            {customDepartments.length > 0 && (
              <div className="mb-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Vícepráce a mimořádné úkoly</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {customDepartments.map((dept) => {
                    const ops = getDeptOps(dept.id);
                    const isExpanded = expandedDeptId === dept.id;
                    return (
                      <div
                        key={dept.id}
                        onClick={() => setExpandedDeptId(isExpanded ? null : dept.id)}
                        className={`bg-amber-950/20 border ${
                          isExpanded
                            ? "border-amber-400 ring-2 ring-amber-400/40"
                            : "border-amber-500/30"
                        } hover:border-amber-500/60 rounded-xl p-2.5 flex flex-col justify-between transition-all cursor-pointer active:scale-[0.98]`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 pr-1">
                            <span className="font-bold text-xs text-white truncate block">
                              {dept.name}
                            </span>
                            <span className="text-[10px] text-amber-400 font-mono">
                              {dept.code}
                            </span>
                          </div>
                          <span className="text-xl font-black text-amber-400 shrink-0">
                            {ops.length}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono flex items-center justify-between">
                          <span>
                            {ops.filter((o) => o.machineType === "LL").length} LL •{" "}
                            {ops.filter((o) => o.machineType === "RTR").length} RTR
                          </span>
                          <span>
                            {isExpanded ? (
                              <ChevronUp className="w-2.5 h-2.5" />
                            ) : (
                              <ChevronDown className="w-2.5 h-2.5" />
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bottom Absence toggle */}
            <div
              onClick={() => setShowAbsenceList((prev) => !prev)}
              className="bg-slate-900 rounded-2xl p-3 border border-slate-800 flex items-center justify-between text-xs cursor-pointer hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-slate-400">Celkem:</span>
                <span className="font-bold text-white">{total}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-semibold">{activeTotal} aktivní</span>
                <span className="text-amber-400 font-semibold">{breakTotal} pauza</span>
                <span className="text-rose-400 font-semibold">{absenceTotal} absence</span>
                <span className="text-slate-500">
                  {showAbsenceList ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </span>
              </div>
            </div>

            {/* Absence Drawer */}
            {showAbsenceList && (
              <div className="mt-2 p-3 bg-slate-900/90 rounded-2xl border border-slate-800 animate-in fade-in duration-150">
                <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <UserX className="w-3.5 h-3.5" />
                  <span>Dnešní absence ({absenceOps.length})</span>
                </div>
                {absenceOps.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">Všichni jsou přítomni</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {absenceOps.map((op) => (
                      <span
                        key={op.id}
                        onClick={() => setActiveDrawerOp(op)}
                        className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[11px] font-medium cursor-pointer hover:bg-rose-500/25"
                      >
                        {op.name}
                        {op.absenceReason ? ` • ${op.absenceReason}` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Copy Text Button */}
          <button
            type="button"
            onClick={copyWidgetText}
            className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4 text-sky-400" />
            )}
            <span>
              {copied ? "Zkopírováno do schránky!" : "Zkopírovat stav pro WhatsApp / Teams"}
            </span>
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* STICKY BOTTOM THUMB ACTION BAR FOR MOBILE WALK */}
      {/* ========================================================= */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 p-2.5 sm:p-3 shadow-2xl">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          {/* Quick Add Person (Thumb action) */}
          {onAddNewOperator && (
            <button
              type="button"
              onClick={onAddNewOperator}
              className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Přidat člověka na směnu</span>
            </button>
          )}

          {/* Undo button if available */}
          {hasUndo && onUndoSingle && (
            <button
              type="button"
              onClick={onUndoSingle}
              className="py-3 px-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
              title="Vrátit poslední přesun"
            >
              <Undo2 className="w-4 h-4 text-amber-400" />
              <span className="hidden xs:inline">Zpět</span>
            </button>
          )}

          {/* Cloud Sync indicator dot */}
          <div className="px-3 py-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
            {isOnline ? (
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="hidden sm:inline">Online</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-amber-400">
                <WifiOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Offline</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE OPERATOR ACTION DRAWER (BOTTOM SHEET) */}
      <MobileOperatorDrawer
        operator={activeDrawerOp}
        customDepartments={customDepartments}
        onClose={() => setActiveDrawerOp(null)}
        onMoveDepartment={(opId, targetDeptId, reason) => {
          if (onMoveOperator) {
            onMoveOperator(opId, targetDeptId, reason);
          }
        }}
        onChangeMachineType={(opId, machine) => {
          if (onChangeMachineType) {
            onChangeMachineType(opId, machine);
          }
        }}
        onChangeStatus={(opId, status) => {
          if (onChangeStatus) {
            onChangeStatus(opId, status);
          }
        }}
        onChangeAbsenceReason={(opId, reason) => {
          if (onChangeAbsenceReason) {
            onChangeAbsenceReason(opId, reason);
          }
        }}
        onEditOperator={(op) => {
          if (onEditOperator) {
            onEditOperator(op);
          }
        }}
      />

      {/* PWA INSTALL INSTRUCTIONS MODAL */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 text-white rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-2xl relative space-y-4">
            <button
              type="button"
              onClick={() => setShowInstallModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-blue-600 text-white shadow-lg">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black">Jak přidat aplikaci na plochu</h3>
                <p className="text-xs text-slate-400">
                  Přístup k rozpisu jedním klepnutím přímo z displeje telefonu.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              {/* Android Guide */}
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-blue-300">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[11px]">
                    1
                  </span>
                  <span>Android (Google Chrome):</span>
                </div>
                <p className="text-slate-300 pl-7">
                  1. Vpravo nahoře v prohlížeči Chrome klepněte na <strong>tři tečky (⋮)</strong>.
                </p>
                <p className="text-slate-300 pl-7">
                  2. Zvolte <strong>„Přidat na plochu“</strong> nebo{" "}
                  <strong>„Instalovat aplikaci“</strong>.
                </p>
                <p className="text-emerald-300 pl-7 text-[11px] font-medium">
                  ✓ Vytvoří se samostatná aplikace, která funguje i bez připojení k internetu.
                </p>
              </div>

              {/* iPhone Guide */}
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-sky-300">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center text-[11px]">
                    2
                  </span>
                  <span>iPhone / iPad (Safari):</span>
                </div>
                <p className="text-slate-300 pl-7 flex items-center gap-1.5">
                  1. Dole v Safari klepněte na tlačítko <strong>Sdílet</strong> (
                  <Share className="w-3.5 h-3.5 inline text-blue-400" />
                  ).
                </p>
                <p className="text-slate-300 pl-7">
                  2. Sjeďte dolů a vyberte <strong>„Přidat na plochu“</strong> (ikona +).
                </p>
                <p className="text-slate-300 pl-7">
                  3. Klepněte na <strong>Přidat</strong> vpravo nahoře.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="w-full py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white text-xs transition-colors cursor-pointer"
              >
                Rozumím, zavřít návod
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
