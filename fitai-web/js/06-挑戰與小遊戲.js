/* ============================================================
   06-挑戰與小遊戲
   內容：一分鐘挑戰、健身忍者、障礙跑酷、姿勢配對、金字塔挑戰、遊戲大廳
   畫面：「挑戰與遊戲」分頁
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 一分鐘挑戰 ================= */
const CH={"開合跳":[30,50,70],"仰臥起坐":[15,25,35],"深蹲":[20,35,50],"伏地挺身":[8,15,25],"高抬腿":[40,70,100],"波比跳":[6,10,15],
 "深蹲跳":[15,25,35],"啞鈴臥推":[10,18,26],"肩推":[15,25,35],"仰臥抬腿":[10,20,30],"前平舉":[15,25,35],"引體向上":[3,6,10],"側抬腿":[20,30,40],"側彎":[25,40,55],"站姿抬膝碰肘":[30,50,70],"原地踏步":[60,90,120],"原地跳繩":[60,100,140],
 "啞鈴上斜臥推":[10,18,26],"啞鈴俯身划船":[12,20,28],"啞鈴反向飛鳥":[12,20,28],"啞鈴羅馬尼亞硬舉":[10,16,22],
 "高位下拉":[12,20,28],"繩索划船":[12,20,28],"俯身划船":[10,18,26]};
const CAMOK=new Set(Object.keys(EX));
const DN=['低','中','高'],MULT=[1,1.5,2];
let chDiff=0,chCounter=null,chPending=null;const chCtl={aborted:false};let chRunning=false;
$('#chEx').innerHTML=optsByCat(Object.keys(CH));
$('#chDiff').innerHTML=DN.map((d,i)=>`<button class="${i===0?'on':''}" data-i="${i}">${d}</button>`).join('');
const chView=makeView($('[data-stage=ch]'),()=>chCounter,{label:()=>$('#chStart').textContent,click:()=>$('#chStart').click()});
function chRefresh(){
  const ex=$('#chEx').value,t=CH[ex][chDiff],best=S.best[ex+'|'+chDiff];
  $('#chTarget').textContent=t;$('#chBest').textContent=best?best:'—';
  $('#chRange').textContent=`低、中、高難度的目標是 ${CH[ex].join('、')} 下。`;
  const okCam=CAMOK.has(ex);$('#chCam').disabled=!okCam;if(!okCam)$('#chCam').checked=false;
  chCounter=okCam?new RepCounter(ex):null;if(chCounter)chCounter.relax=.06;
  chView.nm.textContent=ex;chView.n.textContent='0';
  $('#chLog').innerHTML=S.log.length?'<tr><th>項目</th><th>難度</th><th>目標</th><th>成績</th><th>星</th></tr>'+S.log.slice(0,6).map(l=>`<tr><td>${esc(l.ex)}</td><td>${DN[l.d]}</td><td>${l.t}</td><td>${l.n}</td><td>${'★'.repeat(l.s)||'—'}</td></tr>`).join(''):'<tr><td class="mute">還沒有成績。</td></tr>';
}
$('#chEx').onchange=chRefresh;seg($('#chDiff'),b=>{chDiff=+b.dataset.i;chRefresh()});
$('#chCamBtn').onclick=async()=>{
  const ex=$('#chEx').value;if(!CAMOK.has(ex)){$('#chWarn').hidden=false;$('#chWarn').textContent='這個項目還不支援鏡頭偵測，做完請自己輸入次數。';return}
  $('#chCamBtn').disabled=true;const ok=await camStart(chView);
  if(ok){$('#chCamOff').disabled=false}else $('#chCamBtn').disabled=false;
};
$('#chCamOff').onclick=()=>camStop();
$('#chStart').onclick=async()=>{
  if(chRunning){chCtl.aborted=true;return}
  const ex=$('#chEx').value,useCam=$('#chCam').checked&&CAMOK.has(ex);
  const warn=$('#chWarn');warn.hidden=true;
  if(useCam&&!(cam.running&&cam.view===chView)){warn.hidden=false;warn.textContent='請先按「開啟鏡頭」，看到畫面和骨架後再開始。';return}
  audioInit();chRunning=true;chCtl.aborted=false;$('#chStart').textContent='停止挑戰';$('#chResult').hidden=true;$('#chDone').hidden=true;
  const t=CH[ex][chDiff];
  const ok=await runPhases([ph('準備開始',3,'prepare'),ph(`${ex}（${DN[chDiff]}）`,60,'work')],$('#chTimer'),
    {ctl:chCtl,sound:$('#chSound').checked,onPhase:()=>{if(useCam){chCounter.reset();chView.n.textContent='0'}},live:useCam?()=>chCounter.count:null,mini:useCam?chView:null});
  chRunning=false;$('#chStart').textContent='開始 60 秒挑戰';
  if(fullStage===chView.stage)exitFull();
  if(!ok){$('#chTimer').className='tcard idle';$('#chTimer').innerHTML='<div class="tlabel">已停止。</div>';return}
  const auto=useCam?chCounter.count:null;
  chPending={ex,d:chDiff,t,auto};
  $('#chResult').hidden=false;$('#chReps').value=auto===null?'':auto;
  $('#chResultMsg').textContent=auto===null?`時間到。請輸入你剛剛 ${ex} 做了幾下。`:`時間到，鏡頭偵測到 ${auto} 下${chCounter.cueTotal?`（姿勢達標 ${formTxt(chCounter)}）`:''}。如果不準，可以修正後再提交。`;
  if(gameActiveKey==='ch'&&auto!==null)$('#chSubmit').click();
  else setTimeout(()=>$('#chReps').focus(),0);
};
$('#chSubmit').onclick=()=>{
  if(!chPending)return;const p=chPending,raw=$('#chReps').value.trim();
  if(raw===''||!Number.isFinite(+raw)||+raw<0){toast('請輸入這 60 秒做了幾下');$('#chReps').focus();return}
  const n=Math.min(1000,Math.round(+raw));
  const stars=n>=p.t*1.2?3:n>=p.t?2:n>=p.t*.7?1:0,xp=Math.round(n*2*MULT[p.d])+stars*10,key=p.ex+'|'+p.d,isBest=n>(S.best[key]||0);
  if(isBest)S.best[key]=n;if(stars===3)S.stars3=(S.stars3||0)+1;S.xp+=xp;addReps(n,p.ex,p.auto===null?0:Math.min(n,p.auto));S.log.unshift({ex:p.ex,d:p.d,t:p.t,n,s:stars});S.log=S.log.slice(0,20);
  save();renderStats();chPending=null;$('#chResult').hidden=true;
  $('#chDone').hidden=false;$('#chDone').textContent=`${stars?'★'.repeat(stars):'再接再厲'}　${p.ex} ${n} 下（目標 ${p.t}），獲得 ${xp} 經驗值${isBest?'，新的個人紀錄！':''}`;
  chRefresh();
  finishArcadeLegacy('ch',n,0,xp,60*kcalPerSec(8),`${stars?'獲得 '+stars+' 顆星！':'完成挑戰！'} ${p.ex} ${n} 下${isBest?'，刷新個人最佳！':''}`);
};

