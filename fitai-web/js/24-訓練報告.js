'use strict';

const RP={mode:'week',off:0,model:null,img:null,opener:null,title:''};
const rpN=v=>Number(v)||0;
const rpWD=['日','一','二','三','四','五','六'];
const rpMD=d=>`${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}（${rpWD[d.getDay()]}）`;
const rpShort=k=>{const [,m,d]=k.split('-');return `${+m}/${+d}`};
const rpFromN=n=>{const d=new Date(n*864e5);return new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())};
const rpTrained=()=>Object.keys(S.days).filter(k=>rpN(S.days[k])>0).sort();
const rpDayReps=k=>Object.values(S.dayEx[k]||{}).reduce((a,n)=>a+rpN(n),0);
const rpDiff=(c,p,unit='')=>c>p?`<span class="rpt-up">▲${c-p}${unit}</span>`:c<p?`<span class="rpt-down">▼${p-c}${unit}</span>`:'<span class="rpt-flat">持平</span>';
const rpKm=m=>(rpN(m)/1000).toFixed(2);

function rpStreakAt(endKey){
  const set=new Set(rpTrained().map(dayN));let n=dayN(endKey),c=0;
  if(!set.has(n))n--;
  while(set.has(n)){c++;n--}
  return c;
}

function rpWeekDates(off){return weekDates().map(d=>{const x=new Date(d);x.setDate(x.getDate()+off*7);return x})}

function rpWeekStats(off){
  const ds=rpWeekDates(off),ks=ds.map(dkey),today=dkey(new Date()),end=ks[6]<today?ks[6]:today;
  const startMs=ds[0].getTime(),endD=new Date(ds[6]);endD.setDate(endD.getDate()+1);const endMs=endD.getTime();
  const exMap={};let ok=0,bad=0;
  for(const k of ks){for(const [e,n] of Object.entries(S.dayEx[k]||{}))exMap[e]=(exMap[e]||0)+rpN(n);const f=S.dayForm[k];if(f){ok+=rpN(f.ok);bad+=rpN(f.bad)}}
  const runs=(S.runs||[]).filter(r=>ks.includes(r.d));
  return {ds,ks,today,startMs,endMs,
    days:ks.filter(k=>rpN(S.days[k])>0).length,
    reps:ks.reduce((a,k)=>a+rpN(S.days[k]),0),
    secs:ks.reduce((a,k)=>a+rpN(S.workDays[k]),0),
    kcal:ks.filter(k=>k<=today).reduce((a,k)=>a+kcalOn(k),0),
    streak:ks[0]>today?0:rpStreakAt(end),
    perDay:ks.map(rpDayReps),exMap,ok,bad,runs};
}

function rpRunRecords(runs){
  const all=(S.runs||[]).slice().sort((a,b)=>a.d.localeCompare(b.d)||a.t-b.t),out=[];
  for(const r of runs){
    const before=all.filter(x=>x!==r&&(x.d<r.d||(x.d===r.d&&x.t<r.t)));
    if(!before.length)out.push({k:r.d,t:`第一次跑步紀錄：${rpKm(r.m)} 公里`});
    else if(rpN(r.m)>Math.max(...before.map(x=>rpN(x.m))))out.push({k:r.d,t:`跑步最長距離：${rpKm(r.m)} 公里`});
  }
  return out;
}

function rpBars(items,aria,showVals){
  const mx=Math.max(10,...items.map(i=>i.v)),top=mx<=20?20:mx<=50?50:Math.ceil(mx/50)*50;
  const W=700,H=250,L=34,R=6,T=items.some(i=>i.sub)?40:22,B=34,bw=(W-L-R)/items.length,ch=H-T-B;let g='';
  for(const f of [0,.5,1]){const y=T+ch*(1-f);g+=`<line class="rpt-grid" x1="${L}" x2="${W-R}" y1="${y}" y2="${y}"/><text class="rpt-axis" x="${L-6}" y="${y+4}" text-anchor="end" font-size="11">${Math.round(top*f)}</text>`}
  items.forEach((it,i)=>{
    const v=it.v,h=ch*v/top,bx=L+i*bw+bw*.18,bww=bw*.64,hh=Math.max(h,v?2:0);
    g+=`<rect class="rpt-barv${it.now?' now':''}" x="${bx}" y="${T+ch-hh}" width="${bww}" height="${hh}" rx="${Math.min(6,bww/2)}"/>`;
    if(showVals&&v)g+=`<text class="rpt-val" x="${bx+bww/2}" y="${T+ch-h-6}" text-anchor="middle" font-size="12" font-weight="700">${v}</text>`;
    if(it.sub)g+=`<text class="rpt-axis" x="${bx+bww/2}" y="${T+ch-h-(showVals&&v?20:6)}" text-anchor="middle" font-size="10">${it.sub}</text>`;
    g+=`<text class="rpt-axis" x="${bx+bww/2}" y="${H-12}" text-anchor="middle" font-size="12">${it.label}</text>`;
  });
  return `<svg class="rpt-svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${aria}">${g}</svg>`;
}

