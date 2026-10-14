/** Shared, bounded resident motion; no timers, client-selected positions or NPC loops. */
export const POKO_ANCHOR={x:18,z:-6.1,radius:.57,height:1.5};
export const TOKOTOKO={scale:.65,radius:.60,height:1.88,speed:.62};
export const RESIDENT_POINTS=[
 {x:14,z:12,pause:7},{x:16,z:29,pause:5},{x:7,z:33,pause:9},
 {x:-12,z:33,pause:6},{x:-18,z:19,pause:8},{x:-18,z:-23,pause:7},
 {x:-6,z:-23,pause:9},{x:-18,z:-23,pause:5},{x:-18,z:19,pause:6},
 {x:-12,z:33,pause:4},{x:7,z:33,pause:7},{x:16,z:29,pause:5}
];
export const EMPTY_MOTION={offset:0,holdStart:0,holdUntil:0,facingYaw:0};
export function validResidentId(id){return id==='poko'||id==='tokotoko'}
export function validResidentMotion(s){
 return !!s&&typeof s==='object'&&['offset','holdStart','holdUntil','facingYaw'].every(k=>typeof s[k]==='number'&&Number.isFinite(s[k]))
  &&s.offset>=0&&s.offset<=1e12&&s.holdStart>=0&&s.holdUntil>=s.holdStart&&s.holdUntil-s.holdStart<=12000&&Math.abs(s.facingYaw)<=Math.PI*2;
}
export function residentTimeAt(now,motion=EMPTY_MOTION){
 return now-motion.offset-Math.max(0,Math.min(now-motion.holdStart,motion.holdUntil-motion.holdStart));
}
const legDuration=(a,b)=>Math.hypot(b.x-a.x,b.z-a.z)/TOKOTOKO.speed;
export const RESIDENT_CYCLE_SECONDS=RESIDENT_POINTS.reduce((n,p,i)=>n+p.pause+legDuration(p,RESIDENT_POINTS[(i+1)%RESIDENT_POINTS.length]),0);
export function residentPoseAt(timeMs){
 let t=((timeMs/1000)%RESIDENT_CYCLE_SECONDS+RESIDENT_CYCLE_SECONDS)%RESIDENT_CYCLE_SECONDS;
 for(let i=0;i<RESIDENT_POINTS.length;i++){
  const a=RESIDENT_POINTS[i],b=RESIDENT_POINTS[(i+1)%RESIDENT_POINTS.length],yaw=Math.atan2(b.x-a.x,b.z-a.z);
  if(t<a.pause)return {x:a.x,z:a.z,yaw,moving:false,animationTime:t};
  t-=a.pause;const duration=legDuration(a,b);
  if(t<duration)return {x:a.x+(b.x-a.x)*t/duration,z:a.z+(b.z-a.z)*t/duration,yaw,moving:true,animationTime:t};
  t-=duration;
 }
 return {...RESIDENT_POINTS[0],yaw:0,moving:false,animationTime:0};
}
export function currentResidentPose(now,motion=EMPTY_MOTION){
 const pose=residentPoseAt(residentTimeAt(now,motion));
 return now<motion.holdUntil?{...pose,yaw:motion.facingYaw,moving:false}:pose;
}
export function holdResident(now,motion,viewer,extend=false){
 if(now<motion.holdUntil&&!extend)return {...motion}; // only an active, near conversation can renew the bounded hold
 const time=residentTimeAt(now,motion),pose=residentPoseAt(time);
 return {offset:now-time,holdStart:now,holdUntil:now+12000,facingYaw:Math.atan2(viewer.x-pose.x,viewer.z-pose.z)};
}
export function residentHeightAt(x,z,ceiling,now=Date.now(),motion=EMPTY_MOTION){
 const pose=currentResidentPose(now,motion);let height=0;
 for(const c of [POKO_ANCHOR,{...pose,radius:TOKOTOKO.radius,height:TOKOTOKO.height}])
  if(Math.hypot(x-c.x,z-c.z)<c.radius-.08&&c.height<=ceiling+.01)height=Math.max(height,c.height);
 return height;
}
export function residentStepBlocked(from,to,radius=.36,now=Date.now(),motion=EMPTY_MOTION){
 const pose=currentResidentPose(now,motion);
 for(const c of [POKO_ANCHOR,{...pose,radius:TOKOTOKO.radius,height:TOKOTOKO.height}]){
  if(to.y-1.65>=c.height-.01||to.y+.12<=0)continue;
  const before=Math.hypot(from.x-c.x,from.z-c.z),after=Math.hypot(to.x-c.x,to.z-c.z),limit=radius+c.radius;
  // A roaming resident may approach a stationary player. Always allow escape
  // from an existing overlap; never trap the player inside a moving collider.
  if(after<limit&&!(before<limit&&after>before+1e-7))return true;
 }
 return false;
}
export function canTalkToResident(id,player,now,motion=EMPTY_MOTION){
 if(!validResidentId(id)||!player||![player.x,player.y,player.z].every(Number.isFinite))return false;
 const pose=id==='poko'?POKO_ANCHOR:currentResidentPose(now,motion);
 return Math.hypot(player.x-pose.x,player.z-pose.z)<2.8&&Math.abs(player.y-1.65)<2.2;
}