/* ================= 健身忍者：用手打水果、蹲下打低目標、躲炸彈 ================= */
const NJ_DIFF={easy:{n:'輕鬆',secs:45,spawn:1150,life:3200,bomb:.07,low:.15},normal:{n:'標準',secs:60,spawn:850,life:2500,bomb:.13,low:.22},hard:{n:'地獄',secs:60,spawn:600,life:1900,bomb:.2,low:.3}};
const NJ_FRUIT=['🍎','🍊','🍉','🍋','🍇','🍓','🥝','🍑','🍍','🥥'];
const nj={on:false,phase:'idle',diff:'normal',targets:[],fx:[],particles:[],trails:[[],[]],prevHands:[],body:null,elapsed:0,chip:['開啟鏡頭後按「開始遊戲」','']};
const njView=makeView($('[data-stage=ninja]'),()=>null,{label:()=>nj.on?'停止':'開始遊戲',click:()=>$('#njStart').click()});
njView.manualHint=true;$('.u',njView.stage).textContent='分';njView.nm.textContent='健身忍者';
njView.chipFn=()=>nj.chip;
njView.gaugeFn=()=>nj.on&&nj.phase==='run'?Math.max(0,100-nj.elapsed/NJ_DIFF[nj.diff].secs*100)+'%':'0';
njView.onLm=(lm,now)=>njFrame(lm,now);
const njVis=(lm,i)=>lm&&lm[i]&&lm[i][2]>.5;
function njUpright(ctx,x,y,fn){ctx.save();ctx.translate(x,y);if(isMirror())ctx.scale(-1,1);fn();ctx.restore()}   // 畫面是鏡像的，文字要再翻回來
function njSpawn(now,fever){
  const b=nj.body,d=NJ_DIFF[nj.diff],W=njView.canvas.width,H=njView.canvas.height;if(!b)return;
  const r0=Math.max(30,Math.min(95,b.sw*.42)),roll=Math.random();
  const kind=roll<d.bomb?'bomb':roll<d.bomb+.08?'gold':roll<d.bomb+.08+d.low?'low':roll<d.bomb+.2?'jump':'fruit';
  for(let tries=0;tries<8;tries++){
    const low=kind==='low',x=b.cx+(Math.random()*2-1)*b.sw*(low?1.3:2),y=low?b.ky-b.sw*.15+Math.random()*b.sw*.3:kind==='jump'?b.hy-b.sw*.35:b.sy-b.sw*1.4+Math.random()*(b.hy-b.sy+b.sw*1.4);
    const r=r0*(kind==='gold'?.85:1),cx=Math.max(r,Math.min(W-r,x)),cy=Math.max(r,Math.min(H-r,y));
    if(nj.targets.some(t=>Math.hypot(t.x-cx,t.y-cy)<t.r+r))continue;
    nj.targets.push({x:cx,y:cy,r,kind,e:kind==='bomb'?'💣':kind==='gold'?'⭐':NJ_FRUIT[Math.random()*NJ_FRUIT.length|0],born:now,life:d.life*(fever?.85:1)});return;
  }
}
function njPop(x,y,text,color,now){nj.fx.push({x,y,text,color,t:now})}
function njHit(t,now,fever){
  if(t.kind==='bomb'){nj.score=Math.max(0,nj.score-30);nj.combo=0;nj.bombs++;njPop(t.x,t.y,'-30','#ff6b57',now);beep(160,320);nj.flash=now;$('#gameArena').classList.add('arena-shake');setTimeout(()=>$('#gameArena').classList.remove('arena-shake'),260);return}
  nj.combo=now-nj.lastHit<1800?nj.combo+1:1;nj.lastHit=now;nj.maxCombo=Math.max(nj.maxCombo,nj.combo);
  const base=t.kind==='gold'?30:t.kind==='low'?20:10,pts=Math.round(base*(1+Math.min(nj.combo-1,10)*.1)*(fever?2:1));
  nj.score+=pts;nj.hits++;if(t.kind==='low')nj.low++;
  const palette=t.kind==='gold'?['#ffe36a','#fff']:t.kind==='low'?['#68f6e4','#fff']:t.kind==='jump'?['#83cfff','#fff']:['#ff77ad','#ffe36a','#fff'];
  for(let i=0;i<20;i++){const a=Math.random()*Math.PI*2,s=90+Math.random()*440;nj.particles.push({x:t.x,y:t.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-80,t:now,life:420+Math.random()*360,r:3+Math.random()*7,c:palette[i%palette.length]})}
  njPop(t.x,t.y,`+${pts}`,t.kind==='gold'?'#ffd23f':t.kind==='low'?'#3dd6d0':'#ffffff',now);
  beep(t.kind==='gold'?1568:t.kind==='low'?1046:880,70);
  arenaHit(nj.score,nj.combo,fever?'狂熱時間！分數加倍！':'漂亮命中！繼續連擊！');
  if(nj.combo%5===0)say(`${nj.combo} 連擊`,{cancel:true});
}
function njFrame(lm,now){
  const v=njView,ctx=v.canvas.getContext('2d'),W=v.canvas.width,H=v.canvas.height,d=NJ_DIFF[nj.diff];
  if(lm&&njVis(lm,11)&&njVis(lm,12)){   // 用肩膀、髖、膝蓋算出身體位置，目標都生在手搆得到的地方
    const sw=Math.max(40,dist(lm[11],lm[12])),cx=(lm[11][0]+lm[12][0])/2,sy=(lm[11][1]+lm[12][1])/2;
    const hy=njVis(lm,23)&&njVis(lm,24)?(lm[23][1]+lm[24][1])/2:sy+sw*1.6,ky=njVis(lm,25)&&njVis(lm,26)?(lm[25][1]+lm[26][1])/2:hy+sw*1.3;
    const o=nj.body;nj.body=o&&nj.phase==='run'?{sw:o.sw*.9+sw*.1,cx:o.cx*.9+cx*.1,sy:o.sy*.9+sy*.1,hy:o.hy*.9+hy*.1,ky:o.ky*.95+ky*.05}:{sw,cx,sy,hy,ky};
  }else if(!lm)nj.body=null;
  if(!nj.on){nj.chip=[nj.body?'鏡頭已就緒，按「開始遊戲」':'請站進鏡頭，讓頭到膝蓋入鏡',nj.body?'ready':'warn'];return}
  if(nj.phase==='count'){
    const r=Math.ceil(3-(now-nj.t0)/1000);
    if(r>0){v.n.textContent=r;nj.chip=['準備！雙手放鬆','low'];if(r!==nj.lastR){nj.lastR=r;say(r,{cancel:true});beep(660,120)}return}
    Object.assign(nj,{phase:'run',start:now,next:now,score:0,hits:0,low:0,bombs:0,miss:0,combo:0,maxCombo:0,lastHit:0,targets:[],fx:[],particles:[],trails:[[],[]],prevHands:[],jumpStore:{},feverSaid:false,flash:0});say('開始',{cancel:true});beep(1320,200);
  }
  nj.elapsed=(now-nj.start)/1000;const left=d.secs-nj.elapsed,fever=left<=10;
  if(left<=0){njFinish(true);return}
  if(fever&&!nj.feverSaid){nj.feverSaid=true;say('狂熱時間！',{cancel:true})}
  if(!nj.body){nj.chip=['看不到你，請站回鏡頭前','warn'];v.hintEl.hidden=false;v.hintEl.textContent='請讓頭到膝蓋都在畫面裡'}
  else{v.hintEl.hidden=true;nj.chip=[fever?'⚡ 狂熱時間 ×2':`剩 ${Math.ceil(left)} 秒`,fever?'low':'ready']}
  if(now>=nj.next&&nj.body){njSpawn(now,fever);nj.next=now+d.spawn*(fever?.6:1)*(.8+Math.random()*.4)}
  const hands=lm?[15,16].map(i=>njVis(lm,i)?lm[i]:null):[],jumpSignal=lm?jumpSig(lm,'_',nj.jumpStore||{})>.09:false,crouched=!!(lm&&kneeAng(lm)!==null&&kneeAng(lm)<125);
  hands.forEach((h,i)=>{if(h){nj.trails[i].push({x:h[0],y:h[1],t:now});while(nj.trails[i].length&&now-nj.trails[i][0].t>340)nj.trails[i].shift()}});
  nj.prevHands=hands.map(h=>h&&[h[0],h[1]]);
  nj.targets=nj.targets.filter(t=>{
    const specialOk=t.kind==='low'?crouched:t.kind==='jump'?jumpSignal:true;
    if(now-t.born>150&&specialOk&&hands.some(h=>h&&Math.hypot(h[0]-t.x,h[1]-t.y)<t.r*1.1)){njHit(t,now,fever);return false}
    if(now-t.born>t.life){if(t.kind!=='bomb'){nj.miss++;nj.combo=0}return false}
    return true;
  });
  /* 畫目標：外圈是剩餘時間 */
  for(const t of nj.targets){
    const age=(now-t.born)/t.life,r=t.r*Math.min(1,(now-t.born)/180),col=t.kind==='bomb'?'#ff6b57':t.kind==='gold'?'#ffd23f':t.kind==='low'?'#3dd6d0':'#ffffff';
    ctx.beginPath();ctx.arc(t.x,t.y,r,0,7);ctx.fillStyle=t.kind==='bomb'?'rgba(255,107,87,.22)':'rgba(10,26,32,.45)';ctx.fill();
    ctx.lineWidth=Math.max(4,r*.12);ctx.strokeStyle=col;ctx.beginPath();ctx.arc(t.x,t.y,r,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-age));ctx.stroke();
    njUpright(ctx,t.x,t.y,()=>{ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${Math.round(r*1.15)}px sans-serif`;ctx.fillText(t.e,0,r*.05);
      if(t.kind==='low'||t.kind==='jump'){ctx.font=`800 ${Math.round(r*.5)}px "Noto Sans TC",sans-serif`;ctx.fillStyle=t.kind==='low'?'#3dd6d0':'#7dccff';ctx.fillText(t.kind==='low'?'蹲':'跳',0,-r*1.35)}});
  }
  for(const trail of nj.trails)for(let i=1;i<trail.length;i++){const a=(now-trail[i].t)/340;ctx.beginPath();ctx.moveTo(trail[i-1].x,trail[i-1].y);ctx.lineTo(trail[i].x,trail[i].y);ctx.lineWidth=Math.max(3,(nj.body?nj.body.sw:70)*.13*(1-a));ctx.lineCap='round';ctx.strokeStyle=`rgba(110,246,255,${1-a})`;ctx.shadowBlur=22;ctx.shadowColor='#51dfff';ctx.stroke();ctx.shadowBlur=0}
  for(const h of hands)if(h){ctx.beginPath();ctx.arc(h[0],h[1],Math.max(10,(nj.body?nj.body.sw:80)*.12),0,7);ctx.fillStyle='rgba(255,210,63,.7)';ctx.fill()}
  nj.particles=nj.particles.filter(p=>now-p.t<p.life);for(const p of nj.particles){const age=(now-p.t)/1000;p.x+=p.vx/30;p.y+=p.vy/30;p.vy+=320/30;ctx.globalAlpha=1-age*1000/p.life;ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,p.r*(1-age*.6),0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
  nj.fx=nj.fx.filter(f=>now-f.t<700);
  for(const f of nj.fx){const a=(now-f.t)/700;njUpright(ctx,f.x,f.y-a*70,()=>{ctx.globalAlpha=1-a;ctx.textAlign='center';ctx.font=`900 ${Math.round(Math.max(34,(nj.body?nj.body.sw:100)*.4))}px "Noto Sans TC",sans-serif`;ctx.lineWidth=6;ctx.strokeStyle='rgba(0,0,0,.6)';ctx.strokeText(f.text,0,0);ctx.fillStyle=f.color;ctx.fillText(f.text,0,0);ctx.globalAlpha=1})}
  if(nj.flash&&now-nj.flash<250){ctx.fillStyle=`rgba(255,107,87,${.35*(1-(now-nj.flash)/250)})`;ctx.fillRect(0,0,W,H)}
  if(fever){ctx.lineWidth=14;ctx.strokeStyle=`rgba(255,210,63,${.35+.25*Math.sin(now/120)})`;ctx.strokeRect(0,0,W,H)}
  v.n.textContent=nj.score;
  const label=`剩 ${Math.ceil(left)} 秒${nj.combo>1?`　連擊 ×${nj.combo}`:''}`;if(v.nm.textContent!==label)v.nm.textContent=label;
}
const njRank=sc=>sc>=900?['S','傳說忍者']:sc>=600?['A','上忍']:sc>=350?['B','中忍']:sc>=150?['C','下忍']:['D','見習忍者'];
function njFinish(done){
  if(!nj.on)return;
  const ran=nj.phase==='run';nj.on=false;nj.phase='idle';nj.targets=[];nj.fx=[];njView.hintEl.hidden=true;njView.nm.textContent='健身忍者';
  $('#njStart').textContent='開始遊戲';if(fullStage===njView.stage)exitFull();
  if(!ran||nj.elapsed<3){renderNinja();return}
  const secs=Math.min(NJ_DIFF[nj.diff].secs,Math.round(nj.elapsed)),kc=secs*kcalPerSec(7),xp=Math.round(nj.score/8)+(done?10:0),N=S.ninja;
  const best=N.best[nj.diff]||0,isBest=nj.score>best;
  if(isBest)N.best[nj.diff]=nj.score;N.bestCombo=Math.max(N.bestCombo,nj.maxCombo);N.hits+=nj.hits;N.plays++;N.secs+=secs;
  N.log.unshift({d:nj.diff,sc:nj.score,h:nj.hits,c:nj.maxCombo,t:Date.now()});N.log=N.log.slice(0,10);
  S.xp+=xp;addKcal(kc);addWorkTime(secs);addReps(nj.low,'深蹲',nj.low);save();renderStats();renderNinja();beep(1320,400);
  const [rk,title]=njRank(nj.score),acc=Math.round(nj.hits/Math.max(1,nj.hits+nj.miss)*100);
  const r=$('#njResult');r.hidden=false;
  r.innerHTML=`<div class="rank">${rk==='S'?'🏆':rk==='A'?'🥇':rk==='B'?'🥈':'🥷'}</div><div class="small mute">${NJ_DIFF[nj.diff].n}・評價 <b style="color:var(--yellow)">${rk}</b>（${title}）</div><div class="big">${nj.score}</div><div class="small">${isBest?'🎉 新的最高分！':`這個難度最高 ${best} 分`}</div>
  <div class="facts"><div class="fact"><b>${nj.hits}</b><span>擊中（命中率 ${acc}%）</span></div><div class="fact"><b>${nj.maxCombo}</b><span>最高連擊</span></div><div class="fact"><b>${nj.low}</b><span>蹲下擊中（算深蹲）</span></div><div class="fact"><b>${Math.round(kc)}</b><span>消耗大卡</span></div></div>
  <p class="small mute" style="margin:10px 0 0">獲得 ${xp} 經驗值${nj.bombs?`・碰到炸彈 ${nj.bombs} 次`:''}</p>`;
  say(`遊戲結束，${nj.score} 分`,{cancel:true});
  finishArcadeLegacy('ninja',nj.score,nj.maxCombo,xp,kc,`${title}・命中 ${nj.hits} 次${isBest?'・締造最高分！':''}`);
}
function renderNinja(){
  $('#njDiff').innerHTML=Object.entries(NJ_DIFF).map(([k,v])=>`<button type="button" data-v="${k}" class="${k===nj.diff?'on':''}">${v.n}（${v.secs} 秒）</button>`).join('');
  $('#njBest').textContent=S.ninja.best[nj.diff]||'—';$('#njCombo').textContent=S.ninja.bestCombo;$('#njHits').textContent=S.ninja.hits;
  $('#njLog').innerHTML=S.ninja.log.length?'<tr><th>難度</th><th>分數</th><th>擊中</th><th>連擊</th></tr>'+S.ninja.log.slice(0,6).map(l=>`<tr><td>${(NJ_DIFF[l.d]||NJ_DIFF.normal).n}</td><td><b style="color:var(--yellow)">${l.sc}</b> ${njRank(l.sc)[0]}</td><td>${l.h}</td><td>${l.c}</td></tr>`).join(''):'<tr><td class="mute">還沒有成績，來玩一場吧！</td></tr>';
}
$('#njDiff').onclick=e=>{const b=e.target.closest('button');if(!b||nj.on)return;nj.diff=b.dataset.v;renderNinja()};
$('#njCamBtn').onclick=async()=>{$('#njCamBtn').disabled=true;const ok=await camStart(njView);if(ok)$('#njCamOff').disabled=false;else $('#njCamBtn').disabled=false};
$('#njCamOff').onclick=()=>{njFinish(false);camStop();$('#njCamBtn').disabled=false;$('#njCamOff').disabled=true};
$('#njStart').onclick=()=>{
  if(nj.on){njFinish(false);return}
  const w=$('#njWarn');w.hidden=true;
  if(!(cam.running&&cam.view===njView)){w.hidden=false;w.textContent='請先按「開啟鏡頭」，看到畫面和骨架後再開始。';return}
  audioInit();nj.on=true;nj.phase='count';nj.t0=performance.now();nj.lastR=0;$('#njResult').hidden=true;$('#njStart').textContent='停止';
};
/* ================= 小遊戲共用工具 ================= */
function screenLm(lm,W){   // 鏡頭原始座標換成「螢幕座標」：畫面是鏡像時 x 要左右翻轉，判定和畫圖才會在同一個位置
  if(!lm||!isMirror())return lm;
  return lm.map(p=>p&&[W-p[0],p[1],p[2]]);
}
function onScreen(ctx,W,fn){ctx.save();if(isMirror()){ctx.translate(W,0);ctx.scale(-1,1)}fn();ctx.restore()}   // 用「螢幕座標」畫：鏡像畫面下文字、方向也是正的
function gameCount(g,v,now){   // 3 秒倒數；回傳 true 表示還在倒數
  const r=Math.ceil(3-(now-g.t0)/1000);if(r<=0)return false;
  v.n.textContent=r;g.chip=['準備！','low'];if(r!==g.lastR){g.lastR=r;say(r,{cancel:true});beep(660,120)}return true;
}
function gameRecord(key,score,extra){
  const G=S.games[key],best=G.best||0,isBest=score>best;
  if(isBest)G.best=score;G.plays++;G.log.unshift({sc:score,t:Date.now(),...extra});G.log=G.log.slice(0,10);return{best,isBest};
}
function gameResultHTML(o){
  return `<div class="rank">${o.icon}</div><div class="small mute">${o.sub}</div><div class="big">${o.score}</div><div class="small">${o.isBest?'🎉 新的最高分！':`最高 ${o.best} 分`}</div>
  <div class="facts">${o.facts.map(([v,l])=>`<div class="fact"><b>${v}</b><span>${l}</span></div>`).join('')}</div><p class="small mute" style="margin:10px 0 0">獲得 ${o.xp} 經驗值</p>`;
}
function gameLogHTML(key,cols,row){
  const L=S.games[key].log;
  return L.length?`<tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr>`+L.slice(0,6).map(l=>`<tr>${row(l).map(x=>`<td>${x}</td>`).join('')}</tr>`).join(''):'<tr><td class="mute">還沒有成績，來玩一場吧！</td></tr>';
}
function bodyMetrics(lm){   // 肩寬、肩中心、髖中心、軀幹長
  if(!lm||!njVis(lm,11)||!njVis(lm,12))return null;
  const sw=Math.max(30,dist(lm[11],lm[12])),sx=(lm[11][0]+lm[12][0])/2,sy=(lm[11][1]+lm[12][1])/2;
  const hipOk=njVis(lm,23)&&njVis(lm,24),hx=hipOk?(lm[23][0]+lm[24][0])/2:sx,hy=hipOk?(lm[23][1]+lm[24][1])/2:null;
  return{sw,sx,sy,hx,hy,torso:hy===null?null:Math.max(40,hy-sy)};
}

/* ================= 🏃 障礙跑酷：跳過箱子、蹲過飛鳥 ================= */
const rn={on:false,phase:'idle',chip:['開啟鏡頭後按「開始遊戲」','']};
const rnView=makeView($('[data-stage=run]'),()=>null,{label:()=>rn.on?'停止':'開始遊戲',click:()=>$('#rnStart').click()});
rnView.manualHint=true;$('.u',rnView.stage).textContent='分';rnView.nm.textContent='障礙跑酷';
rnView.chipFn=()=>rn.chip;rnView.gaugeFn=()=>rn.on&&rn.phase==='run'?rn.lives/3*100+'%':'0';
rnView.onLm=(lm,now)=>rnFrame(lm,now);
function rnFrame(lm,now){
  const v=rnView,ctx=v.canvas.getContext('2d'),W=v.canvas.width,H=v.canvas.height,m=bodyMetrics(screenLm(lm,W));
  if(!rn.on){rn.chip=[m&&m.hy?'鏡頭已就緒，按「開始遊戲」':'請退後，讓肩膀到膝蓋都入鏡',m&&m.hy?'ready':'warn'];return}
  if(rn.phase==='count'){
    if(m&&m.hy){rn.cal.push([m.hy,m.torso])}   // 倒數時記下站姿高度當基準
    if(gameCount(rn,v,now))return;
    const c=rn.cal.slice(-40);
    Object.assign(rn,{phase:'run',start:now,last:now,base:c.length?median(c.map(x=>x[0])):null,torso:c.length?median(c.map(x=>x[1])):null,
      lives:3,score:0,dist:0,speed:.3,obs:[],next:now+1500,cleared:0,jumps:0,ducks:0,hits:0,state:'run',flash:0,fx:[],lane:1,lanePos:1,coinNext:now+900,coins:0});
    say('開始，跑起來！',{cancel:true});beep(1320,200);
  }
  const dt=Math.min(.1,(now-rn.last)/1000);rn.last=now;rn.elapsed=(now-rn.start)/1000;
  /* 身體狀態：髖部比基準高＝跳，低很多＝蹲 */
  if(m&&m.hy){
    if(rn.base===null){rn.base=m.hy;rn.torso=m.torso}
    const d=(m.hy-rn.base)/rn.torso;
    rn.state=d<-.09?'jump':d>.22?'duck':'run';
    if(rn.state==='run')rn.base=rn.base*.98+m.hy*.02;   // 慢慢跟著修正，人前後移動也不會亂判
    v.hintEl.hidden=true;
  }else{rn.state='run';v.hintEl.hidden=false;v.hintEl.textContent='請讓肩膀、髖部到膝蓋都在畫面裡'}
  if(rn.state==='jump'&&rn.prevState!=='jump')rn.airT=now;rn.prevState=rn.state;
  const air=rn.state==='jump'||now-(rn.airT||0)<250;   // 跳起來有一點滯空時間，比較好玩
  const chosenLane=m&&m.sx/W<.37?0:m&&m.sx/W>.63?2:1;
  if(rn.lane!==chosenLane&&m){rn.lane=chosenLane;beep(520+chosenLane*90,35)}
  rn.lanePos=(rn.lanePos??1)+(rn.lane-(rn.lanePos??1))*Math.min(1,dt*9);
  const difficulty=rn.diff||'normal',baseSpeed=difficulty==='hard'?.42:difficulty==='easy'?.26:.34;
  rn.speed=Math.min(difficulty==='hard'?.95:.78,baseSpeed+rn.elapsed*.006);rn.dist+=rn.speed*dt*10;
  if(now>=rn.next){
    const duck=Math.random()<.45;rn.obs.push({type:duck?'duck':'jump',lane:Math.random()*3|0,progress:0,done:false,e:duck?['🦅','🐦','🛸'][Math.random()*3|0]:['📦','🪨','🌵'][Math.random()*3|0]});
    rn.next=now+(difficulty==='hard'?1300:difficulty==='easy'?2200:1700)*(0.8+Math.random()*.35)*(.34/rn.speed)**.45;
  }
  for(const o of rn.obs){
    o.progress+=rn.speed*dt*.42;
    const inWin=o.progress>=.82&&o.progress<.94,sameLane=o.lane===rn.lane;
    if(!o.done&&inWin&&sameLane&&((o.type==='jump'&&air)||(o.type==='duck'&&rn.state==='duck'))){
      o.done=true;rn.cleared++;if(o.type==='jump')rn.jumps++;else rn.ducks++;
      const pts=10+Math.floor(rn.speed*20);rn.score+=pts;rn.fx.push({x:(o.lane+.5)/3,text:`+${pts}`,t:now});beep(o.type==='jump'?1046:784,70);arenaHit(rn.score,rn.cleared,o.type==='jump'?'跳過障礙！':'蹲下滑行！');
    }
    if(o.type!=='coin'&&!o.done&&o.progress>=.94){o.done=true;if(sameLane){o.hit=true;rn.lives--;rn.hits++;rn.flash=now;beep(160,320);say(o.type==='jump'?'要跳！':'要蹲！',{cancel:true})}else rn.cleared++}
  }
  rn.obs=rn.obs.filter(o=>o.progress<1.05);
  if(now>=rn.coinNext){rn.obs.push({type:'coin',lane:Math.random()*3|0,progress:.72,done:false,e:'🪙'});rn.coinNext=now+1900+Math.random()*1300}
  for(const o of rn.obs)if(o.type==='coin'&&!o.done&&o.progress>=.82&&o.lane===rn.lane){o.done=true;rn.coins++;rn.score+=25;rn.fx.push({x:(o.lane+.5)/3,text:'+25',t:now});beep(1480,60);arenaHit(rn.score,rn.cleared,'金幣到手！')}
  if(rn.lives<=0||rn.elapsed>=120){rnFinish(true);return}
  const gy=H*.93,band=H*.42,u=H*.11;
  onScreen(ctx,W,()=>{
    ctx.fillStyle='rgba(6,18,36,.72)';ctx.beginPath();ctx.moveTo(W*.43,H*.28);ctx.lineTo(W*.57,H*.28);ctx.lineTo(W*1.08,gy);ctx.lineTo(-W*.08,gy);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(81,226,255,.65)';ctx.lineWidth=3;
    for(let i=0;i<=3;i++){const topX=W*.43+(W*.14/3)*i,bottomX=-W*.08+(W*1.16/3)*i;ctx.beginPath();ctx.moveTo(topX,H*.28);ctx.lineTo(bottomX,gy);ctx.stroke()}
    ctx.strokeStyle='rgba(255,255,255,.24)';ctx.setLineDash([u*.25,u*.34]);ctx.lineDashOffset=rn.dist*u*.4;
    for(let i=1;i<3;i++){const x=-W*.08+(W*1.16/3)*i;ctx.beginPath();ctx.moveTo(x,gy-band);ctx.lineTo(x,gy);ctx.stroke()}ctx.setLineDash([]);
    ctx.textAlign='center';ctx.textBaseline='bottom';
    for(const o of rn.obs){
      const p=Math.max(0,Math.min(1,o.progress)),x=W*(.2+o.lane*.3),y=H*(.27+p*.62),size=u*(.34+p*.72);
      ctx.globalAlpha=o.done&&!o.hit?.35:1;ctx.font=`${size}px sans-serif`;ctx.fillText(o.e,x,y);
      if(!o.done&&o.type!=='coin'&&p>.45){ctx.font=`900 ${u*.35}px "Noto Sans TC",sans-serif`;ctx.fillStyle=o.type==='jump'?'#ffd23f':'#3dd6d0';ctx.fillText(o.type==='jump'?'跳！':'蹲！',x,y-size*.9)}
      ctx.globalAlpha=1;
    }
    const py=air?gy-u*1.25:gy,ps=rn.state==='duck'?.6:1,px=W*(.2+rn.lanePos*.3);
    ctx.save();ctx.translate(px,py);ctx.scale(-ps,ps);ctx.font=`${u*1.1}px sans-serif`;ctx.fillText(rn.state==='duck'?'🧎':'🏃',0,0);ctx.restore();
    rn.fx=rn.fx.filter(f=>now-f.t<600);
    for(const f of rn.fx){const a=(now-f.t)/600;ctx.globalAlpha=1-a;ctx.font=`900 ${u*.5}px "Noto Sans TC",sans-serif`;ctx.fillStyle='#fff';ctx.fillText(f.text,f.x*W,gy-u*2-a*u)}
    ctx.globalAlpha=1;ctx.textAlign='right';ctx.textBaseline='top';ctx.font=`${u*.55}px sans-serif`;ctx.fillText('❤️'.repeat(rn.lives)+'🤍'.repeat(3-rn.lives),W-u*.3,u*.3);
  });
  if(rn.flash&&now-rn.flash<300){ctx.fillStyle=`rgba(255,107,87,${.4*(1-(now-rn.flash)/300)})`;ctx.fillRect(0,0,W,H)}
  v.n.textContent=rn.score;rn.chip=[rn.state==='jump'?'跳！':rn.state==='duck'?'蹲下':'跑步中',rn.state==='run'?'ready':'low'];
  const label=`${Math.floor(rn.dist)} 公尺`;if(v.nm.textContent!==label)v.nm.textContent=label;
}
function rnFinish(done){
  if(!rn.on)return;
  const ran=rn.phase==='run';rn.on=false;rn.phase='idle';rnView.hintEl.hidden=true;rnView.nm.textContent='障礙跑酷';$('#rnStart').textContent='開始遊戲';
  if(fullStage===rnView.stage)exitFull();
  if(!ran||rn.elapsed<3){renderRun();return}
  const secs=Math.round(rn.elapsed),kc=secs*kcalPerSec(8),meters=Math.floor(rn.dist),score=rn.score+meters,xp=Math.round(score/8);
  const {best,isBest}=gameRecord('run',score,{m:meters,c:rn.cleared});
  S.xp+=xp;addKcal(kc);addWorkTime(secs);addReps(rn.ducks,'深蹲',rn.ducks);save();renderStats();renderRun();beep(1320,400);
  $('#rnResult').hidden=false;
  $('#rnResult').innerHTML=gameResultHTML({icon:meters>=300?'🏆':meters>=150?'🥇':'🏃',sub:`跑了 ${meters} 公尺${rn.lives<=0?'，3 條命用完了':''}`,score,isBest,best,xp,
    facts:[[rn.cleared,'閃過障礙'],[rn.jumps,'跳過'],[rn.ducks,'蹲過（算深蹲）'],[Math.round(kc),'消耗大卡']]});
  say(`跑了 ${meters} 公尺，${score} 分`,{cancel:true});
  finishArcadeLegacy('run',score,rn.cleared,xp,kc,`${meters} 公尺・閃過 ${rn.cleared} 個障礙${isBest?'・締造最高分！':''}`);
}
function renderRun(){
  const G=S.games.run;$('#rnBest').textContent=G.best||'—';$('#rnPlays').textContent=G.plays;
  $('#rnLog').innerHTML=gameLogHTML('run',['分數','距離','閃過'],l=>[`<b style="color:var(--yellow)">${l.sc}</b>`,`${l.m} m`,l.c]);
}
$('#rnCamBtn').onclick=async()=>{$('#rnCamBtn').disabled=true;const ok=await camStart(rnView);if(ok)$('#rnCamOff').disabled=false;else $('#rnCamBtn').disabled=false};
$('#rnCamOff').onclick=()=>{rnFinish(false);camStop();$('#rnCamBtn').disabled=false;$('#rnCamOff').disabled=true};
$('#rnStart').onclick=()=>{
  if(rn.on){rnFinish(false);return}
  const w=$('#rnWarn');w.hidden=true;
  if(!(cam.running&&cam.view===rnView)){w.hidden=false;w.textContent='請先按「開啟鏡頭」，看到畫面和骨架後再開始。';return}
  audioInit();Object.assign(rn,{on:true,phase:'count',t0:performance.now(),lastR:0,cal:[]});$('#rnResult').hidden=true;$('#rnStart').textContent='停止';
};

/* ================= 🧍 姿勢配對：牆壁壓過來之前擺出指定姿勢 ================= */
const kneeAng=lm=>{const a=[[23,25,27],[24,26,28]].filter(t=>t.every(i=>njVis(lm,i))).map(t=>ang(lm[t[0]],lm[t[1]],lm[t[2]]));return a.length?a.reduce((x,y)=>x+y,0)/a.length:null};
const POSES=[
  {id:'up',n:'雙手舉高',e:'🙌',ok:(lm,m)=>njVis(lm,15)&&njVis(lm,16)&&njVis(lm,0)&&lm[15][1]<lm[0][1]&&lm[16][1]<lm[0][1]},
  {id:'t',n:'T 字張開',e:'✈️',ok:(lm,m)=>njVis(lm,15)&&njVis(lm,16)&&Math.abs(lm[15][1]-m.sy)<m.sw*.45&&Math.abs(lm[16][1]-m.sy)<m.sw*.45&&Math.abs(lm[15][0]-lm[16][0])>m.sw*2.6},
  {id:'squat',n:'深蹲',e:'🏋️',sq:true,ok:lm=>{const k=kneeAng(lm);return k!==null&&k<125}},
  {id:'star',n:'星星跳開',e:'⭐',ok:(lm,m)=>njVis(lm,15)&&njVis(lm,16)&&njVis(lm,27)&&njVis(lm,28)&&lm[15][1]<m.sy&&lm[16][1]<m.sy&&Math.abs(lm[27][0]-lm[28][0])>m.sw*1.7},
  {id:'flamingo',n:'金雞獨立',e:'🦩',ok:(lm,m)=>njVis(lm,27)&&njVis(lm,28)&&Math.abs(lm[27][1]-lm[28][1])>m.sw*.55},
  {id:'left',n:'只舉左手',e:'🙋',ok:(lm,m)=>njVis(lm,15)&&njVis(lm,16)&&njVis(lm,0)&&lm[15][1]<lm[0][1]&&lm[16][1]>m.sy},
  {id:'right',n:'只舉右手',e:'🙋‍♂️',ok:(lm,m)=>njVis(lm,15)&&njVis(lm,16)&&njVis(lm,0)&&lm[16][1]<lm[0][1]&&lm[15][1]>m.sy},
  {id:'pray',n:'雙手合十舉高',e:'🙏',ok:(lm,m)=>njVis(lm,15)&&njVis(lm,16)&&njVis(lm,0)&&lm[15][1]<lm[0][1]&&lm[16][1]<lm[0][1]&&dist(lm[15],lm[16])<m.sw*.7},
  {id:'hips',n:'雙手叉腰',e:'🦸',ok:(lm,m)=>[15,16,23,24,13,14].every(i=>njVis(lm,i))&&dist(lm[15],lm[23])<m.sw*.75&&dist(lm[16],lm[24])<m.sw*.75&&Math.abs(lm[13][0]-lm[14][0])>m.sw*1.5},
  {id:'squatup',n:'深蹲＋雙手舉高',e:'🔥',sq:true,ok:(lm,m)=>POSES[0].ok(lm,m)&&POSES[2].ok(lm,m)},
];
const ps={on:false,phase:'idle',chip:['開啟鏡頭後按「開始遊戲」','']};
const psView=makeView($('[data-stage=pose]'),()=>null,{label:()=>ps.on?'停止':'開始遊戲',click:()=>$('#psStart').click()});
psView.manualHint=true;$('.u',psView.stage).textContent='分';psView.nm.textContent='姿勢配對';
psView.chipFn=()=>ps.chip;psView.gaugeFn=()=>ps.on&&ps.phase==='run'&&ps.cur?Math.max(0,100-(performance.now()-ps.curT)/ps.limit*100)+'%':'0';
psView.onLm=(lm,now)=>psFrame(lm,now);
function psNext(now){
  const pool=POSES.filter(p=>p.id!==(ps.cur&&ps.cur.id)&&(ps.round>=4||p.id!=='squatup'));
  ps.cur=pool[Math.random()*pool.length|0];ps.curT=now;ps.holdT=0;ps.round++;
  const base=ps.diff==='easy'?6200:ps.diff==='hard'?4200:5200,slope=ps.diff==='hard'?210:ps.diff==='easy'?110:170;
  ps.limit=Math.max(ps.diff==='hard'?1650:2600,base-ps.round*slope);say(ps.cur.n,{cancel:true});
}
function psFrame(lm,now){
  const v=psView,ctx=v.canvas.getContext('2d'),W=v.canvas.width,H=v.canvas.height,m=bodyMetrics(lm);
  if(!ps.on){ps.chip=[m?'鏡頭已就緒，按「開始遊戲」':'請退後，讓全身入鏡',m?'ready':'warn'];return}
  if(ps.phase==='count'){if(gameCount(ps,v,now))return;Object.assign(ps,{phase:'run',start:now,score:0,lives:3,round:0,done:0,combo:0,maxCombo:0,squats:0,cur:null,flash:0,good:0});psNext(now);beep(1320,200)}
  ps.elapsed=(now-ps.start)/1000;
  const match=!!(lm&&m&&ps.cur.ok(lm,m)),left=ps.limit-(now-ps.curT);
  if(!m){v.hintEl.hidden=false;v.hintEl.textContent='請讓全身都在畫面裡'}else v.hintEl.hidden=true;
  if(match){if(!ps.holdT)ps.holdT=now}else ps.holdT=0;
  const held=ps.holdT?(now-ps.holdT)/(ps.holdMs||450):0;
  if(held>=1){   // 撐住 0.45 秒就算過關
    ps.done++;ps.combo++;ps.maxCombo=Math.max(ps.maxCombo,ps.combo);if(ps.cur.sq)ps.squats++;
    const pts=Math.round((50+Math.max(0,left)/ps.limit*100)*(1+Math.min(ps.combo-1,8)*.1));ps.score+=pts;ps.good=now;ps.lastPts=pts;
    beep(1046,90);setTimeout(()=>beep(1568,120),90);if(ps.combo%3===0)say(`${ps.combo} 連過！`,{cancel:true});
    if(ps.round>=20){psFinish(true);return}psNext(now);
  }else if(left<=0){
    ps.lives--;ps.combo=0;ps.flash=now;beep(160,320);
    if(ps.lives<=0){psFinish(true);return}say('撞牆了！',{cancel:true});psNext(now);
  }
  const p=ps.cur,tl=Math.max(0,ps.limit-(now-ps.curT))/ps.limit,u=Math.min(W,H)*.1;
  const cx=W*.5,cy=H*.56,s=u*1.35,arms=p.id==='up'?[-1,-1]:p.id==='t'||p.id==='star'?[-.9,.9]:[-.45,.45],legSpread=p.id==='star'?.8:.42,squat=p.id==='squat'?.55:0;
  /* 牆壁從四周壓過來，中間留一個人形洞 */
  const wall=(1-tl)*Math.min(W,H)*.32;
  ctx.fillStyle=`rgba(255,107,87,${.18+(1-tl)*.35})`;ctx.fillRect(0,0,wall,H);ctx.fillRect(W-wall,0,wall,H);ctx.fillRect(0,0,W,wall*.6);
  ctx.save();ctx.globalAlpha=.3;ctx.strokeStyle=match?'#65ffe0':'#d7fff9';ctx.fillStyle='rgba(101,255,224,.18)';ctx.lineWidth=u*.09;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.arc(cx,cy-s*1.15,s*.24,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx,cy-s*.88);ctx.lineTo(cx,cy+s*.28);
  ctx.moveTo(cx,cy-s*.7);ctx.lineTo(cx+arms[0]*s,cy-s*(p.id==='up'?1.4:.68));
  ctx.moveTo(cx,cy-s*.7);ctx.lineTo(cx+arms[1]*s,cy-s*(p.id==='up'?1.4:.68));
  ctx.moveTo(cx,cy+s*.28);ctx.lineTo(cx-s*legSpread,cy+s*(.9-squat*.4));ctx.lineTo(cx-s*.62,cy+s*1.4);
  ctx.moveTo(cx,cy+s*.28);ctx.lineTo(cx+s*legSpread,cy+s*(.9-squat*.4));ctx.lineTo(cx+s*.62,cy+s*1.4);ctx.stroke();ctx.restore();
  onScreen(ctx,W,()=>{
    ctx.fillStyle='rgba(10,26,32,.72)';ctx.beginPath();rrect(ctx,W/2-u*3.3,u*.25,u*6.6,u*1.6,u*.4);ctx.fill();
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${u*1.05}px sans-serif`;ctx.fillText(p.e,W/2-u*2.3,u*1.05);
    ctx.font=`900 ${u*.62}px "Noto Sans TC",sans-serif`;ctx.fillStyle=match?'#3dd6d0':'#ffffff';ctx.fillText(p.n,W/2+u*.6,u*1.05);
    ctx.fillStyle='rgba(255,255,255,.15)';ctx.fillRect(W/2-u*3,u*1.62,u*6,u*.12);ctx.fillStyle=tl>.3?'#ffd23f':'#ff6b57';ctx.fillRect(W/2-u*3,u*1.62,u*6*tl,u*.12);
    if(held>0){ctx.strokeStyle='#3dd6d0';ctx.lineWidth=u*.14;ctx.beginPath();ctx.arc(W/2,H*.55,u*1.4,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,held));ctx.stroke()}
    if(ps.good&&now-ps.good<600){const a=(now-ps.good)/600;ctx.globalAlpha=1-a;ctx.font=`900 ${u*.9}px "Noto Sans TC",sans-serif`;ctx.fillStyle='#3dd6d0';ctx.fillText(`+${ps.lastPts}`,W/2,H*.5-a*u);ctx.globalAlpha=1}
    ctx.textAlign='right';ctx.textBaseline='top';ctx.font=`${u*.5}px sans-serif`;ctx.fillText('❤️'.repeat(ps.lives)+'🤍'.repeat(3-ps.lives),W-u*.3,H-u*.9);
  });
  if(ps.flash&&now-ps.flash<350){ctx.fillStyle=`rgba(255,107,87,${.45*(1-(now-ps.flash)/350)})`;ctx.fillRect(0,0,W,H)}
  if(ps.good&&now-ps.good<220){ctx.fillStyle=`rgba(101,255,224,${.2*(1-(now-ps.good)/220)})`;ctx.fillRect(0,0,W,H)}
  v.n.textContent=ps.score;ps.chip=[match?'姿勢正確，撐住！':`第 ${ps.round}/20 關`,match?'ready':'low'];
  const label=`第 ${ps.round}/20 關${ps.combo>1?`　連過 ×${ps.combo}`:''}`;if(v.nm.textContent!==label)v.nm.textContent=label;
}
function psFinish(done){
  if(!ps.on)return;
  const ran=ps.phase==='run';ps.on=false;ps.phase='idle';psView.hintEl.hidden=true;psView.nm.textContent='姿勢配對';$('#psStart').textContent='開始遊戲';
  if(fullStage===psView.stage)exitFull();
  if(!ran||ps.elapsed<3){renderPose();return}
  const all=ps.done>=20,score=ps.score+(all?300:0),secs=Math.round(ps.elapsed),kc=secs*kcalPerSec(5),xp=Math.round(score/10);
  const {best,isBest}=gameRecord('pose',score,{n:ps.done,c:ps.maxCombo});
  S.xp+=xp;addKcal(kc);addWorkTime(secs);addReps(ps.squats,'深蹲',ps.squats);save();renderStats();renderPose();beep(1320,400);
  $('#psResult').hidden=false;
  $('#psResult').innerHTML=gameResultHTML({icon:all?'🏆':ps.done>=12?'🥇':'🧍',sub:all?'全部 20 關通關！額外 +300 分':`過了 ${ps.done} 關`,score,isBest,best,xp,
    facts:[[ps.done,'過關數'],[ps.maxCombo,'最多連過'],[ps.squats,'深蹲姿勢'],[Math.round(kc),'消耗大卡']]});
  say(`遊戲結束，${score} 分`,{cancel:true});
  finishArcadeLegacy('pose',score,ps.maxCombo,xp,kc,`${all?'全數通關！':`成功配對 ${ps.done} 個姿勢`}${isBest?'・締造最高分！':''}`);
}
function renderPose(){
  const G=S.games.pose;$('#psBest').textContent=G.best||'—';$('#psPlays').textContent=G.plays;
  $('#psPoses').innerHTML=POSES.map(p=>`<span class="ps-chip">${p.e} ${p.n}</span>`).join('');
  $('#psLog').innerHTML=gameLogHTML('pose',['分數','過關','連過'],l=>[`<b style="color:var(--yellow)">${l.sc}</b>`,`${l.n}/20`,l.c]);
}
$('#psCamBtn').onclick=async()=>{$('#psCamBtn').disabled=true;const ok=await camStart(psView);if(ok)$('#psCamOff').disabled=false;else $('#psCamBtn').disabled=false};
$('#psCamOff').onclick=()=>{psFinish(false);camStop();$('#psCamBtn').disabled=false;$('#psCamOff').disabled=true};
$('#psStart').onclick=()=>{
  if(ps.on){psFinish(false);return}
  const w=$('#psWarn');w.hidden=true;
  if(!(cam.running&&cam.view===psView)){w.hidden=false;w.textContent='請先按「開啟鏡頭」，看到畫面和骨架後再開始。';return}
  audioInit();Object.assign(ps,{on:true,phase:'count',t0:performance.now(),lastR:0});$('#psResult').hidden=true;$('#psStart').textContent='停止';
};
/* ================= 金字塔挑戰：1、2、3…做到頂層，再一層一層做回 1 下；每層有時間限制 ================= */
const PY_EX=Object.keys(CH).filter(x=>CAMOK.has(x));
const py={on:false,phase:'idle',ex:PY_EX[0],peak:5,rest:10,steps:[],i:0,done:0,total:0,until:0,counter:null,failAt:-1,workElapsed:0,workStart:0,chip:['開啟鏡頭後按「開始挑戰」','']};
const pySteps=p=>{const a=[];for(let n=1;n<=p;n++)a.push(n);for(let n=p-1;n>=1;n--)a.push(n);return a};
const pyLimit=n=>Math.round(6+n*Math.max(2.5,((EX_MET[py.ex]||[4,2.5])[1])*1.6));   // 每層秒數：慢的動作給多一點時間
const pyView=makeView($('[data-stage=pyr]'),()=>py.on&&py.phase==='work'?py.counter:null,{label:()=>py.on?'停止':'開始挑戰',click:()=>$('#pyStart').click()});
pyView.chipFn=()=>py.chip;
pyView.gaugeFn=()=>!py.on?'0':py.phase==='work'?Math.min(100,py.counter.count/py.steps[py.i]*100)+'%':py.phase==='rest'?Math.max(0,Math.min(100,(py.until-performance.now())/(py.rest*1000)*100))+'%':'0';
pyView.onFrame=info=>pyFrame(info,performance.now());
function pyMini(label,r,kind){const v=pyView;v.tmini.hidden=false;v.tmini.className='tmini '+kind;v.tl.textContent=label;v.tn.textContent=r;v.miniState={label,r,kind}}
function pyWork(now){
  const n=py.steps[py.i];py.phase='work';py.counter.reset();py.until=now+pyLimit(n)*1000;py.workStart=now;py.lastR=0;
  pyView.nm.textContent=`第 ${py.i+1}/${py.steps.length} 層・目標 ${n} 下`;pyView.n.textContent='0';
  say(`第 ${py.i+1} 層，${n} 下`,{cancel:true});beep(1320,200);pyDraw();
}
function pyFrame(info,now){
  const v=pyView;
  if(!py.on){py.chip=['鏡頭已就緒，按「開始挑戰」','ready'];return}
  if(py.phase==='count'){if(gameCount(py,v,now))return;pyWork(now);return}
  const left=Math.max(0,Math.ceil((py.until-now)/1000));
  if(py.phase==='rest'){
    v.n.textContent=left;py.chip=[`休息中，下一層 ${py.steps[py.i]} 下`,''];pyMini('休息',left,'rest');
    if(left<=3&&left>0&&left!==py.lastR){py.lastR=left;beep(660,120)}
    if(now>=py.until)pyWork(now);
    return;
  }
  const need=py.steps[py.i],c=py.counter.count;
  py.chip=info.status==='nobody'?['請讓全身入鏡','warn']:[`還差 ${Math.max(0,need-c)} 下`,info.status==='low'?'low':'ready'];
  pyMini(`第 ${py.i+1} 層`,left,left<=5?'danger':'work');
  if(c>=need){
    py.workElapsed+=Math.max(0,now-py.workStart);py.workStart=0;
    py.total+=need;py.done++;py.i++;
    if(py.i>=py.steps.length){pyFinish(true);return}
    py.phase='rest';py.until=now+py.rest*1000;py.lastR=0;v.nm.textContent=`休息・下一層 ${py.steps[py.i]} 下`;
    say(py.i===py.peak?'登頂了！開始下山':'完成，休息一下',{cancel:true});pyDraw();return;
  }
  if(left<=5&&left>0&&left!==py.lastR){py.lastR=left;beep(880,120)}
  if(now>=py.until){py.failAt=py.i;pyFinish(false)}
}
function pyDraw(){
  const st=py.steps.length?py.steps:pySteps(py.peak);
  $('#pyBoard').innerHTML=st.map((n,i)=>{
    const cls=py.failAt===i?'fail':py.steps.length&&i<py.done?'done':py.on&&i===py.i?'cur':'';
    return `<i class="${cls}" style="height:${Math.round(n/py.peak*100)}%" title="第 ${i+1} 層：${n} 下">${n}</i>`;
  }).join('');
}
function pyFinish(full){
  if(!py.on)return;
  const ran=py.phase==='work'||py.phase==='rest';
  if(py.phase==='work'&&py.workStart){py.workElapsed+=Math.max(0,performance.now()-py.workStart);py.workStart=0}
  if(py.phase==='work'&&!full)py.total+=Math.min(py.counter.count,py.steps[py.i]);   // 沒做完那層也算已做的次數
  py.on=false;py.phase='idle';
  const v=pyView;v.tmini.hidden=true;v.miniState=null;v.hintEl.hidden=true;v.nm.textContent=py.ex;$('#pyStart').textContent='開始挑戰';
  if(fullStage===v.stage)exitFull();
  pyDraw();
  if(!ran){renderPyr();return}
  const total=py.total,ex=py.ex,n=py.steps.length,xp=total*2+(full?50+py.peak*5:0);
  addWorkTime(Math.floor(py.workElapsed/1000));
  if(total>0){
    addReps(total,ex,total);S.xp+=xp;
    S.history.unshift({ex,n:total,t:Date.now()});S.history=S.history.slice(0,30);renderHist();
  }
  if(full)S.pyFull=(S.pyFull||0)+1;
  const {best,isBest}=gameRecord('pyr',total,{ex,p:py.peak,lv:py.done,n,f:full?1:0});
  save();renderStats();renderPyr();beep(1320,400);
  $('#pyResult').hidden=false;
  $('#pyResult').innerHTML=gameResultHTML({icon:full?'🏆':py.done>=py.peak?'⛰️':'🔺',
    sub:full?`${esc(ex)}・頂層 ${py.peak} 下，登頂再下山全部完成！`:`${esc(ex)}・完成 ${py.done}/${n} 層${py.failAt>=0?'，時間到了':''}`,
    score:total+' 下',isBest,best,xp,facts:[[`${py.done}/${n}`,'完成層數'],[total,'總次數'],[py.peak,'頂層次數']]}).replace(/最高 (\d+) 分/,'最多 $1 下');
  say(full?`金字塔完成，共 ${total} 下`:`挑戰結束，共 ${total} 下`,{cancel:true});
  finishArcadeLegacy('pyr',total,py.done,xp,Math.floor(py.workElapsed/1000)*kcalPerSec(6),`${full?'登頂再下山，完整通關！':`突破 ${py.done}/${n} 層`}・共 ${total} 下`);
}
function renderPyr(){
  py.ex=$('#pyEx').value;if(!py.on)pyView.nm.textContent=py.ex;
  $('#pyTotal').textContent=py.peak*py.peak;$('#pyBest').textContent=S.games.pyr.best||'—';$('#pyFullN').textContent=S.pyFull||0;
  $('#pyLog').innerHTML=gameLogHTML('pyr',['動作','頂層','完成','次數'],l=>[esc(l.ex),l.p,`${l.lv}/${l.n}${l.f?' 🏆':''}`,`<b style="color:var(--yellow)">${l.sc}</b>`]);
  if(!py.on)pyDraw();
}
$('#pyEx').innerHTML=optsByCat(PY_EX);
$('#pyEx').value=PY_EX.includes('深蹲')?'深蹲':PY_EX[0];
$('#pyEx').onchange=()=>{if(!py.on)renderPyr()};
seg($('#pyPeak'),b=>{if(py.on)return;py.peak=+b.dataset.v;py.failAt=-1;py.steps=[];renderPyr()});
seg($('#pyRest'),b=>{py.rest=+b.dataset.v});
$('#pyCamBtn').onclick=async()=>{$('#pyCamBtn').disabled=true;const ok=await camStart(pyView);if(ok)$('#pyCamOff').disabled=false;else $('#pyCamBtn').disabled=false};
$('#pyCamOff').onclick=()=>camStop();
{const prev=cam.onStop;cam.onStop=()=>{prev&&prev();if(py.on)pyFinish(false);$('#pyCamBtn').disabled=false;$('#pyCamOff').disabled=true}}
$('#pyStart').onclick=()=>{
  if(py.on){pyFinish(false);return}
  const w=$('#pyWarn');w.hidden=true;
  if(!(cam.running&&cam.view===pyView)){w.hidden=false;w.textContent='請先按「開啟鏡頭」，看到畫面和骨架後再開始。';return}
  audioInit();py.ex=$('#pyEx').value;py.steps=pySteps(py.peak);py.counter=new RepCounter(py.ex);py.counter.relax=.06;
  Object.assign(py,{on:true,phase:'count',t0:performance.now(),lastR:0,i:0,done:0,total:0,failAt:-1,workElapsed:0,workStart:0});
  $('#pyResult').hidden=true;$('#pyStart').textContent='停止';pyDraw();
};
renderPyr();