function rpRank(entries,limit){
  const tot=entries.reduce((a,[,n])=>a+n,0)||1,mx=entries.length?entries[0][1]:1;
  return `<div class="rpt-rank">${entries.slice(0,limit).map(([e,n],i)=>`<div class="rpt-rank-row"><span class="rpt-rank-i">${i+1}</span><span class="rpt-rank-n">${esc(e)}</span><span class="rpt-rank-bar"><i style="width:${Math.max(3,n/mx*100)}%"></i></span><b>${n}</b><span class="rpt-rank-p">${Math.round(n/tot*100)}%</span></div>`).join('')}</div>`;
}

const rpKpi=(v,l,d)=>`<div class="rpt-kpi"><b>${v}</b><span>${l}</span>${d?`<small>${d}</small>`:''}</div>`;
const rpSec=(t,body,extra='')=>`<section class="card rpt-sec ${extra}"><h3>${t}</h3>${body}</section>`;
const rpEmpty=(title,txt)=>`<div class="rpt-empty"><div class="rpt-empty-ic" aria-hidden="true">🏋️</div><h3>${title}</h3><p class="mute">${txt}</p><button class="btn" type="button" data-rpt-go>前往訓練</button></div>`;
const rpRate=(ok,bad)=>ok+bad?Math.round(ok/(ok+bad)*100):null;

function rpWeekSummary(w,p,off){
  if(!w.days)return `這週有 ${Math.round(w.secs/60)} 分鐘的訓練時間，下次開鏡頭計數，把次數也記下來吧。`;
  const parts=[],lg=streaks().longest,cr=rpRate(w.ok,w.bad),pr=rpRate(p.ok,p.bad);
  if(off===0&&w.streak>=3&&w.streak>=lg)parts.push(`連續運動 ${w.streak} 天，追平或刷新了你的最長紀錄，太強了！`);
  else if(w.days>p.days)parts.push(`這週練了 ${w.days} 天，比上週多 ${w.days-p.days} 天，進步看得見！`);
  else if(p.reps>0&&w.reps>p.reps)parts.push(`這週總共 ${w.reps} 下，比上週多了 ${w.reps-p.reps} 下，繼續保持！`);
  else if(w.days<p.days)parts.push(`這週練了 ${w.days} 天，比上週少一點，下週再把節奏找回來。`);
  else parts.push(`這週練了 ${w.days} 天、共 ${w.reps} 下，穩穩累積就是最好的進步。`);
  if(cr!==null&&pr!==null&&cr>pr)parts.push(`姿勢達標率從 ${pr}% 提升到 ${cr}%。`);
  return parts.join('');
}

