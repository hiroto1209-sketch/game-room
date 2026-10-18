/** The blaster is standard kit. Shots are sent whenever the room is online. */
export function canBlasterFire(unlocked:boolean):boolean{
  return unlocked;
}
export function shouldSendPvpShot(online:boolean):boolean{
  return online;
}
