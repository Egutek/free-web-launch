import { describe, expect, it } from 'vitest';
import { uniqueRoster } from './roster';

describe('permanent roster', () => {
  it('keeps one person across team entries with different formatting', () => {
    expect(uniqueRoster([{ name: 'Novák Jan', team: 'TRANSPORT', shift: 'A' }, { name: 'NOVAK JAN', team: 'VNA', shift: 'B' }])).toEqual([{ name: 'Novák Jan', team: 'TRANSPORT', shift: 'A' }]);
  });
});
