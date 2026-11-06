/* ============================================================
   09-喝水提醒
   內容：喝水提醒（網頁開著時有效）
   畫面：上方的喝水提醒列、統計紀錄裡的喝水設定
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 喝水提醒（網頁開著時有效） ================= */
const wToday=()=>S.water[dkey(new Date())]||0;
function nextActive(t){
  const d=new Date(t),h=d.getHours()+d.getMinutes()/60;
  if(h>=S.waterFrom&&h<S.waterTo)return t;
  const n=new Date(t);n.setHours(S.waterFrom,0,0,0);if(h>=S.waterTo)n.setDate(n.getDate()+1);return n.getTime();
}
function waterSchedule(){S.waterNext=nextActive(Date.now()+S.waterMin*60000);save()}
function addWater(ml){
  const k=dkey(new Date());S.water[k]=(S.water[k]||0)+ml;S.waterLog=[...S.waterLog,{k,ml}].slice(-30);
  if(S.water[k]>=S.waterGoal)S.waterHit[k]=true;
  save();renderStats();
}
function showWater(text){
  $('#wText').textContent=text;$('#waterBar').hidden=false;
  clearTimeout(showWater.t);showWater.t=setTimeout(()=>{$('#waterBar').hidden=true},90000);
  beep(660,120);setTimeout(()=>beep(880,160),170);say('該喝水了');
  if(document.hidden&&'Notification' in window&&Notification.permission==='granted'){try{new Notification('Lin AI 喝水提醒',{body:text})}catch(e){}}
}
function waterNudge(text){if(S.waterOn)showWater(text)}
function waterTick(){
  if(!S.waterOn)return;
  const now=Date.now();if(!S.waterNext){waterSchedule();return}
  if(now<S.waterNext)return;
  if(cam.running||tRunning||chRunning){S.waterNext=now+2*60000;return}   // 訓練中先不打擾
  const d=new Date(),h=d.getHours()+d.getMinutes()/60;
  if(h<S.waterFrom||h>=S.waterTo){S.waterNext=nextActive(now);save();return}
  showWater(`該喝水了，喝一杯 250 ml 吧。今天已喝 ${wToday()} / ${S.waterGoal} ml`);
  S.waterNext=nextActive(now+S.waterMin*60000);save();renderWater();
}
setInterval(waterTick,20000);
const hhmm=t=>{const d=new Date(t);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
function renderWater(){
  if(!$('#wOn'))return;
  const ml=wToday(),goal=S.waterGoal;
  $('#wOn').checked=S.waterOn;$('#wMin').value=S.waterMin;$('#wFrom').value=S.waterFrom;$('#wTo').value=S.waterTo;$('#wGoal').value=goal;
  $('#wBar').style.width=Math.min(100,ml/goal*100)+'%';
  $('#wTxt').textContent=`今天已喝 ${ml} / ${goal} ml`+(ml>=goal?'，達標了！':'')+(S.waterOn&&S.waterNext?`。下次提醒：${hhmm(S.waterNext)}`:(S.waterOn?'':'。提醒已關閉'));
  const perm=!('Notification' in window)?'此瀏覽器不支援通知':Notification.permission==='granted'?'瀏覽器通知已開啟':Notification.permission==='denied'?'瀏覽器通知被封鎖':'尚未允許瀏覽器通知';
  $('#wNote').textContent=`依你在「身體數據」填的體重，建議每天約 ${Math.round(bodyInfo().w*35/50)*50} ml。提醒只在這個網頁開著時有效，分頁縮到背景也可以；${perm}。`;
  $('#wNotif').disabled=!('Notification' in window)||Notification.permission==='granted';
}
$('#wFrom').innerHTML=Array.from({length:24},(_,i)=>`<option value="${i}">${String(i).padStart(2,'0')}:00</option>`).join('');
$('#wTo').innerHTML=Array.from({length:24},(_,i)=>`<option value="${i+1}">${String(i+1).padStart(2,'0')}:00</option>`).join('');
$('#wOn').onchange=e=>{S.waterOn=e.target.checked;if(S.waterOn)waterSchedule();save();renderWater()};
$('#wMin').onchange=e=>{S.waterMin=+e.target.value;waterSchedule();renderWater()};
$('#wFrom').onchange=e=>{S.waterFrom=+e.target.value;if(S.waterFrom>=S.waterTo){S.waterTo=Math.min(24,S.waterFrom+1)}waterSchedule();renderWater()};
$('#wTo').onchange=e=>{S.waterTo=+e.target.value;if(S.waterTo<=S.waterFrom){S.waterFrom=Math.max(0,S.waterTo-1)}waterSchedule();renderWater()};
$('#wGoal').onchange=e=>{S.waterGoal=Math.max(500,Math.min(6000,Math.round(+e.target.value)||2000));const k=dkey(new Date());if(wToday()>=S.waterGoal)S.waterHit[k]=true;save();renderStats()};
$$('#waterCard [data-ml]').forEach(b=>b.onclick=()=>{addWater(+b.dataset.ml);if(S.waterOn)waterSchedule()});
$('#wUndo').onclick=()=>{const l=S.waterLog.pop();if(!l){toast('沒有可以撤銷的紀錄');return}S.water[l.k]=Math.max(0,(S.water[l.k]||0)-l.ml);if(S.water[l.k]<S.waterGoal)delete S.waterHit[l.k];save();renderWater()};
$('#wNotif').onclick=async()=>{
  try{const r=await Notification.requestPermission();toast(r==='granted'?'已開啟瀏覽器通知':'通知被封鎖，可以點網址列左邊的圖示重新開啟')}catch(e){}
  renderWater();
};
$('#wDrink').onclick=()=>{addWater(250);if(S.waterOn)waterSchedule();$('#waterBar').hidden=true};
$('#wLater').onclick=()=>{S.waterNext=Date.now()+10*60000;save();$('#waterBar').hidden=true;renderWater()};
$('#wClose').onclick=()=>{$('#waterBar').hidden=true};

