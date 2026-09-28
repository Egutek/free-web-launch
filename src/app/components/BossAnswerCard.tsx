import React, { useState } from "react";
import {
  Copy,
  Check,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Truck,
  Forklift,
  Users,
  Activity,
  UserX,
  Sparkles,
  Bot,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { Department, Operator, RosterMember, ShiftCode } from "../types";
import { DEPARTMENTS, getDepartmentById } from "../data/departments";
import {
  isTransportDepartment,
  isVnaRosterMember,
  matchOperatorWithRoster,
} from "../utils/rosterMatcher";
import {
  findLearnedProfile,
  loadLearnedProfiles,
  loadAILearningEvents,
} from "../services/operatorLearningEngine";

interface BossAnswerCardProps {
  operators: Operator[];
  customDepartments?: Department[];
  roster?: RosterMember[];
  activeShift?: ShiftCode;
  onOpenReportModal: () => void;
  onQuickMoveModal?: () => void;
  onOpenKmenModal?: () => void;
  onAutoAssignAISuggestions?: () => void;
}

export const BossAnswerCard: React.FC<BossAnswerCardProps> = ({
  operators,
  customDepartments = [],
  roster = [],
  activeShift = "A",
  onOpenReportModal,
  onOpenKmenModal,
  onAutoAssignAISuggestions,
}) => {
  const [copied, setCopied] = useState(false);
  const [showAIDetails, setShowAIDetails] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("zf_boss_card_collapsed");
      if (stored !== null) return stored === "true";
      return false; // Default expanded for great overview
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("zf_boss_card_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // 1. Filtrací rozdělit operátory dle reálných stavů
  const activeOps = operators.filter(
    (op) => op.departmentId !== "unassigned" && op.status === "active",
  );
  const absenceOps = operators.filter(
    (op) => op.departmentId === "unassigned" || op.status === "absence",
  );
  const breakOps = operators.filter(
    (op) => op.departmentId !== "unassigned" && op.status === "break",
  );

  // 2. Transport vs VNA v živém provozu
  const transportActiveOps = activeOps.filter((op) => isTransportDepartment(op.departmentId));
  const vnaActiveOps = activeOps.filter((op) => op.departmentId === "vna");

  // 3. Stálý stav (roster) pro aktivní směnu
  const shiftRoster = roster.filter(
    (m) =>
      (!m.shift || m.shift === "all" || m.shift === activeShift) && m.isActiveInRoster !== false,
  );
  const transportRosterCount = shiftRoster.filter((m) => !isVnaRosterMember(m)).length;
  const vnaRosterCount = shiftRoster.filter((m) => isVnaRosterMember(m)).length;

  // 4. Výpomoci mezi týmy
  const vnaLoanedToTransport = transportActiveOps.filter((op) => {
    const m = matchOperatorWithRoster(op.name, roster).match;
    return m && isVnaRosterMember(m);
  }).length;

  const transportLoanedToVna = vnaActiveOps.filter((op) => {
    const m = matchOperatorWithRoster(op.name, roster).match;
    return m && !isVnaRosterMember(m);
  }).length;

  // 5. Inteligentní rozdělení absencí s pomocí AI znalostní báze
  // "kdo je na PN tak rovnou ho přiřadila pod transport protože tam jezdí"
  const transportAbsenceOps = absenceOps.filter((op) => {
    const profile = findLearnedProfile(op.name);
    if (profile) {
      return profile.primaryTeam === "transport";
    }
    const m = matchOperatorWithRoster(op.name, roster).match;
    return !m || !isVnaRosterMember(m);
  });

  const vnaAbsenceOps = absenceOps.filter((op) => {
    const profile = findLearnedProfile(op.name);
    if (profile) {
      return profile.primaryTeam === "vna";
    }
    const m = matchOperatorWithRoster(op.name, roster).match;
    return m && isVnaRosterMember(m);
  });

  const transportPnOps = transportAbsenceOps.filter((op) => op.absenceReason === "PN");
  const transportVacationOps = transportAbsenceOps.filter((op) => op.absenceReason === "Dovolená");
  const unassignedWaitingOps = operators.filter(
    (op) => op.departmentId === "unassigned" && !op.absenceReason,
  );

  // 6. Stroje a pracoviště Transportu
  const activeLL = activeOps.filter((op) => op.machineType === "LL").length;
  const activeRTR = activeOps.filter((op) => op.machineType === "RTR").length;
  const activeVNA = vnaActiveOps.length;

  const hovsOps = transportActiveOps.filter(
    (op) => op.departmentId === "hovs" || op.departmentId === "hovc",
  );
  const putawayOps = transportActiveOps.filter((op) => op.departmentId === "putaway");
  const outboundOps = transportActiveOps.filter(
    (op) => op.departmentId === "obwf" || op.departmentId === "obwi",
  );
  const vasOps = transportActiveOps.filter((op) => op.departmentId === "vas");

  const customDeptIds = new Set(customDepartments.map((d) => d.id));
  const activeExtraOps = activeOps.filter((op) => customDeptIds.has(op.departmentId));

  // 7. AI learning data stats
  const learnedMap = loadLearnedProfiles();
  const recentAIEvents = loadAILearningEvents();
  const learnedProfilesCount = learnedMap.size;

  // 8. Rychlé kopírování pro vedení
  const copyPickSummary = () => {
    const lines = DEPARTMENTS.filter((d) => d.id !== "unassigned").map((d) => {
      const opsInDept = operators.filter((o) => o.departmentId === d.id && o.status !== "absence");
      return `${d.name}: ${opsInDept.length}`;
    });
    const extraLines = customDepartments.map((d) => {
      const opsInDept = operators.filter((o) => o.departmentId === d.id && o.status !== "absence");
      return `${d.name}: ${opsInDept.length}`;
    });
    const combined = [...lines, ...extraLines];

    const extraNote =
      activeExtraOps.length > 0 ? `, z toho ${activeExtraOps.length} na vícepracích` : "";
    const rosterInfo =
      transportRosterCount > 0 ? ` (stálý stav Transport ${transportRosterCount})` : "";
    const text = `Ahoj, aktuální stav oddělení PICK (Směna ${activeShift}):\nTransport: ${transportActiveOps.length} lidí v provozu${rosterInfo}, VNA: ${vnaActiveOps.length} v provozu (celkem ${activeOps.length} z ${operators.length} na směně${extraNote}, ${absenceOps.length} v absenci / doma [z toho ${transportPnOps.length}× PN], ${activeLL}× LL, ${activeRTR}× RTR):\n${combined.join(" | ")}.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ==========================================
  // 1. COLLAPSED BAR VIEW
  // ==========================================
  if (isCollapsed) {
    return (
      <div
        id="boss-pick-card-collapsed"
        className="bg-slate-900 border border-slate-700/80 rounded-2xl p-2.5 sm:px-4 sm:py-2.5 text-white shadow-md flex items-center justify-between gap-2.5 flex-wrap transition-all"
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
            Směna {activeShift}
          </span>

          {/* Transport Pill */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-950/80 border border-blue-600/50 text-xs text-blue-200">
            <Truck className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-slate-300">Transport:</span>
            <strong className="text-white font-extrabold text-sm">
              {transportActiveOps.length}
            </strong>
            {transportRosterCount > 0 && (
              <span className="text-blue-400/80 font-mono text-[11px]">
                /{transportRosterCount}
              </span>
            )}
            <span className="text-slate-400 text-[11px]">v provozu</span>
          </div>

          {/* VNA Pill */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/80 border border-emerald-600/50 text-xs text-emerald-200">
            <Forklift className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold text-slate-300">VNA:</span>
            <strong className="text-white font-extrabold text-sm">{vnaActiveOps.length}</strong>
            {vnaRosterCount > 0 && (
              <span className="text-emerald-400/80 font-mono text-[11px]">/{vnaRosterCount}</span>
            )}
            <span className="text-slate-400 text-[11px]">v provozu</span>
          </div>

          {/* Absence Pill with PN detail */}
          {absenceOps.length > 0 && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-950/70 border border-rose-700/60 text-xs text-rose-300">
              <UserX className="w-3.5 h-3.5 text-rose-400" />
              <span>
                Absence: <strong className="text-white font-bold">{absenceOps.length}</strong>
                {transportPnOps.length > 0 && (
                  <span className="text-rose-400 text-[11px] ml-1">
                    ({transportPnOps.length} PN)
                  </span>
                )}
              </span>
            </div>
          )}

          {/* AI background learning badge */}
          <div
            onClick={() => {
              setIsCollapsed(false);
              setShowAIDetails(true);
            }}
            className="hidden xl:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-950/70 border border-indigo-700/60 text-[11px] text-indigo-300 cursor-pointer hover:bg-indigo-900/60 transition-colors"
            title="AI na pozadí sleduje pohyby a automaticky rozpoznává tým a PN."
          >
            <Bot className="w-3 h-3 text-indigo-400" />
            <span>AI učení: {learnedProfilesCount} profilů</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <button
            id="copy-pick-answer-collapsed-btn"
            onClick={copyPickSummary}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            title="Zkopírovat stav pro WhatsApp / SMS"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{copied ? "Zkopírováno" : "Kopírovat"}</span>
          </button>

          <button
            id="open-report-collapsed-btn"
            onClick={onOpenReportModal}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Report</span>
          </button>

          <button
            id="expand-boss-card-btn"
            onClick={toggleCollapse}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
            title="Rozbalit přehledný dashboard"
          >
            <span>Přehled</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. EXPANDED STRUCTURED DASHBOARD
  // ==========================================
  return (
    <div
      id="boss-pick-card"
      className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 text-white shadow-xl relative overflow-hidden transition-all space-y-3.5"
    >
      {/* 1. TOP HEADER BAR */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-sm shadow-md">
            ZF
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                Oddělení PICK • Stav směny {activeShift}
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/80">
                Živý provoz
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Přehledné rozdělení operátorů, docházky a automatické AI zařazení absencí
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* AI Info pill */}
          <button
            type="button"
            onClick={() => setShowAIDetails((prev) => !prev)}
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              showAIDetails
                ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                : "bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border-indigo-800/60"
            }`}
            title="Klikněte pro zobrazení, co se AI na pozadí naučila a jak rozpoznává lidi na PN."
          >
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI učení ({learnedProfilesCount})</span>
          </button>

          <button
            id="copy-pick-answer-btn"
            onClick={copyPickSummary}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer shadow-2xs"
            title="Zkopírovat textovou zprávu pro šéfa"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {copied ? "Zkopírováno!" : "Kopírovat pro šéfa"}
            </span>
          </button>

          <button
            id="open-full-boss-report-btn"
            onClick={onOpenReportModal}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer shadow-sm"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Celý report</span>
          </button>

          <button
            id="collapse-boss-card-btn"
            onClick={toggleCollapse}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Sbalit přehled"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. MAIN 3 KPI COLUMNS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
        {/* Card 1: TRANSPORT TÝM (1. Team Leader) */}
        <div className="bg-slate-950/80 border border-blue-900/50 hover:border-blue-700/60 rounded-xl p-3.5 space-y-2.5 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400">
              <Truck className="w-4 h-4 text-blue-500" />
              <span>TÝM TRANSPORT</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
              1. Team Leader
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-0.5">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white flex items-baseline gap-1">
                <span>{transportActiveOps.length}</span>
                <span className="text-xs font-normal text-slate-400">v provozu</span>
              </div>
              <span className="text-[11px] text-slate-400">
                Stálý stav:{" "}
                <strong className="text-blue-300 font-bold">{transportRosterCount || 57}</strong>{" "}
                lidí
              </span>
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-lg bg-blue-950 text-blue-300 border border-blue-800/80">
              {Math.round((transportActiveOps.length / (transportRosterCount || 57)) * 100)}%
              nasazeno
            </span>
          </div>

          {/* Breakdown items */}
          <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Na pracovištích Transportu:</span>
              <strong className="text-white font-mono">
                {transportActiveOps.length - vnaLoanedToTransport}
              </strong>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400 flex items-center gap-1">
                <span>V absenci / PN:</span>
                {transportPnOps.length > 0 && (
                  <span className="text-[10px] text-rose-400 font-bold">
                    ({transportPnOps.length} PN)
                  </span>
                )}
              </span>
              <strong
                className={
                  transportAbsenceOps.length > 0
                    ? "text-rose-400 font-mono font-bold"
                    : "text-slate-400 font-mono"
                }
              >
                {transportAbsenceOps.length}
              </strong>
            </div>

            {vnaLoanedToTransport > 0 && (
              <div className="flex items-center justify-between text-amber-300">
                <span className="text-amber-400/90">Výpomoc z VNA týmu:</span>
                <strong className="font-mono">+{vnaLoanedToTransport}</strong>
              </div>
            )}
            {transportLoanedToVna > 0 && (
              <div className="flex items-center justify-between text-blue-300">
                <span className="text-blue-400/90">Zapůjčeno na VNA:</span>
                <strong className="font-mono">{transportLoanedToVna}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: VNA TÝM (2. Team Leader) */}
        <div className="bg-slate-950/80 border border-emerald-900/50 hover:border-emerald-700/60 rounded-xl p-3.5 space-y-2.5 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <Forklift className="w-4 h-4 text-emerald-500" />
              <span>TÝM VNA</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
              2. Team Leader
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-0.5">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white flex items-baseline gap-1">
                <span>{vnaActiveOps.length}</span>
                <span className="text-xs font-normal text-slate-400">v provozu</span>
              </div>
              <span className="text-[11px] text-slate-400">
                Stálý stav:{" "}
                <strong className="text-emerald-300 font-bold">{vnaRosterCount || 8}</strong> lidí
              </span>
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800/80">
              {Math.round((vnaActiveOps.length / (vnaRosterCount || 8)) * 100)}% nasazeno
            </span>
          </div>

          {/* Breakdown items */}
          <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">V uličkách VNA:</span>
              <strong className="text-white font-mono">{vnaActiveOps.length}</strong>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">V absenci / doma:</span>
              <strong
                className={
                  vnaAbsenceOps.length > 0
                    ? "text-rose-400 font-mono font-bold"
                    : "text-slate-400 font-mono"
                }
              >
                {vnaAbsenceOps.length}
              </strong>
            </div>
            {vnaLoanedToTransport > 0 && (
              <div className="flex items-center justify-between text-amber-300">
                <span className="text-amber-400/90">Vypomáhá na Transportu:</span>
                <strong className="font-mono">{vnaLoanedToTransport}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: STROJE & CELKOVÉ OBSAZENÍ HALY */}
        <div className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 space-y-2.5 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <Activity className="w-4 h-4 text-slate-400" />
              <span>STROJE & CELKEM HALA</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
              Celkem {operators.length} lidí
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-0.5">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 flex items-baseline gap-1">
                <span>{activeOps.length}</span>
                <span className="text-xs font-normal text-slate-400">aktivně na hale</span>
              </div>
              <span className="text-[11px] text-slate-400">
                {absenceOps.length} v absenci • {breakOps.length} na pauze
              </span>
            </div>
          </div>

          {/* Machine qualification badges */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-1 rounded-lg bg-amber-950/80 border border-amber-600/50 text-amber-300 text-xs font-bold font-mono">
              {activeLL}× LL
            </span>
            <span className="px-2 py-1 rounded-lg bg-blue-950/80 border border-blue-600/50 text-blue-300 text-xs font-bold font-mono">
              {activeRTR}× RTR
            </span>
            <span className="px-2 py-1 rounded-lg bg-emerald-950/80 border border-emerald-600/50 text-emerald-300 text-xs font-bold font-mono">
              {activeVNA}× VNA
            </span>
            {activeExtraOps.length > 0 && (
              <span className="px-2 py-1 rounded-lg bg-purple-950/80 border border-purple-600/50 text-purple-300 text-xs font-bold">
                +{activeExtraOps.length} vícepráce
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. ORGANIZED SUB-SECTION: TRANSPORT WORKPLACES BREAKDOWN */}
      <div className="bg-slate-950/50 border border-slate-800/90 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Rozpad pracovišť Transportu (1. TL):</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Celkem na Transportu:{" "}
            <strong className="text-white">{transportActiveOps.length}</strong> lidí
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {/* HOVS */}
          <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-300 font-medium">HOVS / HOVC</span>
            <div className="flex items-center gap-1.5">
              <strong className="text-white font-extrabold text-sm">{hovsOps.length}</strong>
              <span className="text-[10px] text-slate-500 font-mono">
                ({hovsOps.filter((o) => o.machineType === "LL").length} LL)
              </span>
            </div>
          </div>

          {/* Putaway */}
          <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-300 font-medium">Putaway</span>
            <div className="flex items-center gap-1.5">
              <strong className="text-white font-extrabold text-sm">{putawayOps.length}</strong>
              <span className="text-[10px] text-slate-500 font-mono">
                ({putawayOps.filter((o) => o.machineType === "LL").length} LL)
              </span>
            </div>
          </div>

          {/* Outbound */}
          <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-300 font-medium">Outbound</span>
            <div className="flex items-center gap-1.5">
              <strong className="text-white font-extrabold text-sm">{outboundOps.length}</strong>
              <span className="text-[10px] text-slate-500 font-mono">
                ({outboundOps.filter((o) => o.machineType === "RTR").length} RTR)
              </span>
            </div>
          </div>

          {/* VAS */}
          <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-300 font-medium">VAS</span>
            <strong className="text-white font-extrabold text-sm">{vasOps.length}</strong>
          </div>
        </div>
      </div>

      {/* 4. AI BACKGROUND LEARNING PANEL (Collapsible or alert banner) */}
      <div className="bg-gradient-to-r from-indigo-950/60 to-slate-950/80 border border-indigo-800/50 rounded-xl p-3 text-xs text-indigo-200 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 font-bold text-indigo-100">
            <Bot className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>AI inteligence na pozadí:</span>
            <span className="font-normal text-indigo-300">
              Sleduje dlouhodobé pohyby řidičů a automaticky ví, kdo kam jezdí.
            </span>
          </div>

          <div className="flex items-center gap-2">
            {unassignedWaitingOps.length > 0 && onAutoAssignAISuggestions && (
              <button
                type="button"
                onClick={onAutoAssignAISuggestions}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all shadow-2xs active:scale-95"
              >
                <Sparkles className="w-3 h-3" />
                <span>⚡ AI rozřazení ({unassignedWaitingOps.length} nezařazených)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAIDetails((prev) => !prev)}
              className="text-[11px] text-indigo-400 hover:text-indigo-200 underline cursor-pointer"
            >
              {showAIDetails ? "Skrýt detaily AI" : "Zobrazit detaily AI"}
            </button>
          </div>
        </div>

        {/* AI Key Rule Highlight */}
        <div className="text-[11px] text-indigo-300/90 flex items-center gap-1.5 flex-wrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            {transportPnOps.length > 0 ? (
              <span>
                <strong>{transportPnOps.length} operátorů na PN</strong> bylo na základě historie
                směn automaticky započteno pod <strong>Tým Transport</strong>.
              </span>
            ) : (
              <span>
                Všichni řidiči na PN / absenci jsou podle své jízdní historie automaticky
                přiřazováni pod svůj tým (Transport vs VNA).
              </span>
            )}
          </span>
        </div>

        {/* Detailed Drawer when clicked */}
        {showAIDetails && (
          <div className="pt-2 border-t border-indigo-900/60 space-y-2 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="font-bold text-white block">Jak AI model funguje:</span>
                <p className="text-slate-300">
                  Model průběžně analyzuje každé přesunutí na webu, frekvenci strojů (LL / RTR) a
                  směny. Pokud operátor jezdí převážně HOVS, Putaway, Outbound nebo VAS, AI si jej
                  pamatuje jako <strong>Transport</strong>. Při PN jej proto systém nikdy neztratí
                  ani nepřiřadí jinam.
                </p>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="font-bold text-white block">Stav naučených dat:</span>
                <div className="text-slate-300 space-y-0.5">
                  <div>
                    Celkem sledovaných operátorů v AI paměti:{" "}
                    <strong className="text-white">{learnedProfilesCount}</strong>
                  </div>
                  <div>
                    Poslední zaznamenaná AI událost:{" "}
                    <span className="text-indigo-300">
                      {recentAIEvents[0]?.details || "Průběžné sledování aktivní"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
