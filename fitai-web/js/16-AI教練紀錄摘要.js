/* ============================================================
   16-AI教練紀錄摘要
   內容：把近 7 天的訓練紀錄整理成摘要給 AI 教練用
   畫面：「AI 教練」分頁
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= AI 教練：近 7 天紀錄摘要 ================= */
function trainSummary(){
  const days=lastDays(7),L=[],act=days.filter(x=>(S.days[x.k]||0)>0).length;
  L.push(`【使用者最近 7 天的紀錄】練了 ${act} 天；目前連續 ${streaks().cur} 天。`);
  const ex={};days.forEach(x=>{for(const [k,v] of Object.entries(S.dayEx[x.k]||{}))ex[k]=(ex[k]||0)+v});
  const exs=Object.entries(ex).sort((a,b)=>b[1]-a[1]);
  L.push(exs.length?'各動作次數：'+exs.map(([k,v])=>`${k} ${v} 下`).join('、'):'各動作次數：沒有紀錄');
  const fo=days.reduce((a,x)=>{const f=S.dayForm[x.k]||{ok:0,bad:0};return [a[0]+f.ok,a[1]+f.bad]},[0,0]);
  if(fo[0]+fo[1])L.push(`姿勢達標率：${Math.round(fo[0]/(fo[0]+fo[1])*100)}%（共 ${fo[0]+fo[1]} 下有判定）`);
  const prs=Object.entries(S.pr).map(([k,r])=>`${k} ${r.n} 下`);if(prs.length)L.push('單組最高紀錄：'+prs.join('、'));
  const hb=Object.entries(S.holdBest).map(([k,v])=>`${k} ${v} 秒`);if(hb.length)L.push('撐住類最佳：'+hb.join('、'));
  const wt=Object.entries(S.weights).sort((a,b)=>a[0]<b[0]?-1:1).slice(-5);if(wt.length>1)L.push(`體重從 ${wt[0][1]} kg 到 ${wt[wt.length-1][1]} kg（最近 ${wt.length} 筆）`);
  const fk=days.map(x=>(S.food[x.k]||[]).reduce((a,f)=>a+f.k,0)).filter(v=>v>0);
  if(fk.length)L.push(`有記錄飲食的 ${fk.length} 天，平均每天約 ${Math.round(mean(fk))} 大卡（目標約 ${Math.round(bodyInfo().target)} 大卡）`);
  const plan=weekDates().map(d=>[d,(S.sched[d.getDay()]||'').trim()]).filter(([d,p])=>!isRest(p)).map(([d,p])=>`週${WDN[d.getDay()]}：${p}`);
  if(plan.length)L.push('目前自訂的每週課表：'+plan.join('、'));
  return L.join('\n')+'\n請根據這些紀錄給建議（哪裡進步、哪裡不足、下週怎麼排），不要編造上面沒有的數據。';
}

