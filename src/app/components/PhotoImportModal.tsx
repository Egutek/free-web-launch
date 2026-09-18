import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Upload,
  Camera,
  FileText,
  Sparkles,
  Check,
  AlertCircle,
  Trash2,
  Plus,
  Lock,
  ArrowRight,
  HelpCircle,
  RefreshCw,
  Image as ImageIcon,
  Sliders,
  RotateCw,
  Crop,
  Wand2,
  Sun,
  Contrast,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  SplitSquareVertical,
  Columns,
  ShieldAlert,
  CheckSquare,
  Square,
  Brain,
  RotateCcw,
} from "lucide-react";
import { DepartmentId, MachineType, Operator, AbsenceReason } from "../types";
import { DEPARTMENTS, getDepartmentById } from "../data/departments";
import {
  extractOperatorsFn,
  isProblemSolver,
  isTopAbsenceOrAbsent,
  isCategoryHeader,
  FilteredOutRecord,
} from "../services/aiServerFn";
import {
  ImageAdjustments,
  DEFAULT_ADJUSTMENTS,
  WHITEBOARD_PRESET,
  LOW_QUALITY_DARK_PRESET,
  HIGH_CONTRAST_PRESET,
  GRAYSCALE_PRESET,
  applyImageAdjustments,
} from "../utils/imagePreprocessing";
import { subscribeToOcrInstructions, syncOcrInstructionsToCloud } from "../services/firestoreSync";

export const DEFAULT_CUSTOM_OCR_INSTRUCTIONS = `1. Všechny osoby vlevo nahoře pod absencí (pod nápisy Absence, Dovolená, D, PN, Nemoc, NV, OČR nebo zkratkami oddělení např. HOVC - Novák D, Svoboda PN) VŽDY načti a zařaď do nabídky absencí.
2. Operátoři přiřazení na HOVS mají mít po nahrání výchozí stroj LL (pokud není výslovně napsáno RTR).
3. Operátoři na oddělení HOVC a OBWI mají mít výchozí stroj RTR (pokud není výslovně napsáno LL).
4. Pro oddělení VNA nenastavuj žádný stroj (NONE).
5. Kódy vozíků (např. V47, V107) uveď do poznámky.`;

interface PhotoImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportOperators: (
    newOperators: Operator[],
    replaceAll: boolean,
    omittedCandidates?: FilteredOutRecord[],
  ) => void;
  currentCount: number;
}

interface DraftOperator {
  tempId: string;
  name: string;
  machineType: MachineType;
  departmentId: DepartmentId;
  notes?: string;
  absenceReason?: AbsenceReason;
}