function rpWeekModel(off){
  const w=rpWeekStats(off),p=rpWeekStats(off-1),name=(S.me.name||'').trim();
  const title=`${name?name+'的':'我的'}${off===0?'本週':off===-1?'上週':'每週'}訓練報告`,range=`${rpMD(w.ds[0])} – ${rpMD(w.ds[6])}`;
  const has=w.reps>0||w.secs>0||w.runs.length>0;
  const m={kind:'week',title,range,has,fileDate:dkey(w.ds[0])};
  const head=`<header class="rpt-head">${S.me.avatar?avatarHTML(S.me.avatar,name,S.me.code||S.me.id,'lg'):''}<div><h2 id="rptTitle">${esc(title)}</h2><p class="mute">${range}</p></div></header>`;
  if(!has){m.html=head+rpEmpty(off===0?'這週還沒有訓練':'這一週沒有訓練紀錄',off===0?'開啟鏡頭做第一組吧！':'換一週看看，或是開始今天的訓練。');return m}
  const min=Math.round(w.secs/60),pmin=Math.round(p.secs/60),kc=Math.round(w.kcal),pkc=Math.round(p.kcal);
  m.summary=rpWeekSummary(w,p,off);
  m.kpis=[[`${w.days}/7`,'訓練天數'],[w.reps,'總次數'],[min,'訓練時間（分）'],[kc,'消耗大卡']];
  m.bars=w.ds.map((d,i)=>({label:'週'+rpWD[d.getDay()],v:w.perDay[i],now:w.ks[i]===w.today}));
  const exs=Object.entries(w.exMap).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]);
  m.top=exs.slice(0,3);
  let h=head+`<p class="rpt-sum">${esc(m.summary)}</p>`;
  h+=`<section class="rpt-kpis">${rpKpi(`${w.days}<small>/7</small>`,'訓練天數',rpDiff(w.days,p.days,' 天'))}${rpKpi(w.reps,'總次數',rpDiff(w.reps,p.reps))}${rpKpi(min,'訓練時間（分）',rpDiff(min,pmin))}${rpKpi(kc,'消耗大卡',rpDiff(kc,pkc))}${rpKpi(w.streak,'目前連續天數',rpDiff(w.streak,p.streak,' 天'))}</section>`;
  h+=rpSec('每日次數',rpBars(m.bars,`${range} 每日次數長條圖，青色是今天`,true)+'<p class="small mute rpt-note">比較對象是上一週；青色是今天。</p>');
  if(exs.length)h+=rpSec('動作排行',rpRank(exs,8));
  const cr=rpRate(w.ok,w.bad),pr=rpRate(p.ok,p.bad);
  if(cr!==null)h+=rpSec('姿勢達標率',`<div class="rpt-rate"><b>${cr}%</b><div class="grow"><div class="bar"><i style="width:${cr}%"></i></div><p class="small mute">標準 ${w.ok} 下、需要調整 ${w.bad} 下${pr!==null?`，上週 ${pr}%（${rpDiff(cr,pr,'%')}）`:''}</p></div></div>`);
  const recs=Object.entries(S.pr).filter(([,r])=>rpN(r.t)>=w.startMs&&rpN(r.t)<w.endMs).sort((a,b)=>a[1].t-b[1].t).map(([e,r])=>({k:dkey(new Date(r.t)),t:`${esc(e)} 單組 ${r.n} 下`})).concat(rpRunRecords(w.runs));
  if(recs.length)h+=rpSec('本週新紀錄',`<ul class="rpt-list">${recs.map(r=>`<li><span class="rpt-date">${rpShort(r.k)}</span>${r.t}</li>`).join('')}</ul>`);
  const planned=w.ds.filter(d=>!isRest((S.sched[d.getDay()]||'').trim())).map(dkey);
  if(planned.length){const done=planned.filter(k=>rpN(S.days[k])>0).length,future=planned.filter(k=>k>w.today).length;
    h+=rpSec('課表完成',`<p class="rpt-big">排了 ${planned.length} 天，完成 ${done} 天</p>${future?`<p class="small mute">還有 ${future} 天還沒到。</p>`:''}`)}
  const life=[];
  if(w.ks.some(k=>rpN(S.water[k])>0))life.push(['💧 喝水達標',`${w.ks.filter(k=>rpN(S.water[k])>=S.waterGoal).length} 天`,`目標 ${S.waterGoal} ml`]);
  const fd=w.ks.filter(k=>(S.food[k]||[]).length);
  if(fd.length){const tot=fd.reduce((a,k)=>a+S.food[k].reduce((s,f)=>s+rpN(f.k),0),0);life.push(['🍱 飲食紀錄',`${fd.length} 天`,`平均每天 ${Math.round(tot/fd.length)} 大卡`])}
  const wt=w.ks.filter(k=>S.weights[k]!==undefined);
  if(wt.length){const a=rpN(S.weights[wt[0]]),b=rpN(S.weights[wt[wt.length-1]]),d=+(b-a).toFixed(1);
    life.push(['⚖️ 體重',`${b} kg`,wt.length>1?`${rpShort(wt[0])} ${a} kg → ${rpShort(wt[wt.length-1])}，${d>0?'增加 '+d:d<0?'減少 '+(-d):'持平'}${d?' kg':''}`:`本週記錄 1 次（${rpShort(wt[0])}）`])}
  if(life.length)h+=rpSec('生活紀錄',`<div class="rpt-life">${life.map(([a,b,c])=>`<div><span>${a}</span><b>${b}</b><small class="mute">${c}</small></div>`).join('')}</div>`);
  m.html=h;return m;
}

