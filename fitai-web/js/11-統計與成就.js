/* ============================================================
   11-統計與成就
   內容：統計、自訂紀錄、每日挑戰、個人紀錄、運動日曆、成就徽章與分享圖、體重紀錄
   畫面：「統計紀錄」與「成就徽章」分頁
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 統計與成就 ================= */
let chartN=7;
const WD=['日','一','二','三','四','五','六'];
function lastDays(n){const a=[];for(let i=n-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);a.push({k:dkey(d),d})}return a}
function renderStatsTab(){
  const exerciseSelect=$('#stExercise');
  {
    const extra=Object.keys(S.exs).filter(ex=>!ORDER.includes(ex)).sort((a,b)=>a.localeCompare(b));
    if(exerciseSelect.options.length!==ORDER.length+extra.length)exerciseSelect.innerHTML=optsByCat(ORDER)+extra.map(ex=>`<option value="${esc(ex)}">${esc(ex)}</option>`).join('');
  }
  if(![...exerciseSelect.options].some(option=>option.value===S.statsEx))S.statsEx=ORDER[0];
  exerciseSelect.value=S.statsEx;
  const ex=S.statsEx,days=lastDays(chartN),vals=days.map(x=>Number(S.dayEx[x.k]?.[ex])||0);
  const todayKey=dkey(new Date()),today=Number(S.dayEx[todayKey]?.[ex])||0;
  const dayTotal=k=>Object.values(S.dayEx[k]||{}).reduce((sum,n)=>sum+(Number(n)||0),0);
  const last7=lastDays(7),sum7=last7.reduce((a,x)=>a+(Number(S.dayEx[x.k]?.[ex])||0),0);
  const bestDay=Math.max(0,...Object.values(S.dayEx).map(day=>Number(day?.[ex])||0));
  const streak=streaks(),cameraTotal=Number(S.ver.exs[ex])||0;
  const manualTotal=S.manual.filter(entry=>entry.ex===ex).reduce((sum,entry)=>sum+entry.n,0);
  const weekDays=weekDates().filter(d=>S.days[dkey(d)]>0).length;
  $('#stFacts').innerHTML=[[dayTotal(todayKey),'今日總次數'],[last7.reduce((a,x)=>a+dayTotal(x.k),0),'近 7 天總次數'],[Number(S.reps)||0,'累計總次數'],[weekDays+' 天','本週訓練天數'],[streak.cur+' 天','目前連續天數'],[streak.longest+' 天','最長連續天數']]
    .map(([b,l])=>`<div class="fact"><b>${b}</b><span>${l}</span></div>`).join('');
  $('#stExStats').innerHTML=[[Number(S.exs[ex])||0,'累計次數'],[today,'今日次數'],[sum7,'近 7 天'],[bestDay,'單日最高'],['📷 '+cameraTotal,'鏡頭偵測'],['✍️ '+manualTotal,'自訂紀錄']]
    .map(([b,l])=>`<div><b>${b}</b><span>${l}</span></div>`).join('');
  const mx=Math.max(10,...vals),top=mx<=20?20:mx<=50?50:Math.ceil(mx/50)*50;
  const W=700,H=250,L=34,R=6,T=16,B=34,bw=(W-L-R)/days.length,ch=H-T-B;let g='';
  for(const f of [0,.5,1]){const y=T+ch*(1-f);g+=`<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.1)"/><text x="${L-6}" y="${y+4}" text-anchor="end" font-size="11" fill="#93aeb3">${Math.round(top*f)}</text>`}
  days.forEach((x,i)=>{
    const v=vals[i],h=ch*v/top,bx=L+i*bw+bw*.18,bww=bw*.64,isToday=i===days.length-1;
    g+=`<rect x="${bx}" y="${T+ch-Math.max(h,v?2:0)}" width="${bww}" height="${Math.max(h,v?2:0)}" rx="${Math.min(6,bww/2)}" fill="${isToday?'#3dd6d0':'#ffd23f'}"/>`;
    if(chartN===7&&v)g+=`<text x="${bx+bww/2}" y="${T+ch-h-5}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">${v}</text>`;
    if(chartN===7||i%5===0||i===days.length-1)g+=`<text x="${bx+bww/2}" y="${H-12}" text-anchor="middle" font-size="12" fill="#93aeb3">${chartN===7?'週'+WD[x.d.getDay()]:(x.d.getMonth()+1)+'/'+x.d.getDate()}</text>`;
  });
  $('#stChart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${ex}近 ${chartN} 天每日次數長條圖，青色是今天">${g}</svg>`;
  $('#stGoal').value=S.goal;$('#stGoalBar').style.width=Math.min(100,today/S.goal*100)+'%';
  $('#stGoalTxt').textContent=today>=S.goal?`今天的${ex}已達標，完成 ${today} 下。`:`今天的${ex}已完成 ${today} / ${S.goal} 下，還差 ${S.goal-today} 下。`;
  renderWater();
  renderHeat();renderPR();renderExerciseTotals();renderManual();
}
function renderExerciseTotals(){
  const known=new Set(ORDER),groups=CATS.map(cat=>[cat,ORDER.filter(ex=>EX[ex].cat===cat)]);
  const unlisted=Object.keys(S.exs).filter(ex=>!known.has(ex)).sort((a,b)=>a.localeCompare(b));
  if(unlisted.length)groups.push(['其他動作',unlisted]);
  const html=groups.map(([cat,exercises])=>`<div><h4>${esc(cat)}</h4><table><tbody>${exercises.map(ex=>`<tr><td>${esc(ex)}</td><td style="text-align:right"><b style="color:var(--yellow)">${Math.max(0,Number(S.exs[ex])||0)}</b> 下</td></tr>`).join('')}</tbody></table></div>`).join('');
  const knownTotal=Object.values(S.exs).reduce((sum,n)=>sum+(Number(n)||0),0),unclassified=Math.max(0,(Number(S.reps)||0)-knownTotal);
  $('#stExTotals').innerHTML=html+(unclassified?'<p class="small mute">部分舊紀錄沒有動作名稱，未納入任何單一動作統計。</p>':'');
}
seg($('#stRange'),b=>{chartN=+b.dataset.n;renderStatsTab()});
$('#stExercise').onchange=e=>{S.statsEx=e.target.value;save();renderStatsTab()};
/* ===== 自訂紀錄：手動補登，不計入好友排行 ===== */
$('#manEx').innerHTML=optsByCat(ORDER)+'<option value="__custom">其他（自己輸入名稱）</option>';
const manDateLimits=()=>{const t=new Date(),m=new Date();m.setDate(t.getDate()-30);$('#manDate').max=dkey(t);$('#manDate').min=dkey(m);if(!$('#manDate').value)$('#manDate').value=dkey(t)};
$('#manEx').onchange=()=>{$('#manNameWrap').hidden=$('#manEx').value!=='__custom';if(!$('#manNameWrap').hidden)$('#manName').focus()};
function renderManual(){
  manDateLimits();
  const L=[...S.manual].sort((a,b)=>String(b.d).localeCompare(String(a.d))||(Number(b.t)||0)-(Number(a.t)||0)).slice(0,12);
  $('#manList').innerHTML=L.length?L.map(m=>`<li><span class="mdate">${m.d.slice(5).replace('-','/')}</span><span class="grow">${esc(m.ex)}</span><b>${m.n}</b><span class="small mute">下</span><button class="xbtn" type="button" data-id="${m.id}" aria-label="刪除 ${esc(m.ex)} ${m.n} 下">×</button></li>`).join('')+(S.manual.length>12?`<li class="small mute">另外還有 ${S.manual.length-12} 筆較早的紀錄</li>`:''):'<li class="small mute">還沒有自訂紀錄。</li>';
}
$('#manAdd').onclick=()=>{
  manDateLimits();
  const custom=$('#manEx').value==='__custom',ex=(custom?$('#manName').value:$('#manEx').value).trim().slice(0,12),n=Math.round(+$('#manN').value||0),d=$('#manDate').value;
  if(!ex){toast('請輸入動作名稱');return}
  if(!(n>=1&&n<=2000)){toast('次數請輸入 1 到 2000');return}
  if(!d||d>$('#manDate').max||d<$('#manDate').min){toast('只能補登最近 30 天內的紀錄');return}
  addReps(n,ex,0,d);S.manual.unshift({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),ex,n,d,t:Date.now()});S.manual=S.manual.slice(0,200);
  save();renderStats();$('#manN').value='';$('#manName').value='';toast(`已記錄 ${ex} ${n} 下（不計入好友排行）`);
};
$('#manN').addEventListener('keydown',e=>{if(e.key==='Enter')$('#manAdd').click()});
$('#manList').onclick=e=>{
  const b=e.target.closest('[data-id]');if(!b)return;const i=S.manual.findIndex(m=>m.id===b.dataset.id);if(i<0)return;const m=S.manual[i];
  if(!confirm(`刪除這筆紀錄：${m.d} ${m.ex} ${m.n} 下？`))return;
  subReps(m.n,m.ex,m.d);S.manual.splice(i,1);save();renderStats();renderStatsTab();
};
$('#stGoal').onchange=e=>{S.goal=Math.max(10,Math.min(1000,Math.round(+e.target.value)||50));save();renderStatsTab()};
$('#stReset').onclick=async()=>{if(!confirm('要清除所有紀錄嗎？次數、等級、成就和統計都會歸零。\n（好友排行榜上的資料不會被清掉，要刪除請到「好友排行」分頁。）'))return;
  noSave=true;clearTimeout(saveT);saveT=0;
  try{
    if(accountSession&&activeUserId){clearTimeout(cloudSaveT);const keep=S;S=freshState();try{await syncAccountNow({force:true})}catch(error){S=keep;throw error}localStorage.removeItem(dirtyKey(activeUserId))}
    localStorage.removeItem(stateKey());location.reload();
  }catch(error){noSave=false;toast('雲端清除失敗，紀錄沒有刪除：'+accountErrorText(error))}
};

