import test from "node:test";
import assert from "node:assert/strict";
import {winner,play,computerMove,targetIndex} from "../src/games/quickGames.ts";

test("three-in-a-row wins for every direction and full board draws",()=>{
  for(const line of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]){
    const board=Array(9).fill(null);
    for(const n of line)board[n]="X";
    assert.equal(winner(board),"X",line.join(","));
  }
  assert.equal(winner(["X","O","X","X","O","O","O","X","X"]),"draw");
});
test("tic-tac-toe doesn't overwrite cells, play after ending, or mutate state",()=>{
  const b=Array(9).fill(null);
  const next=play(b,4,"X");
  assert.ok(next);
  assert.equal(b[4],null);
  assert.equal(play(next,4,"O"),null);
  assert.equal(play(next,9,"O"),null);
  assert.equal(play(next,-1,"O"),null);
  assert.equal(play(["X","X","X","O",null,"O",null,null,null],4,"O"),null);
});
test("CPU wins if able and blocks immediate loss",()=>{
  assert.equal(computerMove(["O","O",null,"X",null,null,"X",null,null]),2);
  assert.equal(computerMove(["X","X",null,"O",null,null,null,"O",null]),2);
  assert.equal(computerMove(Array(9).fill(null)),4);
  assert.equal(computerMove(["X","X","X",null,null,null,null,null,null]),null);
});
test("target pad returns valid cells with changing levels",()=>{
  const cells=Array.from({length:50},(_,i)=>targetIndex(i,12345));
  assert.equal(cells.length,50);
  assert.ok(cells.every(i=>i>=0&&i<9));
  assert.ok(new Set(cells).size>=5);
  assert.deepEqual(cells,Array.from({length:50},(_,i)=>targetIndex(i,12345)));
});