function rpFirstKey(){
  const ks=[...rpTrained(),...Object.keys(S.dayEx),...S.manual.map(x=>x.d),...Object.keys(S.weights)].filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k||'')).sort();
  return ks[0]||null;
}

function rpLongestRange(){
  const nums=rpTrained().map(dayN);let best=null,start=null,prev=null;
  for(const n of nums){if(prev===null||n!==prev+1)start=n;if(!best||n-start>best[1]-best[0])best=[start,n];prev=n}
  return best;
}

function rpTrend(firstKey){
  const today=new Date();today.setHours(0,0,0,0);const used=dayN(dkey(today))-dayN(firstKey)+1,keys=rpTrained();
  if(used<31){
    const mon=weekDates()[0],first=new Date(firstKey+'T00:00:00'),out=[];
    for(let off=0;;off--){const s=new Date(mon);s.setDate(s.getDate()+off*7);const e=new Date(s);e.setDate(e.getDate()+7);
      const ks=keys.filter(k=>k>=dkey(s)&&k<dkey(e));out.unshift({label:rpShort(dkey(s)),v:ks.reduce((a,k)=>a+rpN(S.days[k]),0),sub:ks.length+'天',now:off===0});
      if(e<=first||s<=first)break}
    return {unit:'週',items:out};
  }
  const fy=+firstKey.slice(0,4),fm=+firstKey.slice(5,7)-1,out=[];
  let y=today.getFullYear(),m=today.getMonth();
  for(let i=0;i<12;i++){const pre=`${y}-${String(m+1).padStart(2,'0')}`,ks=keys.filter(k=>k.startsWith(pre));
    out.unshift({label:(m+1)+'月',v:ks.reduce((a,k)=>a+rpN(S.days[k]),0),sub:ks.length+'天',now:i===0});
    if(y===fy&&m===fm)break;m--;if(m<0){m=11;y--}}
  return {unit:'月',items:out};
}

function rpWeightSvg(ents){
  const vals=ents.map(e=>e[1]),mn=Math.min(...vals)-1,mx=Math.max(...vals)+1;
  const W=700,H=220,L=40,R=14,T=16,B=30,sx=i=>L+i*(W-L-R)/(ents.length-1),sy=v=>T+(H-T-B)*(1-(v-mn)/(mx-mn));let g='';
  for(const f of [0,.5,1]){const v=mn+(mx-mn)*f,y=sy(v);g+=`<line class="rpt-grid" x1="${L}" x2="${W-R}" y1="${y}" y2="${y}"/><text class="rpt-axis" x="${L-6}" y="${y+4}" text-anchor="end" font-size="11">${v.toFixed(1)}</text>`}
  g+=`<polyline class="rpt-line" fill="none" stroke-width="3" stroke-linejoin="round" points="${ents.map((e,i)=>sx(i)+','+sy(e[1])).join(' ')}"/>`;
  ents.forEach((e,i)=>{g+=`<circle class="rpt-dot" cx="${sx(i)}" cy="${sy(e[1])}" r="4.5"/>`;if(i===0||i===ents.length-1||ents.length<=8)g+=`<text class="rpt-axis" x="${sx(i)}" y="${H-10}" text-anchor="middle" font-size="11">${rpShort(e[0])}</text>`});
  return `<svg class="rpt-svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="體重變化折線圖">${g}</svg>`;
}

