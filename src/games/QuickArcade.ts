import {winner,play,computerMove,targetIndex,type Board} from "./quickGames";

type Callbacks={onOpen():void;onClose():void};
type Kind="target"|"tic";
const $=<T extends HTMLElement=HTMLElement>(id:string):T=>{
  const e=document.getElementById(id);if(!e)throw new Error("Missing "+id);
  return e as T;
};
/** Local arcade games: no WebGL allocations, only DOM updates while modal open. */
export class QuickArcade{
  private readonly overlay=$("quick-game-overlay");
  private readonly heading=$("quick-game-title");
  private readonly info=$("quick-game-info");
  private readonly grid=$("quick-game-grid");
  private readonly restart=$<HTMLButtonElement>("quick-game-restart");
  private readonly close=$<HTMLButtonElement>("quick-game-close");
  private readonly cells:HTMLButtonElement[]=[];
  private kind:Kind|null=null;
  private board:Board=Array(9).fill(null);
  private targetRound=0;
  private targetCell=0;
  private targetScore=0;
  private targetSeed=15125;
  private endAt=0;
  private ticker:ReturnType<typeof setInterval>|null=null;
  private done=false;
  constructor(private callbacks:Callbacks){
    for(let i=0;i<9;i++){
      const cell=document.createElement("button");cell.type="button";
      cell.className="quick-game-cell";cell.dataset.index=String(i);
      cell.addEventListener("click",()=>this.press(i));
      this.grid.appendChild(cell);this.cells.push(cell);
    }
    this.close.addEventListener("click",()=>this.dismiss());
    this.restart.addEventListener("click",()=>this.reset());
  }
  get active():boolean{return this.kind!==null}
  open(kind:Kind):void{
    if(this.active)return;
    this.kind=kind;this.callbacks.onOpen();
    this.overlay.classList.remove("hidden");this.reset();
  }
  dismiss():void{
    if(!this.active)return;
    this.stopTimer();
    this.kind=null;this.overlay.classList.add("hidden");
    this.callbacks.onClose();
  }
  private stopTimer():void{if(this.ticker!==null){clearInterval(this.ticker);this.ticker=null;}}
  private reset():void{
    if(!this.kind)return;
    this.stopTimer();this.done=false;this.board=Array(9).fill(null);
    this.grid.classList.toggle("tic-board",this.kind==="tic");
    this.heading.textContent=this.kind==="tic"?"三目並べ · VS CPU":"NEON TARGET · 20秒チャレンジ";
    if(this.kind==="tic"){
      this.info.textContent="先攻はあなた（×）。3つそろえよう！";
    }else{
      this.targetRound=0;this.targetScore=0;
      this.targetSeed=Math.floor(performance.now())%17777+1;
      this.nextTarget();
      this.endAt=performance.now()+20000;
      this.ticker=setInterval(()=>this.refreshTargetTimer(),120);
      this.refreshTargetTimer();
    }
    this.render();
  }
  private nextTarget():void{
    // Ensure the target switches cells after each successful hit.
    const next=targetIndex(this.targetRound++,this.targetSeed);
    this.targetCell=next===this.targetCell?(next+1)%9:next;
  }
  private refreshTargetTimer():void{
    if(this.kind!=="target")return;
    const remain=Math.max(0,this.endAt-performance.now());
    if(remain===0){
      this.done=true;this.stopTimer();this.info.textContent="終了！ スコア "+this.targetScore+" HIT";
      this.render();return;
    }
    this.info.textContent="残り "+(remain/1000).toFixed(1)+"秒 · "+this.targetScore+" HIT";
  }
  private press(index:number):void{
    if(this.done)return;
    if(this.kind==="target"){
      if(performance.now()>=this.endAt){this.refreshTargetTimer();return;}
      if(index===this.targetCell){this.targetScore++;this.nextTarget();this.render();}
    }else if(this.kind==="tic"){
      const placed=play(this.board,index,"X");if(!placed)return;
      this.board=placed;
      let outcome=winner(this.board);
      if(!outcome){
        const cpu=computerMove(this.board);
        if(cpu!==null)this.board=play(this.board,cpu,"O")??this.board;
        outcome=winner(this.board);
      }
      if(outcome){
        this.done=true;
        this.info.textContent=outcome==="draw"?"引き分け！":outcome==="X"?"あなたの勝ち！":"CPUの勝ち！";
      }else this.info.textContent="あなたの番 · × を置いてください";
      this.render();
    }
  }
  private render():void{
    for(let i=0;i<9;i++){
      const b=this.cells[i];b.classList.remove("target-active");
      if(this.kind==="target"){
        b.textContent=!this.done&&i===this.targetCell?"✦":"·";
        b.classList.toggle("target-active",!this.done&&i===this.targetCell);
        b.disabled=this.done;
        b.setAttribute("aria-label","的 "+(i+1));
      }else{
        b.textContent=this.board[i]??"";
        b.disabled=this.done||this.board[i]!==null;
        b.setAttribute("aria-label",(i+1)+"番のマス "+(this.board[i]??"空き"));
      }
    }
  }
}
