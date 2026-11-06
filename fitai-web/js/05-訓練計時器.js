/* ============================================================
   05-訓練計時器
   內容：訓練計時器：模式（Tabata 等）、參數、倒數、搭配鏡頭計數
   畫面：「訓練計時器」分頁
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 計時器 ================= */
let ac=null;
function audioInit(){try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();ac.resume&&ac.resume()}catch(e){}}
function beep(freq=880,ms=150){if(!ac)return;try{const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=freq;g.gain.value=.25;o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+ms/1000)}catch(e){}}
const sleepUntil=t=>new Promise(r=>setTimeout(r,Math.max(0,t-performance.now())));
async function waitGameUntil(deadline,clock,ctl){
  while(!ctl.aborted){
    const now=performance.now();
    if(gamePaused){if(!clock.pausedAt)clock.pausedAt=now;await sleepUntil(now+60);continue}
    if(clock.pausedAt){clock.shift+=now-clock.pausedAt;clock.pausedAt=0}
    const remain=deadline+clock.shift-now;if(remain<=0)return;
    await sleepUntil(now+Math.min(remain,100));
  }
}
function cardHTML(o){
  return `<div class="tlabel">${o.label}</div><div class="tbig">${o.big}</div><div class="thint">${o.hint||'&nbsp;'}</div>
  <div class="tbar"><i style="width:${o.pct}%"></i></div><div class="tmeta"><span>下一個：${o.next}</span><span>總剩餘 ${mmss(o.remain)}</span></div>`;
}
/* 依序執行階段 [{label,secs,kind}]；每個階段最後 10 秒放大倒數並嗶聲。回傳 true＝完整跑完、false＝被中斷 */
async function runPhases(phases,card,opt={}){
  const total=phases.reduce((a,p)=>a+p.secs,0);let done=0,workElapsed=0;
  let wake=null;try{wake=await navigator.wakeLock?.request('screen')}catch(e){}
  const musicHere=S.musicAuto&&!music.on;if(musicHere)musicStart();
  try{
    for(let i=0;i<phases.length;i++){
      const ph=phases[i],next=phases[i+1]?phases[i+1].label:'完成',start=performance.now(),clock={pausedAt:0,shift:0};
      opt.onPhase&&opt.onPhase(ph);
      musicDuck(ph.kind!=='work');
      for(let r=ph.secs;r>0;r--){
        if(opt.ctl.aborted){
          if(ph.kind==='work')workElapsed+=Math.min(ph.secs,Math.floor((performance.now()-start)/1000));
          if(workElapsed){addWorkTime(workElapsed);save();renderStats()}
          return false;
        }
        const danger=r<=10&&ph.secs>10;
        let hint=danger?(ph.kind==='work'?'最後 10 秒，衝刺！':'準備好，下一組快開始了'):'';
        if(opt.live&&ph.kind==='work')hint=`已偵測 ${opt.live()} 下`+(danger?'，最後 10 秒！':'');
        if(opt.mini){const m=opt.mini;m.tmini.hidden=false;m.tmini.className='tmini '+(danger?'danger':ph.kind);m.tl.textContent=ph.label;m.tn.textContent=r;m.miniState={label:ph.label,r,kind:danger?'danger':ph.kind}}
        card.className='tcard '+(danger?'danger':ph.kind);
        card.innerHTML=cardHTML({label:ph.label,big:r,hint,pct:(ph.secs-r)/ph.secs*100,next,remain:total-(done+ph.secs-r)});
        if(opt.sound&&((r<=10&&ph.secs>10)||r<=3))beep(r===1?1320:880,r===1?450:150);
        await waitGameUntil(start+(ph.secs-r+1)*1000,clock,opt.ctl);
      }
      opt.onPhaseEnd&&opt.onPhaseEnd(ph);
      if(ph.kind==='work')workElapsed+=ph.secs;
      done+=ph.secs;
    }
    card.className='tcard done';
    card.innerHTML=`<div class="tlabel">完成</div><div class="tbig">✓</div><div class="thint">做得好，記得補水和伸展。</div>`;
    if(opt.sound)beep(1320,500);
    addWorkTime(workElapsed);save();renderStats();
    return true;
  }finally{if(musicHere)musicStop();musicDuck(false);wake&&wake.release&&wake.release().catch(()=>{});if(opt.mini){opt.mini.tmini.hidden=true;opt.mini.miniState=null}}
}

