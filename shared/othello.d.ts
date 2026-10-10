export type Disc=0|1|2;
export type MatchStatus="idle"|"waiting"|"playing"|"finished";
export interface OthelloMatch{
  revision:number;status:MatchStatus;board:Disc[];turn:1|2;
  blackId:string;whiteId:string;blackName:string;whiteName:string;
  winner:0|1|2|3;pass:boolean;lastMove:number;
}
export const BOARD_SIZE:8,EMPTY:0,BLACK:1,WHITE:2;
export function other(color:1|2):1|2;
export function initialBoard():Disc[];
export function freshMatch(blackId?:string,blackName?:string):OthelloMatch;
export function validMatch(value:unknown):value is OthelloMatch;
export function flipsAt(board:Disc[],index:number,color:1|2):number[];
export function legalMoves(board:Disc[],color:1|2):number[];
export function counts(board:Disc[]):{black:number;white:number;empty:number};
export function applyMove(match:OthelloMatch,index:number):OthelloMatch|null;
