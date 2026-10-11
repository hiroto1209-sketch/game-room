/** PvP is opt-in, while local solo skill practice never exposes peers to damage. */
export function canBlasterFire(unlocked:boolean,peaceful:boolean,training:boolean):boolean{
  return unlocked&&(training||!peaceful);
}
export function shouldSendPvpShot(online:boolean,peaceful:boolean,training:boolean):boolean{
  return online&&!peaceful&&!training;
}