function rpAllModel(){
  const first=rpFirstKey(),today=dkey(new Date()),trained=rpTrained();
  const m={kind:'all',title:'我的訓練總報告',fileDate:today};
  const has=rpN(S.reps)>0||rpN(S.workSecs)>0||trained.length>0;
  m.range=first?`${first.replace(/-/g,'/')} – ${today.replace(/-/g,'/')}`:today.replace(/-/g,'/');
  m.has=has;
  const used=first?dayN(today)-dayN(first)+1:0;
  const head=`<header class="rpt-head">${S.me.avatar?avatarHTML(S.me.avatar,S.me.name,S.me.code||S.me.id,'lg'):''}<div><h2 id="rptTitle">${m.title}</h2><p class="mute">${m.range}${used?`　已使用 ${used} 天`:''}</p></div></header>`;
  if(!has){m.html=head+rpEmpty('還沒有任何訓練紀錄','開啟鏡頭做第一組，這裡就會開始累積你的成果。');return m}
  const st=streaks(),min=Math.round(rpN(S.workSecs)/60),kc=Math.round(kcalTotal());
  m.kpis=[[trained.length,'訓練天數'],[rpN(S.reps),'總次數'],[kc,'消耗大卡'],[st.longest,'最長連續（天）']];
  m.summary=`從 ${rpShort(first)} 到今天，累積 ${trained.length} 天、${rpN(S.reps)} 下訓練，最長連續 ${st.longest} 天，目前等級 ${level()}。`;
  const tr=rpTrend(first);m.bars=tr.items;
  const exs=Object.entries(S.exs).map(([e,n])=>[e,rpN(n)]).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]);m.top=exs.slice(0,3);
  let h=head+`<p class="rpt-sum">${esc(m.summary)}</p>`;
  h+=`<section class="rpt-kpis">${rpKpi(trained.length,'總訓練天數')}${rpKpi(rpN(S.reps),'總次數')}${rpKpi(min,'總訓練時間（分）')}${rpKpi(kc,'總消耗大卡')}${rpKpi(st.longest,'最長連續天數')}${rpKpi(level(),'等級')}</section>`;
  h+=rpSec(tr.unit==='月'?'每月趨勢':'每週趨勢',rpBars(tr.items,`每${tr.unit}訓練次數長條圖，上方小字是訓練天數`,true)+`<p class="small mute rpt-note">長條是每${tr.unit}總次數，上方小字是訓練天數。</p>`);
  if(exs.length)h+=rpSec('各動作累計',rpRank(exs,10));
  const prs=Object.entries(S.pr).sort((a,b)=>b[1].n-a[1].n),holds=Object.entries(S.holdBest).filter(([,v])=>rpN(v)>0).sort((a,b)=>b[1]-a[1]);
  if(prs.length||holds.length)h+=rpSec('個人紀錄',(prs.length?`<table class="rpt-table"><tr><th>動作</th><th>單組最多</th><th>日期</th></tr>${prs.map(([e,r])=>`<tr><td>${esc(e)}</td><td><b>${r.n} 下</b></td><td>${rpShort(dkey(new Date(r.t)))}</td></tr>`).join('')}</table>`:'')+(holds.length?`<table class="rpt-table"><tr><th>撐住項目</th><th colspan="2">最久</th></tr>${holds.map(([e,v])=>`<tr><td>${esc(e)}</td><td colspan="2"><b>${v} 秒</b></td></tr>`).join('')}</table>`:''));
  const ach=ACH.map(a=>({a,...achState(a)})),got=ach.reduce((s,o)=>s+o.tier,0),unl=ach.filter(o=>o.tier>0);
  h+=rpSec('成就',`<p class="small mute">已解鎖 ${got} / ${ACH.length*3} 個等級</p>${unl.length?`<div class="rpt-medals">${unl.map(o=>`<div>${medal(o.a.g,o.tier,44)}<b>${o.a.n}</b><small style="color:${TIERC[o.tier]}">${TIERN[o.tier]}級</small></div>`).join('')}</div>`:'<p class="small mute">還沒有解鎖的徽章，繼續加油！</p>'}`);
  const wts=Object.entries(S.weights).map(([k,v])=>[k,rpN(v)]).sort((a,b)=>a[0]<b[0]?-1:1);
  if(wts.length>=2){const vals=wts.map(e=>e[1]);h+=rpSec('體重',rpWeightSvg(wts)+`<div class="rpt-life"><div><span>起始</span><b>${vals[0]} kg</b><small class="mute">${rpShort(wts[0][0])}</small></div><div><span>目前</span><b>${vals[vals.length-1]} kg</b><small class="mute">${rpShort(wts[wts.length-1][0])}</small></div><div><span>最低</span><b>${Math.min(...vals)} kg</b><small class="mute">${rpShort(wts[vals.indexOf(Math.min(...vals))][0])}</small></div></div>`)}
  const ms=[];
  if(trained.length){ms.push([trained[0],'第一次訓練']);const best=trained.reduce((a,k)=>rpN(S.days[k])>rpN(S.days[a])?k:a,trained[0]);ms.push([best,`單日最多次數：${rpN(S.days[best])} 下`])}
  const lr=rpLongestRange();if(lr&&lr[1]>lr[0])ms.push([dkey(rpFromN(lr[1])),`最長連續 ${lr[1]-lr[0]+1} 天（${rpShort(dkey(rpFromN(lr[0])))} – ${rpShort(dkey(rpFromN(lr[1])))}）`]);
  ms.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  if(ms.length)h+=rpSec('里程碑',`<ul class="rpt-list">${ms.map(([k,t])=>`<li><span class="rpt-date">${k.replace(/-/g,'/')}</span>${t}</li>`).join('')}</ul>`);
  m.html=h;return m;
}

