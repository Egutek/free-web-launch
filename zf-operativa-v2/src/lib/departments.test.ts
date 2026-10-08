import { describe, expect, it } from 'vitest';
import { addDepartment, DEFAULT_DEPARTMENTS, renameDepartment, uniqueDepartments } from './departments';

describe('department configuration', () => {
  it('prevents duplicate department names after normalization', () => expect(uniqueDepartments([{ name: 'Nové oddělení' }, { name: 'NOVE ODDĚLENÍ' }])).toHaveLength(1));
  it('adds a new department once', () => { const next = addDepartment(DEFAULT_DEPARTMENTS, 'PICKING'); expect(next.some((department) => department.name === 'PICKING')).toBe(true); expect(addDepartment(next, ' picking ')).toBe(next); });
  it('keeps Transport and HOVS/ML protected', () => expect(DEFAULT_DEPARTMENTS.filter((department) => department.protected).map((department) => department.name)).toEqual(['TRANSPORT', 'HOVS/ML']));
  it('renames a department without allowing a normalized duplicate', () => { const renamed = renameDepartment(DEFAULT_DEPARTMENTS, 'OUTBOUND', 'BALENÍ'); expect(renamed.some((department) => department.name === 'BALENÍ')).toBe(true); expect(renameDepartment(renamed, 'BALENÍ', 'transport')).toBe(renamed); });
});