/* ================= 每日挑戰 ================= */
const DAILY_T={"深蹲":40,"伏地挺身":20,"捲腹":30,"側平舉":30,"二頭彎舉":30,"開合跳":60,"弓箭步":30,"臀橋":30,"高抬腿":60,
 "仰臥起坐":25,"深蹲跳":20,"啞鈴臥推":20,"肩推":25,"仰臥抬腿":20,"前平舉":25,"引體向上":8,"側抬腿":30,"側彎":40,"站姿抬膝碰肘":40,"原地踏步":100,"原地跳繩":150,"波比跳":15,
 "啞鈴上斜臥推":20,"啞鈴俯身划船":20,"啞鈴反向飛鳥":20,"啞鈴羅馬尼亞硬舉":15,
 "高位下拉":20,"繩索划船":20,"俯身划船":20};
function dailyTask(){const k=dkey(new Date()),ex=ORDER[dayN(k)%ORDER.length];return {ex,target:DAILY_T[ex],key:k}}
const dailyProg=t=>(S.dayEx[t.key]||{})[t.ex]||0;
function checkDaily(){
  const t=dailyTask();
  if(!S.dailyDone[t.key]&&dailyProg(t)>=t.target){S.dailyDone[t.key]=true;S.xp+=30;save();toast(`每日挑戰完成：${t.ex} ${t.target} 下，獲得 30 經驗值`,true)}
}
function renderDaily(){
  const t=dailyTask(),p=dailyProg(t),done=!!S.dailyDone[t.key];
  $('#dailyTxt').innerHTML=`今日挑戰：<span style="color:var(--yellow)">${t.ex} ${t.target} 下</span>`;
  $('#dailyBar').style.width=Math.min(100,p/t.target*100)+'%';
  const plan=(S.sched[new Date().getDay()]||'').trim();$('#dailyPlan').textContent=isRest(plan)?'':`今日課表：${plan}${(S.days[dkey(new Date())]||0)>0?'（今天已運動）':''}`;
  $('#dailySub').textContent=done?'已完成，獲得 30 經驗值。':`進度 ${p} / ${t.target} 下，完成可獲得 30 經驗值。`;
}
$('#dailyGo').onclick=()=>{const t=dailyTask();$('#camEx').value=t.ex;$('#camEx').dispatchEvent(new Event('change'))};

