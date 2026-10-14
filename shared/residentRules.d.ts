export type ResidentId='poko'|'tokotoko';
export type ResidentMotion={offset:number;holdStart:number;holdUntil:number;facingYaw:number};
export type ResidentPose={x:number;z:number;yaw:number;moving:boolean;animationTime:number};
export const POKO_ANCHOR:{x:number;z:number;radius:number;height:number};
export const TOKOTOKO:{scale:number;radius:number;height:number;speed:number};
export const RESIDENT_POINTS:{x:number;z:number;pause:number}[];
export const EMPTY_MOTION:ResidentMotion;
export const RESIDENT_CYCLE_SECONDS:number;
export function validResidentId(id:unknown):id is ResidentId;
export function validResidentMotion(s:unknown):s is ResidentMotion;
export function residentTimeAt(now:number,motion?:ResidentMotion):number;
export function residentPoseAt(timeMs:number):ResidentPose;
export function currentResidentPose(now:number,motion?:ResidentMotion):ResidentPose;
export function holdResident(now:number,motion:ResidentMotion,viewer:{x:number;z:number},extend?:boolean):ResidentMotion;
export function residentStepBlocked(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number},radius?:number,now?:number,motion?:ResidentMotion):boolean;
export function canTalkToResident(id:unknown,player:{x:number;y:number;z:number},now:number,motion?:ResidentMotion):boolean;

export function residentHeightAt(x:number,z:number,ceiling:number,now?:number,motion?:ResidentMotion):number;
