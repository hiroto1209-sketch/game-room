export interface GridCollider{x0:number;x1:number;z0:number;z1:number;y0?:number;y1?:number;walkable?:boolean}
export type DecoItem={x:number;z:number;size?:number;twist?:number;height?:number;color?:number};
export type ChunkData={cx:number;cz:number;centerX:number;centerZ:number;grass:DecoItem[];trees:DecoItem[];rocks:DecoItem[];blocks:DecoItem[]};
export const WORLD_SEED:number;
export const OUTDOOR:{minX:number;maxX:number;minZ:number;maxZ:number;chunkSize:number;columns:number;rows:number};
export const HOUSE:{
  main:{minX:number;maxX:number;minZ:number;maxZ:number};
  hall:{minX:number;maxX:number;minZ:number;maxZ:number};
  armory:{minX:number;maxX:number;minZ:number;maxZ:number}};
export const DOOR:{x:number;minZ:number;maxZ:number};
export const POND:{x:number;z:number;rx:number;rz:number};
export const SPAWN:{x:number;y:number;z:number};
export const HIDDEN_WORLD:{
  entrance:{x:number;z:number};rune:{x:number;z:number};
  trail:{x:number;z:number};vista:{x:number;z:number};
  caveStart:number;caveEnd:number;caveMinZ:number;caveMaxZ:number
};
export function hiddenTrailDistance(x:number,z:number):number;
export function nearExplorationFeature(x:number,z:number,clearance?:number):boolean;
export function groundHeightAt(x:number,z:number,ceiling?:number):number;
export function terrainVisualHeightAt(x:number,z:number):number;
export function insideHouse(x:number,z:number,margin?:number):boolean;
export function crossesHouseWall(from:{x:number;z:number},to:{x:number;z:number}):boolean;
export function terrainSlopeAt(x:number,z:number):number;
export function shotObstructed(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number}):boolean;
export function hashCell(cx:number,cz:number,seed?:number):number;
export function chunkData(cx:number,cz:number,seed?:number):ChunkData|null;
export function insidePond(x:number,z:number,margin?:number):boolean;
export function outdoorRegion(x:number,z:number):boolean;
export function validWorldPosition(p:unknown):boolean;
export function crossesClosedEastWall(from:{x:number;z:number},to:{x:number;z:number}):boolean;
export function outdoorColliderBoxes():GridCollider[];
export function outsideBounds(x:number,z:number,radius?:number):boolean;
export function worldBlocked(x:number,z:number,radius?:number,eye?:number):boolean;
export function validWorldStep(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number},residents?:{now:number;motion:import("./residentRules.js").ResidentMotion;jumpBase?:number}):boolean;

export function walkableHeightAt(x:number,z:number,ceiling?:number):number;
