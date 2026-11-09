/* ============================================================
   09-喝水提醒
   內容：喝水紀錄（每日目標、記錄、撤銷）。定時跳出的喝水提醒已移除。
   畫面：統計紀錄裡的喝水卡片
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 喝水紀錄 ================= */
const wToday=()=>S.water[dkey(new Date())]||0;
function addWater(ml){
  const k=dkey(new Date());S.water[k]=(S.water[k]||0)+ml;S.waterLog=[...S.waterLog,{k,ml}].slice(-30);
  if(S.water[k]>=S.waterGoal)S.waterHit[k]=true;
  save();renderStats();
}
const hhmm=t=>{const d=new Date(t);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
function renderWater(){
  if(!$('#wGoal'))return;
  const ml=wToday(),goal=S.waterGoal;
  $('#wGoal').value=goal;
  $('#wBar').style.width=Math.min(100,ml/goal*100)+'%';
  $('#wTxt').textContent=`今天已喝 ${ml} / ${goal} ml`+(ml>=goal?'，達標了！':'');
  const perm=!('Notification' in window)?'此瀏覽器不支援通知':Notification.permission==='granted'?'瀏覽器通知已開啟':Notification.permission==='denied'?'瀏覽器通知被封鎖':'尚未允許瀏覽器通知';
  $('#wNote').textContent=`依你在「身體數據」填的體重，建議每天約 ${Math.round(bodyInfo().w*35/50)*50} ml。瀏覽器通知用於訓練提醒；${perm}。`;
  $('#wNotif').disabled=!('Notification' in window)||Notification.permission==='granted';
}
$('#wGoal').onchange=e=>{S.waterGoal=Math.max(500,Math.min(6000,Math.round(+e.target.value)||2000));const k=dkey(new Date());if(wToday()>=S.waterGoal)S.waterHit[k]=true;save();renderStats()};
$$('#waterCard [data-ml]').forEach(b=>b.onclick=()=>addWater(+b.dataset.ml));
$('#wUndo').onclick=()=>{const l=S.waterLog.pop();if(!l){toast('沒有可以撤銷的紀錄');return}S.water[l.k]=Math.max(0,(S.water[l.k]||0)-l.ml);if(S.water[l.k]<S.waterGoal)delete S.waterHit[l.k];save();renderWater()};
$('#wNotif').onclick=async()=>{
  try{const r=await Notification.requestPermission();toast(r==='granted'?'已開啟瀏覽器通知':'通知被封鎖，可以點網址列左邊的圖示重新開啟')}catch(e){}
  renderWater();
};
