/** Short synthesized blaster shot. One AudioContext, resumed on the first touch.
 * iOS Safari stays silent until resume() runs inside a user gesture.
 */
export class BlasterAudio{
  private context:AudioContext|null=null;
  private noise:AudioBuffer|null=null;
  private master:GainNode|null=null;
  enabled=true;
  get unlocked():boolean{return this.context?.state==="running"}
  /** Safe to call from every pointerdown/touchstart. Creates nothing until then. */
  unlock():void{
    const Ctx=window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(!Ctx)return;
    if(!this.context){
      this.context=new Ctx();
      this.master=this.context.createGain();
      this.master.gain.value=.35;
      this.master.connect(this.context.destination);
      const seconds=.09;
      const length=Math.max(1,Math.floor(this.context.sampleRate*seconds));
      const buffer=this.context.createBuffer(1,length,this.context.sampleRate);
      const data=buffer.getChannelData(0);
      for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);
      this.noise=buffer;
    }
    if(this.context.state==="suspended")void this.context.resume();
  }
  shot():void{
    if(!this.enabled||!this.context||!this.noise||!this.master)return;
    if(this.context.state!=="running")return;
    const t=this.context.currentTime;
    const src=this.context.createBufferSource();
    src.buffer=this.noise;
    const filter=this.context.createBiquadFilter();
    filter.type="highpass";
    filter.frequency.value=900;
    const gain=this.context.createGain();
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(.55,t+.006);
    gain.gain.exponentialRampToValueAtTime(.0001,t+.07);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);src.stop(t+.08);
    const osc=this.context.createOscillator();
    osc.type="triangle";
    osc.frequency.setValueAtTime(520,t);
    osc.frequency.exponentialRampToValueAtTime(140,t+.055);
    const tone=this.context.createGain();
    tone.gain.setValueAtTime(.0001,t);
    tone.gain.exponentialRampToValueAtTime(.16,t+.004);
    tone.gain.exponentialRampToValueAtTime(.0001,t+.05);
    osc.connect(tone).connect(this.master);
    osc.start(t);osc.stop(t+.06);
  }
}
