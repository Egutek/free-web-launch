import type{Operator}from'./shifts';
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function filterOperators(ops:Operator[],q:string,transportOnly=false){const n=norm(q.trim());return ops.filter(x=>(!transportOnly||x.home==='TRANSPORT'||x.start==='TRANSPORT')&&(!n||norm(x.name).includes(n)||norm(x.current).includes(n)))}
