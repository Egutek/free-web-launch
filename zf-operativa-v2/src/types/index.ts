export type Area = 'VNAS'|'VNAC'|'PUTAWAY'|'OUTBOUND'|'VAS'|'OBWI'|'HAZMAT'|'OBWF'|'HOVS/ML'|'TRANSPORT'|'VNA'|'UNKNOWN';
export interface Detection { raw:string; matched?:string; area:Area; confidence:number; warning?:string }
export interface Movement { person:string; from:Area; to:Area; at:string }