const ph=(label,secs,kind,ex)=>({label,secs,kind,ex});
const seq=(arr,gap)=>{const a=[];arr.forEach(([n,sec],i)=>{a.push(ph(n,sec,'work'));if(i<arr.length-1)a.push(ph('換下一個',gap,'rest'))});return a};
const MODES={
 hiit:{name:'高強度間歇',desc:'固定訓練時間與休息時間，重複完成多組。',
  params:[['work','訓練（秒）',10,120,5,30],['rest','休息（秒）',5,60,5,15],['rounds','組數',2,20,1,6]],
  build:p=>{const a=[];for(let n=1;n<=p.rounds;n++){a.push(ph(`第 ${n}/${p.rounds} 組`,p.work,'work'));if(n<p.rounds)a.push(ph('休息',p.rest,'rest'))}return a}},
 tabata:{name:'短間歇訓練',desc:'訓練 20 秒、休息 10 秒，標準為 8 組，約 4 分鐘。',
  params:[['rounds','組數',4,12,1,8]],
  build:p=>{const a=[];for(let n=1;n<=p.rounds;n++){a.push(ph(`第 ${n}/${p.rounds} 組，全力衝刺`,20,'work'));if(n<p.rounds)a.push(ph('休息',10,'rest'))}return a}},
 emom:{name:'每分鐘訓練',desc:'每分鐘開始時完成指定動作，剩餘時間用來休息。',
  params:[['work','每分鐘訓練（秒）',15,50,5,40],['mins','總分鐘數',3,20,1,8]],
  build:p=>{const a=[];for(let n=1;n<=p.mins;n++){a.push(ph(`第 ${n}/${p.mins} 分鐘`,p.work,'work'));a.push(ph('剩餘時間休息',60-p.work,'rest'))}return a}},
 circuit:{name:'循環訓練',desc:'選幾個動作依序做完一輪，休息後進入下一輪。',picks:true,
  params:[['work','每個動作（秒）',15,90,5,40],['rest','動作間休息（秒）',5,60,5,15],['rounds','輪數',1,6,1,3],['rr','輪間休息（秒）',10,120,5,45]],
  build:(p,picks)=>{const a=[];if(!picks.length)return a;for(let r=1;r<=p.rounds;r++){picks.forEach((n,j)=>{a.push(ph(`第 ${r} 輪：${n}`,p.work,'work',n));if(j<picks.length-1)a.push(ph('休息',p.rest,'rest'))});if(r<p.rounds)a.push(ph('輪間休息',p.rr,'rest'))}return a}},
 warmup:{name:'暖身',desc:'約 5 分鐘全身暖身，運動前先做。',params:[],nocam:true,
  build:()=>seq([['原地踏步',40],['手臂繞環',30],['開合跳',30],['徒手深蹲',30],['弓步轉體',30],['高抬腿',30],['手腕與腳踝繞環',30]],5)},
 cooldown:{name:'收操伸展',desc:'約 5 分鐘放鬆伸展，運動後做。每個部位 30 秒。',params:[],nocam:true,
  build:()=>seq([['小腿伸展',30],['大腿前側伸展',30],['大腿後側伸展',30],['臀部伸展',30],['胸口伸展',30],['肩膀伸展',30],['深呼吸放鬆',30]],5)},
 pyramid:{name:'金字塔',desc:'訓練時間逐步增加再逐步減少，例如 20、30、40、30、20 秒。',
  params:[['base','起始訓練（秒）',10,40,5,20],['step','每階增加（秒）',5,20,5,10],['peak','往上幾階',1,4,1,2],['rest','休息（秒）',5,60,5,20]],
  build:p=>{const seq=[];for(let k=0;k<=p.peak;k++)seq.push(p.base+p.step*k);for(let k=p.peak-1;k>=0;k--)seq.push(p.base+p.step*k);
    const a=[];seq.forEach((w,i)=>{a.push(ph(`第 ${i+1}/${seq.length} 階，${w} 秒`,w,'work'));if(i<seq.length-1)a.push(ph('休息',p.rest,'rest'))});return a}},
};
let tMode='hiit';const tCtl={aborted:false};let tRunning=false;
$('#tModes').innerHTML=Object.entries(MODES).map(([k,m])=>`<button data-k="${k}" class="${k===tMode?'on':''}">${m.name}</button>`).join('');
$('#tPickList').innerHTML=ORDER.map(n=>`<label><input type="checkbox" value="${n}" ${['開合跳','深蹲','伏地挺身','高抬腿'].includes(n)?'checked':''}> ${n}</label>`).join('');
function tParams(){const p={};$$('#tParams input').forEach(i=>p[i.dataset.k]=+i.value);return p}
function tBuild(){
  const m=MODES[tMode],picks=$$('#tPickList input:checked').map(i=>i.value);
  const phases=[ph('準備開始',+$('#tPrep').value,'prepare'),...m.build(tParams(),picks)];
  const has=phases.some(p=>p.kind==='work');
  $('#tTotal').textContent=mmss(phases.reduce((a,p)=>a+p.secs,0));$('#tCount').textContent=phases.length-1;
  $('#tStart').disabled=tRunning||!has;return phases;
}
function tRender(){
  const m=MODES[tMode];$('#tDesc').textContent=m.desc;$('#tPicks').hidden=!m.picks;$('#timerModeName').textContent=m.name;
  $('#tParams').innerHTML=m.params.map(([k,l,mn,mx,st,v])=>`<div class="slider"><label class="f" style="margin:0">${l}</label><output>${v}</output><input type="range" data-k="${k}" min="${mn}" max="${mx}" step="${st}" value="${v}"></div>`).join('');
  $$('#tParams input').forEach(i=>i.oninput=()=>{i.previousElementSibling.textContent=i.value;tBuild()});tBuild();
}
seg($('#tModes'),b=>{tMode=b.dataset.k;tRender();tCamUi()});
$('#tPrep').oninput=e=>{$('#tPrepO').textContent=e.target.value;tBuild()};
$('#tPickList').onchange=tBuild;
/* ----- 計時器的鏡頭計數 ----- */
const formTxt=c=>c.cueTotal?`${c.cueTotal-c.cueBad}/${c.cueTotal}`:'—';
let timerCounter=null;
$('#tEx').innerHTML=optsByCat(Object.keys(EX),n=>n);
const timerStageHost=$('#timerCameraSetupHost');
const timerView=makeView(timerStageHost,()=>timerCounter,{label:()=>tRunning?'停止':'開始訓練',click:()=>tRunning?$('#tStop').click():$('#tStart').click()});
const tCurEx=()=>{if(tMode==='circuit'){const f=$$('#tPickList input:checked').map(i=>i.value).find(n=>EX[n]);return f||'深蹲'}return $('#tEx').value};
function tPreviewCounter(){const k=tCurEx();timerCounter=new RepCounter(k);timerCounter.relax=.06;timerView.nm.textContent=k;timerView.n.textContent='0'}
function tCamUi(){const nc=!!MODES[tMode].nocam;$('#tCamCard').hidden=nc;if(nc&&$('#tCamOn').checked){$('#tCamOn').checked=false;if((cam.running||cam.starting)&&cam.view===timerView)camStop()}$('#tCamBox').hidden=!$('#tCamOn').checked;$('#tExWrap').hidden=tMode==='circuit';$('#tExNote').hidden=tMode!=='circuit'}
$('#tCamOn').onchange=()=>{tCamUi();if(!$('#tCamOn').checked&&(cam.running||cam.starting)&&cam.view===timerView)camStop()};
$('#tEx').onchange=()=>{if(cam.running&&cam.view===timerView&&!tRunning)tPreviewCounter()};
$('#tCamBtn').onclick=async()=>{
  $('#tCamBtn').disabled=true;tPreviewCounter();
  const ok=await camStart(timerView);
  if(ok)$('#tCamOff').disabled=false;else $('#tCamBtn').disabled=false;
};
$('#tCamOff').onclick=()=>camStop();
function showTimerResult(sets){
  const box=$('#tResult');if(!sets.length){box.hidden=true;return}
  const total=sets.reduce((a,x)=>a+x.n,0);
  const movementTotals=new Map();
  sets.forEach(set=>movementTotals.set(set.ex,(movementTotals.get(set.ex)||0)+set.n));
  box.hidden=false;
  box.innerHTML=`<h4>這次訓練的次數</h4><table><tr><th>階段</th><th>動作</th><th>次數</th><th>姿勢達標</th></tr>${sets.map(x=>`<tr><td>${esc(x.label)}</td><td>${esc(x.ex)}</td><td>${x.n}</td><td>${x.f||'—'}</td></tr>`).join('')}</table><p>每個動作的次數已分別加入統計紀錄。</p>`;
  if(total>0){
    movementTotals.forEach((n,ex)=>{S.history.unshift({ex,n,t:Date.now()});notePR(ex,n);addReps(n,ex,n)});
    S.history=S.history.slice(0,30);save();renderStats();renderHist();
  }
}
$('#tStart').onclick=async()=>{
  const useCam=$('#tCamOn').checked&&!MODES[tMode].nocam,warn=$('#tWarn');warn.hidden=true;
  if(useCam&&!(cam.running&&cam.view===timerView)){warn.hidden=false;warn.textContent='請先開啟鏡頭，再開始訓練。';return}
  $('#timerModeName').textContent=MODES[tMode].name;
  if(useCam){$('#timerSessionCamera').appendChild(timerView.stage);$('#timerSession').classList.add('has-camera')}
  transitionStep($('#timerSetup'),$('#timerSession'));
  audioInit();tRunning=true;tCtl.aborted=false;$('#tStart').disabled=true;$('#tStop').disabled=false;$('#tResult').hidden=true;
  const sets=[];let cur=null;
  const ok=await runPhases(tBuild(),$('#tCard'),{ctl:tCtl,sound:$('#tSound').checked,
    onPhase:p=>{cur=p;if(!useCam)return;
      if(p.kind==='work'){const k=p.ex&&EX[p.ex]?p.ex:tCurEx();timerCounter=new RepCounter(k);timerCounter.relax=.06;timerView.nm.textContent=k;timerView.n.textContent='0'}
      else timerCounter=null},
    onPhaseEnd:p=>{if(useCam&&p.kind==='work'&&timerCounter)sets.push({label:p.label,ex:timerCounter.key,n:timerCounter.count,f:formTxt(timerCounter)})},
    live:useCam?()=>timerCounter?timerCounter.count:0:null,mini:useCam?timerView:null});
  tRunning=false;$('#tStop').disabled=true;tBuild();$('#tStart').textContent='再來一組';
  if(fullStage===timerView.stage)exitFull();   // 結束後離開全螢幕，才看得到結果表
  if(ok)waterNudge('訓練完成，喝點水補充一下吧。');
  if(useCam){
    if(!ok&&cur&&cur.kind==='work'&&timerCounter)sets.push({label:cur.label+'（中斷）',ex:timerCounter.key,n:timerCounter.count,f:formTxt(timerCounter)});
    showTimerResult(sets);
    if(cam.running&&cam.view===timerView)tPreviewCounter();else timerCounter=null;
  }
  if(!ok){$('#tCard').className='tcard idle';$('#tCard').innerHTML='<div class="tlabel">已停止。可以重新開始。</div>'}
};
$('#tStop').onclick=()=>{tCtl.aborted=true};
tRender();
$('#timerBegin').onclick=()=>$('#tStart').click();
$('#timerBack').onclick=()=>{
  if(tRunning)tCtl.aborted=true;
  if(cam.running||cam.starting)camStop();
  if(timerView.stage.parentElement!==timerStageHost)timerStageHost.appendChild(timerView.stage);
  $('#timerSession').classList.remove('has-camera');
  transitionStep($('#timerSession'),$('#timerSetup'));
};

