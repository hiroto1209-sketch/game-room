// Pure 8×8 Reversi rules; used by browser practice and Cloudflare room authority.
export const BOARD_SIZE=8, EMPTY=0, BLACK=1, WHITE=2;
const DIRS=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
export const other=color=>color===BLACK?WHITE:BLACK;
export function initialBoard(){
  const board=Array(64).fill(0);
  board[3*8+3]=WHITE;board[3*8+4]=BLACK;
  board[4*8+3]=BLACK;board[4*8+4]=WHITE;
  return board;
}
export function freshMatch(blackId="",blackName="BLACK"){
  return {revision:0,status:blackId?"waiting":"idle",board:initialBoard(),turn:BLACK,
    blackId,whiteId:"",blackName,whiteName:"",winner:0,pass:false,lastMove:-1};
}
export function validMatch(s){
  return !!s&&typeof s==="object"&&Number.isSafeInteger(s.revision)&&s.revision>=0
    &&["idle","waiting","playing","paused","finished"].includes(s.status)
    &&Array.isArray(s.board)&&s.board.length===64
    &&s.board.every(n=>n===0||n===1||n===2)
    &&(s.turn===BLACK||s.turn===WHITE)
    &&typeof s.blackId==="string"&&s.blackId.length<=64
    &&typeof s.whiteId==="string"&&s.whiteId.length<=64
    &&typeof s.blackName==="string"&&s.blackName.length<=24
    &&typeof s.whiteName==="string"&&s.whiteName.length<=24
    &&[0,1,2,3].includes(s.winner)&&typeof s.pass==="boolean"
    &&Number.isInteger(s.lastMove)&&s.lastMove>=-1&&s.lastMove<64;
}
export function flipsAt(board,index,color){
  if(!Array.isArray(board)||board.length!==64||!Number.isInteger(index)||index<0||index>=64
    ||board[index]!==EMPTY||(color!==BLACK&&color!==WHITE))return [];
  const row=Math.floor(index/8),col=index%8,opponent=other(color);
  const result=[];
  for(const [dr,dc] of DIRS){
    let r=row+dr,c=col+dc;
    const line=[];
    while(r>=0&&r<8&&c>=0&&c<8&&board[r*8+c]===opponent){
      line.push(r*8+c);r+=dr;c+=dc;
    }
    if(line.length&&r>=0&&r<8&&c>=0&&c<8&&board[r*8+c]===color)result.push(...line);
  }
  return result;
}
export function legalMoves(board,color){
  const moves=[];
  for(let i=0;i<64;i++)if(flipsAt(board,i,color).length>0)moves.push(i);
  return moves;
}
export function counts(board){
  let black=0,white=0;
  for(const v of board){if(v===BLACK)black++;else if(v===WHITE)white++;}
  return {black,white,empty:64-black-white};
}
export function applyMove(match,index){
  if(!validMatch(match)||match.status!=="playing")return null;
  const flips=flipsAt(match.board,index,match.turn);
  if(flips.length===0)return null;
  const board=match.board.slice();
  board[index]=match.turn;
  for(const i of flips)board[i]=match.turn;
  const next=other(match.turn);
  const nextCan=legalMoves(board,next).length>0;
  const currentCan=legalMoves(board,match.turn).length>0;
  const finish=!nextCan&&!currentCan||counts(board).empty===0;
  const score=counts(board);
  const winner=finish?(score.black>score.white?BLACK:score.white>score.black?WHITE:3):0;
  return {...match,board,revision:match.revision+1,
    status:finish?"finished":"playing",winner,turn:nextCan?next:match.turn,
    pass:!finish&&!nextCan,lastMove:index};
}
