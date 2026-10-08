import{describe,it,expect}from'vitest';import{isValidShift}from'./migration';
describe('stored shift validation',()=>{it('rejects malformed data',()=>expect(isValidShift({operators:[]})).toBe(false));it('accepts base state',()=>expect(isValidShift({startedAt:'x',operators:[],movements:[]})).toBe(true))})
