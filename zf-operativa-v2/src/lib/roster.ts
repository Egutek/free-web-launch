import { normalizeName } from './validation';

export type PermanentTeam = 'TRANSPORT' | 'VNA';
export type ShiftCode = 'A' | 'B' | 'C';
export type RosterMember = { name: string; team: PermanentTeam; shift: ShiftCode };

const KEY = 'zf.roster.v1';

export function uniqueRoster(members: RosterMember[]): RosterMember[] {
  const seen = new Set<string>();
  return members.filter((member) => {
    const key = normalizeName(member.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function loadRoster(fallback: RosterMember[]): RosterMember[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!Array.isArray(value)) return fallback;
    const members = value.filter((member): member is Omit<RosterMember, 'shift'> & Partial<Pick<RosterMember, 'shift'>> => Boolean(member) && typeof member === 'object' && typeof (member as RosterMember).name === 'string' && ((member as RosterMember).team === 'TRANSPORT' || (member as RosterMember).team === 'VNA')).map((member): RosterMember => ({ name: member.name, team: member.team, shift: member.shift === 'B' || member.shift === 'C' ? member.shift : 'A' }));
    return members.length ? uniqueRoster(members) : fallback;
  } catch {
    return fallback;
  }
}

export function saveRoster(members: RosterMember[]): void { try { localStorage.setItem(KEY, JSON.stringify(uniqueRoster(members))); } catch {} }
