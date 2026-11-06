/* ============================================================
   15-撐住挑戰
   內容：平板支撐、側棒式的撐住挑戰
   畫面：「挑戰與遊戲」分頁的撐住挑戰
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 撐住挑戰（平板支撐、側棒式） ================= */
const HOLDTIP={"側棒式":'從正面或背面拍，讓身體橫向入鏡，肩膀、髖部、腳踝都要看得到。側躺，前臂撐地，髖部抬起讓身體成一直線。',"平板支撐":'從側面拍，讓肩膀、髖部、腳踝都入鏡。身體成一直線，臀部不要塌下去也不要翹太高。前臂或手掌撐地都可以。'};
const hold={on:false,phase:'idle',t0:0,last:0,good:0,total:0,lastTen:0,badSince:0,lastR:0,sayAt:0,ex:'平板支撐',target:30,chip:['鏡頭已就緒，按「開始」','ready']};
function holdCheck(ex,lm){
  if(ex==='平板支撐'||ex==='側棒式'){
    const sideP=ex==='側棒式';let best=null;
    for(const sd of ['l','r']){const a=P(lm,sd+'_sh'),h=P(lm,sd+'_hip'),k=P(lm,sd+'_an');if(a&&h&&k){const sc=lm[IDX[sd+'_sh']][2]+lm[IDX[sd+'_hip']][2]+lm[IDX[sd+'_an']][2];if(!best||sc>best.sc)best={sh:a,hip:h,an:k,sc}}}
    if(!best)return {ok:false,msg:'請從側面拍，讓肩膀、髖部、腳踝都入鏡'};
    const dx=best.an[0]-best.sh[0],dy=best.an[1]-best.sh[1],L=Math.hypot(dx,dy);
    if(L<1||Math.abs(dy)/L>.45||Math.abs(dx)<1)return {ok:false,msg:'請從側面拍，身體要和鏡頭平行（趴著撐住）'};
    const lineY=best.sh[1]+dy*(best.hip[0]-best.sh[0])/dx,dev=(best.hip[1]-lineY)/L;
    if(dev>.07)return {ok:false,msg:sideP?'髖部太低，把身體撐成一直線':'臀部太低，收緊核心，把腰頂起來'};
    if(dev<-.07)return {ok:false,msg:sideP?'髖部太高，往下放一點，讓身體成一直線':'臀部太高，往下壓一點，讓身體成一直線'};
    return {ok:true};
  }
  const a=mean(angles(lm,'hip','kn','an'));
  if(a===null)return {ok:false,msg:'請從側面拍，讓髖部、膝蓋、腳踝都入鏡'};
  if(a>115)return {ok:false,msg:'再往下坐一點，大腿接近水平'};
  if(a<70)return {ok:false,msg:'太低了，起來一點，膝蓋約 90 度'};
  return {ok:true};
}
const holdView=makeView($('[data-stage=hold]'),()=>null,{label:()=>hold.on?'停止':'開始',click:()=>$('#hStart').click()});
holdView.manualHint=true;holdView.unit='秒';$('.u',holdView.stage).textContent='秒';
holdView.chipFn=()=>hold.chip;
holdView.gaugeFn=()=>hold.on&&hold.phase==='run'?Math.min(100,hold.good/hold.target*100)+'%':'0';
holdView.onLm=(lm,now)=>holdFrame(lm,now);
function holdFrame(lm,now){
  const v=holdView;
  if(!hold.on){hold.chip=['鏡頭已就緒，按「開始」','ready'];return}
  if(hold.phase==='count'){
    const r=Math.ceil(3-(now-hold.t0)/1000);
    if(r>0){v.n.textContent=r;hold.chip=['準備姿勢…','low'];if(r!==hold.lastR){hold.lastR=r;say(r,{cancel:true})}return}
    hold.phase='run';hold.last=now;hold.good=0;hold.total=0;hold.lastTen=0;hold.badSince=0;say('開始',{cancel:true});
  }
  const res=lm?holdCheck(hold.ex,lm):{ok:false,msg:'沒偵測到人，請站進鏡頭'};
  const dt=Math.min(.25,Math.max(0,(now-hold.last)/1000));hold.last=now;hold.total+=dt;
  if(res.ok){hold.good+=dt;hold.badSince=0;hold.chip=['撐住中，計時中','ready'];v.hintEl.hidden=true}
  else{
    if(!hold.badSince)hold.badSince=now;hold.chip=['姿勢跑掉，暫停計時','warn'];
    if(now-hold.badSince>400){v.hintEl.hidden=false;v.hintEl.textContent=res.msg;if(now-hold.sayAt>6000){hold.sayAt=now;say(res.msg)}}
  }
  v.n.textContent=Math.floor(hold.good);
  const ten=Math.floor(hold.good/10);if(ten>hold.lastTen){hold.lastTen=ten;say(`${ten*10} 秒`)}
  if(hold.good>=hold.target)holdFinish(true);
}
function holdFinish(reached){
  if(!hold.on)return;
  hold.on=false;hold.phase='idle';holdView.hintEl.hidden=true;
  const secs=Math.floor(hold.good),ex=hold.ex,isBest=secs>(S.holdBest[ex]||0),pct=Math.round(hold.good/Math.max(hold.total,1)*100),xp=Math.floor(secs/2);
  if(secs>0){
    if(isBest)S.holdBest[ex]=secs;S.holdSecs=(S.holdSecs||0)+secs;S.xp+=xp;addKcal(secs*kcalPerSec(4));addWorkTime(secs);
    S.holdLog.unshift({ex,t:hold.target,n:secs,ok:pct});S.holdLog=S.holdLog.slice(0,15);
  }
  save();renderStats();renderHold();beep(1320,400);
  $('#hResult').hidden=false;
  $('#hResult').textContent=`${reached?'達標！':'結束。'}${ex}撐了 ${secs} 秒（目標 ${hold.target} 秒），姿勢正確的時間佔 ${pct}%，獲得 ${xp} 經驗值${isBest&&secs>0?'，新的個人紀錄！':''}`;
  $('#hStart').textContent='開始（3 秒後計時）';
  if(fullStage===holdView.stage)exitFull();
  finishArcadeLegacy('hold',secs,0,xp,secs*kcalPerSec(4),`${reached?'成功守住目標！':'完成撐住挑戰。'} ${ex} ${secs} 秒`);
}
function renderHold(){
  const ex=$('#hEx').value;hold.ex=ex;holdView.nm.textContent=ex;
  $('#hBest').textContent=S.holdBest[ex]||'—';$('#hTip').textContent=HOLDTIP[ex];
  $('#hLog').innerHTML=S.holdLog.length?'<tr><th>項目</th><th>目標</th><th>撐住</th><th>姿勢正確</th></tr>'+S.holdLog.slice(0,6).map(l=>`<tr><td>${esc(l.ex)}</td><td>${l.t} 秒</td><td>${l.n} 秒</td><td>${l.ok}%</td></tr>`).join(''):'<tr><td class="mute">還沒有成績。</td></tr>';
}
$('#hEx').onchange=()=>{if(hold.on)holdFinish(false);renderHold()};
seg($('#hTarget'),b=>{hold.target=+b.dataset.v});
$('#hCamBtn').onclick=async()=>{$('#hCamBtn').disabled=true;const ok=await camStart(holdView);if(ok)$('#hCamOff').disabled=false;else $('#hCamBtn').disabled=false};
$('#hCamOff').onclick=()=>camStop();
$('#hStart').onclick=()=>{
  if(hold.on){holdFinish(false);return}
  const w=$('#hWarn');w.hidden=true;
  if(!(cam.running&&cam.view===holdView)){w.hidden=false;w.textContent='請先按「開啟鏡頭」，看到畫面和骨架後再開始。';return}
  audioInit();hold.ex=$('#hEx').value;hold.on=true;hold.phase='count';hold.t0=performance.now();hold.lastR=0;hold.sayAt=0;
  $('#hResult').hidden=true;$('#hStart').textContent='停止';
};

