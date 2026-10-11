/** Small, allowlisted avatar choices. This is social display, never authentication. */
export const AVATAR_COLORS=Object.freeze(["rose","mint","sky","amber","violet"]);
export const AVATAR_HATS=Object.freeze(["none","cap","crown","halo"]);
export const EMOTES=Object.freeze(["wave","dance","cheer"]);
export const DEFAULT_AVATAR=Object.freeze({color:"rose",hat:"none"});
export const EMOTE_DURATION_MS=2600;
export function validAvatar(value){
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  return Object.keys(value).length===2&&
    Object.keys(value).every(k=>k==="color"||k==="hat")&&
    AVATAR_COLORS.includes(value.color)&&AVATAR_HATS.includes(value.hat);
}
export function validEmote(value){return typeof value==="string"&&EMOTES.includes(value)}
export function sanitizedAvatar(value){
  return validAvatar(value)?{color:value.color,hat:value.hat}:{...DEFAULT_AVATAR};
}
