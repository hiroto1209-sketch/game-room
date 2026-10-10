/** Small deterministic offline arcade rules; no render loop or network packets. */
export type Mark="X"|"O"|null;
export type Board=Mark[];
export const lines=[
  [0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]
] as const;
export function winner(board:readonly Mark[]):Mark|"draw"{
  if(board.length!==9)return null;
  for(const [a,b,c] of lines){
    if(board[a]&&board[a]===board[b]&&board[a]===board[c])return board[a];
  }
  return board.every(v=>v!==null)?"draw":null;
}
export function play(board:readonly Mark[],index:number,mark:Exclude<Mark,null>):Board|null{
  if(board.length!==9||!Number.isInteger(index)||index<0||index>=9
    ||board[index]!==null||winner(board)!==null)return null;
  const next=[...board];next[index]=mark;return next;
}
export function computerMove(board:readonly Mark[]):number|null{
  if(board.length!==9||winner(board)!==null)return null;
  const blanks=board.map((v,i)=>v===null?i:-1).filter(v=>v>=0);
  for(const mark of ["O","X"] as const){
    for(const i of blanks){
      const next=play(board,i,mark);
      if(next&&winner(next)===mark)return i;
    }
  }
  for(const i of [4,0,2,6,8,1,3,5,7])if(board[i]===null)return i;
  return null;
}
export function targetIndex(round:number,seed:number):number{
  // One highlighted cell from a nine-cell arcade pad. Deterministic and cheap.
  return (Math.imul((round+1) ^ seed,0x9e3779b1)>>>0)%9;
}
