export const PILOT_STORAGE = {
  shift: 'zf.v2.pilot.shift.v1',
  roster: 'zf.v2.pilot.roster.v1',
  departments: 'zf.v2.pilot.departments.v1',
  problemSolvers: 'zf.v2.pilot.problem-solvers.v1',
} as const;

export function resetPilotStorage(): void { try { Object.values(PILOT_STORAGE).forEach((key) => localStorage.removeItem(key)); } catch {} }
