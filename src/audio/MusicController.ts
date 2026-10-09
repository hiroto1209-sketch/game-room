/** Optional tiny WebAudio sequence. No music is loaded from external servers. */
export class MusicController{
  private context:AudioContext|null=null;
  private timer:ReturnType<typeof setInterval>|null=null;
  private beat=0;
  private note(frequency:number,time:number,duration:number,volume=.026):void{
    if(!this.context)return;
    const osc=this.context.createOscillator();
    const gain=this.context.createGain();
    osc.type="triangle";
    osc.frequency.setValueAtTime(frequency,time);
    gain.gain.setValueAtTime(.0001,time);
    gain.gain.exponentialRampToValueAtTime(volume,time+.015);
    gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
    osc.connect(gain).connect(this.context.destination);
    osc.start(time);osc.stop(time+duration+.03);
  }
  async start():Promise<void>{
    if(this.timer!==null)return;
    this.context??=new AudioContext();
    await this.context.resume();
    const melody=[220,261.6,329.6,392,329.6,261.6,246.9,293.7];
    const tick=()=>{
      const ctx=this.context;
      if(!ctx||ctx.state!=="running")return;
      const now=ctx.currentTime+.025;
      this.note(melody[this.beat%melody.length],now,.26);
      if(this.beat%4===0)this.note(110,now,.37,.015);
      this.beat++;
    };
    tick();this.timer=setInterval(tick,325);
  }
  stop():void{
    if(this.timer!==null)clearInterval(this.timer);
    this.timer=null;
    void this.context?.suspend();
  }
}
