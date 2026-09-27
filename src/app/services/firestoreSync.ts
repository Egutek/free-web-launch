// Compatibility boundary: all existing screens now use Sites.
import {mutate,watch} from './sitesStore';
import type {Operator,MoveHistoryRecord,ShiftTemplate,Department,ShiftCode} from '../types';
export type Unsubscribe=()=>void;
export const subscribeToOperators=(fn:(v:Operator[])=>void,err?:(e:Error)=>void)=>watch(b=>b.operators,fn,err);
export const subscribeToHistory=(fn:(v:MoveHistoryRecord[])=>void,err?:(e:Error)=>void)=>watch(b=>b.history.slice(0,100),fn,err);
export const subscribeToTemplates=(fn:(v:ShiftTemplate[])=>void,err?:(e:Error)=>void)=>watch(b=>b.templates,fn,err);
export const subscribeToCustomDepartments=(fn:(v:Department[])=>void,err?:(e:Error)=>void)=>watch(b=>b.custom_departments,fn,err);
export const subscribeToOcrInstructions=(fn:(v:string)=>void,err?:(e:Error)=>void)=>watch(b=>b.settings['ocr_instructions']??'',fn,err);
export const syncOperatorToCloud=(op:Operator,_queue?:boolean)=>mutate('operators',[op]);
export const bulkSyncOperatorsToCloud=(ops:Operator[])=>mutate('operators',ops);
export const deleteOperatorFromCloud=(id:string,_queue?:boolean)=>mutate('delete_operator',id);
export const replaceOperatorsInCloud=(operators:Operator[],shift?:ShiftCode)=>mutate('replace',{operators,shift});
// Server history is part of the operator transaction.
export const syncHistoryRecordToCloud=async (_record:MoveHistoryRecord,_queue?:boolean)=>{};
export const syncTemplateToCloud=(template:ShiftTemplate)=>mutate('template',template);
export const deleteTemplateFromCloud=(id:string)=>mutate('delete_template',id);
export const syncCustomDepartmentToCloud=(dept:Department)=>mutate('department',dept);
export const deleteCustomDepartmentFromCloud=(id:string)=>mutate('delete_department',id);
export const syncOcrInstructionsToCloud=(value:string)=>mutate('settings',value);