/* ================= 個人紀錄 ================= */
function notePR(ex,n){
  if(n<5)return;const old=S.pr[ex];
  if(!old||n>old.n){S.pr[ex]={n,t:Date.now()};if(old){S.prCount=(S.prCount||0)+1;toast(`新紀錄：${ex} 單組 ${n} 下`,true)}}
}
function renderPR(){
  const rows=Object.entries(S.pr).sort((x,y)=>y[1].n-x[1].n);
  $('#stPR').innerHTML=rows.length?'<table><tr><th>動作</th><th>單組最多</th><th>日期</th></tr>'+rows.map(([ex,r])=>{const d=new Date(r.t);return `<tr><td>${esc(ex)}</td><td><b style="color:var(--yellow)">${r.n} 下</b></td><td>${d.getMonth()+1}/${d.getDate()}</td></tr>`}).join('')+'</table>':'<p class="small mute">還沒有紀錄。用鏡頭做完一組並儲存，或跑計時器，就會記下每個動作單組最多的次數。</p>';
}

/* ================= 運動日曆 ================= */
function renderHeat(){
  const weeks=16,cell=15,gap=3,today=new Date();today.setHours(0,0,0,0);
  const start=new Date(today);start.setDate(today.getDate()-today.getDay()-(weeks-1)*7);
  let g='',lastM=-1;
  for(let w=0;w<weeks;w++){
    for(let d=0;d<7;d++){
      const dt=new Date(start);dt.setDate(start.getDate()+w*7+d);if(dt>today)continue;
      const active=Number(S.days[dkey(dt)])>0,col=active?'#35bd99':'rgba(255,255,255,.07)';
      g+=`<rect x="${26+w*(cell+gap)}" y="${18+d*(cell+gap)}" width="${cell}" height="${cell}" rx="3" fill="${col}"><title>${dkey(dt)}：${active?'有訓練紀錄':'休息日'}</title></rect>`;
      if(d===0&&dt.getMonth()!==lastM){lastM=dt.getMonth();g+=`<text x="${26+w*(cell+gap)}" y="11" font-size="11" fill="#93aeb3">${dt.getMonth()+1} 月</text>`}
    }
  }
  [['一',1],['三',3],['五',5]].forEach(([t,r])=>{g+=`<text x="0" y="${18+r*(cell+gap)+12}" font-size="11" fill="#93aeb3">${t}</text>`});
  const W=26+weeks*(cell+gap),H=18+7*(cell+gap);
  $('#stHeat').innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="最近 16 週的運動日曆，標記每日是否有訓練">${g}</svg><div class="small mute" style="margin-top:6px">青色代表當天有訓練紀錄。</div>`;
}

/* ================= 成就頁與分享圖 ================= */
function medal(g,tier,size=56){
  const c=TIERC[tier],on=tier>0;
  return `<svg width="${size}" height="${size}" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="24" fill="${on?c:'none'}" stroke="${c}" stroke-width="2.5" ${on?'':'stroke-dasharray="5 5"'}/><circle cx="28" cy="28" r="19" fill="none" stroke="${on?'rgba(10,26,32,.3)':'none'}" stroke-width="1.5"/><text x="28" y="36" text-anchor="middle" font-size="24" font-weight="800" fill="${on?'#0a1a20':'#93aeb3'}">${g}</text></svg>`;
}
function renderAch(){
  let got=0;const total=ACH.length*3;
  $('#achGrid').innerHTML=ACH.map(a=>{
    const {v,tier,next}=achState(a);got+=tier;const pct=next?Math.min(100,v/next*100):100;
    return `<div class="ach ${tier?'':'locked'}">${medal(a.g,tier)}<div class="grow"><b>${a.n}${tier?`　<span class="tag t${tier}">${TIERN[tier]}</span>`:''}</b><span class="d">${a.d}</span><div class="bar"><i style="width:${pct}%"></i></div><span class="d">${next?`${v} / ${next} ${a.u}，下一級：${TIERN[tier+1]}`:`已達最高等級（${v} ${a.u}）`}</span></div></div>`;
  }).join('');
  $('#achCount').textContent=`${got} / ${total} 個等級`;
}
let shareBlob=null;
async function makeShare(){
  try{await document.fonts.ready}catch(e){}
  const W=900,H=1200,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  const F='"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
  const gr=x.createLinearGradient(0,0,0,H);gr.addColorStop(0,'#0f2c35');gr.addColorStop(1,'#0a1a20');x.fillStyle=gr;x.fillRect(0,0,W,H);
  x.strokeStyle='rgba(255,255,255,.045)';x.lineWidth=2;for(let i=0;i<W;i+=120){x.beginPath();x.moveTo(i,0);x.lineTo(i,H);x.stroke()}
  x.fillStyle='#eaf4f1';x.font=`800 80px ${F}`;x.fillText('Lin AI',60,140);
  x.fillStyle='#93aeb3';x.font=`500 32px ${F}`;const d=new Date();x.fillText(`健身成就卡　${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`,60,196);
  const st=streaks(),stats=[[Number(S.exs[S.statsEx])||0,`${S.statsEx}累計`],[st.cur,'連續天數'],[level(),'遊戲等級'],[Math.round(kcalTotal()),'消耗大卡']];
  stats.forEach(([v,l],i)=>{const bx=60+i*210;x.fillStyle='rgba(255,255,255,.06)';x.beginPath();rrect(x,bx,250,195,150,20);x.fill();
    x.fillStyle='#ffd23f';x.font=`800 60px ${F}`;x.textAlign='center';x.fillText(String(v),bx+97,332);x.fillStyle='#93aeb3';x.font=`500 26px ${F}`;x.fillText(l,bx+97,378);x.textAlign='left'});
  x.fillStyle='#eaf4f1';x.font=`800 40px ${F}`;x.fillText('我的徽章',60,490);
  const list=ACH.map(a=>({a,...achState(a)})).sort((p,q)=>q.tier-p.tier);
  list.slice(0,12).forEach((o,i)=>{
    const col=i%4,row=Math.floor(i/4),cx=60+col*210+97,cy=590+row*215;
    x.beginPath();x.arc(cx,cy,64,0,7);x.fillStyle=o.tier?TIERC[o.tier]:'rgba(255,255,255,.05)';x.fill();
    if(!o.tier){x.setLineDash([8,8]);x.strokeStyle='#93aeb3';x.lineWidth=3;x.stroke();x.setLineDash([])}
    x.fillStyle=o.tier?'#0a1a20':'#93aeb3';x.font=`800 58px ${F}`;x.textAlign='center';x.fillText(o.a.g,cx,cy+20);
    x.fillStyle='#eaf4f1';x.font=`700 26px ${F}`;x.fillText(o.a.n,cx,cy+104);
    x.fillStyle=o.tier?TIERC[o.tier]:'#93aeb3';x.font=`600 22px ${F}`;x.fillText(o.tier?TIERN[o.tier]+'級':'未解鎖',cx,cy+134);x.textAlign='left';
  });
  x.fillStyle='#93aeb3';x.font=`500 28px ${F}`;x.textAlign='center';x.fillText('每天進步一點點',W/2,H-50);x.textAlign='left';
  return new Promise(r=>c.toBlob(r,'image/png'));
}
$('#achShare').onclick=async()=>{
  const btn=$('#achShare');btn.disabled=true;
  try{
    shareBlob=await makeShare();
    if(!shareBlob)throw new Error('產生圖片失敗');
    const url=URL.createObjectURL(shareBlob);$('#shareImg').src=url;$('#shareDl').href=url;$('#shareBox').hidden=false;
    const f=new File([shareBlob],'lin-ai-achievements.png',{type:'image/png'});
    $('#shareNative').hidden=!(navigator.canShare&&navigator.canShare({files:[f]}));
    $('#shareNative').onclick=()=>navigator.share({files:[f],title:'Lin AI 成就卡'}).catch(()=>{});
  }catch(e){toast('產生分享圖失敗：'+e.message)}
  btn.disabled=false;
};

/* ================= 體重紀錄 ================= */
function renderWeights(){
  const ents=Object.entries(S.weights).sort((a,b)=>a[0]<b[0]?-1:1).slice(-30);
  if(!ents.length){$('#wtChart').innerHTML='';$('#wtTxt').textContent='還沒有紀錄。輸入今天的體重，按「記錄」。';$('#wtList').innerHTML='';return}
  const vals=ents.map(e=>e[1]),mn=Math.min(...vals)-1,mx=Math.max(...vals)+1;
  const W=700,H=220,L=40,R=14,T=16,B=30,sx=i=>L+(ents.length===1?(W-L-R)/2:i*(W-L-R)/(ents.length-1)),sy=v=>T+(H-T-B)*(1-(v-mn)/(mx-mn));
  let g='';
  for(const f of [0,.5,1]){const v=mn+(mx-mn)*f,y=sy(v);g+=`<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.1)"/><text x="${L-6}" y="${y+4}" text-anchor="end" font-size="11" fill="#93aeb3">${v.toFixed(1)}</text>`}
  g+=`<polyline fill="none" stroke="#3dd6d0" stroke-width="3" stroke-linejoin="round" points="${ents.map((e,i)=>sx(i)+','+sy(e[1])).join(' ')}"/>`;
  ents.forEach((e,i)=>{g+=`<circle cx="${sx(i)}" cy="${sy(e[1])}" r="4.5" fill="#ffd23f"><title>${e[0]}：${e[1]} kg</title></circle>`;
    if(i===0||i===ents.length-1||ents.length<=8)g+=`<text x="${sx(i)}" y="${H-10}" text-anchor="middle" font-size="11" fill="#93aeb3">${e[0].slice(5).replace('-','/')}</text>`});
  $('#wtChart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="最近的體重變化折線圖">${g}</svg>`;
  const first=vals[0],last=vals[vals.length-1],diff=last-first;
  $('#wtTxt').textContent=`最新 ${last} kg`+(ents.length>1?`，比第一筆${diff>0?'增加':'減少'} ${Math.abs(diff).toFixed(1)} kg，期間最低 ${Math.min(...vals)} kg`:'');
  $('#wtList').innerHTML=ents.slice(-5).reverse().map(e=>`<span class="chip2">${e[0].slice(5).replace('-','/')}　${e[1]} kg<button class="x" type="button" data-k="${e[0]}" aria-label="刪除 ${e[0]} 的紀錄">×</button></span>`).join('');
  $$('#wtList .x').forEach(b=>b.onclick=()=>{delete S.weights[b.dataset.k];save();renderWeights()});
}
$('#wtAdd').onclick=()=>{
  const v=Math.round(+$('#wtIn').value*10)/10;
  if(!(v>=30&&v<=200)){toast('請輸入 30 到 200 之間的體重');return}
  S.weights[dkey(new Date())]=v;$('#bW').value=v;calc(true);$('#wtIn').value='';save();renderWeights();renderStats();toast(`已記錄體重 ${v} kg`);
};

