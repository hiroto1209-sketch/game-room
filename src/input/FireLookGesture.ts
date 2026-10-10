/**
 * Each touch retains ownership independently. Pointer capture on FIRE keeps
 * the firing finger's drag events even when it slides outside the button.
 */
export class FireLookGesture{
  private owner:number|null=null;
  private x=0;private y=0;
  get active():boolean{return this.owner!==null}
  begin(id:number,x:number,y:number):boolean{
    if(this.owner!==null)return false;
    this.owner=id;this.x=x;this.y=y;return true;
  }
  move(id:number,x:number,y:number):{dx:number;dy:number}|null{
    if(id!==this.owner)return null;
    const dx=Math.max(-65,Math.min(65,x-this.x));
    const dy=Math.max(-65,Math.min(65,y-this.y));
    this.x=x;this.y=y;return {dx,dy};
  }
  end(id:number):boolean{
    if(id!==this.owner)return false;
    this.owner=null;return true;
  }
  reset():void{this.owner=null}
}
