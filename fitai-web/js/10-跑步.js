/* ============================================================
   10-跑步
   內容：跑步：GPS／跑步機、時間、距離、配速、熱量
   畫面：「跑步」分頁
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 🏃 跑步：GPS 或跑步機，記時間、距離、配速、熱量 ================= */
// 跑步／走路的 MET（Compendium of Physical Activities）：[時速 km/h, MET]，中間用線性內插
const RUN_MET=[[0,2],[3.2,2.8],[4.8,3.5],[5.6,4.3],[6.4,5],[8,8.3],[9.7,9.8],[10.8,10.5],[11.3,11],[12.1,11.5],[12.9,11.8],[13.8,12.3],[14.5,12.8],[16.1,14.5],[17.7,16],[19.3,19],[20.9,19.8],[22.5,23]];
function runMet(kmh){const T=RUN_MET;if(!(kmh>0))return T[0][1];for(let i=1;i<T.length;i++)if(kmh<=T[i][0]){const [a,ma]=T[i-1],[b,mb]=T[i];return ma+(mb-ma)*(kmh-a)/(b-a)}return T[T.length-1][1]}
const runKcal=(m,secs)=>secs>0?kcalPerSec(runMet(m/secs*3.6))*secs:0;   // 用平均速度決定 MET，再乘上自己的基礎代謝
function runKmTotal(){return (S.runs||[]).reduce((a,r)=>a+(r.m||0),0)/1000}
const hms=s=>{s=Math.max(0,Math.round(s));const h=Math.floor(s/3600);return h?h+':'+String(Math.floor(s%3600/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'):mmss(s)};
const paceSec=(m,secs)=>m>=10&&secs>0?Math.round(secs/(m/1000)):0;   // 每公里幾秒
const paceTxt=(m,secs)=>{const p=paceSec(m,secs);return p&&p<6000?Math.floor(p/60)+"'"+String(p%60).padStart(2,'0')+'"':'—'};
const sayTime=s=>{s=Math.round(s);const h=Math.floor(s/3600),mi=Math.floor(s%3600/60),se=s%60;return (h?h+' 小時 ':'')+(mi?mi+' 分 ':'')+(se||!(h||mi)?se+' 秒':'')};
function hav(a,b){const r=Math.PI/180,dl=(b.lat-a.lat)*r,dn=(b.lon-a.lon)*r,x=Math.sin(dl/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)**2;return 2*6371000*Math.asin(Math.min(1,Math.sqrt(x)))}
const rk={on:false,paused:false,mode:'gps',acc:0,t0:0,lastTick:0,snapAt:0,startAt:0,m:0,last:null,bad:0,route:[],kmSaid:0,watch:null,tick:0,wake:null,gpsAcc:null,gpsErr:'',pending:null};
const rkSecs=()=>rk.acc+(rk.on&&!rk.paused?(Date.now()-rk.t0)/1000:0);   // 只算沒暫停的時間
const rkLiveKey=()=>stateKey()+':runlive';   // 跑到一半頁面被關掉時，下次打開還能把這次存回來
function rkSnap(){try{localStorage.setItem(rkLiveKey(),JSON.stringify({startAt:rk.startAt,secs:Math.round(rkSecs()),m:Math.round(rk.m),mode:rk.mode,at:Date.now()}))}catch(e){}}
function rkSnapClear(){try{localStorage.removeItem(rkLiveKey())}catch(e){}}
async function rkWake(){if(!rk.on||rk.wake)return;try{rk.wake=await navigator.wakeLock?.request('screen');rk.wake?.addEventListener?.('release',()=>{rk.wake=null})}catch(e){rk.wake=null}}
document.addEventListener('visibilitychange',()=>{if(!rk.on)return;if(document.visibilityState==='hidden')rkSnap();else{rkWake();rkShow()}});
addEventListener('pagehide',()=>{if(rk.on)rkSnap()});
function rkKmCheck(){
  const k=Math.floor(rk.m/1000);if(k<=rk.kmSaid)return;rk.kmSaid=k;beep(1100,180);
  const s=rkSecs(),p=paceSec(rk.m,s);
  if(S.runCfg.voice)say(`第 ${k} 公里，用時 ${sayTime(s)}，平均配速每公里 ${sayTime(p)}`,{cancel:true});
}
function rkPos(p){
  const c=p.coords;rk.gpsAcc=c.accuracy;rk.gpsErr='';
  if(!rk.on||rk.paused){rkGpsTxt();return}
  if(!(c.accuracy<=40)){rkGpsTxt();return}   // 誤差超過 40 公尺的點不用，避免距離亂跳
  const pt={lat:c.latitude,lon:c.longitude,t:p.timestamp||Date.now()};
  if(!rk.last){rk.last=pt;rk.route.push([pt.lat,pt.lon]);rkGpsTxt();rkDraw();return}
  const d=hav(rk.last,pt),dt=(pt.t-rk.last.t)/1000;
  if(!(dt>0)||d<Math.max(3,c.accuracy*.4)){rkGpsTxt();return}   // 站著不動 GPS 也會飄幾公尺，太小的位移先不算
  if(d/dt>10){if(++rk.bad>=3){rk.bad=0;rk.last=pt}rkGpsTxt();return}   // 超過時速 36 公里當成定位亂跳；連續 3 次就接受新位置，但這段不算距離
  rk.bad=0;rk.m+=d;rk.last=pt;rk.route.push([pt.lat,pt.lon]);
  if(rk.route.length>6000)rk.route=rk.route.filter((_,i,a)=>i%2===0||i===a.length-1);
  rkKmCheck();rkShow();rkGpsTxt();rkDraw();
}
function rkPosErr(e){
  rk.gpsErr=e.code===1?'沒有定位權限：請點網址列的鎖頭圖示允許「位置」，或改用跑步機模式。':e.code===2?'抓不到 GPS 訊號，到空曠的地方等一下。':'GPS 還在找訊號…';
  if(e.code===1){const w=$('#rkWarn');w.hidden=false;w.textContent=rk.gpsErr}
  rkGpsTxt();
}
function rkGpsTxt(){
  const el=$('#rkGps');
  if(!rk.on){el.textContent='';return}
  if(rk.mode==='mill'){el.textContent=`跑步機 ${S.runCfg.speed} km/h`;return}
  el.textContent=rk.gpsErr?'⚠ '+rk.gpsErr:rk.gpsAcc==null?'正在找 GPS 訊號…':`GPS 精準度 ±${Math.round(rk.gpsAcc)} 公尺${rk.gpsAcc>40?'（訊號太差，這段先不算距離）':''}`;
}
function rkShow(){
  const s=rkSecs();
  $('#rkTime').textContent=hms(s);$('#rkKm').textContent=(rk.m/1000).toFixed(2);
  $('#rkPace').textContent=paceTxt(rk.m,s);$('#rkKc').textContent=Math.round(runKcal(rk.m,s));
}
function rkTick(){
  const now=Date.now();
  if(rk.mode==='mill'&&!rk.paused){rk.m+=S.runCfg.speed/3.6*Math.min(5,(now-rk.lastTick)/1000);rkKmCheck()}   // 背景回來時最多補 5 秒，避免一次跳很多
  rk.lastTick=now;rkShow();
  if(now-rk.snapAt>5000){rk.snapAt=now;rkSnap()}
}
function rkDraw(){
  const R=rk.route,card=$('#rkMapCard');card.hidden=R.length<2;if(card.hidden)return;
  const k=Math.cos(R[0][0]*Math.PI/180),P=R.map(p=>[p[1]*k,-p[0]]),W=400,H=220,pad=16;
  const xs=P.map(p=>p[0]),ys=P.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const sc=Math.min((W-2*pad)/Math.max(x1-x0,5e-4),(H-2*pad)/Math.max(y1-y0,5e-4)),ox=(W-(x1-x0)*sc)/2,oy=(H-(y1-y0)*sc)/2;   // 至少當成 50 公尺見方，才不會一點點路線就塞滿
  const pt=p=>[(ox+(p[0]-x0)*sc).toFixed(1),(oy+(p[1]-y0)*sc).toFixed(1)],a=pt(P[0]),b=pt(P[P.length-1]);
  $('#rkMap').innerHTML=`<polyline points="${P.map(p=>pt(p).join(',')).join(' ')}" fill="none" stroke="#3dd6d0" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${a[0]}" cy="${a[1]}" r="6" fill="#8fd16a"/><circle cx="${b[0]}" cy="${b[1]}" r="7" fill="#ffd23f" stroke="#0a1a20" stroke-width="2"/>`;
}
function rkUi(){
  $('#rkStart').textContent=!rk.on?'開始跑步':rk.paused?'繼續':'暫停';
  $('#rkStart').classList.toggle('teal',rk.on&&rk.paused);
  $('#rkStop').disabled=!rk.on;
  $('#rkCard').className='tcard '+(!rk.on?'idle':rk.paused?'prepare':'work');
  $('#rkLbl').textContent=!rk.on?(rk.acc?'已結束':'選好模式，按「開始跑步」'):rk.paused?'⏸ 已暫停':rk.mode==='gps'?'📍 跑步中':'🏃 跑步機跑步中';
  rkShow();rkGpsTxt();
}
function rkBegin(){
  const w=$('#rkWarn'),mode=S.runCfg.mode;w.hidden=true;
  if(mode==='gps'&&!('geolocation' in navigator&&isSecureContext)){w.hidden=false;w.textContent=isSecureContext?'這個瀏覽器不支援定位，請改用跑步機模式。':'定位只能在 https 網址使用，請改用跑步機模式，或用 https 開啟網站。';return}
  audioInit();$('#rkResult').hidden=true;rk.pending=null;$('#rkMapCard').hidden=true;
  const now=Date.now();
  Object.assign(rk,{on:true,paused:false,mode,acc:0,t0:now,lastTick:now,snapAt:now,startAt:now,m:0,last:null,bad:0,route:[],kmSaid:0,gpsAcc:null,gpsErr:''});
  if(mode==='gps')rk.watch=navigator.geolocation.watchPosition(rkPos,rkPosErr,{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  rk.tick=setInterval(rkTick,1000);rkWake();rkSnap();
  say('開始跑步，加油！',{cancel:true});beep(1320,200);rkUi();
}
function rkEnd(){
  rk.acc=rkSecs();rk.on=false;rk.paused=false;clearInterval(rk.tick);
  if(rk.watch!=null){navigator.geolocation.clearWatch(rk.watch);rk.watch=null}
  try{rk.wake?.release()}catch(e){}rk.wake=null;
}
$('#rkStart').onclick=()=>{
  if(!rk.on){rkBegin();return}
  if(rk.paused){rk.paused=false;rk.t0=rk.lastTick=Date.now();say('繼續跑',{cancel:true})}
  else{rk.acc=rkSecs();rk.paused=true;rk.last=null;say('暫停',{cancel:true})}   // last 清掉：暫停時走動的距離不算
  rkSnap();rkUi();
};
$('#rkStop').onclick=()=>{
  if(!rk.on)return;rkEnd();rkSnap();rkUi();
  const secs=Math.round(rk.acc),m=rk.m;
  if(secs<10){rkSnapClear();toast('跑不到 10 秒，這次不記錄');return}
  say(`結束，總共跑了 ${(m/1000).toFixed(2)} 公里，${sayTime(secs)}`,{cancel:true});beep(1320,400);
  rkOpenForm({m,secs,d:dkey(new Date(rk.startAt)),mode:rk.mode,live:true});
};
const rkDateLimits=()=>{const t=new Date(),m=new Date();m.setDate(t.getDate()-30);$('#rkInDate').max=dkey(t);$('#rkInDate').min=dkey(m)};
function rkOpenForm(o){
  rk.pending=o;rkDateLimits();
  $('#rkResTitle').textContent=o.recover?'上次的跑步還沒儲存':o.live?'確認這次跑步':'補登跑步';
  $('#rkResNote').textContent=o.recover?'可能是頁面被關掉了，下面是最後記到的數字，要存起來嗎？':o.mode==='gps'?'GPS 距離會有一點誤差，不準可以直接改。':o.mode==='mill'?'距離是用跑步機速度推算的，可以改成跑步機面板上的公里數。':'沒用 App 記錄的跑步可以在這裡補登，熱量一樣會算進去。';
  $('#rkInKm').value=o.m>0?(o.m/1000).toFixed(2):'';$('#rkInMin').value=o.secs>0?Math.floor(o.secs/60):'';$('#rkInSec').value=o.secs>0?o.secs%60:'';
  $('#rkInDate').value=o.d<$('#rkInDate').min?$('#rkInDate').min:o.d>$('#rkInDate').max?$('#rkInDate').max:o.d;
  $('#rkResult').hidden=false;rkPreview();$('#rkResult').scrollIntoView({block:'nearest',behavior:'smooth'});
}
const rkFormVals=()=>({m:Math.round((+$('#rkInKm').value||0)*1000),secs:Math.max(0,Math.round(+$('#rkInMin').value||0))*60+Math.min(59,Math.max(0,Math.round(+$('#rkInSec').value||0)))});
function rkPreview(){const {m,secs}=rkFormVals();$('#rkPvPace').textContent=paceTxt(m,secs);$('#rkPvKmh').textContent=m>0&&secs>0?(m/secs*3.6).toFixed(1):'—';$('#rkPvKc').textContent=Math.round(runKcal(m,secs))}
['#rkInKm','#rkInMin','#rkInSec'].forEach(s=>$(s).oninput=rkPreview);
$('#rkAddBtn').onclick=()=>{if(rk.on){toast('跑步中，結束後再補登');return}rkOpenForm({m:0,secs:0,d:dkey(new Date()),mode:'manual',live:false});$('#rkInKm').focus()};
$('#rkSave').onclick=()=>{
  const {m,secs}=rkFormVals(),d=$('#rkInDate').value,P=rk.pending||{mode:'manual'};rkDateLimits();
  if(!(m>=10&&m<=200000)){toast('距離請輸入 0.01 到 200 公里');return}
  if(!(secs>=10&&secs<=86400)){toast('時間請輸入 10 秒到 24 小時');return}
  if(m/secs>12){toast('平均時速超過 43 公里，請檢查距離和時間');return}
  if(!d||d>$('#rkInDate').max||d<$('#rkInDate').min){toast('日期只能選最近 30 天內');return}
  const kc=Math.round(runKcal(m,secs)*10)/10,xp=P.live?Math.round(m/100):0;   // 用 App 記錄的跑步每 100 公尺 1 經驗值，補登的不給
  S.kx[d]=(S.kx[d]||0)+kc;S.xp+=xp;
  S.runs.unshift({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),d,t:Date.now(),m,secs,kc,mode:P.mode,xp});
  S.runs.sort((a,b)=>b.d.localeCompare(a.d)||b.t-a.t);S.runs=S.runs.slice(0,500);
  rkSnapClear();rk.pending=null;$('#rkResult').hidden=true;save();renderStats();rkRender();
  toast(`已記錄跑步 ${(m/1000).toFixed(2)} 公里、${hms(secs)}、${Math.round(kc)} 大卡${xp?`，+${xp} 經驗值`:''}`);
};
$('#rkDiscard').onclick=()=>{if(rk.pending&&rk.pending.live&&!confirm('這次跑步不要存嗎？'))return;rkSnapClear();rk.pending=null;$('#rkResult').hidden=true};
$('#rkList').onclick=e=>{
  const b=e.target.closest('[data-id]');if(!b)return;const i=S.runs.findIndex(r=>r.id===b.dataset.id);if(i<0)return;const r=S.runs[i];
  if(!confirm(`刪除這筆跑步：${r.d} ${(r.m/1000).toFixed(2)} 公里？`))return;
  S.kx[r.d]=Math.max(0,(S.kx[r.d]||0)-(r.kc||0));if(!(S.kx[r.d]>.01))delete S.kx[r.d];S.xp=Math.max(0,S.xp-(r.xp||0));
  S.runs.splice(i,1);save();renderStats();rkRender();
};
$('#rkMode').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(rk.on){toast('跑步中不能換模式，先按「結束」');return}S.runCfg.mode=b.dataset.v;save();rkRender()};
$('#rkSpeed').oninput=e=>{S.runCfg.speed=+e.target.value;$('#rkSpeedO').textContent=S.runCfg.speed+' km/h';save();rkGpsTxt()};
$('#rkVoice').onchange=e=>{S.runCfg.voice=e.target.checked;save()};
function rkRender(){
  const C=S.runCfg,R=S.runs;
  $$('#rkMode button').forEach(b=>b.classList.toggle('on',b.dataset.v===C.mode));
  $('#rkDesc').textContent=C.mode==='gps'?'用手機定位算距離，適合操場、河堤、街上。第一次會問你要不要允許「位置」權限。':'在跑步機或室內跑：用你設定的速度乘上時間算距離，結束後可以改成跑步機上顯示的公里數。';
  $('#rkSpeedWrap').hidden=C.mode!=='mill';$('#rkSpeed').value=C.speed;$('#rkSpeedO').textContent=C.speed+' km/h';$('#rkVoice').checked=C.voice;
  const wk=new Set(lastDays(7).map(x=>x.k)),wkM=R.filter(r=>wk.has(r.d)).reduce((a,r)=>a+r.m,0),longest=R.reduce((a,r)=>Math.max(a,r.m),0);
  const fast=R.filter(r=>r.m>=1000).reduce((a,r)=>{const p=paceSec(r.m,r.secs);return !a||p<a?p:a},0);
  $('#rkFacts').innerHTML=[[runKmTotal().toFixed(1),'累計公里'],[(wkM/1000).toFixed(1),'近 7 天公里'],[R.length,'跑步次數'],[(longest/1000).toFixed(2),'最遠一次（公里）'],[fast?Math.floor(fast/60)+"'"+String(fast%60).padStart(2,'0')+'"':'—','最快配速（1 公里以上）'],[Math.round(R.reduce((a,r)=>a+(r.kc||0),0)),'跑步累計大卡']]
    .map(([v,l])=>`<div class="fact"><b>${v}</b><span>${l}</span></div>`).join('');
  const ic={gps:'📍',mill:'🏃',manual:'✍️'};
  $('#rkList').innerHTML=R.length?R.slice(0,15).map(r=>`<li><span class="mdate">${r.d.slice(5).replace('-','/')}</span><span class="grow" title="${(r.m/1000).toFixed(2)} 公里，${hms(r.secs)}，配速 ${paceTxt(r.m,r.secs)}">${ic[r.mode]||''} ${(r.m/1000).toFixed(2)}km・${hms(r.secs)}・${paceTxt(r.m,r.secs)}</span><b>${Math.round(r.kc)}</b><span class="small mute">大卡</span><button class="xbtn" type="button" data-id="${r.id}" aria-label="刪除 ${r.d} 的跑步">×</button></li>`).join('')+(R.length>15?`<li class="small mute">另外還有 ${R.length-15} 筆較早的紀錄</li>`:''):'<li class="small mute">還沒有跑步紀錄，出門跑一圈吧！</li>';
  rkUi();
}
function rkRecover(){
  let o=null;try{o=JSON.parse(localStorage.getItem(rkLiveKey())||'null')}catch(e){}
  if(!o)return;if(!(o.secs>=10)||!(Date.now()-o.at<3*864e5)){rkSnapClear();return}
  rkOpenForm({m:o.m||0,secs:o.secs,d:dkey(new Date(o.startAt||o.at)),mode:o.mode==='mill'?'mill':'gps',live:true,recover:true});
  toast('上次的跑步還沒儲存，到「跑步」分頁確認');
}

