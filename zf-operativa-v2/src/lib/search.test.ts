import{describe,it,expect}from'vitest';import{filterOperators}from'./search';
const ops=[{name:'NOVÁK JAN',home:'TRANSPORT',start:'TRANSPORT',current:'OUTBOUND'},{name:'SVOBODA PETR',home:'VNA',start:'VNA',current:'VNA'}] as const;
describe('operator filter',()=>{it('ignores diacritics',()=>expect(filterOperators([...ops],'novak')).toHaveLength(1));it('transport mode includes OP moved away',()=>expect(filterOperators([...ops],'',true)[0].name).toBe('NOVÁK JAN'))})
