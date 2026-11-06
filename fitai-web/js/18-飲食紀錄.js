/* ============================================================
   18-飲食紀錄
   內容：飲食紀錄：常見食物快速加入、每日熱量與蛋白質
   畫面：「飲食紀錄」分頁
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 飲食紀錄 ================= */
const FOODS=[['白飯 1 碗',280,5],['雞胸肉 100g',165,31],['水煮蛋 1 顆',75,6],['無糖豆漿 400ml',130,13],['地瓜 中型 1 條',130,2],['香蕉 1 根',90,1],['蛋餅 1 份',250,8],['雞腿便當',800,35],['滷肉飯 小碗',400,10],['牛肉麵 1 碗',600,30],['珍珠奶茶 全糖 700ml',550,4],['無糖優格 150g',100,8],['燕麥片 40g',150,5],['鮭魚 100g',200,20],['板豆腐 半盒',100,9],['乳清蛋白 1 份',120,24],['吐司 1 片',80,3],['水果 1 份',60,1]];
const foodOf=k=>S.food[k]||[];
function addFood(n,kcal,pr){
  n=String(n).trim().slice(0,20);kcal=Math.round(+kcal);pr=Math.round(+pr||0);
  if(!n||!(kcal>=0&&kcal<=5000)){toast('請輸入食物名稱，和 0 到 5000 之間的大卡');return false}
  const k=dkey(new Date());(S.food[k]=S.food[k]||[]).push({n,k:kcal,p:pr,t:Date.now()});
  save();renderStats();renderFood();return true;
}
function renderFood(){
  if(!$('#fdTotal'))return;
  const list=foodOf(dkey(new Date())),kc=list.reduce((a,f)=>a+f.k,0),pr=list.reduce((a,f)=>a+(f.p||0),0),b=bodyInfo(),tg=Math.round(b.target),left=tg-kc;
  $('#fdTotal').textContent=`今天已記錄 ${kc} 大卡`;$('#fdTarget').textContent=`目標約 ${tg} 大卡`;
  $('#fdBar').style.width=Math.min(100,kc/Math.max(tg,1)*100)+'%';
  $('#fdLeft').textContent=!list.length?'還沒有記錄，從右邊挑一個，或自己輸入。':left>=0?`還可以吃約 ${left} 大卡。`:`比目標多了約 ${-left} 大卡，沒關係，明天抓回來就好。`;
  $('#fdMacro').innerHTML=`<div class="fact"><b>${pr} g</b><span>今天蛋白質（有填的）</span></div><div class="fact"><b>${Math.round(b.w*1.6)}–${Math.round(b.w*2)} g</b><span>每日建議蛋白質</span></div>`;
  $('#fdList').innerHTML=list.length?list.map((f,i)=>`<li>${esc(f.n)}　<b style="color:var(--yellow)">${f.k} 大卡</b>${f.p?`　<span class="small">${f.p} g 蛋白質</span>`:''}<button class="xbtn" type="button" data-i="${i}" aria-label="刪除 ${esc(f.n)}">×</button></li>`).join(''):'<li>今天還沒有記錄。</li>';
  $$('#fdList .xbtn').forEach(x=>x.onclick=()=>{foodOf(dkey(new Date())).splice(+x.dataset.i,1);save();renderStats();renderFood()});
  const fk=lastDays(7).map(d=>foodOf(d.k).reduce((a,f)=>a+f.k,0)).filter(v=>v>0);
  $('#fdAvg').textContent=fk.length?`近 7 天有記錄的 ${fk.length} 天，平均每天約 ${Math.round(mean(fk))} 大卡。`:'';
}
$('#fdQuick').innerHTML=FOODS.map((f,i)=>`<button class="btn ghost small" type="button" data-i="${i}" title="約 ${f[1]} 大卡">${esc(f[0])}　${f[1]}</button>`).join('');
$$('#fdQuick button').forEach(b=>b.onclick=()=>{const f=FOODS[+b.dataset.i];addFood(f[0],f[1],f[2])});
$('#fdAdd').onclick=()=>{if(addFood($('#fdName').value,$('#fdKcal').value,$('#fdP').value)){$('#fdName').value='';$('#fdKcal').value='';$('#fdP').value=''}};

