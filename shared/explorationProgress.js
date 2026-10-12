export const EXPLORATION_STAMPS=[
  {id:"echo",label:"ECHO GROTTO",x:72,z:32},
  {id:"trail",label:"SECRET STONE PATH",x:80,z:33},
  {id:"skylook",label:"SKYLOOK",x:90,z:37}
];
export function safeDiscovered(input){
  if(!Array.isArray(input))return [];
  const allowed=new Set(EXPLORATION_STAMPS.map(s=>s.id));
  return [...new Set(input.filter(id=>typeof id==="string"&&allowed.has(id)))];
}
export function earnStamp(found,id){
  const before=safeDiscovered(found);
  if(!EXPLORATION_STAMPS.some(s=>s.id===id))return {found:before,newlyFound:false};
  if(before.includes(id))return {found:before,newlyFound:false};
  return {found:[...before,id],newlyFound:true};
}
