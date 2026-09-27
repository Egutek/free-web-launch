import {useSyncExternalStore} from 'react';
import {emptyBoard,type Board,type Command} from '../../domain';
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague'}).format(new Date());
let day=today();let state={board:emptyBoard(),revision:0,loading:true,error:'',pending:0,saving:false,date:day};
const listeners=new Set<()=>void>();let started=false;let refreshing=false;
const emit=()=>listeners.forEach(fn=>fn());
const update=(patch:Partial<typeof state>)=>{state={...state,...patch};emit();};
export const getSnapshot=()=>state;
export function useBoard(){return useSyncExternalStore(subscribe,getSnapshot,getSnapshot);}
export function subscribe(fn:()=>void){listeners.add(fn);if(!started){started=true;refresh();setInterval(()=>{if(!document.hidden){flush();refresh();}},3000);window.addEventListener('online',()=>flush());document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});}return ()=>{listeners.delete(fn);};}
export function setDay(value:string){day=value;update({date:day,board:emptyBoard(),revision:0,loading:true});refresh();}
export async function api(path:string,data?:unknown){const response=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:undefined,body:data?JSON.stringify(data):undefined,cache:'no-store'});const body=await response.json();if(!response.ok){const error=new Error(body.error??'Požadavek selhal.') as Error&{status:number};error.status=response.status;throw error;}return body;}
export async function refresh(){if(refreshing)return;refreshing=true;const requested=day;try{const remote=await api('/api/board?date='+requested);await cacheBoard(requested,remote);if(requested===day)update({...remote,loading:false,error:''});}catch(e){const cached=await cacheBoard(requested).catch(()=>null);if(requested===day)update({...cached,loading:false,error:'Offline nebo nedostupný server. '+(e instanceof Error?e.message:'Data nelze načíst.')});}finally{refreshing=false;if(requested!==day)void refresh();}}
type Pending={id:string;command:Command;blocked?:string;order:number};
const openDb=()=>new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('zf-sites-outbox-v1',2);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('queue'))r.result.createObjectStore('queue',{keyPath:'id'});if(!r.result.objectStoreNames.contains('cache'))r.result.createObjectStore('cache',{keyPath:'date'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function cacheBoard(date:string,value?:unknown){const db=await openDb();return new Promise<any>((resolve,reject)=>{const tx=db.transaction('cache',value?'readwrite':'readonly');const s=tx.objectStore('cache');const r=value?s.put({date,value}):s.get(date);tx.oncomplete=()=>{resolve(value??r.result?.value);db.close();};tx.onerror=()=>{reject(tx.error);db.close();};});}
async function queueAccess(mode:IDBTransactionMode,action:(s:IDBObjectStore)=>IDBRequest){const db=await openDb();return new Promise<any>((resolve,reject)=>{const tx=db.transaction('queue',mode);const r=action(tx.objectStore('queue'));tx.oncomplete=()=>{resolve(r.result);db.close();};tx.onerror=()=>{reject(tx.error);db.close();};});}
export const getQueue=async()=>((await queueAccess('readonly',s=>s.getAll())) as Pending[]).sort((a,b)=>a.order-b.order);
async function saveItem(item:Pending){await queueAccess('readwrite',s=>s.put(item));update({pending:(await getQueue()).length});}
export async function mutate(type:Command['type'],payload:unknown){
 if(state.loading)throw Error('Nejprve počkejte na načtení dat.');
 const command:Command={id:crypto.randomUUID(),date:day,revision:state.revision,type,payload};
 await saveItem({id:command.id,command,order:Date.now()+performance.now()%1});await flush();
 const remaining=(await getQueue()).find(x=>x.id===command.id);if(remaining)throw Error(remaining.blocked??'Změna čeká na odeslání. Zůstala bezpečně uložená v tomto zařízení.');
}
let flushing=false;
export async function flush(){if(flushing||!navigator.onLine)return;flushing=true;update({saving:true});try{const queue=await getQueue();update({pending:queue.length});for(const item of queue){if(item.blocked)continue;try{const remote=await api('/api/command',item.command);await queueAccess('readwrite',s=>s.delete(item.id));for(const next of await getQueue()){if(!next.blocked&&next.command.date===item.command.date&&next.command.revision===item.command.revision){next.command.revision=remote.revision;await saveItem(next);const inBatch=queue.find(q=>q.id===next.id);if(inBatch)inBatch.command.revision=remote.revision;}}if(item.command.date===day)update({...remote,error:''});}catch(e){const err=e as Error&{status?:number};if(err.status===409||err.status===400){item.blocked=err.message;await saveItem(item);}update({error:err.message});break;}}}finally{flushing=false;update({saving:false,pending:(await getQueue()).length});}}
export async function retryItem(id:string){const item=(await getQueue()).find(x=>x.id===id);if(!item)return;const latest=await api('/api/board?date='+item.command.date);item.command.revision=latest.revision;delete item.blocked;await saveItem(item);await flush();}
export async function discardItem(id:string){await queueAccess('readwrite',s=>s.delete(id));update({pending:(await getQueue()).length});await refresh();}
export function watch<T>(select:(board:Board)=>T,onUpdate:(value:T)=>void,onError?:(e:Error)=>void){let last='';const run=()=>{if(state.loading)return;if(state.error)onError?.(new Error(state.error));const v=select(state.board);const key=JSON.stringify(v);if(key!==last){last=key;onUpdate(v);}};const off=subscribe(run);run();return off;}

