/** Upward-biased recoil at 80% of the previous hip/ADS vector length.
 * About 70% of the magnitude is always a positive pitch kick (muzzle climbs).
 * The remaining 30% is yaw, with a small pitch jitter, so shots climb instead
 * of kicking randomly downward. Applied AFTER the current shot ray is sent.
 *
 * Math.random() supplies a uniform angle in [0, 2π). Inject random for tests.
 */
const OLD_RECOIL={hip:{pitch:.027,yaw:.005},ads:{pitch:.006,yaw:.0015}} as const;
export const RECOIL_SCALE=.8;
export const RECOIL_UP_SHARE=.7;
export function recoilMagnitude(ads:boolean):number{
  const base=ads?OLD_RECOIL.ads:OLD_RECOIL.hip;
  return Math.hypot(base.pitch,base.yaw)*RECOIL_SCALE;
}
export function recoilDelta(ads:boolean,random:()=>number=Math.random):{pitch:number;yaw:number}{
  const unit=Math.max(0,Math.min(.9999999999999999,random()));
  const angle=unit*Math.PI*2;
  const magnitude=recoilMagnitude(ads);
  const climb=magnitude*RECOIL_UP_SHARE;
  const spread=magnitude*(1-RECOIL_UP_SHARE);
  return {
    pitch:climb+Math.sin(angle)*spread*.35,
    yaw:Math.cos(angle)*spread
  };
}
