import {useEffect,useRef,useState} from 'react';
import {api} from './sitesStore';
type Setting={value:string;revision:number;mutationId:string|null};
type Draft={value:string;base:number;mutationId:string};
const key='zf-ocr-instructions-draft-v2';
const load=():Draft|null=>{try{return JSON.parse(localStorage.getItem(key)??'null');}catch{return null;}};
export function useOcrInstructions(open:boolean){
 const [remote,setRemote]=useState<Setting|null>(null),[draft,setDraft]=useState<Draft|null>(load),[status,setStatus]=useState('Načítání pokynů…'),[conflict,setConflict]=useState(false);
 const current=useRef({remote,draft,conflict});current.current={remote,draft,conflict};const running=useRef<Promise<void>|null>(null);
 const persist=(next:Draft|null)=>{try{next?localStorage.setItem(key,JSON.stringify(next)):localStorage.removeItem(key);}catch{}setDraft(next);current.current.draft=next;};
 const refresh=async()=>{try{const next:Setting=await api('/api/ocr-settings');setRemote(next);current.current.remote=next;const pending=current.current.draft;if(pending&&pending.mutationId===next.mutationId){persist(null);setConflict(false);setStatus('Uloženo');}else if(pending&&pending.base!==next.revision){setConflict(true);setStatus('Pokyny změnil kolega');}else if(!pending)setStatus('Uloženo');}catch{setStatus('Offline · rozepsané pokyny zůstávají v zařízení');}};
 useEffect(()=>{if(!open)return;void refresh();const timer=setInterval(()=>{if(!document.hidden&&!running.current)void refresh();},5000);return()=>clearInterval(timer);},[open]);
 const save=async():Promise<void>=>{
  if(running.current){await running.current;return;}
  const pending=current.current.draft;if(!pending)return;if(current.current.conflict)throw Error('Nejprve vyřešte změnu pokynů od kolegy.');
  const task=(async()=>{setStatus('Ukládání…');try{const next:Setting=await api('/api/ocr-settings',{value:pending.value,revision:pending.base,mutationId:pending.mutationId});setRemote(next);current.current.remote=next;const latest=current.current.draft;if(latest?.mutationId===pending.mutationId){persist(null);setStatus('Uloženo');}else if(latest){persist({...latest,base:next.revision});setStatus('Čeká na uložení');}}catch(e){if((e as any).status===409){setConflict(true);current.current.conflict=true;await refresh();}else setStatus('Neuloženo na server · kopie zůstává v zařízení');throw e;}})();running.current=task;try{await task;}finally{running.current=null;}
 };
 useEffect(()=>{if(!draft||!remote||conflict)return;const timer=setTimeout(()=>void save().catch(()=>{}),800);return()=>clearTimeout(timer);},[draft,remote,conflict]);
 const change=(value:string)=>{persist({value,base:current.current.draft?.base??current.current.remote?.revision??0,mutationId:crypto.randomUUID()});setStatus('Čeká na uložení');};
 const flush=async()=>{if(!current.current.remote)throw Error('Pokyny ještě nejsou načtené.');while(current.current.draft)await save();return current.current.remote!.value;};
 const useRemote=()=>{persist(null);setConflict(false);current.current.conflict=false;setStatus('Uloženo');};
 const keepMine=()=>{if(!remote||!draft)return;persist({...draft,base:remote.revision,mutationId:crypto.randomUUID()});setConflict(false);current.current.conflict=false;};
 return {instructions:draft?.value??remote?.value??'',setInstructions:change,status,conflict,remoteValue:remote?.value??'',useRemote,keepMine,flush,ready:!!remote};
}