function rpWrap(x,text,maxW){
  const lines=[];let cur='';
  for(const ch of text){if(x.measureText(cur+ch).width>maxW&&cur){lines.push(cur);cur=ch}else cur+=ch}
  if(cur)lines.push(cur);return lines;
}

async function rpImage(m){
  try{await document.fonts.ready}catch(e){}
  const W=1080,H=1350,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  const F='"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
  const gr=x.createLinearGradient(0,0,0,H);gr.addColorStop(0,'#0f2c35');gr.addColorStop(1,'#0a1a20');x.fillStyle=gr;x.fillRect(0,0,W,H);
  x.strokeStyle='rgba(255,255,255,.045)';x.lineWidth=2;for(let i=0;i<W;i+=120){x.beginPath();x.moveTo(i,0);x.lineTo(i,H);x.stroke()}
  x.fillStyle='#eaf4f1';x.font=`800 84px ${F}`;x.fillText('Lin AI',70,150);
  x.fillStyle='#ffd23f';x.font=`800 44px ${F}`;x.fillText(m.kind==='week'?'每週訓練報告':'訓練總報告',70,224);
  x.fillStyle='#93aeb3';x.font=`500 32px ${F}`;x.fillText(m.range,70,276);
  m.kpis.forEach(([v,l],i)=>{const bx=70+i*240;x.fillStyle='rgba(255,255,255,.06)';x.beginPath();rrect(x,bx,320,220,170,22);x.fill();
    x.textAlign='center';x.fillStyle='#ffd23f';x.font=`800 ${String(v).length>5?48:60}px ${F}`;x.fillText(String(v),bx+110,410);x.fillStyle='#93aeb3';x.font=`500 26px ${F}`;x.fillText(l,bx+110,458);x.textAlign='left'});
  x.fillStyle='#eaf4f1';x.font=`800 38px ${F}`;x.fillText(m.kind==='week'?'每日次數':'每'+(m.bars.length&&/月/.test(m.bars[0].label)?'月':'週')+'次數',70,566);
  const bars=m.bars,mx=Math.max(1,...bars.map(b=>b.v)),cx=70,cy=640,cw=940,chh=220,bw=cw/bars.length;
  x.strokeStyle='rgba(255,255,255,.12)';x.lineWidth=2;x.beginPath();x.moveTo(cx,cy+chh);x.lineTo(cx+cw,cy+chh);x.stroke();
  bars.forEach((b,i)=>{const h=b.v?Math.max(6,chh*b.v/mx):0,bx=cx+i*bw+bw*.18,bww=bw*.64;x.fillStyle=b.now?'#3dd6d0':'#ffd23f';x.beginPath();rrect(x,bx,cy+chh-h,bww,h,Math.min(10,bww/2));x.fill();
    x.textAlign='center';x.fillStyle='#93aeb3';x.font=`500 ${bars.length>8?20:26}px ${F}`;x.fillText(b.label,bx+bww/2,cy+chh+38);if(b.v){x.fillStyle='#eaf4f1';x.font=`700 ${bars.length>8?18:24}px ${F}`;x.fillText(String(b.v),bx+bww/2,cy+chh-h-10)}x.textAlign='left'});
  x.fillStyle='#eaf4f1';x.font=`800 38px ${F}`;x.fillText('前 3 名動作',70,960);
  (m.top.length?m.top:[['還沒有動作紀錄',0]]).forEach(([e,n],i)=>{const y=1016+i*58;x.fillStyle='#ffd23f';x.font=`800 34px ${F}`;x.fillText(String(i+1),70,y);x.fillStyle='#eaf4f1';x.font=`600 34px ${F}`;x.fillText(e,120,y);if(n){x.textAlign='right';x.fillStyle='#ffd23f';x.fillText(n+' 下',1010,y);x.textAlign='left'}});
  x.fillStyle='rgba(61,214,208,.12)';x.beginPath();rrect(x,70,1180,940,120,22);x.fill();
  x.fillStyle='#eaf4f1';x.font=`600 30px ${F}`;rpWrap(x,m.summary||'',880).slice(0,2).forEach((l,i)=>x.fillText(l,100,1230+i*44));
  return new Promise(r=>c.toBlob(r,'image/png'));
}

