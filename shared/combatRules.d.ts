export interface Position{x:number;y:number;z:number}
export interface Combatant{id:string;hp:number;position:Position}
export const ARENA:{minX:number;maxX:number;minZ:number;maxZ:number};
export const ARENA_RESPAWN:Position;
export const MAX_HP:number,DAMAGE:number,RANGE:number,SHOT_COOLDOWN_MS:number,RESPAWN_MS:number,SPAWN_SHIELD_MS:number;
export function inArena(p:Position):boolean;
export function validSignText(value:unknown):boolean;
export function signText(value:unknown):string|null;
export function aimDirection(yaw:number,pitch:number):Position;
export function raySphereDistance(origin:Position,direction:Position,center:Position,radius:number):number|null;
export function findHitscanTarget(shooter:Combatant,players:Combatant[],yaw:number,pitch:number,occluded?:(from:Position,to:Position)=>boolean):(Combatant&{distance?:number})|null;

export const WEAPON_CODE:string;
export const WING_CODE:string;
export function validUnlockCode(v:unknown):v is string;
export const LOOK_YAW_RATE:number, LOOK_PITCH_RATE:number;
export function angleDelta(from:number,to:number):number;
export function aimAllowance(elapsedMs:number):{yaw:number;pitch:number};
export function aimWithinRate(previous:{yaw:number;pitch:number}|null|undefined,next:{yaw:number;pitch:number}|null|undefined,elapsedMs:number):boolean;
