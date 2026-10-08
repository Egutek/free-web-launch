import type{ShiftState}from'./shifts';
export function isValidShift(x:unknown):x is ShiftState{if(!x||typeof x!=='object')return false;const s=x as ShiftState;return typeof s.startedAt==='string'&&Array.isArray(s.operators)&&Array.isArray(s.movements)&&s.operators.every(o=>typeof o.name==='string'&&typeof o.current==='string')}
