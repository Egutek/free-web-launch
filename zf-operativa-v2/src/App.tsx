import { useEffect, useState } from 'react';
import { addOperatorToShift, createShift, moveOperator, moveOperators, movedOnly, returnOperatorsToStart, returnToStart, type ShiftState } from './lib/shifts';
import { exportShift, loadProblemSolvers, loadShift, saveProblemSolvers, saveShift } from './lib/storage';
import { filterOperators } from './lib/search';
import { type Area, type BoardAnalysisResult, type Detection, type ImageQuality, type ProblemSolver } from './types';
import { analyzeBoardPhoto } from './ocr/pipeline';
import { buildBoardDiagnostics, exportDiagnosticsJson } from './ocr/diagnostics';
import { DebugPanel } from './ocr/debug';
import { duplicates, normalizeName, parseRoster, sanitizeEmployeeCandidate } from './lib/validation';
import { UnusableImageError } from './lib/image';
import { isAutomaticallyConfirmed, isReviewRequired } from './lib/board';
import { loadRoster, saveRoster, type PermanentTeam, type RosterMember, type ShiftCode } from './lib/roster';
import { addDepartment, DEFAULT_DEPARTMENTS, loadDepartments, renameDepartment, saveDepartments, UNASSIGNED, type Department } from './lib/departments';
import { resetPilotStorage } from './lib/pilotStorage';
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
  const [resetDialog, setResetDialog] = useState(false);
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
  const [progress, setProgress] = useState('Připraveno');
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
  const [problemSolverNames, setProblemSolverNames] = useState<string[]>(() => loadProblemSolvers().map((solver) => solver.name));
  const [problemSolverAreas, setProblemSolverAreas] = useState<ProblemSolver['area'][]>(() => loadProblemSolvers().map((solver) => solver.area));

  useEffect(() => {
    saveShift(shift);
  }, [shift]);

  useEffect(() => { saveRoster(rosterMembers); }, [rosterMembers]);
  useEffect(() => { saveDepartments(departments); }, [departments]);
  useEffect(() => { saveProblemSolvers(getProblemSolvers()); }, [problemSolverNames, problemSolverAreas]);

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
  const riskLevel = reviewQueueSize === 0 ? 'Bezpečně' : reviewQueueSize <= 2 ? 'Střední' : 'Vysoké';

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
    setDepartments((items) => items.filter((item) => item.name !== name));
    setDepartmentDialog(null);
  }

  function moveDepartment(name: string, direction: -1 | 1): void {
    setDepartments((items) => { const index = items.findIndex((item) => item.name === name); const target = index + direction; if (index < 0 || target < 0 || target >= items.length) return items; const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }

  function toggleOperator(name: string): void {
    setSelectedOperators((selected) => {
      const next = new Set(selected);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function toggleAreaSelection(area: Exclude<Area, 'UNKNOWN'>): void {
    if (!shift) return;
    const areaNames = shift.operators.filter((operator) => operator.current === area).map((operator) => operator.name);
    setSelectedOperators((selected) => areaNames.every((name) => selected.has(name)) ? new Set([...selected].filter((name) => !areaNames.includes(name))) : new Set([...selected, ...areaNames]));
  }

  function moveSelectedOperators(): void {
    if (!shift || selectedOperators.size === 0) return;
    setLastShiftBeforeAction(shift);
    setShift(moveOperators(shift, [...selectedOperators], bulkArea));
    setSelectedOperators(new Set());
    setConfirmBulkAction(null);
  }

  function dropOperator(area: Exclude<Area, 'UNKNOWN'>): void {
    if (!shift || !draggedOperator) return;
    const names = selectedOperators.has(draggedOperator) ? [...selectedOperators] : [draggedOperator];
    setLastShiftBeforeAction(shift);
    setShift(moveOperators(shift, names, area));
    setSelectedOperators(new Set());
    setDraggedOperator('');
  }

  function returnSelectedOperators(): void {
    if (!shift || selectedOperators.size === 0) return;
    setLastShiftBeforeAction(shift);
    setShift(returnOperatorsToStart(shift, [...selectedOperators]));
    setSelectedOperators(new Set());
    setConfirmBulkAction(null);
  }

  function undoLastAction(): void {
    if (!lastShiftBeforeAction) return;
    setShift(lastShiftBeforeAction);
    setLastShiftBeforeAction(null);
  }

  async function loadPhoto(file: File): Promise<void> {
    setBusy(true);
    setProgress('Připravuji fotografii');
    setError('');
    setAnalysis(null);
    setQuality(null);
    setPreviewUrl('');
    setOverlayUrl('');
    setReviewDrafts({});
    setResolvedRows(new Set());
    setReviewNotice('');
    setReviewApproved(false);

    try {
      const result = await analyzeBoardPhoto(
        file,
        rosterNames,
        undefined,
        [],
        (current, total) => setProgress(`OCR ${Math.min(current + 1, total)} / ${total}`)
      );
      setAnalysis(result);
      setQuality(result.imageQuality ?? null);
      setPreviewUrl(result.imageUrl ?? '');
      setOverlayUrl(result.overlayUrl ?? '');
      setProgress('Analýza dokončena');
    } catch (caught) {
      if (caught instanceof UnusableImageError) {
        setQuality(caught.quality);
        setPreviewUrl(caught.previewUrl ?? '');
        setOverlayUrl(caught.overlayUrl ?? '');
        setError(caught.message);
      } else {
        setError(caught instanceof Error ? caught.message : 'Analýza fotografie selhala.');
      }
      setProgress('Analýza zastavena');
    } finally {
      setBusy(false);
    }
  }

  function startShift(): void {
    if (confirmedOperators.length === 0) return;
    setShift(createShift(confirmedOperators.map(({ name, area }) => ({ name, area })), getProblemSolvers()));
  }

  function startEmptyShift(): void {
    setShift(createShift([], getProblemSolvers()));
    setActivePage('board');
  }

  function addManualOperator(): void {
    if (!manualName) return;
    setShift((current) => current ? addOperatorToShift(current, manualName, manualArea) : current);
    setManualName('');
  }

  function updateReviewDraft(index: number, row: Detection, change: Partial<ReviewDraft>): void {
    const current = reviewDrafts[index] ?? {
      name: row.matched ?? '',
      area: row.area === 'UNKNOWN' ? '' : row.area,
    };
    setReviewDrafts((drafts) => ({ ...drafts, [index]: { ...current, ...change } }));
 .�߻h��춻�q�^ume="department-grid" aria-label="Oddělení směny">
            {areas.map((area) => {
              const operators = filterOperators(shift.operators, query, transportOnly).filter((operator) => operator.current === area);
              return <article className={`department-card${draggedOperator ? ' drop-ready' : ''}`} key={area} onDragOver={(event) => event.preventDefault()} onDrop={() => dropOperator(area)}>
                <header><div><span>{area}</span><b>{shift.operators.filter((operator) => operator.current === area).length}</b></div><div className="department-tools"><small>{operators.length ? `${operators.length} zobrazeno` : 'Bez obsazení'}</small>{shift.operators.some((operator) => operator.current === area) && <button type="button" className="header-action" onClick={() => toggleAreaSelection(area)}>{shift.operators.filter((operator) => operator.current === area).every((operator) => selectedOperators.has(operator.name)) ? 'Zrušit' : 'Vybrat vše'}</button>}</div></header>
                <div className="operator-list">{operators.length ? operators.map((operator) => <article className={`operator-card${selectedOperators.has(operator.name) ? ' selected' : ''}`} key={operator.name} draggable onDragStart={() => setDraggedOperator(operator.name)} onDragEnd={() => setDraggedOperator('')}><label className="operator-select"><input type="checkbox" checked={selectedOperators.has(operator.name)} onChange={() => toggleOperator(operator.name)} /><span><strong>{operator.name}</strong><small>{operator.home !== operator.current ? `${operator.home} → ${operator.current}` : operator.home}</small></span></label><select aria-label={`Pracoviště ${operator.name}`} value={operator.current} onChange={(event) => setShift((current) => current ? moveOperator(current, operator.name, event.target.value) : current)}>{areas.map((target) => <option key={target} value={target}>{target}</option>)}</select>{operator.current !== operator.start && <button type="button" className="tiny" onClick={() => setShift((current) => current ? returnToStart(current, operator.name) : current)}>Vrátit</button>}</article>) : <p className="empty-department">Přidejte člověka nebo jej sem přesuňte.</p>}</div>
              </article>;
            })}
          </section>

        </>
      ) : <section className="panel empty-page"><h1>Nejdřív založte směnu</h1><button type="button" onClick={() => setActivePage('board')}>Zpět na přehled</button></section>}

      {departmentDialog && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDepartmentDialog(null); }}>
        <section className="action-dialog" role="dialog" aria-modal="true" aria-labelledby="department-dialog-title">
          <span className={`dialog-icon ${departmentDialog.type === 'remove' ? 'danger' : ''}`}>{departmentDialog.type === 'remove' ? '!' : '✎'}</span>
          <div>
            <span className="eyebrow">Správa oddělení</span>
            <h2 id="department-dialog-title">{departmentDialog.type === 'remove' ? `Odebrat ${departmentDialog.name}?` : `Přejmenovat ${departmentDialog.name}`}</h2>
          </div>
          {departmentDialog.type === 'rename' ? <label>Nový název<input autoFocus value={departmentDialog.value} onChange={(event) => setDepartmentDialog({ ...departmentDialog, value: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') confirmDepartmentRename(); if (event.key === 'Escape') setDepartmentDialog(null); }} /></label> : <p>Všichni OP z tohoto oddělení budou převedeni do <strong>{UNASSIGNED}</strong>. Změnu můžete jednou vrátit na směnové tabuli.</p>}
          <div className="dialog-actions"><button type="button" className="secondary" onClick={() => setDepartmentDialog(null)}>Zrušit</button><button type="button" className={departmentDialog.type === 'remove' ? 'danger' : ''} onClick={departmentDialog.type === 'remove' ? confirmDepartmentRemoval : confirmDepartmentRename}>{departmentDialog.type === 'remove' ? 'Odebrat oddělení' : 'Uložit název'}</button></div>
        </section>
      </div>}

      {resetDialog && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setResetDialog(false); }}>
        <section className="action-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-dialog-title">
          <span className="dialog-icon danger">!</span><div><span className="eyebrow">Lokální pilot</span><h2 id="reset-dialog-title">Vymazat data pilotu?</h2></div>
          <p>Odstraní se pouze směna, kmen, oddělení a problem solveři uložené v této V2 aplikaci. Původní aplikace a Firebase data zůstanou beze změny.</p>
          <div className="dialog-actions"><button type="button" className="secondary" onClick={() => setResetDialog(false)}>Zrušit</button><button type="button" className="danger" onClick={resetPilot}>Vymazat data</button></div>
        </section>
      </div>}

      <nav className="mobile-nav" aria-label="Mobilní navigace">
        {([['board', 'Směna'], ['roster', 'Stav'], ['import', 'Import']] as [AppPage, string][]).map(([page, label]) => <button type="button" key={page} className={activePage === page ? 'nav-active' : 'secondary'} onClick={() => setActivePage(page)}>{label}</button>)}
      </nav>

    </main>
  );
}
