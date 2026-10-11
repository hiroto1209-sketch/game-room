export function recoilDelta(ads:boolean):{pitch:number;yaw:number}{
  return {pitch:ads?.006:.027,yaw:ads?.0015:.005};
}
