import { useEffect, useState } from 'react';
import { addOperatorToShift, createShift, moveOperator, moveOperators, movedOnly, returnOperatorsToStart, returnToStart, type ShiftState } from './lib/shifts';
import { exportShift, loadShift, saveShift } from './lib/storage';
import { filterOperators } from './lib/search';
import { type Area, type BoardAnalysisResult, type Detection, type ImageQuality, type ProblemSolver } from './types';
import { analyzeBoardPhoto } from './ocr/pipeline';
import { buildBoardDiagnostics, exportDiagnosticsJson } from './ocr/diagnostics';
import { DebugPanel } from './ocr/debug';
import { duplicates, normalizeName, parseRoster, sanitizeEmployeeCandidate } from './lib/validation';
import { UnusableImageError } from './lib/image';
import { isAutomaticallyConfirmed, isReviewRequired } from './lib/board';
import { loadRoster, saveRoster, type PermanentTeam, type RosterMember, type ShiftCode } from './lib/roster';
import { addDepartment, loadDepartments, renameDepartment, saveDepartments, UNASSIGNED, type Department } from './lib/departments';
import './style.css';

const DEFAULT_ROSTER: RosterMember[] = [{ name: 'NOVAK JAN', team: 'TRANSPORT', shift: 'A' }, { name: 'SVOBODA PETR', team: 'TRANSPORT', shift: 'A' }, { name: 'DVORAK MARTIN', team: 'VNA', shift: 'A' }];

