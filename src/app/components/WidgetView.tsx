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
} from "lucide-react";
import { DEPARTMENTS } from "../data/departments";
import { Department, Operator, ShiftCode } from "../types";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface WidgetViewProps {
  operators: Operator[];
  customDepartments?: Department[];
  activeShift?: ShiftCode;
  onShiftChange?: (shift: ShiftCode) => void;
  isCloudConnected?: boolean;
  isCloudSyncing?: boolean;
  hasCloudWriteError?: boolean;
  onSelectDepartment?: (deptId: string) => void;
  onSwitchToBoard?: () => void;
}

export const WidgetView: React.FC<WidgetViewProps> = ({
  operators,
  customDepartments = [],
  activeShift = "A",
  onShiftChange,
  isCloudConnected = true,
  isCloudSyncing = false,
  hasCloudWriteError = false,
  onSelectDepartment,
  onSwitchToBoard,
}) => {
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [showAbsenceList, setShowAbsenceList] = useState(false);

  // Live real-time clock update every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check if running in standalone PWA mode and capture install prompt
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(isStandalone);

      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstall);
      window.addEventListener("appinstalled", () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
      });

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      };
    }
    return undefined;
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch {
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

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 pb-12">
      {/* Top Action & PWA Controls Header */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-sm shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                Mobilní Widget • Živý přehled
              </h2>
              {isInstalled && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  Nainstalováno
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Stále aktuální přehled směny pro plochu mobilu i PC.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {!isInstalled && (
            <button
              id="install-widget-pwa-btn"
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md active:scale-95 transition-all cursor-pointer"
              title="Přidat aplikaci na plochu telefonu"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Přidat na plochu mobilu</span>
            </button>
          )}

          <button
            type="button"
            onClick={copyWidgetText}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            title="Zkopírovat stav směny do schránky pro WhatsApp nebo Teams"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span className="hidden xs:inline">{copied ? "Zkopírováno!" : "Kopírovat"}</span>
          </button>

          {onSwitchToBoard && (
            <button
              type="button"
              onClick={onSwitchToBoard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              title="Přejít do interaktivní tabule pro přesun operátorů"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Plná tabule</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex items-center justify-center p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Režim celé obrazovky"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* SHIFT PICKER PILLS (SMĚNA A / B / C) */}
      {onShiftChange && (
        <div className="flex items-center justify-between bg-slate-900/90 text-white p-2 rounded-2xl border border-slate-800 shadow-md">
          <span className="text-xs font-bold text-slate-400 px-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>Aktivní směna:</span>
          </span>
          <div className="flex items-center gap-1">
            {(["A", "B", "C"] as ShiftCode[]).map((shift) => (
              <button
                key={`widget-shift-btn-${shift}`}
                type="button"
                onClick={() => onShiftChange(shift)}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 ${
                  activeShift === shift
                    ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-400"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Směna {shift}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* THE LIVE PHONE WIDGET CARD */}
      <div
        id="mobile-wallpaper-widget"
        className="w-full bg-slate-950 text-white rounded-[28px] sm:rounded-[36px] p-4 sm:p-6 shadow-2xl border-4 border-slate-800 relative overflow-hidden select-none"
      >
        {/* Subtle background ambient glows */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Live Top Status Strip */}
        <div className="flex items-center justify-between text-xs text-slate-400 mb-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-extrabold text-slate-200 tracking-wider text-[11px] uppercase">
              ZF OSTROV • SMĚNA {activeShift}
            </span>
            {hasCloudWriteError ? (
              <span className="text-[10px] text-red-400 font-mono">
                Chyba ukládání — obnovte stránku
              </span>
            ) : isCloudSyncing ? (
              <span className="text-[10px] text-amber-400 font-mono animate-pulse">
                Ukládání...
              </span>
            ) : isCloudConnected ? (
              <span className="text-[10px] text-emerald-400/80 font-mono hidden xs:inline">
                ● Live Online
              </span>
            ) : (
              <span className="text-[10px] text-amber-400 font-mono">Bez online spojení</span>
            )}
          </div>
          <div className="font-mono text-slate-300 font-bold text-xs flex items-center gap-1.5">
            <span>{dateStr}</span>
            <span className="text-blue-400 font-black">{timeStr}</span>
          </div>
        </div>

        {/* HERO TOTAL BANNER */}
        <div className="mb-3.5 bg-gradient-to-br from-blue-950/90 via-slate-900 to-slate-900 border-2 border-blue-500/50 rounded-2xl p-4 relative shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-400">
                  HLAVNÍ ODDĚLENÍ
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-bold">
                  Směna {activeShift}
                </span>
              </div>
              <h3 className="text-lg font-black text-white mt-0.5">CELKEM PICK</h3>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs font-black text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 rounded-lg shadow-2xs">
                  {llTotal}× LL
                </span>
                <span className="text-xs font-black text-blue-300 bg-blue-500/20 border border-blue-500/30 px-2.5 py-0.5 rounded-lg shadow-2xs">
                  {rtrTotal}× RTR
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-baseline justify-end">
                <span className="text-4xl sm:text-5xl font-black text-blue-400 tracking-tight">
                  {total}
                </span>
                <span className="text-xs text-blue-200/80 ml-1.5 font-bold">lidí</span>
              </div>
              <div className="text-[11px] font-bold text-emerald-300 flex items-center justify-end gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  v provozu:{" "}
                  <strong className="text-white text-xs font-black">{activeTotal}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-blue-500/20 flex items-center justify-between text-[11px] text-slate-300">
            <span className="text-emerald-300 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{activeTotal} aktivních na hale</span>
            </span>
            <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
              {breakTotal > 0 && (
                <span className="text-amber-300 font-semibold">{breakTotal} pauza</span>
              )}
              {breakTotal > 0 && absenceTotal > 0 && <span>•</span>}
              {absenceTotal > 0 && (
                <span className="text-rose-300 font-semibold">{absenceTotal} absence</span>
              )}
            </div>
          </div>
        </div>

        {/* 6 SUB-DEPARTMENTS GRID */}
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          {DEPT_DEFINITIONS.map((dept) => {
            const Icon = dept.icon;
            const llCount = dept.ops.filter((o) => o.machineType === "LL").length;
            const rtrCount = dept.ops.filter((o) => o.machineType === "RTR").length;
            const isExpanded = expandedDeptId === dept.id;

            return (
              <div
                key={dept.id}
                onClick={() => setExpandedDeptId(isExpanded ? null : dept.id)}
                className={`bg-slate-900/90 border ${
                  isExpanded ? `${dept.border} ring-2 ring-blue-500/40` : "border-slate-800"
                } hover:${dept.border} rounded-2xl p-3 flex flex-col justify-between transition-all cursor-pointer active:scale-[0.98] shadow-sm`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0 pr-1">
                    <Icon className={`w-4 h-4 ${dept.color} shrink-0`} />
                    <span className="font-black text-sm text-white truncate">{dept.name}</span>
                  </div>
                  <span className={`text-2xl font-black ${dept.color} shrink-0`}>
                    {dept.ops.length}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between font-mono">
                  <span>
                    {llCount} LL • {rtrCount} RTR
                  </span>
                  <span className="text-slate-500 text-[9px]">
                    {isExpanded ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </span>
                </div>

                {/* Expanded list of operators on tap */}
                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-slate-800 space-y-1 animate-in fade-in duration-150">
                    {dept.ops.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic">Nikdo není přiřazen</p>
                    ) : (
                      dept.ops.map((op) => (
                        <div
                          key={op.id}
                          className="flex items-center justify-between text-[11px] bg-slate-950/60 px-2 py-1 rounded-lg"
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
            );
          })}
        </div>

        {/* OBWI (Full width card) */}
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
                    className="flex items-center justify-between text-[11px] bg-slate-950/60 px-2 py-1 rounded-lg"
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

        {/* CUSTOM DEPARTMENTS (VÍCEPRÁCE) */}
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
                        <span className="text-[10px] text-amber-400 font-mono">{dept.code}</span>
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

                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-amber-500/20 space-y-1">
                        {ops.length === 0 ? (
                          <p className="text-[10px] text-slate-500 italic">Nikdo není přiřazen</p>
                        ) : (
                          ops.map((op) => (
                            <div
                              key={op.id}
                              className="flex items-center justify-between text-[11px] bg-slate-950/60 px-2 py-1 rounded-lg"
                            >
                              <span className="font-bold text-slate-200 truncate pr-1">
                                {op.name}
                              </span>
                              <span className="text-[9px] font-black text-amber-300 font-mono">
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
          </div>
        )}

        {/* BOTTOM SUMMARY & ABSENCE DRAWER TOGGLE */}
        <div
          onClick={() => setShowAbsenceList((prev) => !prev)}
          className="bg-slate-900 rounded-2xl p-3 border border-slate-800 flex items-center justify-between text-xs cursor-pointer hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-slate-400">Celkem:</span>
            <span className="font-bold text-white text-sm">{total}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-emerald-400 font-bold">{activeTotal} na hale</span>
            <span className="text-slate-600">•</span>
            <span className="text-amber-400 font-semibold">{breakTotal} pauza</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">{absenceTotal} absence</span>
            <span className="text-slate-500 ml-1">
              {showAbsenceList ? (
                <ChevronUp className="w-3.5 h-3.5 inline" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 inline" />
              )}
            </span>
          </div>
        </div>

        {/* EXPANDED ABSENCE & PAUSE LIST */}
        {showAbsenceList && (
          <div className="mt-2.5 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Coffee className="w-3.5 h-3.5 text-amber-400" />
                <span>Na pauze ({breakOps.length})</span>
              </span>
            </div>
            {breakOps.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">Nikdo není na pauze</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {breakOps.map((op) => (
                  <span
                    key={op.id}
                    className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-medium"
                  >
                    {op.name} ({op.machineType})
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 pt-2">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <UserX className="w-3.5 h-3.5 text-rose-400" />
                <span>Nepřítomnost / Absence ({absenceOps.length})</span>
              </span>
            </div>
            {absenceOps.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">Všichni jsou přítomni</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {absenceOps.map((op) => (
                  <span
                    key={op.id}
                    className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[11px] font-medium"
                  >
                    {op.name}
                    {op.absenceReason ? ` • ${op.absenceReason}` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick Hint Strip */}
        <div className="mt-3 text-center text-[10px] text-slate-500 flex items-center justify-center gap-1">
          <Sparkles className="w-3 h-3 text-blue-400" />
          <span>Kliknutím na jakékoliv oddělení rozbalíte jména operátorů</span>
        </div>
      </div>

      {/* INSTALL INSTRUCTIONS MODAL */}
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
                <h3 className="text-base font-black">Jak přidat Widget na plochu</h3>
                <p className="text-xs text-slate-400">
                  Budete mít online přehled stále po ruce přímo z plochy mobilu.
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
                  1. Vpravo nahoře v prohlížeči Chrome klikněte na <strong>tři tečky (⋮)</strong>.
                </p>
                <p className="text-slate-300 pl-7">
                  2. Zvolte <strong>„Přidat na plochu“</strong> nebo{" "}
                  <strong>„Instalovat aplikaci“</strong>.
                </p>
                <p className="text-emerald-300 pl-7 text-[11px] font-medium">
                  ✓ Na ploše mobilu se vám vytvoří ikona ZF Widget se živým online přehledem.
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
                  1. Dole v Safari klikněte na tlačítko <strong>Sdílet</strong> (
                  <Share className="w-3.5 h-3.5 inline text-blue-400" />
                  ).
                </p>
                <p className="text-slate-300 pl-7">
                  2. Sjeďte dolů a vyberte <strong>„Přidat na plochu“</strong> (ikona čtverce se
                  symbolem +).
                </p>
                <p className="text-slate-300 pl-7">
                  3. Klikněte na <strong>Přidat</strong> vpravo nahoře.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
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
