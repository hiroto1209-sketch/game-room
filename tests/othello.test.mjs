import test from "node:test";
import assert from "node:assert/strict";
import {BLACK,WHITE,initialBoard,freshMatch,flipsAt,legalMoves,applyMove,counts,validMatch}
  from "../shared/othello.js";
import {decodeMessage} from "../server/src/guards.js";
import {parseIncoming,validateOutgoing} from "../src/network/protocol.ts";

test("initial Reversi board has exactly four pieces and standard legal openings",()=>{
  const board=initialBoard();
  assert.equal(board.length,64);
  assert.deepEqual(counts(board),{black:2,white:2,empty:60});
  assert.deepEqual(legalMoves(board,BLACK).sort((a,b)=>a-b),[19,26,37,44]);
  assert.deepEqual(flipsAt(board,19,BLACK),[27]);
  assert.equal(flipsAt(board,0,BLACK).length,0);
});
test("placing a legal black piece flips white, alternates turn and increases revision",()=>{
  const m={...freshMatch("player_black","Black"),whiteId:"player_white",whiteName:"White",status:"playing"};
  const a=applyMove(m,19);
  assert.ok(a);assert.equal(a.turn,WHITE);
  assert.equal(a.board[19],BLACK);assert.equal(a.board[27],BLACK);
  assert.deepEqual(counts(a.board),{black:4,white:1,empty:59});
  assert.equal(a.revision,1);
  assert.equal(applyMove(m,0),null);
  assert.equal(m.board[19],0,"pure reducer must never mutate saved state");
});
test("full board correctly ends with scored winner",()=>{
  const board=Array(64).fill(BLACK);
  board[0]=EMPTY;board[1]=WHITE;board[2]=BLACK;
  const m={...freshMatch("one","Black"),whiteId:"two",whiteName:"White",status:"playing",board};
  const final=applyMove(m,0);
  assert.ok(final);
  assert.equal(final.status,"finished");assert.equal(final.winner,BLACK);
  assert.equal(final.board.every(n=>n===BLACK),true);
});
test("server rejects illegal Othello packet, index, unknown action, extra keys",()=>{
  assert.deepEqual(decodeMessage('{"type":"othello","action":"start"}'),{type:"othello",action:"start"});
  assert.deepEqual(decodeMessage('{"type":"othello","action":"place","index":19}'),{type:"othello",action:"place",index:19});
  for(const str of ['{"type":"othello","action":"place","index":64}',
    '{"type":"othello","action":"place","index":-1}',
    '{"type":"othello","action":"place","index":"19"}',
    '{"type":"othello","action":"admin"}',
    '{"type":"othello","action":"start","isHost":true}'])
    assert.equal(decodeMessage(str),null,str);
  assert.equal(validateOutgoing({type:"othello",action:"place",index:19}),true);
  assert.equal(validateOutgoing({type:"othello",action:"place",index:100}),false);
});
test("client validates Othello snapshot shape and rejects malformed data",()=>{
  const match=freshMatch("playerA","Mina");
  assert.equal(validMatch(match),true);
  const parsed=parseIncoming(JSON.stringify({type:"othello_state",match}));
  assert.equal(parsed?.type,"othello_state");
  assert.equal(parseIncoming(JSON.stringify({type:"othello_state",match:{...match,board:[1]}})),null);
  assert.equal(parseIncoming(JSON.stringify({type:"othello_state",match:{...match,turn:300}})),null);
});
