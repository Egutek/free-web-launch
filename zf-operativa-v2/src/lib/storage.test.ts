import { beforeEach, describe, expect, it } from 'vitest';
import { createShift } from './shifts';
import { isShiftState, loadShift, saveShift } from './storage';

describe('shift persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a valid shift through the canonical key', () => {
    const shift = createShift([{ name: 'NOVÁK JAN', area: 'TRANSPORT' }]);
    saveShift(shift);

    expect(loadShift()).toEqual(shift);
    expect(localStorage.getItem('zf.shift.v1')).not.toBeNull();
  });

  it('rejects malformed persisted state', () => {
    localStorage.setItem('zf.shift.v1', JSON.stringify({ operators: [{ name: 'UNKNOWN' }] }));

    expect(loadShift()).toBeNull();
    expect(localStorage.getItem('zf.shift.v1')).toBeNull();
    expect(isShiftState({ operators: [] })).toBe(false);
  });

  it('migrates a valid shift from the previous storage key', () => {
    const shift = createShift([{ name: 'SVOBODA PETR', area: 'OUTBOUND' }]);
    localStorage.setItem('shift', JSON.stringify(shift));

    expect(loadShift()).toEqual(shift);
    expect(localStorage.getItem('zf.shift.v1')).not.toBeNull();
    expect(localStorage.getItem('shift')).toBeNull();
  });
});