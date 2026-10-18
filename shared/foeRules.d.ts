export interface FoeState{id:string;hp:number;downUntil:number}
export interface FoeSlot{id:string;x:number;z:number}
export const FOE_RESPAWN_MS:number;
export const FOE_SLOTS:FoeSlot[];
export const FOE_IDS:string[];
export function foeSlot(id:string):FoeSlot|null;
export function foeEye(id:string):{x:number;y:number;z:number}|null;
export function freshFoes():FoeState[];
export function validFoeList(foes:unknown):foes is FoeState[];
export function reviveFoes(foes:FoeState[],now:number):FoeState[];
export function findFoeHit(origin:{x:number;y:number;z:number},yaw:number,pitch:number,foes:FoeState[],occluded?:(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number})=>boolean):{id:string;damage:number;point:{x:number;y:number;z:number};distance:number}|null;
export function applyFoeDamage(foes:FoeState[],id:string,now:number):{foes:FoeState[];damage:number};
export function publicFoes(foes:FoeState[]):FoeState[];
