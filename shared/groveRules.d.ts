export const GROVE: {minX:number;maxX:number;minZ:number;maxZ:number};
export const STONE: {x:number;z:number};
export const GUIDE: {x:number;z:number};
export const SMITH: {x:number;z:number};
export const GROVE_BODY: number;
export const GROVE_RANK_STEP: number;
export const KINDS: Record<MonsterKind, {hp:number;speed:number;range:number;aggro:number;damage:number;cooldown:number;radius:number;height:number;weak:number;minRange?:number}>;
export type MonsterKind = "rush"|"spit"|"elite";
export type MonsterAnim = "idle"|"patrol"|"chase"|"attack"|"stagger"|"dead";
export interface MonsterView {
  id:number; kind:MonsterKind; hp:number; maxHp:number;
  x:number; z:number; yaw:number; state:MonsterAnim;
}
export interface GroveView {
  wave:number; phase:"idle"|"fight"|"clear"; kills:number; eliteDown:boolean;
  monsters:MonsterView[];
}
export interface GroveState extends GroveView {
  nextId:number;
  monsters:Array<MonsterView & {
    cooldown:number; wind:number; stagger:number; deadFor:number; patrol:number;
    ax:number; az:number; bx:number; bz:number;
  }>;
}
export interface GroveHurt {type:"hurt"; playerId:string; damage:number; monsterId:number; kind:MonsterKind}
export interface GroveShot {
  state:GroveState; distance:number; id:number; kind:MonsterKind; damage:number; crit:boolean;
  hp:number; killed:boolean; point:{x:number;y:number;z:number};
}
export function inGrove(p:{x:number;z:number}|null|undefined):boolean;
export function nearStone(p:{x:number;z:number}|null|undefined):boolean;
export function freshGrove():GroveState;
export function shotDamage(rank:number):number;
export function rankForKills(kills:number):number;
export function beginWave(state:GroveState):GroveState;
export function stepGrove(state:GroveState, dt:number, players:Array<{id:string;x:number;z:number;hp:number}>):{state:GroveState; events:GroveHurt[]};
export function monsterFoot(m:{x:number;z:number}):number;
export function shootGrove(state:GroveState, origin:{x:number;y:number;z:number}, yaw:number, pitch:number, rank?:number):GroveShot|null;
export function questCopy(state:GroveView):{title:string; body:string};
export function guideLines(state:GroveView):[string, string];
export function smithLines(state:GroveView, rank:number):[string, string];
export function viewOf(state:GroveState):GroveView;
export function validGroveView(value:unknown):value is GroveView;