seg($('#gSub'),b=>{if(nj.on)njFinish(false);if(rn.on)rnFinish(false);if(ps.on)psFinish(false);if(py.on)pyFinish(false);['ch','ninja','hold','run','pose','pyr'].forEach(k=>{$('#sub-'+k).hidden=b.dataset.sub!==k});if(cam.running)camStop();exitFull()});

document.body.appendChild($('#gameArena'));
let gameActiveKey='',gameSelectedKey='',gamePaused=false,gameLeaving=false,gameCountdownToken=0;
const GAME_META={
  ch:{name:'一分鐘挑戰',icon:'⏱️',tags:'全身燃脂・次數闖關',how:'跟著倒數完成指定動作，每一下都會替頭目造成傷害。動作幅度完整、節奏穩定，挑戰你的個人最佳。',view:chView,start:()=>{$('#chCam').checked=true;$('#chStart').click()},host:$('#sub-ch [data-stage=ch]'),seconds:60},
  hold:{name:'撐住挑戰',icon:'🛡️',tags:'核心穩定・耐力守關',how:'依照鏡頭提示維持標準姿勢，姿勢正確時能量槽持續充能，撐到目標時間即可通關。',view:null,start:()=>$('#hStart').click(),host:$('#sub-hold [data-stage=hold]'),seconds:60},
  pyr:{name:'金字塔挑戰',icon:'🔺',tags:'肌力攀登・層層突破',how:'從第一層開始逐步增加次數，登頂後再完成下山。每突破一層都會削減頭目能量。',view:pyView,start:()=>$('#pyStart').click(),host:$('#sub-pyr [data-stage=pyr]'),seconds:60},
  ninja:{name:'健身忍者',icon:'🥷',tags:'敏捷反應・全身出擊',how:'用雙手揮擊水果、抬膝擊中低位目標，遇到炸彈要避開。連擊越高，分數倍率越高。',view:njView,start:()=>$('#njStart').click(),host:$('#sub-ninja [data-stage=ninja]'),seconds:60},
  run:{name:'障礙跑酷',icon:'🏃',tags:'全身移動・跳躍閃避',how:'左右移動切換跑道，跳過障礙並蹲下閃避，收集金幣並盡可能跑得更遠。',view:rnView,start:()=>$('#rnStart').click(),host:$('#sub-run [data-stage=run]'),seconds:60},
  pose:{name:'姿勢配對',icon:'🧍',tags:'核心爆發・全身反應',how:'依照畫面上的姿勢提示快速擺出指定動作，在倒數結束前穩定維持姿勢即可過關。',view:psView,start:()=>$('#psStart').click(),host:$('#sub-pose [data-stage=pose]'),seconds:60},
  rhythm:{name:'全身節拍光拳',icon:'🥊',tags:'節奏拳擊・高抬腿・深蹲',how:'跟著節拍揮拳擊中光球、抬膝撞擊能量點；雷射逼近時蹲低閃避，連續命中累積熱力連擊。',view:null,host:$('[data-stage=rhythm]'),seconds:60},
  dodge:{name:'極限隕石閃避',icon:'☄️',tags:'弓步閃避・跳躍集晶',how:'左右移動離開隕石落點，遇到低空衝擊時蹲低或跳起閃避，同時用手腳碰觸能量寶石。',view:null,host:$('[data-stage=dodge]'),seconds:60}
};
const gameRankFor=score=>score>=900?'S':score>=500?'A':score>=200?'B':'C';
function gameBest(key){
  if(key==='ch')return Math.max(0,...Object.values(S.best||{}).map(Number).filter(Number.isFinite));
  if(key==='hold')return Math.max(0,...Object.values(S.holdBest||{}).map(Number).filter(Number.isFinite));
  if(key==='ninja')return Math.max(0,...Object.values(S.ninja.best||{}).map(Number).filter(Number.isFinite));
  return Number(S.games[key]&&S.games[key].best)||0;
}
const GAME_KEYS=['ch','hold','pyr','ninja','run','pose','rhythm','dodge'];
function refreshGameHeader(){
  const best=Math.max(0,...GAME_KEYS.map(gameBest));
  $('#headerGameCombo').textContent=Math.max(S.ninja.bestCombo||0,...(S.games.pose.log||[]).map(x=>x.c||0),...(S.games.rhythm.log||[]).map(x=>x.c||0),...(S.games.dodge.log||[]).map(x=>x.c||0));
  $('#headerGameScore').textContent=best.toLocaleString();
  $('#headerGameLevel').textContent=`等級 ${level()}`;
}
function refreshGameLobby(){
  refreshGameHeader();
  $$('#gameCards .game-card').forEach(card=>{
    const key=card.dataset.game,score=gameBest(key);
    $('.game-card-score b',card).textContent=score?score.toLocaleString():'—';
    const badge=$('.game-rank',card);
    if(score){badge.textContent=gameRankFor(score);badge.classList.add('earned')}else if(key==='rhythm'||key==='dodge')badge.textContent='全新';else badge.textContent='開始';
  });
}
function setGameDifficulty(diff){
  const map={ch:()=>{$$('#chDiff button').forEach((b,i)=>b.classList.toggle('on',i===(diff==='easy'?0:diff==='hard'?2:1)));chDiff=diff==='easy'?0:diff==='hard'?2:1;chRefresh()},
    hold:()=>{$(`#hTarget button[data-v="${diff==='easy'?30:diff==='hard'?90:60}"]`).click()},
    pyr:()=>{$(`#pyPeak button[data-v="${diff==='easy'?5:diff==='hard'?10:8}"]`).click()},
    ninja:()=>{$('#njDiff button').forEach(b=>{if(b.dataset.v===diff)b.click()})},
    run:()=>{rn.diff=diff},
    pose:()=>{ps.diff=diff;ps.holdMs=diff==='hard'?650:diff==='easy'?350:450}};
  if(map[gameSelectedKey])map[gameSelectedKey]();
}
function openGameDetails(key){
  gameSelectedKey=key;const g=GAME_META[key];if(!g)return;
  $('#gameDialogIcon').textContent=g.icon;$('#gameDialogTitle').textContent=g.name;$('#gameDialogTags').textContent=g.tags;
  $('#gameDialogHowto').textContent=g.how;
  const d=$('#gameDetails');if(!d.open)d.showModal();
}
function setGameArenaHud(key){
  const g=GAME_META[key];$('#gameArenaName').textContent=g.name;$('#gameArenaSub').textContent=g.tags;
  $('#gameArenaScore').textContent='0';$('#gameArenaClock').textContent=g.seconds||60;$('#gameArenaClock').style.setProperty('--clock-progress','100%');$('#gameArenaCombo').textContent='🔥 連擊 × 0';$('#gameArenaTip').textContent='全身保持在畫面框線內，準備開始！';
}
function updateGameHud(score,combo,tip,time){
  const scoreEl=$('#gameArenaScore'),nextScore=Math.max(0,Math.round(score||0)).toLocaleString();
  if(scoreEl.textContent!==nextScore){scoreEl.textContent=nextScore;scoreEl.classList.remove('pop');void scoreEl.offsetWidth;scoreEl.classList.add('pop')}
  $('#gameArenaCombo').textContent=`🔥 連擊 × ${Math.max(0,Math.round(combo||0))}`;
  if(tip)$('#gameArenaTip').textContent=tip;
  if(time!==undefined){const total=GAME_META[gameActiveKey].seconds||60,left=Math.max(0,Math.ceil(time));$('#gameArenaClock').textContent=left;$('#gameArenaClock').style.setProperty('--clock-progress',`${Math.max(0,Math.min(100,left/total*100))}%`);$('#gameArenaSub').textContent=`${GAME_META[gameActiveKey].tags}　・　${left} 秒`}
  if(time!==undefined)$('#gameArenaBossBar').style.width=`${Math.max(4,Math.min(100,time/Math.max(1,GAME_META[gameActiveKey].seconds)*100))}%`;
}
function syncArcadeHud(){
  const key=gameActiveKey;if(!key||!GAME_META[key]||gamePaused)return;
  let score=0,combo=0,tip=GAME_META[key].tags,progress=0;
  if(key==='ch'){score=chCounter?chCounter.count:0;progress=Number($('#chTarget').textContent)>0?score/Number($('#chTarget').textContent):0;tip='完成動作，持續攻擊頭目！';const clock=$('#chTimer .tbig');updateGameHud(score,combo,tip,clock?Number(clock.textContent)||0:60)}
  if(key==='hold'){score=Math.floor(hold.good||0);progress=hold.target?score/hold.target:0;tip='姿勢正確時能量持續充能！';updateGameHud(score,combo,tip,Math.max(0,(hold.target||60)-(hold.good||0)))}
  if(key==='pyr'){score=py.counter?py.total+py.counter.count:py.total||0;progress=py.steps&&py.steps.length?py.done/py.steps.length:0;tip=py.phase==='rest'?'休息後繼續攀登！':'完成本層次數，突破頭目防線！';updateGameHud(score,combo,tip,py.on&&py.until?Math.max(0,(py.until-performance.now())/1000):60)}
  if(key==='ninja'){score=nj.score||0;combo=nj.combo||0;progress=Math.min(1,score/1200);tip=nj.elapsed>NJ_DIFF[nj.diff].secs-10?'狂熱時間！分數加倍！':'揮拳擊中水果，避開炸彈！';updateGameHud(score,combo,tip,Math.max(0,NJ_DIFF[nj.diff].secs-(nj.elapsed||0)))}
  if(key==='run'){score=rn.score||0;combo=rn.cleared||0;progress=Math.min(1,(rn.elapsed||0)/120);tip='左右移動跑道，跳過低欄、蹲下滑行！';updateGameHud(score,combo,tip,Math.max(0,120-(rn.elapsed||0)))}
  if(key==='pose'){score=ps.score||0;combo=ps.combo||0;progress=Math.min(1,(ps.done||0)/20);tip=ps.cur?`模仿姿勢：${ps.cur.n}`:'全身入鏡，準備配對！';updateGameHud(score,combo,tip,Math.max(0,60-(ps.elapsed||0)))}
  if(['ch','hold','pyr'].includes(key)){updateGameHud(score,combo,tip);$('#gameArenaBossBar').style.width=`${Math.max(4,Math.min(100,100-progress*100))}%`}
}
function arenaCountIn(){
  const token=++gameCountdownToken,box=$('#gameArenaCountdown'),number=$('#gameCountNumber');
  box.hidden=false;
  const steps=['3','2','1','開始！'];
  steps.forEach((n,i)=>setTimeout(()=>{if(token!==gameCountdownToken||$('#gameArena').hidden)return;number.textContent=n;number.style.animation='none';void number.offsetWidth;number.style.animation='';beep(i===3?1320:660,i===3?260:130)},i*760));
  setTimeout(()=>{if(token===gameCountdownToken)box.hidden=true},steps.length*760);
}
function startSelectedGame(){
  const key=gameActiveKey;
  if(!key||!GAME_META[key])return;
  $('#gameArenaResult').hidden=true;$('#gameArenaPausePanel').hidden=true;gamePaused=false;
  if(cam.view&&cam.view.video.paused)cam.view.video.play().catch(e=>console.warn(e));
  if(key==='rhythm')rhythmBegin();else if(key==='dodge')dodgeBegin();else GAME_META[key].start();
  arenaCountIn();
}
async function launchArcadeGame(key){
  const g=GAME_META[key];if(!g)return;
  if($('#gameDetails').open)$('#gameDetails').close();
  gameActiveKey=key;gamePaused=false;gameLeaving=false;
  const view=g.view||({hold:holdView}[key])||(key==='rhythm'?rhythmView:dodgeView);
  g.view=view;
  if(view.stage.parentElement!==$('#gameArenaStage'))$('#gameArenaStage').appendChild(view.stage);
  $('#gameArena').hidden=false;document.body.classList.add('game-arena-open');setGameArenaHud(key);
  const ok=await camStart(view);
  if(!ok){$('#gameArena').hidden=true;document.body.classList.remove('game-arena-open');g.host.appendChild(view.stage);gameActiveKey='';const message=view.msg.textContent||'鏡頭無法啟動，請檢查鏡頭權限後重試。';toast(message);return}
  audioInit();startSelectedGame();
}
function arenaFinish(key,score,combo,xp,kcal,message){
  if(key!==gameActiveKey||!$('#gameArena')||$('#gameArena').hidden)return;
  gamePaused=false;$('#gameArenaPausePanel').hidden=true;$('#gameArenaCountdown').hidden=true;
  const grade=gameRankFor(score);
  $('#gameResultRank').textContent=grade;$('#gameResultTitle').textContent=GAME_META[key].name+'・挑戰完成';
  $('#gameResultScore').textContent=Math.round(score||0).toLocaleString();$('#gameResultCombo').textContent=Math.round(combo||0);
  $('#gameResultXp').textContent=Math.round(xp||0);$('#gameResultKcal').textContent=Math.round(kcal||0);
  $('#gameResultMessage').textContent=message||({S:'傳奇表現！你已突破極限。',A:'表現出色，再挑戰一次刷新紀錄！',B:'做得很好，保持節奏繼續進步！',C:'熱身完成，下一局挑戰更高分！'}[grade]);
  $('#gameArenaResult').hidden=false;refreshGameLobby();beep(1320,280);
}
function returnToGameLobby(){
  gameLeaving=true;gameCountdownToken++;gamePaused=false;$('#gameArenaCountdown').hidden=true;$('#gameArenaPausePanel').hidden=true;$('#gameArenaResult').hidden=true;
  if(chRunning)chCtl.aborted=true;
  if(hold.on){hold.on=false;hold.phase='idle'}
  if(nj.on){nj.on=false;nj.phase='idle'}
  if(rn.on){rn.on=false;rn.phase='idle'}
  if(ps.on){ps.on=false;ps.phase='idle'}
  if(py.on){py.on=false;py.phase='idle'}
  if(rhythm.on){rhythm.on=false;rhythm.phase='idle'}
  if(rhythm.musicStarted){musicStop();rhythm.musicStarted=false}
  if(dodge.on){dodge.on=false;dodge.phase='idle'}
  if(cam.running||cam.starting)camStop();
  const g=GAME_META[gameActiveKey];if(g&&g.view&&g.view.stage.parentElement===$('#gameArenaStage'))g.host.appendChild(g.view.stage);
  $('#gameArena').hidden=true;document.body.classList.remove('game-arena-open');gameActiveKey='';gameLeaving=false;refreshGameLobby();
}
function pauseArcade(){
  if(!gameActiveKey||!cam.running)return;
  if(gamePaused){
    const delta=performance.now()-gamePausedAt;shiftArcadeClock(delta);gamePaused=false;
    const p=cam.view.video.play();if(p&&p.catch)p.catch(e=>{console.warn(e);toast('鏡頭無法恢復，請重新進入遊戲。')});
    $('#gameArenaPausePanel').hidden=true;$('#gameArenaPause').textContent='Ⅱ';return;
  }
  gamePaused=true;gamePausedAt=performance.now();cam.view.video.pause();$('#gameArenaPausePanel').hidden=false;$('#gameArenaPause').textContent='▶';
}
let gamePausedAt=0;
function shiftArcadeClock(delta){
  const states=[hold,nj,rn,ps,py,rhythm,dodge],fields=['t0','start','last','next','until','curT','lastHit','airT','sayAt','coinNext','nextBeat','flash','good','holdT','badSince'];
  for(const state of states)if(state&&state.on){
    for(const field of fields)if(Number.isFinite(state[field])&&state[field]>0)state[field]+=delta;
    for(const list of [state.targets,state.objects,state.fx,state.particles])if(Array.isArray(list))for(const o of list){if(Number.isFinite(o.born))o.born+=delta;if(Number.isFinite(o.t))o.t+=delta}
    if(state.laser&&Number.isFinite(state.laser.until))state.laser.until+=delta;
  }
}
$('#gameCards').onclick=e=>{const card=e.target.closest('[data-game]');if(card)openGameDetails(card.dataset.game)};
$('#gameDialogClose').onclick=()=>$('#gameDetails').close();
$('#gameDifficulty').onclick=e=>{const b=e.target.closest('[data-diff]');if(!b)return;$$('#gameDifficulty button').forEach(x=>x.classList.toggle('on',x===b));setGameDifficulty(b.dataset.diff)};
$('#gamePlayNow').onclick=()=>launchArcadeGame(gameSelectedKey);
$('#gameArenaExit').onclick=returnToGameLobby;$('#gamePauseExit').onclick=returnToGameLobby;$('#gameArenaPause').onclick=pauseArcade;$('#gameArenaResume').onclick=pauseArcade;$('#gameResultBack').onclick=returnToGameLobby;
$('#gameReplay').onclick=()=>startSelectedGame();
$('#gameDetails').onclick=e=>{if(e.target===$('#gameDetails'))$('#gameDetails').close()};

