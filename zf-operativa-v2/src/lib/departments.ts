import { normalizeName } from './validation';

export type Department = { name: string; hidden?: boolean; protected?: boolean };
export const UNASSIGNED = 'NEZAŘAZENÍ';
export const DEFAULT_DEPARTMENTS: Department[] = ['TRANSPORT','OUTBOUND','HOVS/ML','VNA','VNAS','VNAC','PUTAWAY','VAS','OBWI','HAZMAT','OBWF'].map(name => ({ name, protected: name === 'TRANSPORT' || name === 'HOVS/ML' }));
const KEY = 'zf.departments.v1';
const clean = (name: string) => name.trim().replace(/\s+/g, ' ').toUpperCase();

export function uniqueDepartments(items: Department[]): Department[] { const seen = new Set<string>(); return items.map(item => ({ ...item, name: clean(item.name), protected: item.name === 'TRANSPORT' || item.name === 'HOVS/ML' || item.protected })).filter(item => item.name && item.name !== 'UNKNOWN' && !seen.has(normalizeName(item.name)) && (seen.add(normalizeName(item.name)), true)); }
export function loadDepartments(): Department[] { try { const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return Array.isArray(value) ? uniqueDepartments(value.filter((item): item is Department => Boolean(item) && typeof item === 'object' && typeof (item as Department).name === 'string')) : DEFAULT_DEPARTMENTS; } catch { return DEFAULT_DEPARTMENTS; } }
export function saveDepartments(items: Department[]): void { try { localStorage.setItem(KEY, JSON.stringify(uniqueDepartments(items))); } catch {} }
export function addDepartment(items: Department[], name: string): Department[] { const next = uniqueDepartments([...items, { name }]); return next.length === items.length ? items : next; }
export function renameDepartment(items: Department[], from: string, to: string): Department[] { const name = clean(to); if (!name || items.some(item => item.name !== from && normalizeName(item.name) === normalizeName(name))) return items; return uniqueDepartments(items.map(item => item.name === from ? { ...item, name } : item)); }
