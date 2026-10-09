import * as THREE from "three";

const MAX_BYTES=8*1024*1024;
const MIME_TYPES=new Set(["image/jpeg","image/png","image/webp","image/gif"]);
const MAX_DIMENSION=8192;

/**
 * One local wall display. Photos selected by a player are never uploaded.
 * A future shared-image feature must explicitly use server-owned storage and permissions.
 */
export class MediaMonitor {
  readonly group=new THREE.Group();
  private readonly canvas=document.createElement("canvas");
  private readonly context:CanvasRenderingContext2D;
  private readonly texture:THREE.CanvasTexture;

  constructor(scene:THREE.Scene,x:number,y:number,z:number){
    this.canvas.width=1024;
    this.canvas.height=576;
    const context=this.canvas.getContext("2d");
    if(!context)throw new Error("2D monitor canvas is unavailable");
    this.context=context;
    this.texture=new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace=THREE.SRGBColorSpace;
    this.texture.minFilter=THREE.LinearFilter;
    this.texture.magFilter=THREE.LinearFilter;

    this.group.position.set(x,y,z);
    // Plane faces local +Z; orient it toward the center of the party room (-X).
    this.group.rotation.y=-Math.PI/2;
    const backing=new THREE.Mesh(
      new THREE.BoxGeometry(2.72,1.74,.12),
      new THREE.MeshStandardMaterial({color:0x1a1622,roughness:.42,metalness:.5})
    );
    this.group.add(backing);
    const trim=new THREE.Mesh(
      new THREE.BoxGeometry(2.55,1.57,.015),
      new THREE.MeshStandardMaterial({color:0xd9a1cc,metalness:.65,roughness:.3,emissive:0x4a1742,emissiveIntensity:.22})
    );
    trim.position.z=.069;
    this.group.add(trim);
    const screen=new THREE.Mesh(
      new THREE.PlaneGeometry(2.45,1.38),
      new THREE.MeshBasicMaterial({map:this.texture,toneMapped:false})
    );
    screen.position.z=.085;
    this.group.add(screen);
    const status=new THREE.Mesh(
      new THREE.SphereGeometry(.035,10,6),
      new THREE.MeshBasicMaterial({color:0x83ffd4})
    );
    status.position.set(1.23,-.79,.11);
    this.group.add(status);
    scene.add(this.group);
    this.drawPlaceholder();
  }
  private drawPlaceholder():void{
    const ctx=this.context;
    const bg=ctx.createLinearGradient(0,0,1024,576);
    bg.addColorStop(0,"#261b3f");bg.addColorStop(1,"#46213f");
    ctx.fillStyle=bg;ctx.fillRect(0,0,1024,576);
    ctx.strokeStyle="#e88fc96a";ctx.lineWidth=6;
    ctx.strokeRect(40,40,944,496);
    ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillStyle="#fff6eb";ctx.font="bold 89px Arial,sans-serif";
    ctx.fillText("YOUR PHOTO",512,246);
    ctx.font="34px Arial,sans-serif";ctx.fillStyle="#ffd4e5";
    ctx.fillText("COME CLOSER TO CUSTOMIZE",512,344);
    this.texture.needsUpdate=true;
  }
  clear():void{this.drawPlaceholder()}
  async setFile(file:File):Promise<void>{
    if(!MIME_TYPES.has(file.type))throw new Error("JPEG・PNG・WebP・GIFのみ表示できます");
    await this.renderBlob(file);
  }
  async setUrl(value:string):Promise<void>{
    let url:URL;
    try{url=new URL(value)}catch{throw new Error("有効な画像URLを入力してください")}
    if(url.protocol!=="https:")throw new Error("HTTPSの画像URLを指定してください");
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(url.toString(),{method:"GET",mode:"cors",credentials:"omit",signal:controller.signal});
      if(!response.ok)throw new Error("画像の取得に失敗しました");
      const type=(response.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
      if(!MIME_TYPES.has(type))throw new Error("画像ファイルへの直接URLを指定してください");
      if(Number(response.headers.get("content-length")||0)>MAX_BYTES)throw new Error("画像は8MB以下にしてください");
      const reader=response.body?.getReader();
      if(!reader){
        const blob=await response.blob();
        await this.renderBlob(blob);
        return;
      }
      const chunks:Uint8Array[]=[];
      let total=0;
      while(true){
        const {value,done}=await reader.read();
        if(done)break;
        if(value){
          total+=value.byteLength;
          if(total>MAX_BYTES){await reader.cancel();throw new Error("画像は8MB以下にしてください")}
          chunks.push(value);
        }
      }
      await this.renderBlob(new Blob(chunks as BlobPart[],{type}));
    }catch(error){
      if((error as Error).name==="AbortError")throw new Error("画像の読み込みがタイムアウトしました");
      if(error instanceof TypeError)throw new Error("画像URLのCORS制限で読み込めません。写真から選択してください");
      throw error;
    }finally{
      window.clearTimeout(timeout);
    }
  }
  private async renderBlob(blob:Blob):Promise<void>{
    if(blob.size>MAX_BYTES)throw new Error("画像は8MB以下にしてください");
    if(blob.size===0)throw new Error("空の画像です");
    const objectURL=URL.createObjectURL(blob);
    const img=new Image();
    try{
      img.src=objectURL;
      await img.decode();
      if(img.naturalWidth===0||img.naturalHeight===0||
        img.naturalWidth>MAX_DIMENSION||img.naturalHeight>MAX_DIMENSION){
        throw new Error("画像解像度が大きすぎます（最大8192px）");
      }
      const ctx=this.context;
      ctx.fillStyle="#100f18";ctx.fillRect(0,0,1024,576);
      const ratio=Math.min(1024/img.naturalWidth,576/img.naturalHeight);
      const w=img.naturalWidth*ratio,h=img.naturalHeight*ratio;
      ctx.drawImage(img,(1024-w)/2,(576-h)/2,w,h);
      this.texture.needsUpdate=true;
    }finally{URL.revokeObjectURL(objectURL)}
  }
  dispose():void{
    this.group.parent?.remove(this.group);
    this.texture.dispose();
    this.group.traverse(obj=>{
      if(obj instanceof THREE.Mesh){
        obj.geometry.dispose();
        const materials=Array.isArray(obj.material)?obj.material:[obj.material];
        materials.forEach(m=>m.dispose());
      }
    });
  }
}
