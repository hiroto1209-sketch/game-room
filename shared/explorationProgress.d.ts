export type ExplorationId="echo"|"trail"|"skylook";
export type Stamp={id:ExplorationId;label:string;x:number;z:number};
export const EXPLORATION_STAMPS:Stamp[];
export function safeDiscovered(value:unknown):ExplorationId[];
export function earnStamp(found:unknown,id:string):{found:ExplorationId[];newlyFound:boolean};
