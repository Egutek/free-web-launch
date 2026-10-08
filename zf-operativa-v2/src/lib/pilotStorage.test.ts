import { describe, expect, it } from 'vitest';
import { PILOT_STORAGE, resetPilotStorage } from './pilotStorage';

describe('pilot storage', () => {
  it('clears only V2 pilot keys', () => { localStorage.setItem(PILOT_STORAGE.shift, 'shift'); localStorage.setItem(PILOT_STORAGE.roster, 'roster'); localStorage.setItem('zf.shift.v1', 'legacy'); resetPilotStorage(); expect(localStorage.getItem(PILOT_STORAGE.shift)).toBeNull(); expect(localStorage.getItem(PILOT_STORAGE.roster)).toBeNull(); expect(localStorage.getItem('zf.shift.v1')).toBe('legacy'); });
});