const rhythm={on:false,phase:'idle',diff:'normal',t0:0,targets:[],fx:[],trail:[[],[]],combo:0,maxCombo:0,miss:0,score:0,hits:0};
const rhythmView=makeView($('[data-stage=rhythm]'),()=>null,{label:()=>rhythm.on?'停止':'開始',click:()=>returnToGameLobby()});
rhythmView.manualHint=true;rhythmView.nm.textContent='全身節拍光拳';rhythmView.chipFn=()=>[rhythm.on?'跟著節拍出擊':'準備開始','ready'];rhythmView.onLm=(lm,now)=>rhythmFrame(lm,now);
const dodge={on:false,phase:'idle',diff:'normal',t0:0,last:0,objects:[],fx:[],score:0,combo:0,maxCombo:0,hits:0,miss:0,lives:3};
const dodgeView=makeView($('[data-stage=dodge]'),()=>null,{label:()=>dodge.on?'停止':'開始',click:()=>returnToGameLobby()});
dodgeView.manualHint=true;dodgeView.nm.textContent='極限隕石閃避';dodgeView.chipFn=()=>[dodge.on?'左右閃避・收集能量':'準備開始','ready'];dodgeView.onLm=(lm,now)=>dodgeFrame(lm,now);
function gamePerson(lm){
  if(!lm||!njVis(lm,11)||!njVis(lm,12))return null;
  const ids=[0,11,12,13,14,15,16,23,24,25,26,27,28].filter(i=>njVis(lm,i));
  if(ids.length<7)return null;
  const xs=ids.map(i=>lm[i][0]),ys=ids.map(i=>lm[i][1]),sw=Math.max(30,dist(lm[11],lm[12]));
  const shY=(lm[11][1]+lm[12][1])/2,hipY=njVis(lm,23)&&njVis(lm,24)?(lm[23][1]+lm[24][1])/2:null;
  const knee=kneeAng(lm),ankles=[27,28].filter(i=>njVis(lm,i)).map(i=>lm[i][1]),ankleY=ankles.length?mean(ankles):null;
  return{cx:(lm[11][0]+lm[12][0])/2,sw,top:Math.min(...ys),bottom:Math.max(...ys),left:Math.min(...xs),right:Math.max(...xs),shY,hipY,knee,ankleY,torso:hipY===null?sw:Math.max(30,hipY-shY),lm};
}
function arcadeBurst(ctx,x,y,color,now,count=12){
  for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=50+Math.random()*210;ctx.beginPath();ctx.arc(x,y,3+Math.random()*6,0,Math.PI*2);ctx.fillStyle=color;ctx.globalAlpha=.95;ctx.fill();ctx.globalAlpha=1}
}
let arenaShakeCombo=0;
function arenaHit(points,combo,tip){
  if(combo>=5&&combo%5===0&&combo!==arenaShakeCombo){arenaShakeCombo=combo;$('#gameArena').classList.add('arena-shake');setTimeout(()=>$('#gameArena').classList.remove('arena-shake'),260);beep(combo%10===0?1568:1180,90)}
  updateGameHud(points,combo,tip);
}
function rhythmBegin(){
  const secs=gameDifficultyValue(),now=performance.now();rhythm.beatMs=60000/Math.max(70,Math.min(190,S.musicBpm||135));
  const musicStarted=S.musicAuto&&!music.on;if(musicStarted)musicStart();
  Object.assign(rhythm,{on:true,phase:'count',diff:gameDifficultyName(),t0:now,last:now,targets:[],fx:[],trail:[[],[]],combo:0,maxCombo:0,miss:0,score:0,hits:0,next:now+rhythm.beatMs*2,nextBeat:now+rhythm.beatMs,laser:null,prev:[],musicStarted});
  rhythm.duration=secs;
}
function gameDifficultyName(){return $$('#gameDifficulty button').find(b=>b.classList.contains('on'))?.dataset.diff||'normal'}
function gameDifficultyValue(){const d=gameDifficultyName();return d==='easy'?45:d==='hard'?75:60}
function rhythmFrame(lm,now){
  const v=rhythmView,ctx=v.canvas.getContext('2d'),W=v.canvas.width,H=v.canvas.height;lm=screenLm(lm,W);const person=gamePerson(lm),u=Math.min(W,H);
  if(!rhythm.on){if(gameActiveKey==='rhythm')updateGameHud(0,0,person?'準備好後，跟著節奏動起來！':'請讓全身保持在畫面內');return}
  if(rhythm.phase==='count'){if(gameCount(rhythm,v,now))return;rhythm.phase='run';rhythm.start=now;rhythm.last=now;rhythm.next=now+400;say('節拍開始！',{cancel:true})}
  const dt=Math.min(.06,Math.max(0,(now-rhythm.last)/1000));rhythm.last=now;rhythm.elapsed=(now-rhythm.start)/1000;
  const left=rhythm.duration-rhythm.elapsed;if(left<=0){rhythmFinish();return}
  if(now>=rhythm.nextBeat){rhythm.nextBeat+=rhythm.beatMs;beep(440,38)}
  if(person&&now>=rhythm.next){
    const type=Math.random()<.62?'punch':'knee',side=Math.random()<.5?0:1,from=Math.random()*4|0,cx=person.cx;
    const edges=[[-.08,.35],[1.08,.35],[.5,-.08],[.5,.78]],edge=edges[from];
    const tx=type==='punch'?(side?person.cx+person.sw*.8:person.cx-person.sw*.8):person.cx+(side?person.sw*.3:-person.sw*.3),ty=type==='punch'?person.shY:person.hipY||person.shY+person.torso;
    const travel=1.05+Math.random()*.35;
    rhythm.targets.push({type,side,x:edge[0]*W,y:edge[1]*H,tx,ty,vx:(tx-edge[0]*W)/travel,vy:(ty-edge[1]*H)/travel,r:u*.085,born:now,life:travel*1000,hit:false});
    rhythm.next=now+rhythm.beatMs*(rhythm.diff==='hard'?1.5:rhythm.diff==='easy'?3:2);
  }
  if(person&&(!rhythm.laser||now>rhythm.laser.until)&&now>rhythm.next-300&&Math.random()<.055)rhythm.laser={y:H*.12,until:now+1800,done:false};
  if(rhythm.laser&&!rhythm.laser.done){
    rhythm.laser.y+=H*.45*dt;
    if(rhythm.laser.y>=H*.67){
      const knees=[25,26].filter(i=>njVis(lm,i)).length;
      const crouch=person&&person.knee!==null&&person.knee<125;
      if(crouch){rhythm.score+=20;rhythm.hits++;rhythm.combo++;rhythm.maxCombo=Math.max(rhythm.maxCombo,rhythm.combo);rhythm.fx.push({x:W*.5,y:H*.56,text:'閃避 +20',t:now,color:'#73f6ff'});beep(1046,90)}
      else{rhythm.miss++;rhythm.combo=0;rhythm.flash=now;beep(160,240)}
      rhythm.laser.done=true;rhythm.laser.until=now+2400;
    }
  }
  const wrists=lm?[15,16].map((id,i)=>njVis(lm,id)?lm[id]:null):[];
  const prev=rhythm.prev||[];
  wrists.forEach((p,i)=>{if(p){const list=rhythm.trail[i];list.push({x:p[0],y:p[1],t:now});while(list.length&&now-list[0].t>300)list.shift()}});
  rhythm.targets=rhythm.targets.filter(t=>{
    t.x+=t.vx*dt;t.y+=t.vy*dt;
    const hit=t.type==='punch'?wrists.some((p,i)=>p&&Math.hypot(p[0]-t.x,p[1]-t.y)<t.r*1.2&&prev[i]&&Math.hypot(p[0]-prev[i][0],p[1]-prev[i][1])>u*.012):
      [25,26].some(i=>njVis(lm,i)&&person&&person.hipY!==null&&lm[i][1]<person.hipY-person.torso*.12&&Math.hypot(lm[i][0]-t.x,lm[i][1]-t.y)<t.r*1.5);
    if(hit){
      const pts=t.type==='punch'?10:15;rhythm.score+=pts+Math.min(30,rhythm.combo*2);rhythm.hits++;rhythm.combo++;rhythm.maxCombo=Math.max(rhythm.maxCombo,rhythm.combo);
      rhythm.fx.push({x:t.x,y:t.y,text:`+${pts}`,t:now,color:t.type==='punch'?'#ffdb63':'#77f6e1'});beep(t.type==='punch'?920:1180,65);arenaHit(rhythm.score,rhythm.combo,t.type==='punch'?'出拳命中！':'膝擊命中！');return false;
    }
    if(now-t.born>t.life){rhythm.miss++;rhythm.combo=0;rhythm.flash=now;return false}
    return true;
  });
  rhythm.prev=wrists.map(p=>p&&[p[0],p[1]]);
  onScreen(ctx,W,()=>{
    ctx.strokeStyle='rgba(255,255,255,.11)';ctx.lineWidth=u*.008;ctx.beginPath();ctx.ellipse(W*.5,H*.5,u*.27,u*.38,0,0,Math.PI*2);ctx.stroke();
    if(person){ctx.strokeStyle='rgba(83,241,218,.45)';ctx.lineWidth=u*.012;ctx.beginPath();ctx.roundRect(person.left-u*.05,person.top-u*.04,person.right-person.left+u*.1,person.bottom-person.top+u*.08,u*.12);ctx.stroke()}
    for(const path of rhythm.trail){for(let i=1;i<path.length;i++){const a=(now-path[i].t)/300;ctx.beginPath();ctx.moveTo(path[i-1].x,path[i-1].y);ctx.lineTo(path[i].x,path[i].y);ctx.lineWidth=u*.012*(1-a);ctx.strokeStyle=`rgba(255,95,160,${1-a})`;ctx.shadowBlur=u*.04;ctx.shadowColor='#ff63bd';ctx.stroke()}ctx.shadowBlur=0}
    for(const t of rhythm.targets){const r=t.r*(.75+.25*Math.sin(now/90));ctx.beginPath();ctx.arc(t.x,t.y,r,0,Math.PI*2);ctx.fillStyle=t.type==='punch'?'rgba(255,87,145,.28)':'rgba(64,228,255,.3)';ctx.fill();ctx.lineWidth=u*.012;ctx.strokeStyle=t.type==='punch'?'#ff6dba':'#64f0ff';ctx.shadowBlur=u*.05;ctx.shadowColor=ctx.strokeStyle;ctx.stroke();ctx.shadowBlur=0;ctx.font=`${u*.09}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t.type==='punch'?'✊':'🦵',t.x,t.y)}
    if(rhythm.laser&&!rhythm.laser.done){ctx.fillStyle=`rgba(255,54,86,${.35+.18*Math.sin(now/65)})`;ctx.fillRect(0,rhythm.laser.y,W,u*.04);ctx.fillStyle='#fff';ctx.fillRect(0,rhythm.laser.y+u*.012,W,u*.009);ctx.font=`900 ${u*.045}px sans-serif`;ctx.textAlign='center';ctx.fillText('雷射逼近・蹲下閃避',W*.5,rhythm.laser.y-u*.025)}
    rhythm.fx=rhythm.fx.filter(f=>now-f.t<650);for(const f of rhythm.fx){const a=(now-f.t)/650;ctx.globalAlpha=1-a;ctx.font=`900 ${u*.06}px sans-serif`;ctx.textAlign='center';ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y-a*u*.09);ctx.globalAlpha=1}
  });
  if(rhythm.flash&&now-rhythm.flash<240){ctx.fillStyle=`rgba(255,35,65,${.3*(1-(now-rhythm.flash)/240)})`;ctx.fillRect(0,0,W,H)}
  v.n.textContent=rhythm.score;updateGameHud(rhythm.score,rhythm.combo,person?'揮拳擊光球、抬膝撞擊，雷射來時深蹲！':'請站入框線，讓頭到膝蓋清楚入鏡',left);
}
function rhythmFinish(){
  if(!rhythm.on)return;rhythm.on=false;rhythm.phase='idle';const secs=Math.min(rhythm.duration,Math.round(rhythm.elapsed)),kc=secs*kcalPerSec(7),xp=Math.round(rhythm.score/7)+Math.floor(rhythm.maxCombo/3);
  if(rhythm.musicStarted){musicStop();rhythm.musicStarted=false}
  const {best,isBest}=gameRecord('rhythm',rhythm.score,{c:rhythm.maxCombo,h:rhythm.hits});
  S.xp+=xp;addKcal(kc);addWorkTime(secs);save();renderStats();
  arenaFinish('rhythm',rhythm.score,rhythm.maxCombo,xp,kc,`${isBest?'締造新紀錄！':''}命中 ${rhythm.hits} 次，最高連擊 ${rhythm.maxCombo}。最高紀錄 ${best} 分。`);
}
function dodgeBegin(){
  Object.assign(dodge,{on:true,phase:'count',diff:gameDifficultyName(),t0:performance.now(),last:performance.now(),objects:[],fx:[],score:0,combo:0,maxCombo:0,hits:0,miss:0,lives:3,next:performance.now()+1400,flash:0,baseX:null,prev:null});
  dodge.duration=gameDifficultyValue();
}
function dodgeFrame(lm,now){
  const v=dodgeView,ctx=v.canvas.getContext('2d'),W=v.canvas.width,H=v.canvas.height,u=Math.min(W,H);lm=screenLm(lm,W);const person=gamePerson(lm);
  if(!dodge.on){if(gameActiveKey==='dodge')updateGameHud(0,0,person?'全身保持在框線內，準備閃避！':'請讓頭、手腕、膝蓋與腳踝都入鏡');return}
  if(dodge.phase==='count'){if(gameCount(dodge,v,now))return;dodge.phase='run';dodge.start=now;dodge.last=now;dodge.next=now+500;say('閃避開始！',{cancel:true})}
  const dt=Math.min(.06,Math.max(0,(now-dodge.last)/1000));dodge.last=now;dodge.elapsed=(now-dodge.start)/1000;const left=dodge.duration-dodge.elapsed;
  if(left<=0||dodge.lives<=0){dodgeFinish();return}
  const elapsed=dodge.elapsed,speed=H*(.34+Math.min(.25,elapsed*.004));
  if(now>=dodge.next){
    const gem=Math.random()<.52,hazard=gem?'gem':Math.random()<.28?'beam':'meteor',lane=Math.random()*3|0;
    dodge.objects.push({type:hazard,lane,x:(lane+.5)/3*W,y:gem?H*(.82+Math.random()*.08):-u*.1,r:u*(gem?.045:.09),born:now,vy:speed*(gem?.72:1),warn:!gem,kind:hazard==='beam'?'beam':!gem&&Math.random()<.45?'low':'normal'});
    dodge.next=now+(dodge.diff==='hard'?650:dodge.diff==='easy'?1150:850)*(0.8+Math.random()*.35);
  }
  const jump=person&&person.ankleY!==null&&person.hipY!==null&&person.hipY-person.ankleY>person.torso*1.15;
  const crouch=person&&person.knee!==null&&person.knee<125;
  const gemsHit=[];
  dodge.objects=dodge.objects.filter(o=>{
    o.y+=o.vy*dt;
    if(o.type==='gem'&&person){
      const touching=[15,16,27,28].some(i=>njVis(lm,i)&&Math.hypot(lm[i][0]-o.x,lm[i][1]-o.y)<o.r+u*.035);
      if(touching){dodge.score+=25+Math.min(25,dodge.combo*2);dodge.combo++;dodge.maxCombo=Math.max(dodge.maxCombo,dodge.combo);dodge.hits++;dodge.fx.push({x:o.x,y:o.y,text:'+25',t:now});beep(1480,60);arenaHit(dodge.score,dodge.combo,'能量晶石收集成功！');return false}
    }
    if(person&&(o.type==='meteor'||o.type==='beam')&&o.y>H*.62&&o.y<H*.83&&!o.done){
      const laneX=(o.lane+.5)/3,px=person?person.cx/W:.5,side=Math.abs(px-laneX)>.19,avoid=o.kind==='beam'?side||crouch:o.kind==='low'?crouch||side:side||jump;
      if(!avoid){o.done=true;dodge.lives--;dodge.combo=0;dodge.flash=now;beep(130,260)}else if(!o.passed){o.passed=true;dodge.score+=15;dodge.combo++;dodge.maxCombo=Math.max(dodge.maxCombo,dodge.combo);dodge.fx.push({x:o.x,y:o.y,text:'閃避 +15',t:now});beep(900,60)}
    }
    if(o.y>H+o.r){if(o.type==='gem'){dodge.combo=0;dodge.miss++}return false}return true;
  });
  onScreen(ctx,W,()=>{
    const colors=['#ff7e8b','#68e6ff','#f6c66a'];
    for(let i=0;i<3;i++){const x=W*i/3;ctx.fillStyle=`rgba(8,18,37,${.44+i*.025})`;ctx.fillRect(x,0,W/3,H);ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=2;ctx.setLineDash([u*.08,u*.08]);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=colors[i];ctx.globalAlpha=.65;ctx.font=`${u*.035}px sans-serif`;ctx.textAlign='center';ctx.fillText(['左道','中道','右道'][i],x+W/6,H*.93);ctx.globalAlpha=1}
    const beam=dodge.objects.find(o=>(o.type==='meteor'||o.type==='beam')&&o.y<H*.25);if(beam){ctx.fillStyle=`rgba(255,50,70,${.16+.18*Math.sin(now/90)})`;ctx.fillRect(beam.lane*W/3,0,W/3,H*.82);ctx.strokeStyle='#ff4b61';ctx.lineWidth=u*.012;ctx.strokeRect(beam.lane*W/3,0,W/3,H*.82)}
    for(const o of dodge.objects){ctx.textAlign='center';ctx.textBaseline='middle';if(o.type==='gem'){ctx.save();ctx.translate(o.x,o.y);ctx.rotate(now/400);ctx.fillStyle='#70f4ff';ctx.shadowBlur=u*.06;ctx.shadowColor='#55dfff';ctx.beginPath();ctx.moveTo(0,-o.r);ctx.lineTo(o.r*.7,0);ctx.lineTo(0,o.r);ctx.lineTo(-o.r*.7,0);ctx.closePath();ctx.fill();ctx.restore()}else if(o.type==='beam'){const laneX=o.lane*W/3;ctx.fillStyle=`rgba(255,46,92,${.55+.25*Math.sin(now/55)})`;ctx.fillRect(laneX,o.y-u*.025,W/3,u*.05);ctx.fillStyle='#fff';ctx.fillRect(laneX,o.y-u*.005,W/3,u*.01);ctx.font=`900 ${u*.035}px sans-serif`;ctx.fillText('雷射預警・側閃或蹲低',laneX+W/6,o.y-u*.07)}else{ctx.font=`${u*.12}px sans-serif`;ctx.fillText(o.kind==='low'?'☄️':'🪨',o.x,o.y);ctx.font=`900 ${u*.035}px sans-serif`;ctx.fillStyle='#fff';ctx.fillText(o.kind==='low'?'蹲低或側閃':'左右移動／跳躍',o.x,o.y-o.r*1.35)}}
    if(person){ctx.strokeStyle='rgba(102,240,255,.6)';ctx.lineWidth=u*.008;ctx.strokeRect(person.left,person.top,person.right-person.left,person.bottom-person.top);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(person.cx,person.top,u*.025,0,Math.PI*2);ctx.fill()}
    dodge.fx=dodge.fx.filter(f=>now-f.t<620);for(const f of dodge.fx){const a=(now-f.t)/620;ctx.globalAlpha=1-a;ctx.font=`900 ${u*.055}px sans-serif`;ctx.fillStyle='#7af7ff';ctx.fillText(f.text,f.x,f.y-a*u*.08);ctx.globalAlpha=1}
    ctx.font=`${u*.045}px sans-serif`;ctx.textAlign='left';ctx.fillStyle='#ff7f8a';ctx.fillText('❤'.repeat(dodge.lives)+'♡'.repeat(3-dodge.lives),u*.05,u*.08);
  });
  if(dodge.flash&&now-dodge.flash<280){ctx.fillStyle=`rgba(255,32,52,${.36*(1-(now-dodge.flash)/280)})`;ctx.fillRect(0,0,W,H)}
  v.n.textContent=dodge.score;updateGameHud(dodge.score,dodge.combo,person?(crouch?'蹲低閃避！':jump?'跳起來！':'左右移動閃開隕石，手腳收集能量！'):'站入框線，讓全身骨架清楚入鏡',left);
}
function dodgeFinish(){
  if(!dodge.on)return;dodge.on=false;dodge.phase='idle';const secs=Math.min(dodge.duration,Math.round(dodge.elapsed)),kc=secs*kcalPerSec(7),xp=Math.round(dodge.score/7)+dodge.maxCombo;
  const {best,isBest}=gameRecord('dodge',dodge.score,{c:dodge.maxCombo,h:dodge.hits,m:dodge.miss});
  S.xp+=xp;addKcal(kc);addWorkTime(secs);save();renderStats();
  arenaFinish('dodge',dodge.score,dodge.maxCombo,xp,kc,`${isBest?'締造新紀錄！':''}收集 ${dodge.hits} 顆能量，錯失 ${dodge.miss} 顆能量。最高紀錄 ${best} 分。`);
}
const previousGameCamStop=cam.onStop;
cam.onStop=()=>{previousGameCamStop&&previousGameCamStop();if(gameLeaving)return;
  if(nj.on)njFinish(false);if(rn.on)rnFinish(false);if(ps.on)psFinish(false);
  $('#njCamBtn').disabled=$('#rnCamBtn').disabled=$('#psCamBtn').disabled=false;$('#njCamOff').disabled=$('#rnCamOff').disabled=$('#psCamOff').disabled=true;
  if(!gameActiveKey)return;if(gameActiveKey==='rhythm'&&rhythm.on)rhythmFinish();if(gameActiveKey==='dodge'&&dodge.on)dodgeFinish()};
function finishArcadeLegacy(key,score,combo,xp,kcal,message){arenaFinish(key,score,combo,xp,kcal,message)}
$('#gameArena').addEventListener('click',e=>{if(e.target===$('#gameArenaCountdown'))return});
refreshGameLobby();

