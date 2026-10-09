import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";

// GAME ROOM Phase 1 — all 3D geometry is generated locally (no asset downloads).
const $ = id => document.getElementById(id);
const el = { canvas:$("scene"), loading:$("loading"), start:$("start-screen"), hud:$("hud"),
  menu:$("menu-overlay"), joy:$("joystick"), knob:$("joystick-thumb"),
  interaction:$("interaction"), interactionText:$("interaction-text"), toast:$("toast"), tips:$("tips") };
const cfg = { sensitivity:4, exposure:1, reducedMotion:false, sound:false };
const game = { ready:false, playing:false, paused:false, time:0, showToastUntil:0, partyMode:false };
const p = { x:0,z:15,y:1.65,height:1.65,radius:.36,yaw:0,pitch:0,vx:0,vz:0,vy:0,grounded:true };
const fingers = { move:null, look:null, x0:0,y0:0,lastX:0,lastY:0,jx:0,jy:0 };
const keys = new Set(), colliders=[], balloons=[], floorMats=[], lamps=[], targets=[];
let currentTarget=null,renderer,scene,camera,ball,musicContext=null,musicTimer=null,beat=0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let randomSeed=87241;
const rand=()=>((randomSeed=(randomSeed*1664525+1013904223)>>>0)/4294967296);
const mat=(color,options={})=>new THREE.MeshStandardMaterial({color,roughness:.84,...options});
function cube(x,y,z,w,h,d,m,blocking=false){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  mesh.position.set(x,y,z);scene.add(mesh);
  if(blocking)colliders.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2});
  return mesh;
}
function globe(x,y,z,r,m){
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),m);
  mesh.position.set(x,y,z);scene.add(mesh);return mesh;
}
function tube(x,y,z,a,b,h,m,n=12){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(a,b,h,n),m);
  mesh.position.set(x,y,z);scene.add(mesh);return mesh;
}
function light(color,power,x,y,z,range=10){
  const obj=new THREE.PointLight(color,power,range,2);
  obj.position.set(x,y,z);scene.add(obj);return obj;
}
function canvasTex(kind,rx,ry){
  const c=document.createElement("canvas");c.width=c.height=256;
  const ctx=c.getContext("2d");
  const bases={wall:[111,78,90],wood:[103,71,78],carpet:[88,65,79],ceiling:[139,117,117]};
  const rgb=bases[kind], image=ctx.createImageData(256,256);
  for(let i=0;i<image.data.length;i+=4){
    const n=(rand()-.5)*(kind==="carpet"?55:27);
    image.data[i]=rgb[0]+n;image.data[i+1]=rgb[1]+n;image.data[i+2]=rgb[2]+n;image.data[i+3]=255;
  }
  ctx.putImageData(image,0,0);
  if(kind==="wall"){
    ctx.strokeStyle="#ca94a055";ctx.lineWidth=2;
    for(let x=0;x<256;x+=25){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,256);ctx.stroke();}
    ctx.fillStyle="#f6cbbc24";
    for(let x=5;x<256;x+=25)for(let y=9;y<256;y+=25)ctx.fillRect(x,y,2,2);
  }else if(kind==="wood"){
    ctx.strokeStyle="#2c1c254c";ctx.lineWidth=3;
    for(let y=0;y<256;y+=32){
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();
      for(let x=(y/32%2)*64;x<256;x+=128){
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+32);ctx.stroke();
      }
    }
  }else if(kind==="ceiling"){
    ctx.strokeStyle="#564450a0";ctx.lineWidth=3;
    for(let i=0;i<256;i+=64){
      ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,256);ctx.moveTo(0,i);ctx.lineTo(256,i);ctx.stroke();
    }
    ctx.fillStyle="#544553aa";
    for(let x=11;x<256;x+=17)for(let y=11;y<256;y+=17)ctx.fillRect(x,y,2,2);
  }
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(rx,ry);
  tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return tex;
}
function textImage(title,subtitle,color="#ffc7e2"){
  const c=document.createElement("canvas");c.width=1024;c.height=256;
  const ctx=c.getContext("2d");ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.font="900 105px Arial,sans-serif";ctx.fillStyle=color;
  ctx.shadowColor=color;ctx.shadowBlur=36;ctx.fillText(title,512,107);
  ctx.shadowBlur=6;ctx.fillStyle="#fff5ec";ctx.fillText(title,512,107);
  if(subtitle){ctx.shadowBlur=6;ctx.font="bold 30px Arial,sans-serif";
    ctx.fillText(subtitle,512,207);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function sign(title,subtitle,x,y,z,w,h,color="#ffc7df"){
  cube(x,y,z-.065,w+.22,h+.2,.13,mat("#231925"));
  const face=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
    new THREE.MeshBasicMaterial({map:textImage(title,subtitle,color),transparent:true,depthWrite:false,side:THREE.DoubleSide}));
  face.position.set(x,y,z+.02);scene.add(face);
  cube(x,y+h/2+.09,z,w+.25,.03,.11,mat(color,{emissive:color,emissiveIntensity:1.5}));
}
function confetti(){
  const pos=[],colors=[],palette=["#ee86b5","#ffce8b","#86b9f8","#83dbd5","#c6a0fa"];
  for(let i=0;i<360;i++){
    pos.push((rand()-.5)*18,.07+rand()*.07,-14+rand()*21);
    const c=new THREE.Color(palette[Math.floor(rand()*palette.length)]);
    colors.push(c.r,c.g,c.b);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  scene.add(new THREE.Points(g,new THREE.PointsMaterial({size:.08,vertexColors:true,depthWrite:false})));
}
function balloon(x,y,z,color){
  const group=new THREE.Group();group.position.set(x,y,z);
  const shell=new THREE.Mesh(new THREE.SphereGeometry(1,13,11),mat(color,{roughness:.38}));
  shell.scale.set(.36,.47,.34);group.add(shell);
  const knot=new THREE.Mesh(new THREE.ConeGeometry(.09,.14,7),mat(color));
  knot.rotation.z=Math.PI;knot.position.y=-.5;group.add(knot);
  const string=new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,1.1,5),mat("#e6cad0"));
  string.position.y=-1.12;group.add(string);scene.add(group);
  balloons.push({group,y,phase:rand()*6.28});
}
function balloonBunch(x,z){
  const colors=["#fba0bd","#ffce81","#90b5ff","#bb9ce9","#95e4d7"];
  for(let i=0;i<5;i++)balloon(x+Math.sin(i*2.4)*.52,2.45+(i%3)*.32,z+Math.cos(i*2.4)*.4,colors[i]);
}
function bunting(z){
  cube(0,3.49,z,15,.023,.023,mat("#e6b99e"));
  const colors=["#ff86aa","#fbd17c","#a9a1ff","#86e6d7","#ffc3d1"];
  for(let i=0;i<16;i++){
    const shape=new THREE.Shape();shape.moveTo(-.33,0);shape.lineTo(.33,0);
    shape.lineTo(0,-.58);shape.closePath();
    const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({color:colors[i%5],side:THREE.DoubleSide}));
    mesh.position.set(-7+i*.94,3.48,z);scene.add(mesh);
  }
}
function fairyLights(z){
  cube(0,3.43,z,16.5,.025,.025,mat("#40313b"));
  const colors=["#ffbc79","#ff81bd","#8acaff","#b8a7ff","#ffe2a1"];
  for(let i=0;i<17;i++){
    const x=-8+i,c=colors[i%5];
    tube(x,3.38,z,.022,.022,.15,mat("#332431"));
    const g=globe(x,3.26,z,.085,new THREE.MeshBasicMaterial({color:c}));
    lamps.push(g);
    if(i%4===0)light(c,1.4,x,3.3,z,4);
  }
}
function table(x,z){
  tube(x,.9,z,.87,.87,.13,mat("#a77781",{metalness:.15}),18);
  tube(x,.47,z,.12,.15,.82,mat("#ddb58b",{metalness:.45}));
  tube(x,.07,z,.52,.52,.08,mat("#3a2c35"));
  colliders.push({x0:x-.82,x1:x+.82,z0:z-.82,z1:z+.82});
}
function gift(x,y,z,size,color){
  cube(x,y,z,size,size,size,mat(color));
  cube(x,y,z,size*.18,size+.015,size+.015,mat("#ffe2b7"));
  cube(x,y,z,size+.015,size+.015,size*.2,mat("#ffe2b7"));
  for(const a of [-1,1]){
    const bow=new THREE.Mesh(new THREE.TorusGeometry(size*.15,size*.035,5,12),mat("#fff3d2"));
    bow.position.set(x+a*size*.14,y+size*.52,z);
    bow.rotation.y=a*.65;scene.add(bow);
  }
}
function cake(x,z){
  tube(x,1.05,z,.41,.41,.2,mat("#fff1df"),20);
  tube(x,1.19,z,.36,.36,.15,mat("#e99ab8"),20);
  tube(x,1.32,z,.29,.3,.11,mat("#fce4dd"),20);
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5,cx=x+Math.sin(a)*.19,cz=z+Math.cos(a)*.19;
    tube(cx,1.45,cz,.023,.023,.21,mat("#ffe38d"),6);
    globe(cx,1.56,cz,.042,new THREE.MeshBasicMaterial({color:"#fff5a9"}));
  }
}
function sofa(x,z,color){
  cube(x,.4,z,2.45,.6,1.12,mat(color),true);
  cube(x,.83,z-.46,2.45,.95,.24,mat(color),true);
  cube(x-1.15,.6,z,.25,.55,1.13,mat(color));
  cube(x+1.15,.6,z,.25,.55,1.13,mat(color));
}
function danceFloor(){
  const palette=["#f78fb6","#ad92f7","#81cdda","#ffd099","#8eaaff"];
  const materials=palette.map(c=>mat(c,{emissive:c,emissiveIntensity:.25,roughness:.28,metalness:.2}));
  floorMats.push(...materials);
  for(let i=0;i<8;i++)for(let j=0;j<8;j++){
    cube((i-3.5)*.79,-.01,-5.7+(j-3.5)*.79,.73,.05,.73,materials[(i*3+j)%5]);
  }
  for(const x of [-3.25,3.25])cube(x,.02,-5.7,.06,.04,6.5,mat("#d7aacb",{metalness:.6}));
  for(const z of [-8.96,-2.44])cube(0,.02,z,6.6,.04,.06,mat("#d7aacb",{metalness:.6}));
}
function arcade(x,z,name,color){
  cube(x,1.05,z,1.6,2.1,.88,mat("#292136"),true);
  cube(x,1.57,z+.47,1.38,1,.04,mat("#13101d"));
  const face=new THREE.Mesh(new THREE.PlaneGeometry(1.35,.57),
    new THREE.MeshBasicMaterial({map:textImage(name,"COMING SOON",color),transparent:true,depthWrite:false}));
  face.position.set(x,1.65,z+.50);scene.add(face);
  cube(x,.92,z+.51,1.25,.09,.28,mat(color,{emissive:color,emissiveIntensity:.8}));
  light(color,1.4,x,2.1,z+.7,4);
  targets.push({x,z:z+1.2,label:name+" / 近日公開",action:()=>showToast("このゲームはPhase 2以降に追加します 🎮")});
}
function populate(){
  scene=new THREE.Scene();scene.background=new THREE.Color("#19121e");
  scene.fog=new THREE.Fog("#19121e",13,44);
  camera=new THREE.PerspectiveCamera(76,1,.06,100);camera.rotation.order="YXZ";
  renderer=new THREE.WebGLRenderer({canvas:el.canvas,antialias:true,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=cfg.exposure;
  scene.add(new THREE.HemisphereLight(0xffe1e5,0x4d3449,1.8));
  const sunlight=new THREE.DirectionalLight(0xffc49c,.48);
  sunlight.position.set(4,6,10);scene.add(sunlight);
  light(0xffb88d,3.2,0,3,13,12);
  light(0xffd29a,3.0,0,3,5.7,11);
  light(0xfb82c2,4.3,-6.7,3,-7,13);
  light(0x78aaff,4.0,6.5,3,-7,13);
  light(0xb2a0ff,3.1,0,3,-12,12);

  const wall=mat("#efbdc9",{map:canvasTex("wall",3,1.4)});
  const wood=mat("#f6bcb3",{map:canvasTex("wood",9,12)});
  const carpet=mat("#e5bfc6",{map:canvasTex("carpet",2,4)});
  const ceiling=mat("#eed8d0",{map:canvasTex("ceiling",8,10)});
  const hallCeiling=mat("#eed6d0",{map:canvasTex("ceiling",2,5)});
  // Main hall x [-10,10], z [-16,8]; corridor x [-2.3,2.3], z [8,18].
  cube(0,-.16,-4,20.2,.3,24.4,wood);
  cube(0,-.16,13,4.65,.3,10.2,carpet);
  cube(0,4.15,-4,20.2,.23,24.4,ceiling);
  cube(0,4.15,13,4.65,.23,10.2,hallCeiling);
  cube(-10,2,-4,.3,4.1,24.4,wall,true);
  cube(10,2,-4,.3,4.1,24.4,wall,true);
  cube(0,2,-16,20.3,4.1,.3,wall,true);
  cube(-6.18,2,8,7.64,4.1,.3,wall,true);
  cube(6.18,2,8,7.64,4.1,.3,wall,true);
  cube(-2.3,2,13,.24,4.1,10.3,wall,true);
  cube(2.3,2,13,.24,4.1,10.3,wall,true);
  cube(0,2,18,4.7,4.1,.3,wall,true);
  const edge=mat("#b99392"),brass=mat("#e3ae8a",{metalness:.45,roughness:.38});
  for(let z=-14;z<8;z+=3.2){
    cube(-9.83,1.9,z,.045,3.5,.08,edge);
    cube(9.83,1.9,z,.045,3.5,.08,edge);
  }
  for(let z=9;z<18;z+=2.5){
    cube(-2.15,1.9,z,.05,3.5,.08,edge);
    cube(2.15,1.9,z,.05,3.5,.08,edge);
  }
  for(let z=9;z<18;z+=2.1)cube(0,4,z,4.55,.04,.05,brass);
  cube(-2.23,2,7.93,.16,4,.17,brass);
  cube(2.23,2,7.93,.16,4,.17,brass);
  cube(0,3.97,7.93,4.55,.14,.17,brass);
  sign("PARTY INSIDE","FOLLOW THE LIGHTS",0,3.42,7.78,3.6,.64,"#ffc6df");
  sign("GAME ROOM","PARTY WORLD · WELCOME",0,2.5,-15.75,7.4,1.65,"#ff94cb");
  fairyLights(1);fairyLights(-10.9);bunting(3);
  balloonBunch(-7.8,5);balloonBunch(7.8,5);
  balloonBunch(-8.1,-11.7);balloonBunch(8.1,-11.7);
  balloonBunch(-1.05,10.4);balloonBunch(1.1,10.4);
  danceFloor();
  ball=globe(0,3.17,-5.7,.46,mat("#ece1ed",{metalness:.9,roughness:.13}));
  cube(0,3.84,-5.7,.021,.53,.021,mat("#c1acbd"));
  lamps.push(light(0xf9a1d9,2.6,0,3,-5.7,7));
  table(-6.1,-2);cake(-6.1,-2);
  table(6.1,-2.2);tube(6.1,1.07,-2.2,.31,.31,.21,mat("#f8ce87"));
  tube(6.1,1.25,-2.2,.18,.18,.16,mat("#fff5e1"));
  gift(5.3,1.08,-2.36,.29,"#ad93e4");
  gift(-7.3,.31,-.5,.62,"#90d4d3");
  gift(7.9,.37,-1.25,.74,"#ec95b3");
  gift(7.3,.25,-1.75,.5,"#f7ce82");
  sofa(-6.5,-9.7,"#9d607e");sofa(6.4,-9.7,"#685486");
  for(const x of [-8.35,8.35]){
    cube(x,1.12,1.6,1,2.2,.94,mat("#29212d"),true);
    for(const y of [.6,1.51]){
      const speaker=tube(x,y,2.1,.31,.31,.055,mat("#19131f"),16);
      speaker.rotation.x=Math.PI/2;
      globe(x,y,2.13,.11,mat("#a987ad")).scale.z=.3;
    }
  }
  arcade(-6.55,-13.6,"ARCADE","#95cbff");
  arcade(6.55,-13.6,"MINI GAMES","#f7a0ce");
  cube(0,1.07,-13.8,1.43,2.12,.77,mat("#493353",{emissive:"#803e89",emissiveIntensity:.22}),true);
  const switchFace=new THREE.Mesh(new THREE.PlaneGeometry(1.25,.72),
    new THREE.MeshBasicMaterial({map:textImage("LIGHT SHOW","PRESS TO TOGGLE","#ffe79b"),transparent:true}));
  switchFace.position.set(0,1.61,-13.39);scene.add(switchFace);
  targets.push({x:0,z:-12.2,label:"ライトショーの切り替え",action:()=>{
    game.partyMode=!game.partyMode;
    showToast(game.partyMode?"✨ PARTY LIGHT SHOW ON!":"ライトショーをオフにしました");
  }});
  confetti();resetCamera();resize();
}
function resetCamera(){
  camera.position.set(p.x,p.y,p.z);
  camera.rotation.set(p.pitch,p.yaw,0,"YXZ");
}
function resize(){
  if(!renderer)return;
  const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);
  camera.aspect=w/h;camera.fov=w<h?76:71;camera.updateProjectionMatrix();
  renderer.setSize(w,h,false);
}
function clearInput(){
  fingers.move=fingers.look=null;fingers.jx=fingers.jy=0;
  p.vx=p.vz=0;keys.clear();el.joy.classList.remove("active");
}
function pointerDown(e){
  if(!game.playing||game.paused)return;
  if(e.pointerType==="mouse"){
    if(e.button!==0||fingers.look!==null)return;
    fingers.look=e.pointerId;
  }else if(e.clientX<innerWidth/2){
    if(fingers.move!==null)return;
    fingers.move=e.pointerId;fingers.x0=e.clientX;fingers.y0=e.clientY;
    fingers.jx=fingers.jy=0;
    el.joy.style.left=e.clientX+"px";el.joy.style.top=e.clientY+"px";
    el.knob.style.transform="translate(-50%, -50%)";el.joy.classList.add("active");
  }else{
    if(fingers.look!==null)return;
    fingers.look=e.pointerId;
  }
  if(fingers.look===e.pointerId){fingers.lastX=e.clientX;fingers.lastY=e.clientY;}
  try{el.canvas.setPointerCapture(e.pointerId);}catch(_){}
  e.preventDefault();
}
function pointerMove(e){
  if(e.pointerId===fingers.move){
    const dx=e.clientX-fingers.x0,dy=e.clientY-fingers.y0,len=Math.hypot(dx,dy);
    const fraction=Math.min(1,len/60);
    const power=fraction<.1?0:(fraction-.1)/.9;
    fingers.jx=len?dx/len*power:0;fingers.jy=len?-dy/len*power:0;
    const cap=len>60?60/len:1;
    el.knob.style.transform="translate(calc(-50% + "+(dx*cap)+"px),calc(-50% + "+(dy*cap)+"px))";
    e.preventDefault();
  }else if(e.pointerId===fingers.look){
    const dx=e.clientX-fingers.lastX,dy=e.clientY-fingers.lastY;
    fingers.lastX=e.clientX;fingers.lastY=e.clientY;
    p.yaw-=dx*cfg.sensitivity*.001;
    p.pitch=clamp(p.pitch-dy*cfg.sensitivity*.001,-1.22,1.20);
    e.preventDefault();
  }
}
function pointerUp(e){
  if(e.pointerId===fingers.move){
    fingers.move=null;fingers.jx=fingers.jy=0;el.joy.classList.remove("active");
  }
  if(e.pointerId===fingers.look)fingers.look=null;
}
function jump(){
  if(!game.playing||game.paused||!p.grounded)return;
  p.vy=4.5;p.grounded=false;
}
function intent(){
  let x=fingers.jx,z=fingers.jy,kx=0,kz=0;
  if(keys.has("KeyA")||keys.has("ArrowLeft"))kx--;
  if(keys.has("KeyD")||keys.has("ArrowRight"))kx++;
  if(keys.has("KeyW")||keys.has("ArrowUp"))kz++;
  if(keys.has("KeyS")||keys.has("ArrowDown"))kz--;
  if(kx||kz){const n=Math.max(1,Math.hypot(kx,kz));x=kx/n;z=kz/n;}
  const n=Math.max(1,Math.hypot(x,z));return{x:x/n,z:z/n,strength:Math.hypot(x/n,z/n)};
}
function colliding(x,z){
  for(const o of colliders){
    const dx=x-clamp(x,o.x0,o.x1),dz=z-clamp(z,o.z0,o.z1);
    if(dx*dx+dz*dz<p.radius*p.radius)return true;
  }return false;
}
function updatePlayer(dt,t){
  const m=intent();
  const desireX=(Math.cos(p.yaw)*m.x+Math.sin(p.yaw)*m.z)*4.2;
  const desireZ=(Math.sin(p.yaw)*m.x-Math.cos(p.yaw)*m.z)*4.2;
  const factor=1-Math.exp(-dt*(m.strength>0?11:15));
  p.vx+=(desireX-p.vx)*factor;p.vz+=(desireZ-p.vz)*factor;
  const nx=p.x+p.vx*dt;
  if(!colliding(nx,p.z))p.x=nx;else p.vx=0;
  const nz=p.z+p.vz*dt;
  if(!colliding(p.x,nz))p.z=nz;else p.vz=0;
  if(!p.grounded){
    p.vy-=11.8*dt;p.y+=p.vy*dt;
    if(p.y<=p.height){p.y=p.height;p.vy=0;p.grounded=true;}
  }
  const bob=!cfg.reducedMotion&&p.grounded?Math.sin(t*9)*Math.min(4,Math.hypot(p.vx,p.vz))*.008:0;
  camera.position.set(p.x,p.y+bob,p.z);camera.rotation.x=p.pitch;camera.rotation.y=p.yaw;
}
function updateInteraction(){
  let nearest=null,dist=2.5;
  for(const t of targets){
    const d=Math.hypot(p.x-t.x,p.z-t.z);
    if(d<dist){dist=d;nearest=t;}
  }
  currentTarget=nearest;
  if(!nearest){el.interaction.classList.add("hidden");return;}
  el.interactionText.textContent=nearest.label;
  el.interaction.classList.remove("hidden");
}
function showToast(message){
  el.toast.textContent=message;el.toast.classList.add("visible");
  game.showToastUntil=performance.now()+2700;
}
const clock=new THREE.Clock();
function tick(){
  requestAnimationFrame(tick);
  if(!game.ready)return;
  const dt=Math.min(.04,clock.getDelta());game.time+=dt;
  if(game.playing&&!game.paused){updatePlayer(dt,game.time);updateInteraction();}
  if(!cfg.reducedMotion){
    for(const b of balloons){
      b.group.position.y=b.y+Math.sin(game.time*1.15+b.phase)*.045;
      b.group.rotation.z=Math.sin(game.time*.6+b.phase)*.035;
    }
    if(ball)ball.rotation.y+=dt*.36;
  }
  for(let i=0;i<floorMats.length;i++)
    floorMats[i].emissiveIntensity=.22+(game.partyMode?1:.25)*(.5+.5*Math.sin(game.time*(game.partyMode?3.8:.9)+i));
  if(el.toast.classList.contains("visible")&&performance.now()>game.showToastUntil)
    el.toast.classList.remove("visible");
  renderer.render(scene,camera);
}
function start(){
  if(!game.ready)return;
  game.playing=true;game.paused=false;el.start.classList.add("dismissed");
  el.menu.classList.add("hidden");el.hud.classList.remove("hidden");
  el.tips.classList.remove("fading");
  setTimeout(()=>el.tips.classList.add("fading"),6900);
}
function openMenu(){
  game.paused=true;clearInput();
  $("resume-button").textContent=game.playing?"ワールドへ戻る":"設定を閉じる";
  el.menu.classList.remove("hidden");
}
function closeMenu(){game.paused=false;el.menu.classList.add("hidden");clearInput();}
function title(){
  closeMenu();game.playing=false;game.partyMode=false;
  Object.assign(p,{x:0,z:15,y:1.65,yaw:0,pitch:0,vx:0,vz:0,vy:0,grounded:true});
  resetCamera();el.start.classList.remove("dismissed");el.hud.classList.add("hidden");
  cfg.sound=false;$("sound-enabled").checked=false;stopMusic();
}
function playNote(freq,when,len,volume=.026){
  if(!musicContext)return;
  const osc=musicContext.createOscillator(),g=musicContext.createGain();
  osc.type="triangle";osc.frequency.setValueAtTime(freq,when);
  g.gain.setValueAtTime(.0001,when);
  g.gain.exponentialRampToValueAtTime(volume,when+.015);
  g.gain.exponentialRampToValueAtTime(.0001,when+len);
  osc.connect(g).connect(musicContext.destination);
  osc.start(when);osc.stop(when+len+.03);
}
async function startMusic(){
  if(musicTimer)return;
  try{
    musicContext=musicContext||new(window.AudioContext||window.webkitAudioContext)();
    await musicContext.resume();
    const notes=[220,261.6,329.6,392,329.6,261.6,246.9,293.7];
    const step=()=>{
      if(!musicContext||musicContext.state!=="running")return;
      const t=musicContext.currentTime+.02;
      playNote(notes[beat%notes.length],t,.26,.026);
      if(beat%4===0)playNote(110,t,.37,.015);
      beat++;
    };
    step();musicTimer=setInterval(step,325);
  }catch(e){cfg.sound=false;$("sound-enabled").checked=false;}
}
function stopMusic(){
  if(musicTimer)clearInterval(musicTimer);musicTimer=null;
  if(musicContext)musicContext.suspend().catch(()=>{});
}
function register(){
  el.canvas.addEventListener("pointerdown",pointerDown,{passive:false});
  el.canvas.addEventListener("pointermove",pointerMove,{passive:false});
  ["pointerup","pointercancel","lostpointercapture"].forEach(n=>el.canvas.addEventListener(n,pointerUp));
  el.canvas.addEventListener("contextmenu",e=>e.preventDefault());
  addEventListener("blur",clearInput);addEventListener("resize",resize);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)clearInput();});
  addEventListener("keydown",e=>{
    if(e.code==="Escape"){
      if(game.paused)closeMenu();else openMenu();
      e.preventDefault();return;
    }
    if(!game.playing||game.paused)return;
    if(["Space","KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();
    keys.add(e.code);
    if(e.code==="Space"&&!e.repeat)jump();
    if(e.code==="KeyE"&&!e.repeat&&currentTarget)currentTarget.action();
  });
  addEventListener("keyup",e=>keys.delete(e.code));
  $("start-button").addEventListener("click",start);
  $("menu-button").addEventListener("click",()=>game.paused?closeMenu():openMenu());
  $("close-menu").addEventListener("click",closeMenu);
  $("resume-button").addEventListener("click",closeMenu);
  $("return-title").addEventListener("click",title);
  $("jump-button").addEventListener("click",jump);
  $("interact-button").addEventListener("click",()=>{if(currentTarget)currentTarget.action();});
  $("sensitivity").addEventListener("input",e=>{
    cfg.sensitivity=Number(e.target.value);$("sensitivity-value").textContent=cfg.sensitivity;
  });
  $("brightness").addEventListener("input",e=>{
    cfg.exposure=Number(e.target.value);
    $("brightness-value").textContent=cfg.exposure.toFixed(1);
    renderer.toneMappingExposure=cfg.exposure;
  });
  $("reduced-motion").addEventListener("change",e=>cfg.reducedMotion=e.target.checked);
  $("sound-enabled").addEventListener("change",e=>{
    cfg.sound=e.target.checked;if(cfg.sound)startMusic();else stopMusic();
  });
}
try{
  populate();register();game.ready=true;tick();
  el.loading.classList.add("done");setTimeout(()=>el.loading.remove(),600);
}catch(e){
  console.error("GAME ROOM initialization failed",e);
  el.loading.classList.add("hidden");$("fatal").classList.remove("hidden");
}
