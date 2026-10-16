import type {ResidentId} from '../../shared/residentRules.js';
const LINES:Record<ResidentId,string[]>={
 poko:['やあ！ パーティーハウスから出てくる足音、聞こえたよ。ぼくはポコ。','土の中から、みんなが来るのを待っているんだ。森へお出かけするときは、また会いに来てね。','トコトコは家のまわりをお散歩しているよ。見つけたら話しかけてみて！','北の広場に、みんなで倒す的が三つあるよ。メニューの協力モードにすると、友達は撃たずに的だけを狙えるんだ。'],
 tokotoko:['こんにちは。ぼくはトコトコ。この家のまわりを歩くのが好きなんだ。','裏庭でひと休みしたり、森の入口を眺めたり。今日はどこをお散歩しようかな。','ポコにも会った？ 扉の近くで、みんなをお出迎えしているよ。','また会ったら声をかけてね。それじゃあ、もう少し歩いてこようかな。','北の CO-OP PLAZA へ行ってみて。協力モードなら、部屋のみんなで同じ的を倒せるよ。']
};
const THANKS:Record<ResidentId,string>={
 poko:'やったね！ 広場の的を、みんなで倒せたよ。ぼくもトコトコも、ちゃんと見てたんだ。',
 tokotoko:'広場の的、一緒に倒せたね。またやりたくなったら、協力モードをもう一度入れてね。'
};
/** Accessible touch/keyboard dialogue; fixed local text, no external chat service. */
export class ResidentDialogue {
 private readonly overlay=document.createElement('section');
 private readonly title=document.createElement('h2');
 private readonly text=document.createElement('p');
 private readonly count=document.createElement('span');
 private readonly next=document.createElement('button');
 private readonly closeButton=document.createElement('button');
 private id:ResidentId='poko';private index=0;private previousFocus:HTMLElement|null=null;
 private cleared=false;private thanking=false;
 constructor(private onClose:()=>void){
  this.overlay.id='resident-dialogue';this.overlay.className='resident-dialogue hidden';
  this.overlay.setAttribute('role','dialog');this.overlay.setAttribute('aria-modal','true');this.overlay.setAttribute('aria-labelledby','resident-dialogue-title');
  const card=document.createElement('div');card.className='resident-dialogue-card';
  this.title.id='resident-dialogue-title';this.text.id='resident-dialogue-text';this.text.setAttribute('aria-live','polite');
  this.next.id='resident-dialogue-next';this.next.type='button';this.next.onclick=()=>this.advance();
  this.closeButton.id='resident-dialogue-close';this.closeButton.type='button';this.closeButton.textContent='またね';this.closeButton.onclick=()=>this.close();
  const buttons=document.createElement('div');buttons.className='resident-dialogue-buttons';buttons.append(this.count,this.closeButton,this.next);
  card.append(this.title,this.text,buttons);this.overlay.append(card);document.body.append(this.overlay);
  this.overlay.addEventListener('keydown',e=>{
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();this.close();}
   if(e.key==='Tab'){const buttons=[this.closeButton,this.next];const at=buttons.indexOf(document.activeElement as HTMLButtonElement);e.preventDefault();buttons[(at+(e.shiftKey?-1:1)+2)%2].focus();}
  });
 }
 get opened(){return !this.overlay.classList.contains('hidden');}
 setCleared(cleared:boolean){this.cleared=cleared;if(!cleared)this.thanking=false;}
 open(id:ResidentId){
  this.previousFocus=document.activeElement as HTMLElement;this.id=id;this.index=0;this.thanking=this.cleared;
  this.title.textContent=id==='poko'?'POKO · ポコ':'TOKOTOKO · トコトコ';
  this.render();this.overlay.classList.remove('hidden');this.next.focus();
 }
 private render(){
  if(this.thanking){
   this.text.textContent=THANKS[this.id];this.count.textContent='お礼';this.next.textContent='いつもの話を聞く';return;
  }
  this.text.textContent=LINES[this.id][this.index];this.count.textContent=`${this.index+1} / ${LINES[this.id].length}`;this.next.textContent=this.index===LINES[this.id].length-1?'お散歩に戻る':'つづきを聞く';
 }
 private advance(){
  if(this.thanking){this.thanking=false;this.index=0;this.render();return;}
  if(this.index<LINES[this.id].length-1){this.index++;this.render();}else this.close();
 }
 close(){if(!this.opened)return;this.overlay.classList.add('hidden');this.onClose();this.previousFocus?.focus();}
}
