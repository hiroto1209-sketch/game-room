/** 360° recoil with exactly 80% of the previous 2D recoil magnitude.
 * Recoil is applied AFTER the current shot ray has been sent; this changes
 * subsequent aim, never fabricates a server hit.
 *
 * Math.random() supplies a uniform angle in [0, 2π). Inject random for tests.
 */
const OLD_RECOIL={hip:{pitch:.027,yaw:.005},ads:{pitch:.006,yaw:.0015}} as const;
export const RECOIL_SCALE=.8;
export function recoilMagnitude(ads:boolean):number{
  const base=ads?OLD_RECOIL.ads:OLD_RECOIL.hip;
  return Math.hypot(base.pitch,base.yaw)*RECOIL_SCALE;
}
export function recoilDelta(ads:boolean,random:()=>number=Math.random):{pitch:number;yaw:number}{
  const unit=Math.max(0,Math.min(.9999999999999999,random()));
  const angle=unit*Math.PI*2;
  const magnitude=recoilMagnitude(ads);
  return {pitch:Math.sin(angle)*magnitude,yaw:Math.cos(angle)*magnitude};
}
