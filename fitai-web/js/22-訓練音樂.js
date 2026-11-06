/* ============================================================
   22-訓練音樂
   內容：訓練音樂：即時合成的節拍、播放自己的音樂
   畫面：上方的音樂按鈕與音樂面板
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 訓練音樂：即時合成的原創節拍 + 播放自己的音樂 ================= */
const PROG=[[110.0,[220.0,261.63,329.63]],[87.31,[174.61,220.0,261.63]],[130.81,[261.63,329.63,392.0]],[98.0,[196.0,246.94,293.66]]]; // Am F C G
const PROG_UP=[[130.81,[261.63,329.63,392.0]],[98.0,[196.0,246.94,293.66]],[110.0,[220.0,261.63,329.63]],[87.31,[174.61,220.0,261.63]]]; // C G Am F
const PROG_DARK=[[110.0,[220.0,261.63,329.63]],[73.42,[146.83,174.61,220.0]],[110.0,[220.0,261.63,329.63]],[82.41,[164.81,207.65,246.94]]]; // Am Dm Am E
class Synth{
  constructor(ctx,dest){
    this.c=ctx;this.d=dest;
    const n=ctx.sampleRate;this.noise=ctx.createBuffer(1,n,n);const a=this.noise.getChannelData(0);for(let i=0;i<n;i++)a[i]=Math.random()*2-1;
  }
  _env(g,t,peak,att,dec){g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+att);g.gain.exponentialRampToValueAtTime(0.0001,t+att+dec)}
  kick(t,v=.9){const c=this.c,o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(160,t);o.frequency.exponentialRampToValueAtTime(45,t+.12);
    this._env(g,t,v,.003,.26);o.connect(g);g.connect(this.d);o.start(t);o.stop(t+.3)}
  noiseHit(t,{hp=0,bp=0,peak=.4,dec=.1,q=.8}){const c=this.c,s=c.createBufferSource(),g=c.createGain();s.buffer=this.noise;let n=s;
    if(bp){const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=bp;f.Q.value=q;n.connect(f);n=f}
    if(hp){const f=c.createBiquadFilter();f.type='highpass';f.frequency.value=hp;n.connect(f);n=f}
    this._env(g,t,peak,.002,dec);n.connect(g);g.connect(this.d);s.start(t,Math.random()*.5);s.stop(t+dec+.05)}
  clap(t,v=.5){this.noiseHit(t,{bp:1800,peak:v,dec:.16,q:.7})}
  snare(t,v=.4){this.noiseHit(t,{bp:2200,peak:v,dec:.14,q:.6});const c=this.c,o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.value=190;this._env(g,t,v*.6,.002,.1);o.connect(g);g.connect(this.d);o.start(t);o.stop(t+.15)}
  hat(t,open=false,v=.22){this.noiseHit(t,{hp:7000,peak:v,dec:open?.16:.04})}
  tone(t,f,len,{type='sawtooth',lp=1800,peak=.2,att=.005}={}){const c=this.c,o=c.createOscillator(),g=c.createGain(),fl=c.createBiquadFilter();
    o.type=type;o.frequency.value=f;fl.type='lowpass';fl.frequency.value=lp;this._env(g,t,peak,att,len);o.connect(fl);fl.connect(g);g.connect(this.d);o.start(t);o.stop(t+att+len+.05)}
  click(t,accent){this.tone(t,accent?1500:1000,.04,{type:'sine',lp:6000,peak:.5,att:.001})}
}
const STYLES={
  energy:{name:'電子衝刺',bpm:135,step(S,i,t,bar){
    const [root,ch]=PROG[bar%4];
    if(i%4===0)S.kick(t);
    if(i===4||i===12)S.clap(t,.45);
    if(i%4===2)S.hat(t,true,.2);else if(i%2===1)S.hat(t,false,.12);
    if(i%2===0)S.tone(t,i%4===2?root*2:root,.16,{lp:320,peak:.34});
    S.tone(t,ch[i%3]*(i%8>=4?2:1),.09,{lp:2400,peak:i%2?.07:.12});
  }},
  chill:{name:'Lo-fi 放鬆',bpm:80,step(S,i,t,bar,spb){
    const [root,ch]=PROG[bar%4],sw=(i%4===2)?spb*.28:0;
    if(i===0||i===10)S.kick(t,.6);
    if(i===4||i===12)S.snare(t,.28);
    if(i%2===0)S.hat(t+sw,false,.1+(i%4===0?.05:0));
    if(i===0)ch.forEach((f,k)=>S.tone(t,f,spb*14,{type:'triangle',lp:1100,peak:.1,att:.06}));
    if(i===8)ch.forEach(f=>S.tone(t,f,spb*6,{type:'triangle',lp:1100,peak:.07,att:.04}));
    if(i===0||i===10)S.tone(t,root,spb*5,{type:'sine',lp:400,peak:.4});
    if(i%2===0)S.tone(t+sw,ch[(i/2)%3]*2,.25,{type:'triangle',lp:2200,peak:.06});
  }},
  drums:{name:'鼓點',bpm:110,step(S,i,t){
    if([0,6,8,14].includes(i))S.kick(t);
    if(i===4||i===12)S.snare(t,.4);
    if(i===15)S.snare(t,.12);
    if(i%2===0)S.hat(t,i%8===6,.18);
  }},
  hiit:{name:'高強度 HIIT',bpm:150,step(S,i,t,bar,spb){
    const [root,ch]=PROG_DARK[bar%4];
    if(i%4===0||(i===14&&bar%2))S.kick(t);
    if(i===4||i===12)S.clap(t,.5);
    S.hat(t,i%4===2,i%4===2?.18:.09);
    if(i%4===2)S.tone(t,root,.12,{lp:500,peak:.36});
    if(i%4===0&&i)S.tone(t,ch[2]*2,.05,{type:'square',lp:3000,peak:.05});
    if(bar%4===3&&i>=8)S.noiseHit(t,{hp:1500+(i-8)*700,peak:.04+(i-8)*.012,dec:spb});
  }},
  house:{name:'House 律動',bpm:124,step(S,i,t,bar){
    const [root,ch]=PROG_UP[bar%4];
    if(i%4===0)S.kick(t);
    if(i===4||i===12)S.clap(t,.4);
    if(i%4===2)S.hat(t,true,.2);else S.hat(t,false,.06);
    if(i%4===2)S.tone(t,root,.14,{lp:420,peak:.34});
    if(i===3||i===6||i===11)ch.forEach(f=>S.tone(t,f*2,.12,{type:'square',lp:1600,peak:.05}));
  }},
  hiphop:{name:'Hip-hop 重拍',bpm:90,step(S,i,t,bar,spb){
    const [root,ch]=PROG[bar%4],sw=(i%4===2)?spb*.25:0;
    if(i===0||i===7||i===10)S.kick(t,.85);
    if(i===4||i===12)S.snare(t,.42);
    if(i%2===0)S.hat(t+sw,false,.12);
    if(i===0||i===7||i===10)S.tone(t,root/2,spb*2.5,{type:'sine',lp:300,peak:.45});
    if(i===0)ch.forEach(f=>S.tone(t,f,spb*12,{type:'triangle',lp:900,peak:.06,att:.08}));
  }},
  trap:{name:'Trap 爆發',bpm:140,step(S,i,t,bar,spb){
    const [root]=PROG_DARK[bar%4];
    if(i===0||i===11||(i===3&&bar%2))S.kick(t,.8);
    if(i===8)S.clap(t,.5);
    S.hat(t,false,.1);
    if(i>=12&&bar%2)S.hat(t+spb/2,false,.07);
    if(i===0||i===11)S.tone(t,root/2,spb*(i?4:9),{type:'sine',lp:250,peak:.5});
  }},
  dnb:{name:'Drum & Bass 衝刺',bpm:172,step(S,i,t,bar,spb){
    const [root,ch]=PROG[bar%4];
    if(i===0||i===10)S.kick(t);
    if(i===4||i===12)S.snare(t,.45);
    if(i===7&&bar%2)S.snare(t,.15);
    if(i%2===0)S.hat(t,false,.1);
    if(i===0||i===10)S.tone(t,root/2,spb*(i?5:9),{lp:260,peak:.32});
    if(i===0&&bar%2===0)ch.forEach(f=>S.tone(t,f*2,spb*30,{type:'triangle',lp:1400,peak:.05,att:.3}));
  }},
  synthwave:{name:'Synthwave 夜跑',bpm:108,step(S,i,t,bar,spb){
    const [root,ch]=PROG_UP[bar%4];
    if(i===0||i===8)S.kick(t);
    if(i===4||i===12)S.snare(t,.38);
    if(i%2===0)S.hat(t,false,.08);
    if(i%2===0)S.tone(t,i%4===2?root*2:root,spb*1.6,{lp:500,peak:.28});
    S.tone(t,ch[[0,1,2,1][i%4]]*(i>=8?4:2),spb*.9,{lp:2600,peak:.05});
  }},
  rock:{name:'搖滾能量',bpm:120,step(S,i,t,bar,spb){
    const [root]=PROG_UP[bar%4];
    if(i===0||i===8||i===10)S.kick(t);
    if(i===4||i===12)S.snare(t,.48);
    if(i===0&&bar%4===0)S.hat(t,true,.3);else if(i%2===0)S.hat(t,false,.12);
    if(i%2===0)S.tone(t,root,spb*1.5,{type:'square',lp:700,peak:.2});
    if(i===0||i===6||i===8)[root*2,root*3,root*4].forEach(f=>S.tone(t,f,spb*(i===6?1.5:5),{lp:1500,peak:.05}));
  }},
  latin:{name:'拉丁 Dembow',bpm:96,step(S,i,t,bar,spb){
    const [root,ch]=PROG[bar%4];
    if(i%4===0)S.kick(t,.8);
    if(i===3||i===6||i===11||i===14)S.snare(t,.32);
    if(i%2===0)S.hat(t,false,.1);
    if(i===0||i===6||i===8||i===14)S.tone(t,root/2,spb*1.5,{type:'sine',lp:300,peak:.42});
    if(i===2||i===10)ch.forEach(f=>S.tone(t,f*2,spb*.8,{type:'triangle',lp:2200,peak:.05}));
  }},
  click:{name:'節拍器',bpm:60,step(S,i,t){if(i%4===0)S.click(t,i===0)}},
};
const music={on:false,syn:null,master:null,timer:0,step:0,next:0,duck:1,audio:null,list:[],idx:0};
$('#mStyle').innerHTML=Object.entries(STYLES).map(([k,v])=>`<option value="${k}">${v.name}</option>`).join('');
function musicApplyVol(){
  const v=S.musicVol*music.duck;
  if(music.master&&ac)music.master.gain.setTargetAtTime(music.on&&S.musicSrc==='built'?v:0,ac.currentTime,.05);
  if(music.audio)music.audio.volume=Math.max(0,Math.min(1,v));
}
function musicDuck(on){music.duck=on?.4:1;musicApplyVol()}
function musicSchedule(){
  if(!music.on||S.musicSrc!=='built')return;
  const spb=60/S.musicBpm/4,ahead=document.hidden?1.5:.12,st=STYLES[S.musicStyle]||STYLES.energy;
  while(music.next<ac.currentTime+ahead){st.step(music.syn,music.step%16,music.next,Math.floor(music.step/16),spb);music.next+=spb;music.step++}
}
function musicStart(){
  audioInit();
  if(S.musicSrc==='mine'){
    if(!music.list.length){toast('先按「選擇音樂檔案」，挑幾首你手機裡的音樂');return}
    music.audio=music.audio||new Audio();music.audio.onended=()=>musicNext(1);
    if(!music.audio.src)music.audio.src=music.list[music.idx].url;
    music.on=true;musicApplyVol();music.audio.play().catch(()=>toast('瀏覽器擋住了自動播放，請再按一次播放'));
  }else{
    if(!ac){toast('這個瀏覽器不支援音效');return}
    if(!music.master){const comp=ac.createDynamicsCompressor(),g=ac.createGain();g.connect(comp);comp.connect(ac.destination);music.master=g;music.syn=new Synth(ac,g)}
    music.step=0;music.next=ac.currentTime+.08;music.on=true;musicApplyVol();
    clearInterval(music.timer);music.timer=setInterval(musicSchedule,25);
  }
  renderMusic();
}
function musicStop(){
  music.on=false;clearInterval(music.timer);
  if(music.master&&ac)music.master.gain.setTargetAtTime(0,ac.currentTime,.03);
  if(music.audio)music.audio.pause();
  renderMusic();
}
function musicNext(d){
  if(!music.list.length)return;music.idx=(music.idx+d+music.list.length)%music.list.length;
  music.audio=music.audio||new Audio();music.audio.onended=()=>musicNext(1);music.audio.src=music.list[music.idx].url;
  if(music.on&&S.musicSrc==='mine'){musicApplyVol();music.audio.play().catch(()=>{})}
  renderMusic();
}
function renderMusic(){
  $('#musicFab').classList.toggle('on',music.on);$('#mPlay').textContent=music.on?'停止':'播放';
  $$('#mSrc button').forEach(b=>b.classList.toggle('on',b.dataset.v===S.musicSrc));
  $('#mBuilt').hidden=S.musicSrc!=='built';$('#mMine').hidden=S.musicSrc!=='mine';
  $('#mStyle').value=S.musicStyle;$('#mBpm').value=S.musicBpm;$('#mBpmO').textContent=S.musicBpm;
  $('#mVol').value=Math.round(S.musicVol*100);$('#mVolO').textContent=Math.round(S.musicVol*100)+'%';$('#mAuto').checked=S.musicAuto;
  $('#mList').innerHTML=music.list.length?music.list.map((t,i)=>`<li class="${i===music.idx?'cur':''}">${esc(t.name)}</li>`).join(''):'<li class="mute">還沒有選檔案</li>';
}
$('#musicFab').onclick=()=>{const p=$('#musicPanel');p.hidden=!p.hidden;$('#musicFab').setAttribute('aria-expanded',!p.hidden)};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#musicPanel').hidden){$('#musicPanel').hidden=true;$('#musicFab').setAttribute('aria-expanded','false')}});
seg($('#mSrc'),b=>{const was=music.on;if(was)musicStop();S.musicSrc=b.dataset.v;save();renderMusic();if(was)musicStart()});
$('#mStyle').onchange=e=>{S.musicStyle=e.target.value;S.musicBpm=STYLES[S.musicStyle].bpm;save();renderMusic();if(music.on&&S.musicSrc==='built'){music.step=0}};
$('#mBpm').oninput=e=>{S.musicBpm=+e.target.value;$('#mBpmO').textContent=S.musicBpm;save()};
$('#mVol').oninput=e=>{S.musicVol=+e.target.value/100;$('#mVolO').textContent=e.target.value+'%';musicApplyVol();save()};
$('#mAuto').onchange=e=>{S.musicAuto=e.target.checked;save()};
$('#mPlay').onclick=()=>music.on?musicStop():musicStart();
$('#mPrev').onclick=()=>musicNext(-1);$('#mNext').onclick=()=>musicNext(1);
$('#mFiles').onchange=e=>{
  const fs=[...e.target.files].filter(f=>f.type.startsWith('audio/')||/\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(f.name));
  if(!fs.length){toast('沒有找到音樂檔案');return}
  music.list.forEach(t=>URL.revokeObjectURL(t.url));
  music.list=fs.map(f=>({name:f.name.replace(/\.[^.]+$/,''),url:URL.createObjectURL(f)}));music.idx=0;
  if(music.audio){music.audio.pause();music.audio.removeAttribute('src')}
  e.target.value='';renderMusic();toast(`已加入 ${fs.length} 首`);
};