function rpRender(){
  const m=RP.mode==='week'?rpWeekModel(RP.off):rpAllModel();RP.model=m;
  $$('#rptSeg button').forEach(b=>b.classList.toggle('on',b.dataset.m===RP.mode));
  $('#rptNav').hidden=RP.mode!=='week';
  const first=rpFirstKey(),ws=dkey(rpWeekDates(RP.off)[0]);
  $('#rptNext').disabled=RP.off>=0;$('#rptPrev').disabled=!first||first>=ws;
  $('#rptBody').innerHTML=m.html;$('#rptBody').scrollTop=0;$('#rpt').scrollTop=0;
  $('#rptPdf').disabled=$('#rptShare').disabled=!m.has;
  $('#rptShareBox').hidden=true;
  RP.img=m.has?rpImage(m).catch(()=>null):null;
  $$('#rptBody [data-rpt-go]').forEach(b=>b.onclick=()=>{rptClose();$('.tab[data-tab=cam]').click()});
}

function rptOpen(mode){
  RP.mode=mode;RP.off=0;RP.opener=document.activeElement;
  $('#rpt').hidden=false;document.body.classList.add('rpt-open');rpRender();$('#rptX').focus();
}
function rptClose(){
  if($('#rpt').hidden)return;
  $('#rpt').hidden=true;document.body.classList.remove('rpt-open','rpt-printing');
  if(RP.title){document.title=RP.title;RP.title=''}
  const u=$('#rptShareImg').src;if(u&&u.startsWith('blob:'))URL.revokeObjectURL(u);$('#rptShareImg').removeAttribute('src');
  if(RP.opener&&RP.opener.focus)RP.opener.focus();
}

$('#rptWeekBtn').onclick=()=>rptOpen('week');
$('#rptAllBtn').onclick=()=>rptOpen('all');
seg($('#rptSeg'),b=>{RP.mode=b.dataset.m;RP.off=0;rpRender()});
$('#rptPrev').onclick=()=>{RP.off--;rpRender()};
$('#rptNext').onclick=()=>{if(RP.off<0){RP.off++;rpRender()}};
$('#rptX').onclick=$('#rptClose').onclick=rptClose;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#rpt').hidden){e.preventDefault();rptClose()}});
$('#rptPdf').onclick=()=>{
  const m=RP.model;if(!m||!m.has)return;
  if(!RP.title)RP.title=document.title;
  document.title=`Lin-AI-${m.kind==='week'?'本週訓練報告':'訓練總報告'}-${m.fileDate}`;
  document.body.classList.add('rpt-printing');
  const done=()=>{removeEventListener('afterprint',done);document.body.classList.remove('rpt-printing');if(RP.title){document.title=RP.title;RP.title=''}};
  addEventListener('afterprint',done);
  window.print();
};
$('#rptShare').onclick=async()=>{
  const m=RP.model;if(!m||!m.has)return;
  const btn=$('#rptShare');btn.disabled=true;
  try{
    const blob=await (RP.img||rpImage(m));if(!blob)throw new Error('產生圖片失敗');
    const name=`lin-ai-${m.kind==='week'?'週報':'總報告'}-${m.fileDate}.png`,f=new File([blob],name,{type:'image/png'});
    if(navigator.canShare&&navigator.canShare({files:[f]})){
      try{await navigator.share({files:[f],title:m.title});btn.disabled=false;return}
      catch(e){if(e&&e.name==='AbortError'){btn.disabled=false;return}}
    }
    const old=$('#rptShareImg').src;if(old&&old.startsWith('blob:'))URL.revokeObjectURL(old);
    const url=URL.createObjectURL(blob);$('#rptShareImg').src=url;$('#rptShareDl').href=url;$('#rptShareDl').download=name;
    $('#rptShareBox').hidden=false;$('#rptShareBox').scrollIntoView({block:'nearest',behavior:'smooth'});
  }catch(e){toast('產生分享圖失敗：'+e.message)}
  btn.disabled=false;
};
$('#rptShareHide').onclick=()=>{$('#rptShareBox').hidden=true};
