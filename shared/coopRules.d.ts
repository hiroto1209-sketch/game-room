export interface FoeState{id:string;hp:number;downUntil:number;beaten:boolean}
export interface CoopState{enabled:boolean;cleared:boolean;foes:FoeState[]}
export interface FoeSlot{id:string;x:number;z:number}
export const COOP_PLAZA:{minX:number;maxX:number;minZ:number;maxZ:number};
export const FOE_RESPAWN_MS:number;
export const FOE_SLOTS:FoeSlot[];
export const FOE_IDS:string[];
export function inCoopPlaza(x:number,z:number):boolean;
export function foeSlot(id:string):FoeSlot|null;
export function foeEye(id:string):{x:number;y:number;z:number}|null;
export function freshFoes():FoeState[];
export function freshCoop():CoopState;
export function validCoopState(s:unknown):s is CoopState;
export function fireTargetKind(coopEnabled:boolean):"foes"|"players";
export function reviveFoes(foes:FoeState[],now:number):FoeState[];
export function findFoeHit(origin:{x:number;y:number;z:number},yaw:number,pitch:number,foes:FoeState[],occluded?:(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number})=>boolean):{id:string;damage:number;point:{x:number;y:number;z:number}}|null;
export function applyFoeDamage(state:CoopState,id:string,now:number):{state:CoopState;damage:number;justCleared:boolean};
export function publicCoop(state:CoopState):CoopState;
