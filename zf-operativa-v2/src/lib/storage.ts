import type { Area, Movement, ProblemSolver } from '../types';
import type { ShiftState } from './shifts';
import { PILOT_STORAGE } from './pilotStorage';

const KEY = PILOT_STORAGE.shift;
function isArea(value: unknown): value is Area {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMovement(value: unknown): value is Movement {
  return isRecord(value) && typeof value.person === 'string' &&
    isArea(value.from) && isArea(value.to) && typeof value.at === 'string' && Number.isFinite(Date.parse(value.at));
}

export function isShiftState(value: unknown): value is ShiftState {
  if (!isRecord(value) || typeof value.startedAt !== 'string' || !Number.isFinite(Date.parse(value.startedAt))) return false;
  if (!Array.isArray(value.operators) || !Array.isArray(value.movements)) return false;
  const validOperators = value.operators.every((operator) => isRecord(operator) &&
    typeof operator.name === 'string' && operator.name.trim().length > 0 &&
    isArea(operator.home) && isArea(operator.start) && isArea(operator.current));
  const problemSolvers = value.problemSolvers === undefined || (Array.isArray(value.problemSolvers) && value.problemSolvers.every((solver) => isRecord(solver) && typeof solver.name === 'string' && (solver.area === 'TRANSPORT' || solver.area === 'HOVS/ML')));
  return validOperators && problemSolvers && value.movements.every(isMovement);
}

export function saveShift(shift: ShiftState | null): void {
  try {
    if (shift) localStorage.setItem(KEY, JSON.stringify(shift));
    else localStorage.removeItem(KEY);
  } catch (error) {
    console.warn('Shift could not be persisted:', error);
  }
}

export function loadShift(): ShiftState | null {
  try {
    const serialized = localStorage.getItem(KEY);
    if (!serialized) return null;

    const parsed: unknown = JSON.parse(serialized);
    if (!isShiftState(parsed)) {
      localStorage.removeItem(KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function exportShift(shift: ShiftState): void {
  const blob = new Blob([JSON.stringify(shift, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `shift-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function loadProblemSolvers(): ProblemSolver[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PILOT_STORAGE.problemSolvers) ?? 'null');
    return Array.isArray(value) ? value.filter((solver): solver is ProblemSolver => isRecord(solver) && typeof solver.name === 'string' && solver.name.trim().length > 0 && (solver.area === 'TRANSPORT' || solver.area === 'HOVS/ML')) : [];
  } catch { return []; }
}

export function saveProblemSolvers(solvers: ProblemSolver[]): void { try { localStorage.setItem(PILOT_STORAGE.problemSolvers, JSON.stringify(solvers)); } catch {} }
