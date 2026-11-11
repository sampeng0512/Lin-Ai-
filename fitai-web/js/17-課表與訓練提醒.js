/* ============================================================
   17-課表與訓練提醒
   內容：每週課表與「該去訓練了」提醒
   畫面：上方的訓練提醒列、統計紀錄裡的課表設定
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 課表與訓練提醒 ================= */
const WDN=['日','一','二','三','四','五','六'];
function weekDates(){const t=new Date();t.setHours(0,0,0,0);const mon=new Date(t);mon.setDate(t.getDate()-((t.getDay()+6)%7));return Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d})}
const isRest=v=>!v||/^(休息|rest)$/i.test(String(v).trim());
$('#scTime').innerHTML=Array.from({length:17},(_,i)=>{const t=String(6+i).padStart(2,'0')+':00';return `<option value="${t}">${t}</option>`}).join('');
function renderSched(){
  const wd=weekDates(),todayK=dkey(new Date());
  $('#scGrid').innerHTML=wd.map(d=>{
    const k=dkey(d),p=(S.sched[d.getDay()]||'').trim(),done=(S.days[k]||0)>0;
    const st=isRest(p)?'<span class="mute">休息</span>':done?'<span style="color:var(--teal)">已完成</span>':k>todayK?'<span class="mute">待完成</span>':k===todayK?'<b style="color:var(--yellow)">今天</b>':'<span style="color:var(--coral)">未完成</span>';
    return `<div class="sc ${k===todayK?'today':''}"><b>週${WDN[d.getDay()]}</b><input type="text" data-d="${d.getDay()}" maxlength="14" placeholder="休息" value="${esc(S.sched[d.getDay()]||'')}" aria-label="週${WDN[d.getDay()]}的課表">${st}</div>`;
  }).join('');
  $$('#scGrid input').forEach(i=>i.onchange=()=>{S.sched[+i.dataset.d]=i.value.trim();save();renderSched();renderDaily()});
  $('#scOn').checked=S.schedOn;$('#scTime').value=S.schedTime;
  $('#scNote').textContent=S.schedOn?`每天 ${S.schedTime}，如果今天有課表卻還沒有任何運動紀錄，會提醒你。網頁要開著才有效。`:'打開後，到了設定的時間，如果今天有課表卻還沒運動，會提醒你。';
}
$('#scOn').onchange=e=>{S.schedOn=e.target.checked;save();renderSched();if(S.schedOn&&'Notification' in window&&Notification.permission==='default')toast('想在網頁縮到背景時也收到提醒，可以到「統計紀錄」的喝水紀錄卡片按「允許瀏覽器通知」')};
$('#scTime').onchange=e=>{S.schedTime=e.target.value;S.schedSeen[dkey(new Date())]=false;save();renderSched()};
function planTick(){
  if(!S.schedOn)return;
  const now=new Date(),k=dkey(now),p=(S.sched[now.getDay()]||'').trim();
  if(isRest(p)||S.schedSeen[k]||(S.days[k]||0)>0)return;
  if(S.schedNext&&Date.now()<S.schedNext)return;
  const [h,m]=S.schedTime.split(':').map(Number);if(now.getHours()*60+now.getMinutes()<h*60+m)return;
  if(cam.running||tRunning||chRunning)return;
  S.schedSeen[k]=true;save();
  const text=`今天的課表是「${p}」，現在開始訓練吧。`;
  $('#plText').textContent=text;$('#planBar').hidden=false;say('該訓練了');
  if(document.hidden&&'Notification' in window&&Notification.permission==='granted'){try{new Notification('Lin AI 訓練提醒',{body:text})}catch(e){}}
}
$('#plGo').onclick=()=>{$('#planBar').hidden=true;if(document.body.dataset.mode!=='professional')enterMode('professional');else $('.tab[data-tab=cam]').click()};
$('#plLater').onclick=()=>{S.schedSeen[dkey(new Date())]=false;S.schedNext=Date.now()+30*60000;save();$('#planBar').hidden=true};
$('#plClose').onclick=()=>{$('#planBar').hidden=true};