type ReviewDraft = { name: string; area: Exclude<Area, 'UNKNOWN'> | '' };
type AppPage = 'board' | 'roster' | 'import';
type DepartmentDialog = { type: 'rename' | 'remove'; name: string; value: string };

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [rosterMembers, setRosterMembers] = useState<RosterMember[]>(() => loadRoster(DEFAULT_ROSTER));
  const [departments, setDepartments] = useState<Department[]>(loadDepartments);
  const [departmentEntry, setDepartmentEntry] = useState('');
  const [departmentDialog, setDepartmentDialog] = useState<DepartmentDialog | null>(null);
  const [rosterEntry, setRosterEntry] = useState('');
  const [rosterTeam, setRosterTeam] = useState<PermanentTeam>('TRANSPORT');
  const [rosterShift, setRosterShift] = useState<ShiftCode>('A');
  const [problemSolverEntry, setProblemSolverEntry] = useState('');
  const [problemSolverArea, setProblemSolverArea] = useState<ProblemSolver['area']>('TRANSPORT');
  const [analysis, setAnalysis] = useState<BoardAnalysisResult | null>(null);
  const [shift, setShift] = useState<ShiftState | null>(loadShift);
  const [quality, setQuality] = useState<ImageQuality | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [overlayUrl, setOverlayUrl] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('PÅ™ipraveno');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [transportOnly, setTransportOnly] = useState(false);
  const [activePage, setActivePage] = useState<AppPage>('board');
  const [manualName, setManualName] = useState('');
  const [manualArea, setManualArea] = useState<Area>('TRANSPORT');
  const [selectedOperators, setSelectedOperators] = useState<Set<string>>(() => new Set());
  const [bulkArea, setBulkArea] = useState<Area>('TRANSPORT');
  const [draggedOperator, setDraggedOperator] = useState('');
  const [lastShiftBeforeAction, setLastShiftBeforeAction] = useState<ShiftState | null>(null);
  const [confirmBulkAction, setConfirmBulkAction] = useState<'move' | 'return' | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, ReviewDraft>>({});
  const [resolvedRows, setResolvedRows] = useState<Set<number>>(() => new Set());
  const [reviewNotice, setReviewNotice] = useState('');
  const [reviewApproved, setReviewApproved] = useState(false);
  const [problemSolverNames, setProblemSolverNames] = useState<string[]>([]);
  const [problemSolverAreas, setProblemSolverAreas] = useState<ProblemSolver['area'][]>([]);

  useEffect(() => {
    saveShift(shift);
  }, [shift]);

  useEffect(() => { saveRoster(rosterMembers); }, [rosterMembers]);
  useEffect(() => { saveDepartments(departments); }, [departments]);

  const visibleAreas = departments.filter((department) => !department.hidden).map((department) => department.name);
  const occupiedHiddenAreas = [...new Set(shift?.operators.map((operator) => operator.current).filter((area) => !visibleAreas.includes(area)) ?? [])];
  const areas = [...visibleAreas, ...occupiedHiddenAreas];

  const rows = analysis?.detections ?? [];
  const duplicateNames = duplicates(rows);
  const confirmedOperators = (analysis?.assignedOperators ?? []).filter((operator) => isAutomaticallyConfirmed(operator, duplicateNames));
  const reviewRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row, index }) => isReviewRequired(row, duplicateNames) && !resolvedRows.has(index));
  const shiftRoster = rosterMembers.filter((member) => member.shift === rosterShift);
  const roster = shiftRoster.map((member) => member.name).join('\n');
  const rosterNames = shiftRoster.map((member) => member.name);
  const problemSolvers = shift?.problemSolvers ?? [];
  const problemSolverCounts = problemSolvers.reduce((counts, solver) => ({ ...counts, [solver.area]: (counts[solver.area] ?? 0) + 1 }), { TRANSPORT: 0, 'HOVS/ML': 0 } as Record<ProblemSolver['area'], number>);
  const operatorCounts = shift
    ? areas.map((area) => [area, shift.operators.filter((operator) => operator.current === area).length] as const)
      .filter(([, count]) => count > 0)
    : [];
  const diagnostics = analysis
    ? buildBoardDiagnostics(
      [...new Set(rows.map((row) => row.area).filter((area) => area !== 'UNKNOWN'))],
      rows,
      analysis.assignedOperators,
      analysis.review,
      analysis.boardDetected
    )
    : null;

  const fleetLoad = shift ? Math.min(100, Math.round((shift.operators.length / Math.max(1, areas.length)) * 100)) : 0;
  const transportCount = analysis?.assignedOperators.filter((operator) => operator.area === 'TRANSPORT').length ?? 0;
  const reviewQueueSize = analysis?.review.blockingIssues.reduce((sum, issue) => sum + issue.count, 0) ?? 0;
  const riskLevel = reviewQueueSize === 0 ? 'BezpeÄnÄ›' : reviewQueueSize <= 2 ? 'StÅ™ednÃ­' : 'VysokÃ©';

  function getProblemSolvers(): ProblemSolver[] {
    return problemSolverNames.map((name, index) => ({ name, area: problemSolverAreas[index] ?? 'TRANSPORT' }));
  }

  function addRosterEntry(): void {
    const name = sanitizeEmployeeCandidate(rosterEntry);
    if (!name || rosterMembers.some((member) => normalizeName(member.name) === normalizeName(name))) return;
    setRosterMembers((members) => [...members, { name, team: rosterTeam, shift: rosterShift }]);
    setRosterEntry('');
  }

  function removeRosterEntry(name: string): void {
    setRosterMembers((members) => members.filter((member) => normalizeName(member.name) !== normalizeName(name)));
  }

  function setRosterText(value: string): void {
    const current = new Map(shiftRoster.map((member) => [normalizeName(member.name), member.team]));
    setRosterMembers((members) => [...members.filter((member) => member.shift !== rosterShift), ...parseRoster(value).names.map((name) => ({ name, team: current.get(normalizeName(name)) ?? 'TRANSPORT', shift: rosterShift }))]);
  }

  function addProblemSolver(): void {
    const name = sanitizeEmployeeCandidate(problemSolverEntry);
    if (!name || problemSolverNames.some((item) => normalizeName(item) === normalizeName(name)) || rosterMembers.some((member) => normalizeName(member.name) === normalizeName(name))) return;
    setProblemSolverNames((names) => [...names, name]);
    setProblemSolverAreas((areas) => [...areas, problemSolverArea]);
    setProblemSolverEntry('');
  }

  function removeProblemSolver(index: number): void {
    setProblemSolverNames((names) => names.filter((_, itemIndex) => itemIndex !== index));
    setProblemSolverAreas((areas) => areas.filter((_, itemIndex) => itemIndex !== index));
  }

  function addDepartmentEntry(): void {
    const next = addDepartment(departments, departmentEntry);
    if (next === departments) return;
    setDepartments(next);
    setDepartmentEntry('');
  }

  function toggleDepartment(name: string): void { setDepartments((items) => items.map((item) => item.name === name ? { ...item, hidden: !item.hidden } : item)); }

  function confirmDepartmentRename(): void {
    if (!departmentDialog || departmentDialog.type !== 'rename') return;
    const { name, value } = departmentDialog;
    const next = renameDepartment(departments, name, value);
    const renamed = next.find((item) => item.name !== name && !departments.some((current) => current.name === item.name));
    if (next === departments || !renamed) return;
    setDepartments(next);
    setShift((current) => current ? {
      ...current,
      operators: current.operators.map((operator) => ({ ...operator, home: operator.home === name ? renamed.name : operator.home, start: operator.start === name ? renamed.name : operator.start, current: operator.current === name ? renamed.name : operator.current })),
      movements: current.movements.map((movement) => ({ ...movement, from: movement.from === name ? renamed.name : movement.from, to: movement.to === name ? renamed.name : movement.to })),
    } : current);
    setDepartmentDialog(null);
  }

  function confirmDepartmentRemoval(): void {
    if (!departmentDialog || departmentDialog.type !== 'remove') return;
    const { name } = departmentDialog;
    const department = departments.find((item) => item.name === name);
    if (!department || department.protected) return;
    if (shift) {
      setLastShiftBeforeAction(shift);
      const moved = moveOperators(shift, shift.operators.filter((operator) => operator.current === name).map((operator) => operator.name), UNASSIGNED);
      setShift({ ...moved, operators: moved.operators.map((operator) => ({ ...operator, home: operator.home === name ? UNASSIGNED : operator.home, start: operator.start === name ? UNASSIGNED : operator.start })) });
    }
    setDepartments((items) => iwmøßÛh‘éì¶»§q«^uĞñÍÑÉ¥¹œø ¤í½¹ÍĞ½Á•É…Ñ½ÉÌõ…ÍÍ¥¹µ•¹ÑÌ¹™¥±Ñ•È¡àôùí½¹ÍĞ­•äõ¹…µ•-•ä¡à¹¹…µ”¤í¥˜¡Í••¸¹¡…Ì¡­•ä¤¥É•ÑÕÉ¸™…±Í”íÍ••¸¹…‘¡­•ä¤íÉ•ÑÕÉ¸ÑÉÕ•ô¤¹µ…À¡àôø¡í¹…µ”éà¹¹…µ”¹ÑÉ¥´ ¤±¡½µ”éà¹…É•„±ÍÑ…ÉĞéà¹…É•„±ÕÉÉ•¹Ğéà¹…É•…ô¤¤íÉ•ÑÕÉ¹íÍÑ…ÉÑ•‘Ğé¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤±½Á•É…Ñ½ÉÌ±µ½Ù•µ•¹ÑÌémt±ÁÉ½‰±•µM½±Ù•ÉÍõô)•áÁ½ÉĞ™Õ¹Ñ¥½¸…‘‘=Á•É…Ñ½ÉQ½M¡¥™Ğ¡ÍÑ…Ñ”éM¡¥™ÑMÑ…Ñ”±¹…µ”éÍÑÉ¥¹œ±…É•„éÉ•„¤éM¡¥™ÑMÑ…Ñ•í¥˜¡ÍÑ…Ñ”¹½Á•É…Ñ½ÉÌ¹Í½µ”¡½Á•É…Ñ½Èôù¹…µ•-•ä¡½Á•É…Ñ½È¹¹…µ”¤ôôõ¹…µ•-•ä¡¹…µ”¤¤¥É•ÑÕÉ¸ÍÑ…Ñ”íÉ•ÑÕÉ¹ì¸¸¹ÍÑ…Ñ”±½Á•É…Ñ½ÉÌél¸¸¹ÍÑ…Ñ”¹½Á•É…Ñ½ÉÌ±í¹…µ”é¹…µ”¹ÑÉ¥´ ¤±¡½µ”é…É•„±ÍÑ…ÉĞé…É•„±ÕÉÉ•¹Ğé…É•…õuõô)•áÁ½ÉĞ™Õ¹Ñ¥½¸µ½Ù•=Á•É…Ñ½È¡ÍÑ…Ñ”éM¡¥™ÑMÑ…Ñ”±¹…µ”éÍÑÉ¥¹œ±Ñ¼éÉ•„±…Ğõ¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤¤éM¡¥™ÑMÑ…Ñ•í½¹ÍĞ½ÀõÍÑ…Ñ”¹½Á•É…Ñ½ÉÌ¹™¥¹¡àôùà¹¹…µ”ôôõ¹…µ”¤í¥˜ …½Áññ½À¹ÕÉÉ•¹ĞôôõÑ¼¥É•ÑÕÉ¸ÍÑ…Ñ”í½¹ÍĞ™É½´õ½À¹ÕÉÉ•¹ĞíÉ•ÑÕÉ¹ì¸¸¹ÍÑ…Ñ”±½Á•É…Ñ½ÉÌéÍÑ…Ñ”¹½Á•É…Ñ½ÉÌ¹µ…À¡àôùà¹¹…µ”ôôõ¹…µ”ıì¸¸¹à±ÕÉÉ•¹ĞéÑ½ôéà¤±µ½Ù•µ•¹ÑÌél¸¸¹ÍÑ…Ñ”¹µ½Ù•µ•¹ÑÌ±íÁ•ÉÍ½¸é¹…µ”±™É½´±Ñ¼±…Ñõuõô)•áÁ½ÉĞ™Õ¹Ñ¥½¸µ½Ù•=Á•É…Ñ½ÉÌ¡ÍÑ…Ñ”éM¡¥™ÑMÑ…Ñ”±¹…µ•ÌéÍÑÉ¥¹mt±Ñ¼éÉ•„±…Ğõ¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤¤éM¡¥™ÑMÑ…Ñ•í½¹ÍĞÍ•±•Ñ•õ¹•ÜM•Ğ¡¹…µ•Ì¹µ…À¡¹…µ•-•ä¤¤íÉ•ÑÕÉ¸ÍÑ…Ñ”¹½Á•É…Ñ½ÉÌ¹É•‘Õ” ¡ÕÉÉ•¹Ğ±½Á•É…Ñ½È¤ôùÍ•±•Ñ•¹¡…Ì¡¹…µ•-•ä¡½Á•É…Ñ½È¹¹…µ”¤¤ıµ½Ù•=Á•É…Ñ½È¡ÕÉÉ•¹Ğ±½Á•É…Ñ½È¹¹…µ”±Ñ¼±…Ğ¤éÕÉÉ•¹Ğ±ÍÑ…Ñ”¥ô)•áÁ½ÉĞ™Õ¹Ñ¥½¸µ½Ù•‘=¹±ä¡ÌéM¡¥™ÑMÑ…Ñ”¥íÉ•ÑÕÉ¸Ì¹½Á•É…Ñ½ÉÌ¹™¥±Ñ•È¡àôùà¹ÕÉÉ•¹Ğ„ôõà¹ÍÑ…ÉĞ¥ô)•áÁ½ÉĞ™Õ¹Ñ¥½¸…É•…½Õ¹ÑÌ¡ÌéM¡¥™ÑMÑ…Ñ”¥íÉ•ÑÕÉ¸Ì¹½Á•É…Ñ½ÉÌ¹É•‘Õ”ñI•½ÉñÍÑÉ¥¹œ±¹Õµ‰•Èøø ¡„±à¤ôø¡…mà¹ÕÉÉ•¹Ñtô¡…mà¹ÕÉÉ•¹ÑuñğÀ¤¬Ä±„¤±íô¥ô)•áÁ½ÉĞ™Õ¹Ñ¥½¸É•ÑÕÉ¹Q½MÑ…ÉĞ¡ÌéM¡¥™ÑMÑ…Ñ”±¹…µ”éÍÑÉ¥¹œ¥í½¹ÍĞ½ÀõÌ¹½Á•É…Ñ½ÉÌ¹™¥¹¡àôùà¹¹…µ”ôôõ¹…µ”¤íÉ•ÑÕÉ¸½Àıµ½Ù•=Á•É…Ñ½È¡Ì±¹…µ”±½À¹ÍÑ…ÉĞ¤éÍô)•áÁ½ÉĞ™Õ¹Ñ¥½¸É•ÑÕÉ¹=Á•É…Ñ½ÉÍQ½MÑ…ÉĞ¡ÍÑ…Ñ”éM¡¥™ÑMÑ…Ñ”±¹…µ•ÌéÍÑÉ¥¹mt±…Ğõ¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤¤éM¡¥™ÑMÑ…Ñ•í½¹ÍĞÍ•±•Ñ•õ¹•ÜM•Ğ¡¹…µ•Ì¹µ…À¡¹…µ•-•ä¤¤íÉ•ÑÕÉ¸ÍÑ…Ñ”¹½Á•É…Ñ½ÉÌ¹É•‘Õ” ¡ÕÉÉ•¹Ğ±½Á•É…Ñ½È¤ôùÍ•±•Ñ•¹¡…Ì¡¹…µ•-•ä¡½Á•É…Ñ½È¹¹…µ”¤¤ıµ½Ù•=Á•É…Ñ½È¡ÕÉÉ•¹Ğ±½Á•É…Ñ½È¹¹…µ”±½Á•É…Ñ½È¹ÍÑ…ÉĞ±…Ğ¤éÕÉÉ•¹Ğ±ÍÑ…Ñ”¥ô(