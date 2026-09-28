import React, { useState } from "react";
import { RotateCcw, AlertTriangle, X, CheckCircle2, Users, ShieldAlert } from "lucide-react";
import { ShiftCode } from "../types";

interface ResetShiftModalProps {
  isOpen: boolean;
  activeShift: ShiftCode;
  totalPermanentCount: number;
  vnaCount: number;
  absenceCount: number;
  onClose: () => void;
  onConfirmReset: (options: { excludeVna: boolean; keepAbsences: boolean }) => void;
}

export const ResetShiftModal: React.FC<ResetShiftModalProps> = ({
  isOpen,
  activeShift,
  totalPermanentCount,
  vnaCount,
  absenceCount,
  onClose,
  onConfirmReset,
}) => {
  const [excludeVna, setExcludeVna] = useState(true);
  const [keepAbsences, setKeepAbsences] = useState(false);

  if (!isOpen) return null;

  const operatorsToResetCount =
    totalPermanentCount - (excludeVna ? vnaCount : 0) - (keepAbsences ? absenceCount : 0);

  return (
    <div
      id="reset-shift-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="reset-shift-modal-card"
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Zavřít"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-800 shadow-xs">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div className="space-y-1 pr-6">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                Resetovat směnu {activeShift} (Začátek směny)
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Příprava pro novou směnu. Všichni vaši stálí operátoři se přesunou do{" "}
              <strong>kmenového přehledu</strong> bez přiřazeného oddělení k novému rozdělení.
            </p>
          </div>
        </div>

        {/* Important Info Card */}
        <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl space-y-2 text-xs text-blue-950 dark:text-blue-200">
          <div className="flex items-center gap-2 font-bold text-blue-900 dark:text-blue-100">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>Stálý stav operátorů zůstane 100% zachován:</span>
          </div>
          <p className="text-blue-800 dark:text-blue-300">
            Kmenový počet (<strong>{totalPermanentCount} operátorů</strong>) se nezmění. Žádný
            člověk nebude z firmy smazán. Po resetu jim postupně přidělíte pozice – jakmile operátor
            dostane oddělení nebo absenci, z rozřazovací tabulky sám zmizí.
          </p>
        </div>

        {/* Configuration Options */}
        <div className="space-y-2.5 pt-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Možnosti resetu směny:
          </span>

          {/* VNA Option */}
          <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors cursor-pointer select-none">
            <input
              type="checkbox"
              checked={excludeVna}
              onChange={(e) => setExcludeVna(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="text-xs space-y-0.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                <span>Ponechat VNA operátory beze změny ({vnaCount} lidí)</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-800">
                  Druhý Team Leader
                </span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                Doporučeno. VNA spravuje druhý mistr – tito operátoři zůstanou na svých pozicích a
                nebudou se míchat do vašeho rozřazení.
              </p>
            </div>
          </label>

          {/* Absence Option */}
          <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors cursor-pointer select-none">
            <input
              type="checkbox"
              checked={keepAbsences}
              onChange={(e) => setKeepAbsences(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="text-xs space-y-0.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                <span>Ponechat zadané absence ({absenceCount} lidí)</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                Ponechá pracovníky na schválené dovolené či PN. Nemusíte je znovu zadávat.
              </p>
            </div>
          </label>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Přesunout k přiřazení:{" "}
            <strong className="text-slate-900 dark:text-white font-bold">
              {operatorsToResetCount} operátorů
            </strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
            >
              Zrušit
            </button>
            <button
              type="button"
              id="confirm-reset-shift-btn"
              onClick={() => {
                onConfirmReset({ excludeVna, keepAbsences });
                onClose();
              }}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Resetovat směnu {activeShift}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