export const PhotoImportModal: React.FC<PhotoImportModalProps> = ({
  isOpen,
  onClose,
  onImportOperators,
  currentCount,
}) => {
  const [activeTab, setActiveTab] = useState<"photo" | "text">("photo");
  const [rawSourceImage, setRawSourceImage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>("image/jpeg");
  const [imageFileName, setImageFileName] = useState<string>("");
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(WHITEBOARD_PRESET);
  const [activePreset, setActivePreset] = useState<
    "whiteboard" | "dark" | "contrast" | "grayscale" | "original" | "custom"
  >("whiteboard");
  const [showManualControls, setShowManualControls] = useState<boolean>(false);
  const [isProcessingCanvas, setIsProcessingCanvas] = useState<boolean>(false);

  const [rawText, setRawText] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extractedList, setExtractedList] = useState<DraftOperator[]>([]);
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [filteredOutList, setFilteredOutList] = useState<FilteredOutRecord[]>([]);
  const [showFilteredDetails, setShowFilteredDetails] = useState<boolean>(true);
  const [replaceAll, setReplaceAll] = useState<boolean>(true);

  // Custom OCR instructions with memory (cloud + local storage)
  const [customInstructions, setCustomInstructions] = useState<string>(() => {
    return localStorage.getItem("zf_custom_ocr_instructions") || DEFAULT_CUSTOM_OCR_INSTRUCTIONS;
  });
  const [showCustomInstructions, setShowCustomInstructions] = useState<boolean>(false);
  const [instructionsSavedNotice, setInstructionsSavedNotice] = useState<boolean>(false);

  useEffect(() => {
    const unsub = subscribeToOcrInstructions((cloudVal) => {
      if (cloudVal && cloudVal.trim()) {
        setCustomInstructions(cloudVal);
        localStorage.setItem("zf_custom_ocr_instructions", cloudVal);
      }
    });
    return () => {
      unsub();
    };
  }, []);

  const handleSaveCustomInstructions = (newVal?: string) => {
    const valToSave = newVal !== undefined ? newVal : customInstructions;
    localStorage.setItem("zf_custom_ocr_instructions", valToSave);
    syncOcrInstructionsToCloud(valToSave);
    setInstructionsSavedNotice(true);
    setTimeout(() => setInstructionsSavedNotice(false), 3000);
  };

  const handleResetCustomInstructions = () => {
    setCustomInstructions(DEFAULT_CUSTOM_OCR_INSTRUCTIONS);
    handleSaveCustomInstructions(DEFAULT_CUSTOM_OCR_INSTRUCTIONS);
  };

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Recalculate canvas when raw image or adjustments change
  const updateProcessedImage = useCallback(async (sourceUrl: string, adj: ImageAdjustments) => {
    setIsProcessingCanvas(true);
    try {
      const enhanced = await applyImageAdjustments(sourceUrl, adj);
      setSelectedImage(enhanced);
    } catch (e) {
      console.error("Canvas preprocessing failed:", e);
      setSelectedImage(sourceUrl);
    } finally {
      setIsProcessingCanvas(false);
    }
  }, []);

  useEffect(() => {
    if (rawSourceImage) {
      updateProcessedImage(rawSourceImage, adjustments);
    }
  }, [rawSourceImage, adjustments, updateProcessedImage]);

  if (!isOpen) return null;

  const clearImage = () => {
    setRawSourceImage(null);
    setSelectedImage(null);
    setImageFileName("");
    setErrorMessage(null);
    setAdjustments(WHITEBOARD_PRESET);
    setActivePreset("whiteboard");
    setShowManualControls(false);
    setFilteredOutList([]);
    setShowFilteredDetails(false);
  };

  const processAndSetImage = (file: File) => {
    setImageFileName(file.name);
    setImageMime("image/jpeg");
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const originalDataUrl = ev.target?.result as string;
      if (!originalDataUrl) return;
      setRawSourceImage(originalDataUrl);
      setAdjustments(DEFAULT_ADJUSTMENTS);
      setActivePreset("original");
    };
    reader.readAsDataURL(file);
  };

  const handleApplyPreset = (
    type: "whiteboard" | "dark" | "contrast" | "grayscale" | "original",
  ) => {
    setActivePreset(type);
    if (type === "whiteboard") {
      setAdjustments((prev) => ({
        ...WHITEBOARD_PRESET,
        rotation: prev.rotation,
        crop: prev.crop,
      }));
    } else if (type === "dark") {
      setAdjustments((prev) => ({
        ...LOW_QUALITY_DARK_PRESET,
        rotation: prev.rotation,
        crop: prev.crop,
      }));
    } else if (type === "contrast") {
      setAdjustments((prev) => ({
        ...HIGH_CONTRAST_PRESET,
        rotation: prev.rotation,
        crop: prev.crop,
      }));
    } else if (type === "grayscale") {
      setAdjustments((prev) => ({
        ...GRAYSCALE_PRESET,
        rotation: prev.rotation,
        crop: prev.crop,
      }));
    } else if (type === "original") {
      setAdjustments((prev) => ({
        ...DEFAULT_ADJUSTMENTS,
        rotation: prev.rotation,
        crop: prev.crop,
      }));
    }
  };

  const handleRotate = () => {
    setAdjustments((prev) => ({
      ...prev,
      rotation: ((prev.rotation + 90) % 360) as 0 | 90 | 180 | 270,
    }));
  };

  const handleCropPreset = (type: "all" | "left" | "right") => {
    if (type === "all") {
      setAdjustments((prev) => ({
        ...prev,
        crop: { x: 0, y: 0, width: 100, height: 100 },
      }));
    } else if (type === "left") {
      setAdjustments((prev) => ({
        ...prev,
        crop: { x: 0, y: 0, width: 52, height: 100 },
      }));
    } else if (type === "right") {
      setAdjustments((prev) => ({
        ...prev,
        crop: { x: 48, y: 0, width: 52, height: 100 },
      }));
    }
  };

  const handleManualAdjustmentChange = (patch: Partial<ImageAdjustments>) => {
    setActivePreset("custom");
    setAdjustments((prev) => ({ ...prev, ...patch }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    processAndSetImage(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processAndSetImage(file);
  };

  const triggerAnalysis = async () => {
    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const payload: {
        imageBase64?: string;
        mimeType?: string;
        textInput?: string;
        customInstructions?: string;
      } = {
        customInstructions: customInstructions.trim() || undefined,
      };
      if (activeTab === "photo") {
        if (!rawSourceImage && !selectedImage) {
          throw new Error("Vyberte prosím fotografii nebo vložte text se jmény.");
        }

        // Perform guaranteed fresh canvas preprocessing (grayscale, contrast, levels) before sending to OCR
        let finalImageBase64 = selectedImage;
        if (rawSourceImage) {
          finalImageBase64 = await applyImageAdjustments(rawSourceImage, adjustments);
          setSelectedImage(finalImageBase64);
        }

        payload.imageBase64 = finalImageBase64 || undefined;
        payload.mimeType = imageMime;
      } else if (activeTab === "text" && rawText.trim()) {
        payload.textInput = rawText.trim();
      } else {
        throw new Error("Vyberte prosím fotografii nebo vložte text se jmény.");
      }

      const data = (await extractOperatorsFn({ data: payload })) as {
        operators?: Array<{
          name: string;
          machineType: "LL" | "RTR" | "NONE";
          departmentId: string;
          notes?: string;
        }>;
        filteredOut?: FilteredOutRecord[];
      };

      const accumulatedFilteredOut: FilteredOutRecord[] = [...(data.filteredOut || [])];
      const validOps: Array<{
        name: string;
        machineType: "LL" | "RTR" | "NONE";
        departmentId: string;
        notes?: string;
      }> = [];

      // Second client-side safety filter pass
      for (const op of data.operators || []) {
        const name = op.name || "";
        const notes = op.notes || "";
        const dept = op.departmentId || "";

        if (isCategoryHeader(name)) {
          accumulatedFilteredOut.push({
            name,
            reason: "header_or_invalid",
            detail: "Záhlaví nebo název kategorie",
          });
          continue;
        }

        if (isProblemSolver(name, notes, dept)) {
          accumulatedFilteredOut.push({
            name,
            reason: "problem_solver",
            detail: "Kategorie Problem Solver",
          });
          continue;
        }

        if (isTopAbsenceOrAbsent(name, notes, dept)) {
          accumulatedFilteredOut.push({
            name,
            reason: "top_absence",
            detail: "Horní lišta absencí / nepřítomnost na směně",
          });
          continue;
        }

        validOps.push(op);
      }

      // Deduplicate filtered out candidates (preserves first occurrence)
      const seenFiltered = new Set<string>();
      const dedupedFilteredOut: FilteredOutRecord[] = [];
      for (const item of accumulatedFilteredOut) {
        const key = item.name.toLowerCase().trim();
        if (!seenFiltered.has(key)) {
          seenFiltered.add(key);
          dedupedFilteredOut.push(item);
        }
      }

      setFilteredOutList(dedupedFilteredOut);

      if (validOps.length === 0) {
        if (accumulatedFilteredOut.length > 0) {
          // If all names were detected as problem solvers or absences, present them to user as candidates with clear note
          const fallbackDrafts: DraftOperator[] = accumulatedFilteredOut.map((f, idx) => ({
            tempId: `draft-fallback-${Date.now()}-${idx}`,
            name: f.name,
            machineType: "LL",
            departmentId: "hovc",
            notes: `Detekováno v sekci ${f.detail} (zkontrolujte)`,
          }));
          setExtractedList(fallbackDrafts);
          return;
        }
        throw new Error(
          "Na snímku nebyla nalezena žádná jména operátorů. Zkontrolujte kvalitu fotky nebo vložte text.",
        );
      }

      const drafts: DraftOperator[] = validOps.map((op, index: number) => {
        const deptId = (op.departmentId as DepartmentId) || "hovc";
        const rawMachine = String(op.machineType ?? "").toUpperCase();
        const combined = `${String(op.name || "")} ${String(op.notes || "")}`.toUpperCase();
        const hasExplicitLL =
          combined.includes(" LL") ||
          combined.includes("(LL)") ||
          combined.includes("-LL") ||
          combined.includes("NÍZKOZDVIH");
        const hasExplicitRTR = combined.includes("RTR") || combined.includes("RETRAK");

        let mType: "LL" | "RTR" | "NONE" = "LL";
        if (deptId === "vna" || deptId === "unassigned") {
          mType = "NONE";
        } else if (deptId === "hovs") {
          mType = hasExplicitRTR ? "RTR" : "LL";
        } else if (deptId === "hovc" || deptId === "obwi") {
          mType = hasExplicitLL ? "LL" : "RTR";
        } else if (deptId === "putaway") {
          mType = hasExplicitRTR ? "RTR" : "LL";
        } else {
          mType = rawMachine === "RTR" ? "RTR" : rawMachine === "NONE" ? "NONE" : "LL";
        }

        const isAbsence = deptId === "unassigned";
        let detectedReason: AbsenceReason = "Absence";
        if (combined.includes("DOVOLEN")) detectedReason = "Dovolená";
        else if (
          combined.includes("PN") ||
          combined.includes("NEMOC") ||
          combined.includes("NESCHOP")
        )
          detectedReason = "PN";

        return {
          tempId: `draft-${Date.now()}-${index}`,
          name: op.name || `Operátor ${index + 1}`,
          machineType: mType,
          departmentId: deptId,
          notes: op.notes || "Extrahováno ze snímku ZF",
          absenceReason: isAbsence ? detectedReason : undefined,
        };
      });

      setExtractedList(drafts);
    } catch (err: unknown) {
      console.error(err);
      const errObj = err as { message?: string };
      let msg = errObj?.message || "Nastala neočekávaná chyba při vytahování jmen.";
      // Clean JSON if present
      const jsonMatch = msg.match(/\{[\s\S]*"error"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed?.error?.message) msg = parsed.error.message;
        } catch {
          // ignore
        }
      }
      if (/503|high demand|UNAVAILABLE/i.test(msg)) {
        msg =
          "Služba Google Gemini má momentálně vysokou poptávku (kód 503). Zkuste to prosím za pár sekund znovu tlačítkem Zkusit znovu, případně zadejte jména textem.";
      }
      setErrorMessage(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateDraft = (tempId: string, patch: Partial<DraftOperator>) => {
    setExtractedList((prev) =>
      prev.map((item) => (item.tempId === tempId ? { ...item, ...patch } : item)),
    );
  };

  const removeDraft = (tempId: string) => {
    setExtractedList((prev) => prev.filter((item) => item.tempId !== tempId));
    setSelectedDraftIds((prev) => {
      const next = new Set(prev);
      next.delete(tempId);
      return next;
    });
  };

  const toggleSelectDraft = (tempId: string) => {
    setSelectedDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) {
        next.delete(tempId);
      } else {
        next.add(tempId);
      }
      return next;
    });
  };

  const toggleSelectAllDrafts = () => {
    if (selectedDraftIds.size === extractedList.length) {
      setSelectedDraftIds(new Set());
    } else {
      setSelectedDraftIds(new Set(extractedList.map((d) => d.tempId)));
    }
  };

  const handleDeleteSelectedDrafts = () => {
    if (selectedDraftIds.size === 0) return;
    setExtractedList((prev) => prev.filter((d) => !selectedDraftIds.has(d.tempId)));
    setSelectedDraftIds(new Set());
  };

  const handleBulkSetMachineForDrafts = (machine: MachineType) => {
    if (selectedDraftIds.size === 0) return;
    setExtractedList((prev) =>
      prev.map((d) => (selectedDraftIds.has(d.tempId) ? { ...d, machineType: machine } : d)),
    );
  };

  const handleAddFilteredToAbsence = (item: FilteredOutRecord, reason: AbsenceReason) => {
    setExtractedList((prev) => [
      ...prev,
      {
        tempId: `draft-absence-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: item.name,
        machineType: "NONE",
        departmentId: "unassigned",
        notes: item.detail || "Absence z fotky",
        absenceReason: reason,
      },
    ]);
    setFilteredOutList((prev) => prev.filter((f) => f.name !== item.name));
  };

  const handleAddFilteredToDept = (item: FilteredOutRecord, deptId: DepartmentId = "hovc") => {
    setExtractedList((prev) => [
      ...prev,
      {
        tempId: `draft-dept-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: item.name,
        machineType:
          deptId === "hovs"
            ? "LL"
            : deptId === "hovc" || deptId === "obwi"
              ? "RTR"
              : deptId === "vna" || deptId === "unassigned"
                ? "NONE"
                : "LL",
        departmentId: deptId,
        notes: item.detail,
        absenceReason: deptId === "unassigned" ? "Absence" : undefined,
      },
    ]);
    setFilteredOutList((prev) => prev.filter((f) => f.name !== item.name));
  };

  const handleAddAllFilteredToAbsence = (forcedReason?: AbsenceReason) => {
    if (filteredOutList.length === 0) return;
    const newDrafts: DraftOperator[] = filteredOutList.map((item, idx) => {
      let reason: AbsenceReason = forcedReason || "Absence";
      if (!forcedReason) {
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
      }
      return {
        tempId: `draft-all-abs-${Date.now()}-${idx}`,
        name: item.name,
        machineType: "NONE",
        departmentId: "unassigned",
        notes: item.detail,
        absenceReason: reason,
      };
    });
    setExtractedList((prev) => [...prev, ...newDrafts]);
    setFilteredOutList([]);
  };

  const addNewRow = () => {
    setExtractedList((prev) => [
      ...prev,
      {
        tempId: `draft-${Date.now()}-${prev.length + 1}`,
        name: "Nový Operátor",
        machineType: "LL",
        departmentId: "hovc",
        notes: "Ručně přidáno",
      },
    ]);
  };

  const handleApply = () => {
    if (extractedList.length === 0) return;

    const finalOps: Operator[] = extractedList.map((draft, idx) => ({
      id: `op-imported-${Date.now()}-${idx + 1}`,
      name: draft.name.trim(),
      machineType: draft.departmentId === "unassigned" ? "NONE" : draft.machineType,
      departmentId: draft.departmentId,
      isVnaOnly: false,
      status: draft.departmentId === "unassigned" ? "absence" : "active",
      absenceReason:
        draft.departmentId === "unassigned" ? draft.absenceReason || "Absence" : undefined,
      notes: draft.notes,
      lastMovedAt: new Date().toISOString(),
    }));

    onImportOperators(finalOps, replaceAll, filteredOutList);
    onClose();
  };

  return (
    <div
      id="photo-import-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="photo-import-modal-dialog"
        className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Vytáhnout jména operátorů z fotek / rozpisu
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automaticky načte jména, kvalifikaci LL / RTR a zařazení do oddělení PICK
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Step 1: Input source */}
          {extractedList.length === 0 ? (
            <div className="space-y-4">
              {/* Tab selector */}
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl max-w-md">
                <button
                  type="button"
                  onClick={() => setActiveTab("photo")}
                  className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                    activeTab === "photo"
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>Fotka / Snímek docházky</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("text")}
                  className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                    activeTab === "text"
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Vložit textem / Excel</span>
                </button>
              </div>

              {/* Tab 1: Photo upload */}
              {activeTab === "photo" && (
                <div className="space-y-3.5">
                  {/* Hidden inputs: Gallery (photo library/file picker without capture) and Camera (with capture) */}
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {/* Dual Action Buttons: Gallery & Camera */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      id="select-from-gallery-btn"
                      onClick={() => galleryInputRef.current?.click()}
                      className="py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 hover:bg-blue-100 dark:hover:bg-blue-900/60 flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer active:scale-[0.99]"
                    >
                      <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>Vybrat z galerie / souborů</span>
                    </button>
                    <button
                      type="button"
                      id="take-photo-btn"
                      onClick={() => cameraInputRef.current?.click()}
                      className="py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700/80 flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer active:scale-[0.99]"
                    >
                      <Camera className="w-4 h-4 text-slate-600 dark:text-slate-300 shrink-0" />
                      <span>Vyfotit fotoaparátem</span>
                    </button>
                  </div>

                  {/* Drop / Preview Area */}
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center transition-all flex flex-col items-center justify-center ${
                      selectedImage
                        ? "border-blue-400 bg-blue-50/20 dark:bg-blue-950/10"
                        : "border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:border-blue-400 dark:hover:border-blue-500"
                    }`}
                  >
                    {selectedImage ? (
                      <div className="space-y-4 flex flex-col items-center w-full">
                        {/* Image Canvas Preview */}
                        <div className="relative max-h-60 w-full flex items-center justify-center rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 shadow-sm bg-slate-900/10 dark:bg-black/30 p-1">
                          <img
                            src={selectedImage}
                            alt="Náhled po předzpracování"
                            className="max-h-56 max-w-full object-contain rounded-lg transition-all"
                          />
                          {isProcessingCanvas && (
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center gap-2 text-white text-xs font-semibold">
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Aplikuji vylepšení obrazu...</span>
                            </div>
                          )}

                          {/* Overlay badges for active filters */}
                          <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-600/90 text-white shadow-xs backdrop-blur-xs flex items-center gap-1">
                              <Wand2 className="w-3 h-3" />
                              {activePreset === "whiteboard"
                                ? "Vylepšení tabule (OCR)"
                                : activePreset === "contrast"
                                  ? "Vysoký kontrast"
                                  : activePreset === "grayscale"
                                    ? "Stupně šedé"
                                    : activePreset === "custom"
                                      ? "Vlastní úpravy"
                                      : "Původní snímek"}
                            </span>
                            {adjustments.rotation > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-800/80 text-white shadow-xs">
                                {adjustments.rotation}°
                              </span>
                            )}
                            {(adjustments.crop.width < 100 ||
                              adjustments.crop.x > 0 ||
                              adjustments.crop.height < 100 ||
                              adjustments.crop.y > 0) && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-600/90 text-white shadow-xs flex items-center gap-1">
                                <Crop className="w-2.5 h-2.5" />
                                Ořez aktivní
                              </span>
                            )}
                          </div>
                        </div>

                        {/* File info and ready tag */}
                        <div className="flex flex-col items-center">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-sm">
                            {imageFileName || "Fotka připravena"}
                          </p>
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                            <Check className="w-3 h-3" /> Předzpracováno pomocí Canvas API pro
                            maximální přesnost AI
                          </span>
                        </div>

                        {/* OCR Preprocessing Quick Presets */}
                        <div className="w-full bg-slate-100 dark:bg-slate-800/70 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2.5 text-left">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                              Předzpracování obrazu pro čtení OCR:
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowManualControls(!showManualControls)}
                              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <SlidersHorizontal className="w-3 h-3" />
                              <span>{showManualControls ? "Skrýt posuvníky" : "Ruční ladění"}</span>
                              {showManualControls ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          </div>

                          {/* Presets grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleApplyPreset("whiteboard")}
                              className={`py-1.5 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                activePreset === "whiteboard"
                                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                  : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <Wand2 className="w-3.5 h-3.5" />
                              <span>Vylepšit tabuli</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleApplyPreset("dark")}
                              className={`py-1.5 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                activePreset === "dark"
                                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                  : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <Sun className="w-3.5 h-3.5 text-amber-300" />
                              <span>Tmavá fotka</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleApplyPreset("contrast")}
                              className={`py-1.5 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                activePreset === "contrast"
                                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                  : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <Contrast className="w-3.5 h-3.5" />
                              <span>Vysoký kontrast</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleApplyPreset("grayscale")}
                              className={`py-1.5 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                activePreset === "grayscale"
                                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                  : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>Stupně šedé</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleApplyPreset("original")}
                              className={`py-1.5 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                activePreset === "original"
                                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                  : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                              <span>Původní barvy</span>
                            </button>
                          </div>

                          {/* Quick Crop & Rotate row */}
                          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/70 dark:border-slate-700/60">
                            <span className="text-[10px] font-bold text-slate-500 mr-1">
                              Ořez a rotace:
                            </span>

                            <button
                              type="button"
                              onClick={() => handleCropPreset("all")}
                              className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
                                adjustments.crop.width === 100 && adjustments.crop.x === 0
                                  ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                                  : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600"
                              }`}
                            >
                              Celá fotka (100%)
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCropPreset("left")}
                              className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
                                adjustments.crop.width < 100 && adjustments.crop.x === 0
                                  ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                                  : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600"
                              }`}
                            >
                              <Columns className="w-3 h-3" />
                              <span>Levá polovina tabule</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCropPreset("right")}
                              className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
                                adjustments.crop.width < 100 && adjustments.crop.x > 0
                                  ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                                  : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600"
                              }`}
                            >
                              <Columns className="w-3 h-3" />
                              <span>Pravá polovina tabule</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleRotate}
                              className="px-2 py-1 rounded-md text-[11px] font-semibold border bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 flex items-center gap-1 cursor-pointer ml-auto"
                            >
                              <RotateCw className="w-3 h-3 text-slate-500" />
                              <span>Otočit +90°</span>
                            </button>
                          </div>

                          {/* Expandable Manual Fine-Tuning Sliders */}
                          {showManualControls && (
                            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-3 bg-white/60 dark:bg-slate-900/40 p-3 rounded-lg mt-1">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Contrast slider */}
                                <div>
                                  <div className="flex justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    <span>Zvýšení kontrastu</span>
                                    <span className="font-mono text-blue-600">
                                      {adjustments.contrast > 0
                                        ? `+${adjustments.contrast}`
                                        : adjustments.contrast}
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min="-40"
                                    max="100"
                                    value={adjustments.contrast}
                                    onChange={(e) =>
                                      handleManualAdjustmentChange({
                                        contrast: Number(e.target.value),
                                      })
                                    }
                                    className="w-full accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                                  />
                                </div>

                                {/* Brightness slider */}
                                <div>
                                  <div className="flex justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    <span>Jas / prosvětlení tabule</span>
                                    <span className="font-mono text-blue-600">
                                      {adjustments.brightness > 0
                                        ? `+${adjustments.brightness}`
                                        : adjustments.brightness}
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min="-50"
                                    max="50"
                                    value={adjustments.brightness}
                                    onChange={(e) =>
                                      handleManualAdjustmentChange({
                                        brightness: Number(e.target.value),
                                      })
                                    }
                                    className="w-full accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                                  />
                                </div>
                              </div>

                              {/* Toggles */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={adjustments.grayscale}
                                    onChange={(e) =>
                                      handleManualAdjustmentChange({ grayscale: e.target.checked })
                                    }
                                    className="w-3.5 h-3.5 text-blue-600 rounded-sm"
                                  />
                                  <span>Stupně šedé</span>
                                </label>

                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={adjustments.autoLevels}
                                    onChange={(e) =>
                                      handleManualAdjustmentChange({ autoLevels: e.target.checked })
                                    }
                                    className="w-3.5 h-3.5 text-blue-600 rounded-sm"
                                  />
                                  <span>Auto vyrovnání úrovní (Auto-levels)</span>
                                </label>

                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={adjustments.shadowRemoval}
                                    onChange={(e) =>
                                      handleManualAdjustmentChange({
                                        shadowRemoval: e.target.checked,
                                      })
                                    }
                                    className="w-3.5 h-3.5 text-blue-600 rounded-sm"
                                  />
                                  <span>Odstranění stínů a nerovnoměrného světla</span>
                                </label>

                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={adjustments.whiteboardBoost}
                                    onChange={(e) =>
                                      handleManualAdjustmentChange({
                                        whiteboardBoost: e.target.checked,
                                      })
                                    }
                                    className="w-3.5 h-3.5 text-blue-600 rounded-sm"
                                  />
                                  <span>Čištění pozadí tabule</span>
                                </label>

                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={adjustments.sharpen}
                                    onChange={(e) =>
                                      handleManualAdjustmentChange({ sharpen: e.target.checked })
                                    }
                                    className="w-3.5 h-3.5 text-blue-600 rounded-sm"
                                  />
                                  <span>Zostření textu fixy</span>
                                </label>
                              </div>

                              {/* Fine Crop controls */}
                              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                                  Ruční oříznutí okrajů tabule (%):
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  <div>
                                    <span className="text-[10px] text-slate-500 block mb-0.5">
                                      Zleva ({adjustments.crop.x}%)
                                    </span>
                                    <input
                                      type="range"
                                      min="0"
                                      max="45"
                                      value={adjustments.crop.x}
                                      onChange={(e) => {
                                        const newX = Number(e.target.value);
                                        const newW = Math.max(
                                          20,
                                          100 -
                                            newX -
                                            (100 - (adjustments.crop.x + adjustments.crop.width)),
                                        );
                                        handleManualAdjustmentChange({
                                          crop: { ...adjustments.crop, x: newX, width: newW },
                                        });
                                      }}
                                      className="w-full accent-blue-600 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                                    />
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-500 block mb-0.5">
                                      Zprava ({100 - (adjustments.crop.x + adjustments.crop.width)}
                                      %)
                                    </span>
                                    <input
                                      type="range"
                                      min="0"
                                      max="45"
                                      value={100 - (adjustments.crop.x + adjustments.crop.width)}
                                      onChange={(e) => {
                                        const rightMargin = Number(e.target.value);
                                        const newW = Math.max(
                                          20,
                                          100 - adjustments.crop.x - rightMargin,
                                        );
                                        handleManualAdjustmentChange({
                                          crop: { ...adjustments.crop, width: newW },
                                        });
                                      }}
                                      className="w-full accent-blue-600 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                                    />
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-500 block mb-0.5">
                                      Shora ({adjustments.crop.y}%)
                                    </span>
                                    <input
                                      type="range"
                                      min="0"
                                      max="45"
                                      value={adjustments.crop.y}
                                      onChange={(e) => {
                                        const newY = Number(e.target.value);
                                        const newH = Math.max(
                                          20,
                                          100 -
                                            newY -
                                            (100 - (adjustments.crop.y + adjustments.crop.height)),
                                        );
                                        handleManualAdjustmentChange({
                                          crop: { ...adjustments.crop, y: newY, height: newH },
                                        });
                                      }}
                                      className="w-full accent-blue-600 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                                    />
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-500 block mb-0.5">
                                      Zdola ({100 - (adjustments.crop.y + adjustments.crop.height)}
                                      %)
                                    </span>
                                    <input
                                      type="range"
                                      min="0"
                                      max="45"
                                      value={100 - (adjustments.crop.y + adjustments.crop.height)}
                                      onChange={(e) => {
                                        const bottomMargin = Number(e.target.value);
                                        const newH = Math.max(
                                          20,
                                          100 - adjustments.crop.y - bottomMargin,
                                        );
                                        handleManualAdjustmentChange({
                                          crop: { ...adjustments.crop, height: newH },
                                        });
                                      }}
                                      className="w-full accent-blue-600 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Bottom action bar */}
                        <div className="flex items-center gap-2 pt-1 flex-wrap justify-center">
                          <button
                            type="button"
                            onClick={() => galleryInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                            <span>Změnit fotku</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5 text-slate-500" />
                            <span>Vyfotit znovu</span>
                          </button>
                          <button
                            type="button"
                            onClick={clearImage}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Odebrat</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => galleryInputRef.current?.click()}
                        className="cursor-pointer flex flex-col items-center py-2 w-full"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                          <Upload className="w-7 h-7" />
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">
                          Přetáhněte sem fotku nebo klikněte pro výběr
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-md">
                          Vyberte obrázek z galerie telefonu, screenshot ze SAP/Excelu nebo soubor z
                          počítače.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Text input */}
              {activeTab === "text" && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Vložte jména operátorů (jméno na řádek):
                  </label>
                  <textarea
                    rows={7}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={`Příklad:\nPetr Novák (LL) - Outbound\nJan Svoboda RTR VNA\nMilan Dvořák - Putaway\nTomáš Kučera RTR HOVS`}
                    className="w-full text-xs sm:text-sm font-mono p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                  <p className="text-[11px] text-slate-500">
                    Můžete zkopírovat sloupce z Excelu nebo zprávy. Systém automaticky rozpozná
                    jména, stroje (LL/RTR) i oddělení.
                  </p>
                </div>
              )}

              {errorMessage && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                    <div>
                      <span className="font-semibold">Chyba rozpoznání: </span>
                      {errorMessage}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {activeTab === "photo" && (
                      <button
                        type="button"
                        onClick={() => setActiveTab("text")}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                      >
                        Vložit textem
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={triggerAnalysis}
                      disabled={isAnalyzing}
                      className="px-3 py-1 text-xs font-bold rounded-lg text-white bg-rose-600 hover:bg-rose-500 flex items-center gap-1.5 shadow-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
                      <span>Zkusit znovu</span>
                    </button>
                  </div>
                </div>
              )}

              {/* AI Instructions & Rules with Memory (stored in cloud & local) */}
              <div className="border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/70 to-blue-50/50 dark:from-indigo-950/30 dark:to-slate-900/40 rounded-2xl p-3.5 transition-all shadow-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowCustomInstructions(!showCustomInstructions)}
                    className="flex items-center gap-2 text-left group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      <Brain className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-black text-indigo-950 dark:text-indigo-200">
                          Příkazy a trvalá paměť pro AI (OCR)
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          Cloudová paměť
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Zadání instrukcí pro OCR přímo na webu – bez nutnosti nového nasazování
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2">
                    {instructionsSavedNotice && (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in">
                        <Check className="w-3.5 h-3.5" />
                        <span>Uloženo v paměti</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowCustomInstructions(!showCustomInstructions)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800/80 hover:bg-indigo-50 dark:hover:bg-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showCustomInstructions ? "Skrýt" : "Upravit pravidla"}</span>
                      {showCustomInstructions ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {showCustomInstructions && (
                  <div className="mt-3 pt-3 border-t border-indigo-100 dark:border-indigo-900/50 space-y-2.5">
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      Zde můžete AI modelu zadat libovolná specifická pravidla (např. které sekce
                      tabule číst, výchozí stroje pro oddělení, co zařadit do absencí). Pokyny se
                      ukládají do databáze a AI je dostane s <strong>nejvyšší prioritou</strong>.
                    </div>

                    <textarea
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      rows={5}
                      placeholder="Zadejte pravidla pro AI model..."
                      className="w-full text-xs font-mono p-3 rounded-xl border border-indigo-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 resize-y"
                    />

                    <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                          Rychlé přidání:
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const snippet =
                              "\n- Všechny osoby vlevo nahoře pod absencí VŽDY uveď v seznamu absencí.";
                            if (!customInstructions.includes("vlevo nahoře")) {
                              const next = customInstructions + snippet;
                              setCustomInstructions(next);
                              handleSaveCustomInstructions(next);
                            }
                          }}
                          className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          + Lidé pod absencí vlevo nahoře
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const snippet =
                              "\n- Operátoři na HOVS mají mít výchozí stroj LL (pokud není výslovně napsáno RTR).";
                            if (!customInstructions.includes("HOVS mají mít výchozí")) {
                              const next = customInstructions + snippet;
                              setCustomInstructions(next);
                              handleSaveCustomInstructions(next);
                            }
                          }}
                          className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          + HOVS výchozí LL
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleResetCustomInstructions}
                          className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                          title="Vrátit na výchozí osvědčená pravidla"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSaveCustomInstructions()}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-transform"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Uložit do paměti</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  id="start-extraction-btn"
                  onClick={triggerAnalysis}
                  disabled={
                    isAnalyzing ||
                    (activeTab === "photo" && !selectedImage) ||
                    (activeTab === "text" && !rawText.trim())
                  }
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Gemini analyzuje snímek a čte jména...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Vytáhnout jména operátorů</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Step 2: Review and edit extracted list */
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Nalezeno {extractedList.length} operátorů</span>
                    <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                      Připraveno ke kontrole
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Zkontrolujte jména, zařazení do oddělení a stroje (LL / RTR) před importem.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCustomInstructions(!showCustomInstructions)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                    title="Upravit paměť pravidel pro AI"
                  >
                    <Brain className="w-3.5 h-3.5" />
                    <span>Pravidla AI</span>
                  </button>

                  <button
                    onClick={addNewRow}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Přidat řádek</span>
                  </button>

                  <button
                    onClick={() => {
                      setExtractedList([]);
                      setFilteredOutList([]);
                      setShowFilteredDetails(false);
                      setSelectedImage(null);
                      setRawText("");
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    <span>Nahrát jinou fotku</span>
                  </button>
                </div>
              </div>

              {/* Collapsible custom instructions editor in Step 2 */}
              {showCustomInstructions && (
                <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                      <Brain className="w-4 h-4 text-indigo-600" />
                      Pravidla a paměť pro AI (OCR):
                    </span>
                    {instructionsSavedNotice && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                        Uloženo v cloudu!
                      </span>
                    )}
                  </div>
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    rows={4}
                    className="w-full text-xs font-mono p-2.5 rounded-lg border border-indigo-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 resize-y"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveCustomInstructions()}
                      className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Uložit pravidla
                    </button>
                  </div>
                </div>
              )}

              {/* Section with auto-filtered entries (Problem Solver & Top Absences) */}
              {filteredOutList.length > 0 && (
                <div className="p-3.5 bg-amber-50/95 dark:bg-amber-950/40 border-2 border-amber-300/80 dark:border-amber-700/80 rounded-2xl text-xs text-amber-950 dark:text-amber-100 shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-black text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                          Vynechaní pracovníci / Zjištěné absence ({filteredOutList.length})
                        </h4>
                        <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                          Lidé z horní lišty absencí nebo Problem Solver. Kliknutím je zařadíte pod
                          správný důvod:
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleAddAllFilteredToAbsence()}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-2xs flex items-center gap-1 cursor-pointer transition-transform active:scale-95"
                        title="Přidat všechny do seznamu se zjištěným důvodem (Absence/PN/Dovolená)"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>⚡ Přidat všechny do absencí</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowFilteredDetails(!showFilteredDetails)}
                        className="p-1.5 rounded-lg text-amber-800 dark:text-amber-200 hover:bg-amber-200/50 dark:hover:bg-amber-800/40 cursor-pointer"
                        title={showFilteredDetails ? "Sbalit" : "Rozbalit"}
                      >
                        {showFilteredDetails ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {showFilteredDetails && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-1.5 flex-wrap pb-1 border-b border-amber-200/60 dark:border-amber-800/60">
                        <span className="text-[10px] font-bold uppercase text-amber-800/70 dark:text-amber-400">
                          Hromadně:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddAllFilteredToAbsence("Absence")}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 cursor-pointer"
                        >
                          Vše jako Absence
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddAllFilteredToAbsence("Dovolená")}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-700 hover:bg-sky-200 cursor-pointer"
                        >
                          Vše jako Dovolená
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddAllFilteredToAbsence("PN")}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700 hover:bg-rose-200 cursor-pointer"
                        >
                          Vše jako PN
                        </button>
                      </div>

                      <div className="max-h-52 overflow-y-auto divide-y divide-amber-200/50 dark:divide-amber-800/40 pr-1">
                        {filteredOutList.map((item, idx) => (
                          <div
                            key={`filtered-${idx}`}
                            className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-amber-100/40 dark:hover:bg-amber-900/20 px-1 rounded-lg transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-bold text-xs sm:text-sm truncate text-slate-900 dark:text-white">
                                {item.name}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                  item.reason === "problem_solver"
                                    ? "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                    : /dovol/i.test(item.detail)
                                      ? "bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                                      : /pn|nemoc/i.test(item.detail)
                                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                }`}
                              >
                                {item.reason === "problem_solver"
                                  ? "Problem Solver (vpravo)"
                                  : /dovol/i.test(item.detail)
                                    ? "Dovolená"
                                    : /pn|nemoc/i.test(item.detail)
                                      ? "PN / Nemoc"
                                      : item.reason === "top_absence" ||
                                          /vlevo|horní/i.test(item.detail)
                                        ? "Absence vlevo nahoře"
                                        : "Absence"}
                              </span>
                              {item.detail && (
                                <span
                                  className="text-[10px] text-amber-900/70 dark:text-amber-400 truncate max-w-[140px] hidden md:inline"
                                  title={item.detail}
                                >
                                  {item.detail}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleAddFilteredToAbsence(item, "Absence")}
                                className="px-2 py-1 rounded text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 border border-amber-400/50 cursor-pointer transition-colors"
                                title="Zařadit pod Absence"
                              >
                                + Absence
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddFilteredToAbsence(item, "Dovolená")}
                                className="px-2 py-1 rounded text-[11px] font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-900 dark:text-sky-200 border border-sky-400/50 cursor-pointer transition-colors"
                                title="Zařadit pod Dovolená"
                              >
                                + Dovolená
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddFilteredToAbsence(item, "PN")}
                                className="px-2 py-1 rounded text-[11px] font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-900 dark:text-rose-200 border border-rose-400/50 cursor-pointer transition-colors"
                                title="Zařadit pod PN (pracovní neschopnost)"
                              >
                                + PN
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddFilteredToDept(item, "hovc")}
                                className="px-2 py-1 rounded text-[11px] font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-900 dark:text-emerald-200 border border-emerald-400/50 cursor-pointer transition-colors"
                                title="Zařadit do směny (HOVC)"
                              >
                                + HOVC
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setFilteredOutList((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="p-1 rounded text-slate-400 hover:text-rose-500 cursor-pointer"
                                title="Vyřadit ze seznamu"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bulk actions bar for selected OCR drafts */}
              {selectedDraftIds.size > 0 && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl flex items-center justify-between gap-2 flex-wrap text-xs animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-rose-900 dark:text-rose-200">
                      Vybráno {selectedDraftIds.size} z {extractedList.length} operátorů
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handleDeleteSelectedDrafts}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-xs flex items-center gap-1.5 cursor-pointer transition-transform active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Smazat vybrané ({selectedDraftIds.size})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkSetMachineForDrafts("LL")}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-800/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 cursor-pointer"
                    >
                      Nastavit všem LL
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkSetMachineForDrafts("RTR")}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/60 dark:hover:bg-blue-800/60 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700 cursor-pointer"
                    >
                      Nastavit všem RTR
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDraftIds(new Set())}
                      className="px-2 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      Zrušit výběr
                    </button>
                  </div>
                </div>
              )}

              {/* Table of extracted operators */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                {/* Table Header with Select All */}
                <div className="p-2.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleSelectAllDrafts}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
                      title={
                        selectedDraftIds.size === extractedList.length
                          ? "Odznačit vše"
                          : "Označit vše pro hromadné smazání"
                      }
                    >
                      {selectedDraftIds.size > 0 &&
                      selectedDraftIds.size === extractedList.length ? (
                        <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      ) : selectedDraftIds.size > 0 ? (
                        <CheckSquare className="w-4 h-4 text-slate-500" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                      <span>Vybrat vše ({extractedList.length})</span>
                    </button>
                  </div>

                  <div className="hidden sm:flex items-center gap-4 text-[11px] text-slate-500">
                    <span>Stroj / Důvod</span>
                    <span>Oddělení</span>
                  </div>
                </div>

                {/* Rows */}
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
                  {extractedList.map((item, index) => (
                    <div
                      key={item.tempId}
                      className={`p-2.5 sm:p-3 flex items-center justify-between gap-2.5 transition-colors ${
                        selectedDraftIds.has(item.tempId)
                          ? "bg-rose-50/70 dark:bg-rose-950/30"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <button
                        type="button"
                        onClick={() => toggleSelectDraft(item.tempId)}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                        title="Označit řádek"
                      >
                        {selectedDraftIds.has(item.tempId) ? (
                          <CheckSquare className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                        )}
                      </button>

                      <span className="text-xs font-mono font-bold text-slate-400 w-5 shrink-0 text-center">
                        {index + 1}.
                      </span>

                      {/* Name input */}
                      <div className="flex-1 min-w-[120px]">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateDraft(item.tempId, { name: e.target.value })}
                          className="w-full text-xs sm:text-sm font-semibold px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-transparent focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white"
                        />
                      </div>

                      {/* Machine Type or Absence Reason */}
                      <div className="shrink-0 flex items-center gap-1 justify-center">
                        {item.departmentId === "unassigned" ? (
                          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                            <button
                              type="button"
                              onClick={() => updateDraft(item.tempId, { absenceReason: "Absence" })}
                              className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                                (item.absenceReason || "Absence") === "Absence"
                                  ? "bg-amber-500 text-white shadow-2xs"
                                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                              }`}
                            >
                              Abs
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateDraft(item.tempId, { absenceReason: "Dovolená" })
                              }
                              className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                                item.absenceReason === "Dovolená"
                                  ? "bg-sky-500 text-white shadow-2xs"
                                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                              }`}
                            >
                              Dov
                            </button>
                            <button
                              type="button"
                              onClick={() => updateDraft(item.tempId, { absenceReason: "PN" })}
                              className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                                item.absenceReason === "PN"
                                  ? "bg-rose-500 text-white shadow-2xs"
                                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                              }`}
                            >
                              PN
                            </button>
                          </div>
                        ) : item.departmentId === "vna" ? (
                          <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            VNA
                          </span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateDraft(item.tempId, { machineType: "LL" })}
                              className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${
                                item.machineType === "LL"
                                  ? "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200"
                              }`}
                            >
                              LL
                            </button>
                            <button
                              type="button"
                              onClick={() => updateDraft(item.tempId, { machineType: "RTR" })}
                              className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${
                                item.machineType === "RTR"
                                  ? "bg-blue-100 text-blue-900 dark:bg-blue-900/60 dark:text-blue-200 border border-blue-300 dark:border-blue-700"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200"
                              }`}
                            >
                              RTR
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Department Dropdown */}
                      <div className="shrink-0 w-28 sm:w-36">
                        <select
                          value={item.departmentId}
                          onChange={(e) => {
                            const newDept = e.target.value as DepartmentId;
                            let newMachine = item.machineType;
                            let newReason = item.absenceReason;
                            if (newDept === "vna" || newDept === "unassigned") {
                              newMachine = "NONE";
                              if (newDept === "unassigned" && !newReason) newReason = "Absence";
                            } else if (newDept === "hovs") {
                              newMachine = "LL";
                            } else if (
                              (newDept === "hovc" || newDept === "obwi") &&
                              newMachine === "NONE"
                            ) {
                              newMachine = "RTR";
                            } else if (newDept === "putaway" && newMachine === "NONE") {
                              newMachine = "LL";
                            }
                            updateDraft(item.tempId, {
                              departmentId: newDept,
                              machineType: newMachine,
                              absenceReason: newReason,
                            });
                          }}
                          className="w-full text-xs font-medium px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        >
                          {DEPARTMENTS.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Delete row */}
                      <button
                        type="button"
                        onClick={() => removeDraft(item.tempId)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0 cursor-pointer"
                        title="Smazat tohoto operátora ze seznamu"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Replace vs Append choice */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Režim uložení do systému:
                  </span>
                  <div className="flex items-center gap-4 mt-1">
                    <label className="inline-flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="importMode"
                        checked={replaceAll}
                        onChange={() => setReplaceAll(true)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>
                        Nahradit celý tým novým seznamem (přepíše současných {currentCount} lidí)
                      </span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="importMode"
                        checked={!replaceAll}
                        onChange={() => setReplaceAll(false)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Přidat k existujícím operátorům</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Zrušit
          </button>

          {extractedList.length > 0 && (
            <button
              id="confirm-import-btn"
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Použít tyto operátory v aplikaci ({extractedList.length})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
