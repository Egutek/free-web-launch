import { beforeEach, describe, expect, it } from 'vitest';
import { createShift } from './shifts';
import { isShiftState, loadShift, saveProblemSolvers, saveShift } from './storage';
import { PILOT_STORAGE } from './pilotStorage';

describe('shift persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a valid shift through the canonical key', () => {
    const shift = createShift([{ name: 'NOVÁK JAN', area: 'TRANSPORT' }]);
    saveShift(shift);

    expect(loadShift()).toEqual(shift);
    expect(localStorage.getItem(PILOT_STORAGE.shift)).not.toBeNull();
  });

  it('rejects malformed persisted state', () => {
    localStorage.setItem(PILOT_STORAGE.shift, JSON.stringify({ operators: [{ name: 'UNKNOWN' }] }));

    expect(loadShift()).toBeNull();
    expect(localStorage.getItem(PILOT_STORAGE.shift)).toBeNull();
    expect(isShiftState({ operators: [] })).toBe(false);
  });

  it('keeps pilot data isolated from legacy keys', () => { const shift = createShift([{ name: 'SVOBODA PETR', area: 'OUTBOUND' }]); localStorage.setItem('zf.shift.v1', JSON.stringify(shift)); expect(loadShift()).toBeNull(); saveProblemSolvers([{ name: 'PAVELKA', area: 'TRANSPORT' }]); expect(localStorage.getItem(PILOT_STORAGE.problemSolvers)).not.toBeNull(); });
});
