import { z } from 'zod';

export const shiftSchema = z.enum(['A','B','C']);
const id = z.string().min(1).max(128);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v);
export const operatorSchema = z.object({id, name:z.string().trim().min(1).max(100), departmentId:id, machineType:z.enum(['LL','RTR','NONE']),status:z.enum(['active','break','absence']),shift:shiftSchema.default('A'),lastMovedAt:z.string().max(50),notes:z.string().max(500).optional(),absenceReason:z.enum(['Absence','Dovolená','PN']).optional(),isVnaOnly:z.boolean().optional(),personId:id.optional(),source:z.enum(['manual','ocr']).optional()});
export const personSchema=z.object({id,name:z.string().trim().min(1).max(100),shift:shiftSchema,team:z.enum(['transport','vna']),role:z.enum(['operator','problem_solver','lead']),aliases:z.array(z.string().trim().min(1).max(100)).max(20),distinction:z.string().max(100).default(''),activeFrom:date,activeTo:date.nullable(),memberships:z.array(z.object({from:date,shift:shiftSchema,team:z.enum(['transport','vna']),role:z.enum(['operator','problem_solver','lead'])})).optional()}).refine(p=>!p.activeTo||p.activeTo>=p.activeFrom,'Konec platnosti musí následovat začátek.');
export type Person=z.infer<typeof personSchema>;
export type Op=z.infer<typeof operatorSchema>;
export type Shift='A'|'B'|'C';
export type OcrRow={rowId:string;name:string;departmentId:string;machineType:'LL'|'RTR'|'NONE';kind:'operator'|'problem_solver'|'absence'|'excluded'|'unclear';absenceReason?:'Absence'|'Dovolená'|'PN';notes?:string;rawText:string;issues:string[];personId?:string;reviewed?:boolean};
export interface Board {rosterVersion?:number;operators:Op[]; history:any[];templates:any[];custom_departments:any[];settings:Record<string,string>;roster:Person[];expected:Partial<Record<Shift,Person[]>>;imports:any[];resolutions:Record<string,{note:string}>;applied:string[]}
export const emptyBoard=():Board=>({operators:[],history:[],templates:[],custom_departments:[],settings:{},roster:[],expected:{},imports:[],resolutions:{},applied:[]});
export const normalizeName=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('cs');
export function matchPerson(name:string,people:Person[]) {const n=normalizeName(name); return people.filter(p=>[p.name,...p.aliases].some(v=>normalizeName(v)===n));}
export const activePeople=(people:Person[],day:string,shift:Shift)=>people.map(p=>{const m=p.memberships?.filter(m=>m.from<=day).sort((a,b)=>b.from.localeCompare(a.from))[0];return m?{...p,...m}:p;}).filter(p=>p.shift===shift&&p.activeFrom<=day&&(!p.activeTo||p.activeTo>=day));
export function audit(board:Board,day:string,shift:Shift){
 const people=(board.expected[shift]??activePeople(board.roster,day,shift)).filter(p=>p.role!=='lead');
 const latest=board.imports.filter(i=>i.shift===shift).at(-1);
 const rows=people.map(person=>{
  const found=!!latest?.rows.some((r:OcrRow)=>r.personId===person.id&&r.kind!=='excluded');
  const ops=board.operators.filter(o=>o.shift===shift&&o.personId===person.id);
  const resolved=board.resolutions[`${shift}:${person.id}`];
  const valid=ops.length===1&&((ops[0].departmentId!=='unassigned'&&ops[0].status!=='absence')||(ops[0].status==='absence'&&!!ops[0].absenceReason));
  const status=!latest?'waiting':ops.length>1?'conflict':valid||resolved?(found?'done':'manual'):'missing';
  return {person,found,status,note:resolved?.note,operator:ops[0]};
 });
 const summarize=(list:typeof rows)=>({total:list.length,op:list.filter(r=>r.person.role==='operator').length,ps:list.filter(r=>r.person.role==='problem_solver').length,resolved:list.filter(r=>['done','manual'].includes(r.status)).length,pending:list.filter(r=>['missing','conflict'].includes(r.status)).length});
 return {teams:{transport:summarize(rows.filter(r=>r.person.team==='transport')),vna:summarize(rows.filter(r=>r.person.team==='vna'))},rows,total:rows.length,resolved:rows.filter(r=>['done','manual'].includes(r.status)).length,pending:rows.filter(r=>['missing','conflict'].includes(r.status)).length,hasImport:!!latest};
}
export const commandSchema=z.object({id,date,revision:z.number().int().nonnegative(),type:z.enum(['operators','delete_operator','replace','template','delete_template','department','delete_department','settings','roster','resolve','import']),payload:z.unknown()});
export type Command=z.infer<typeof commandSchema>;
export function applyCommand(previous:Board,cmd:Command,now:string):Board{
 const b:Board=structuredClone(previous);const p:any=cmd.payload;
 const record=(next:Op,old?:Op)=>{b.history.unshift({id:crypto.randomUUID(),operatorId:next.id,operatorName:next.name,machineType:next.machineType,fromDept:old?.departmentId??'unassigned',toDept:next.departmentId,timestamp:now,shift:next.shift,reason:next.source==='ocr'?'Potvrzený import':'Ruční změna'});};
 const put=(raw:unknown,source:'manual'|'ocr'='manual')=>{const op=operatorSchema.parse(raw);if(!['hovc','hovs','putaway','vas','obwf','vna','obwi','problem_solver','unassigned',...b.custom_departments.map(d=>d.id)].includes(op.departmentId))throw Error('Neznámé oddělení.');const old=b.operators.find(o=>o.id===op.id);const candidates=matchPerson(op.name,activePeople(b.roster,cmd.date,op.shift).filter(p=>p.role!=='lead'));const personId=op.personId??old?.personId??(candidates.length===1?candidates[0].id:undefined); if(personId&&!b.roster.concat(Object.values(b.expected).flat()).some(x=>x?.id===personId&&x.shift===op.shift))throw Error('Osoba nepatří do směny.'); const next={...op,personId,source}; b.operators=b.operators.filter(o=>o.id!==op.id);b.operators.push(next);record(next,old);};
 switch(cmd.type){
 case 'operators': z.array(operatorSchema).max(2000).parse(p).forEach(o=>put(o));break;
 case 'delete_operator':{const key=id.parse(p);b.operators=b.operators.filter(o=>o.id!==key);break;}
 case 'replace':{const parsed=z.object({operators:z.array(operatorSchema).max(2000),shift:shiftSchema.optional()}).parse(p);b.operators=b.operators.filter(o=>parsed.shift&&o.shift!==parsed.shift);parsed.operators.filter(o=>!parsed.shift||o.shift===parsed.shift).forEach(o=>put(o));break;}
 case 'template':{const t=z.object({id,name:z.string().min(1).max(120),description:z.string().max(500).optional(),operatorCount:z.number().int().min(0),activeCount:z.number().int().min(0),createdAt:z.string().max(50),shift:z.enum(['A','B','C','all']).optional(),assignments:z.array(z.object({operatorId:id,operatorName:z.string().max(100),departmentId:id,status:z.enum(['active','break','absence']),machineType:z.enum(['LL','RTR','NONE']),notes:z.string().max(500).optional()})).max(2000)}).parse(p);b.templates=b.templates.filter(t0=>t0.id!==t.id);b.templates.push(t);break;}
 case 'delete_template':b.templates=b.templates.filter(t=>t.id!==id.parse(p));break;
 case 'department':{const d=z.object({id,name:z.string().min(1).max(100),fullName:z.string().max(120),code:z.string().max(20),description:z.string().max(500),color:z.string().max(50),badgeBg:z.string().max(200),badgeText:z.string().max(200),borderColor:z.string().max(200),iconName:z.string().max(50),targetCount:z.number().int().min(0).max(2000),shift:shiftSchema.optional(),createdAt:z.string().max(50).optional(),isCustom:z.boolean().optional()}).parse(p);b.custom_departments=b.custom_departments.filter(x=>x.id!==d.id);b.custom_departments.push(d);break;}
 case 'delete_department':b.custom_departments=b.custom_departments.filter(d=>d.id!==id.parse(p));break;
 case 'settings':b.settings['ocr_instructions']=z.string().max(4000).parse(p);break;
 case 'roster':{const people=z.array(personSchema).max(2000).parse(p.people);if(p.version!==(b.rosterVersion??0))throw Error('Kmen změnil kolega. Načtěte aktuální seznam.');if(new Set(people.map(p=>p.id)).size!==people.length)throw Error('Duplicitní identifikátor.');
 for(const old of b.roster)if(!people.some(p=>p.id===old.id))throw Error('Osobu nelze odstranit z historie. Nastavte konec platnosti.');
 for(const person of people){const old=b.roster.find(p=>p.id===person.id);person.memberships=old?.memberships;if(old&&(['team','role','shift'] as const).some(k=>old[k]!==person[k])){const history=old.memberships??[{from:old.activeFrom,team:old.team,role:old.role,shift:old.shift}];if(history.some(h=>h.from>cmd.date))throw Error('Nejprve upravte již naplánovanou změnu členství.');person.memberships=[...history.filter(h=>h.from!==cmd.date),{from:cmd.date,team:person.team,role:person.role,shift:person.shift}];}}
 for(const s of ['A','B','C'] as Shift[]){const active=activePeople(people,cmd.date,s);const keys=active.map(p=>normalizeName(p.name)+'|'+normalizeName(p.distinction));if(new Set(keys).size!==keys.length)throw Error('Stejná jména rozlište osobním číslem.');for(const team of ['transport','vna'])if(active.filter(p=>p.role==='lead'&&p.team===team).length>1)throw Error('Část směny může mít jednoho vedoucího.');b.expected[s]=active;}b.roster=people;b.rosterVersion=(b.rosterVersion??0)+1;break;}
 case 'resolve':{const r=z.object({personId:id,shift:shiftSchema,note:z.string().trim().min(1).max(500)}).parse(p);b.resolutions[`${r.shift}:${r.personId}`]={note:r.note};break;}
 case 'import':{
  const data=z.object({importId:id,shift:shiftSchema,rows:z.array(z.object({rowId:id,name:z.string().trim().max(100),departmentId:id,machineType:z.enum(['LL','RTR','NONE']),kind:z.enum(['operator','problem_solver','absence','excluded','unclear']),absenceReason:z.enum(['Absence','Dovolená','PN']).optional(),notes:z.string().max(500).optional(),rawText:z.string().max(1000),issues:z.array(z.string().max(300)).max(20),personId:id.optional(),reviewed:z.literal(true)})).max(2000),replaceManual:z.boolean()}).parse(p);
  if(b.imports.some(i=>i.importId===data.importId&&i.shift===data.shift))break;
  const people=activePeople(b.roster,cmd.date,data.shift).filter(p=>p.role!=='lead');b.expected[data.shift]=structuredClone(people);
  const rows=data.rows.map(r=>{const matches=matchPerson(r.name,people);return {...r,personId:r.personId??(matches.length===1?matches[0].id:undefined)};});
  const linked=rows.filter(r=>r.personId&&r.kind!=='excluded').map(r=>r.personId);if(new Set(linked).size!==linked.length)throw Error('Stejná osoba je přiřazena vícekrát.');
  const old=b.operators.filter(o=>o.shift===data.shift);const keep=old.filter(o=>o.source!=='ocr'&&!data.replaceManual);
  b.operators=b.operators.filter(o=>o.shift!==data.shift).concat(keep);
  for(const r of rows){if(r.kind==='excluded')continue;if(!r.name.trim())throw Error('Doplňte jméno.');if(r.kind==='unclear')throw Error('Nejasný řádek nejprve opravte nebo vyřaďte.');if(r.kind==='absence'&&!r.absenceReason)throw Error('Doplňte důvod absence.');if(r.kind==='operator'&&r.departmentId==='unassigned')throw Error('Doplňte oddělení.');if(keep.some(o=>r.personId?o.personId===r.personId:normalizeName(o.name)===normalizeName(r.name)))continue;
   put({id:r.personId?`person-${r.personId}`:r.rowId,name:r.name,personId:r.personId,departmentId:r.kind==='absence'?'unassigned':r.kind==='problem_solver'?'problem_solver':r.departmentId,machineType:r.machineType,status:r.kind==='absence'?'absence':'active',absenceReason:r.absenceReason,notes:r.notes,shift:data.shift,lastMovedAt:now},'ocr');}
  b.imports.push({...data,rows,expected:structuredClone(people),confirmedAt:now,revision:b.imports.filter(i=>i.shift===data.shift).length+1});break;
 }
 }
 if(b.operators.length>2000||b.history.length>20000)throw Error('Denní kapacita překročena.');
 b.applied.push(cmd.id);return b;
}
