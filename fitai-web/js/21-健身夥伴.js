/* ============================================================
   21-健身夥伴
   內容：左下角的健身夥伴（體型跟著身高體重變化）
   畫面：左下角夥伴按鈕與面板
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 左下角健身夥伴：體型照著帳號本人的身高體重畫 ================= */
const bmiOf=b=>b.w/((b.h/100)**2);
const healthyW=b=>{const m=(b.h/100)**2;return [18.5*m,24*m]};
function buddyGoalW(b){const [lo,hi]=healthyW(b),bmi=bmiOf(b);return bmi>24?hi:bmi<18.5?lo:b.w}
/* 參數化小人：高度跟身高成比例，胖瘦跟 BMI 成比例 */
function buddySVG(b,o={}){
  const bmi=b.w/((b.h/100)**2),f=Math.max(.72,Math.min(1.75,bmi/21.5)),hs=Math.max(.82,Math.min(1.12,b.h/172));
  const H=150*hs,top=170-H,head=15,cx=50,neck=top+head*2,legH=H*.42,torsoH=H-head*2-legH,hip=neck+torsoH;
  const tw=26*f,lw=8.5*Math.sqrt(f),aw=6.5*Math.sqrt(f),belly=Math.max(0,f-1.1)*16;
  const happy=o.mood!=='tired',ghost=o.ghost;
  const fill=c=>ghost?'rgba(61,214,208,.32)':c,st='';
  const skin=fill('#f5c9a0'),shirt=fill(b.sex==='女'?'#ff8fc7':'#3dd6d0'),pants=fill('#1d3a44'),shoe=fill('#ffd23f');
  return `<svg viewBox="0 0 100 175" class="bd-svg${ghost?' ghost':''}" aria-hidden="true">
    ${ghost?'':'<ellipse cx="50" cy="171" rx="'+(18+tw*.4)+'" ry="4" fill="rgba(0,0,0,.25)"/>'}
    <rect x="${cx-tw/2+2}" y="${hip-4}" width="${lw}" height="${legH}" rx="${lw/2}" fill="${pants}" ${st}/>
    <rect x="${cx+tw/2-2-lw}" y="${hip-4}" width="${lw}" height="${legH}" rx="${lw/2}" fill="${pants}" ${st}/>
    <rect x="${cx-tw/2-1}" y="${hip+legH-8}" width="${lw+4}" height="7" rx="3" fill="${shoe}" ${st}/>
    <rect x="${cx+tw/2-3-lw}" y="${hip+legH-8}" width="${lw+4}" height="7" rx="3" fill="${shoe}" ${st}/>
    <g class="bd-arm-l"><rect x="${cx-tw/2-aw-1}" y="${neck+4}" width="${aw}" height="${torsoH*.95}" rx="${aw/2}" fill="${skin}" ${st}/></g>
    <g class="bd-arm-r"><rect x="${cx+tw/2+1}" y="${neck+4}" width="${aw}" height="${torsoH*.95}" rx="${aw/2}" fill="${skin}" ${st}/></g>
    <path d="M${cx-tw/2} ${neck+6} q0 -6 8 -6 h${tw-16} q8 0 8 6 v${torsoH-4} q${belly/2} 0 0 ${2} h-${tw} q-${belly/2} 0 0 -${2}z" fill="${shirt}" ${st}/>
    ${belly&&!ghost?`<ellipse cx="${cx}" cy="${neck+torsoH*.62}" rx="${tw/2+belly*.35}" ry="${torsoH*.32}" fill="${shirt}"/>`:''}
    <circle cx="${cx}" cy="${top+head}" r="${head}" fill="${skin}" ${st}/>
    ${ghost?'':`<path d="M${cx-head} ${top+head-4} a${head} ${head} 0 0 1 ${head*2} 0 z" fill="#2a2320"/>
    <rect x="${cx-head}" y="${top+head-6}" width="${head*2}" height="4" rx="2" fill="#ffd23f"/>
    <circle cx="${cx-5}" cy="${top+head+2}" r="1.8" fill="#1a1a1a"/><circle cx="${cx+5}" cy="${top+head+2}" r="1.8" fill="#1a1a1a"/>
    <path d="M${cx-5} ${top+head+7} q5 ${happy?4:-2} 10 0" stroke="#1a1a1a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <circle cx="${cx-9}" cy="${top+head+6}" r="2.2" fill="#ff8f8f" opacity=".6"/><circle cx="${cx+9}" cy="${top+head+6}" r="2.2" fill="#ff8f8f" opacity=".6"/>`}
  </svg>`;
}
function buddyTip(){
  const b=S.body,today=Number(S.dayEx[dkey(new Date())]?.[S.statsEx])||0,kt=Math.round(kcalToday()),st=streaks(),hr=new Date().getHours(),ex=S.statsEx;
  if(!b.set)return '告訴我你的身高體重，我就會變成你的樣子，熱量也會算得更準！';
  const tips=[];
  if(today>=S.goal)tips.push(`今天的${ex}已達標，完成 ${today} 下，我們都超棒！`);
  else if(today>0)tips.push(`今天完成 ${today} 下${ex}，再 ${S.goal-today} 下就達標！`);
  else tips.push(hr<12?'早安！今天動一動，我陪你。':hr<18?'午後來幾組深蹲提提神吧！':'睡前來一點伸展或核心訓練？');
  if(kt>0)tips.push(`今天已燒掉約 ${kt} 大卡，差不多 ${Math.max(1,Math.round(kt/70))} 顆茶葉蛋的熱量 🥚`);
  if(st.cur>=2)tips.push(`連續 ${st.cur} 天了，別讓火焰熄滅 🔥`);
  const gw=buddyGoalW(b),diff=b.w-gw;
  if(Math.abs(diff)>=.5)tips.push(diff>0?`距離健康體重還有 ${diff.toFixed(1)} kg，一起慢慢來！`:`再增加 ${(-diff).toFixed(1)} kg 就進入健康範圍，記得吃夠蛋白質！`);
  else tips.push(`BMI ${bmiOf(b).toFixed(1)} 在健康範圍，維持下去！`);
  return tips[Math.floor(Math.random()*tips.length)];
}
var bdBubbleT=0;
function buddySay(msg,ms=6000){const el=$('#bdBubble');el.textContent=msg||buddyTip();el.hidden=false;clearTimeout(bdBubbleT);bdBubbleT=setTimeout(()=>{el.hidden=true},ms)}
function renderBuddy(){
  const b=S.body,today=Number(S.dayEx[dkey(new Date())]?.[S.statsEx])||0;
  $('#bdFab').innerHTML=buddySVG(b,{mood:today>=S.goal||today>0?'happy':'tired'});
  const p=$('#bdPanel');if(p.hidden)return;
  const bmi=bmiOf(b),[lo,hi]=healthyW(b),gw=buddyGoalW(b),cat=bmi<18.5?'過輕':bmi<24?'正常':bmi<27?'過重':'肥胖';
  const gb={...b,w:gw},same=Math.abs(gw-b.w)<.5;
  $('#bdFigs').innerHTML=`<figure>${buddySVG(b)}<figcaption>現在的你<br><b>${b.w} kg</b></figcaption></figure>`+
    (same?'':`<div class="bd-arrow">➜</div><figure>${buddySVG(gb,{ghost:true})}<figcaption>健康目標<br><b>${gw.toFixed(1)} kg</b></figcaption></figure>`);
  const pos=Math.max(0,Math.min(100,(bmi-15)/(35-15)*100));
  $('#bdInfo').innerHTML=`<div class="facts">
      <div class="fact"><b>${b.h}</b><span>身高 cm</span></div><div class="fact"><b>${b.w}</b><span>體重 kg</span></div>
      <div class="fact"><b>${bmi.toFixed(1)}</b><span>BMI（${cat}）</span></div><div class="fact"><b>${Math.round(kcalToday())}</b><span>今日大卡</span></div></div>
    <div class="bd-bmi"><i style="left:${pos}%"></i></div><div class="bd-bmi-l small mute"><span>過輕</span><span>正常 ${lo.toFixed(0)}–${hi.toFixed(0)} kg</span><span>過重</span><span>肥胖</span></div>
    <p class="small" style="margin:10px 0 0">${b.set?(same?'你在健康範圍內，我們保持這個體型！':`${gw<b.w?'減':'增'} ${Math.abs(b.w-gw).toFixed(1)} kg 就能到達健康範圍，我會一路陪你。`):'⚠ 還沒設定身高體重，現在先用 170 cm／65 kg 示範。'}</p>`;
}
$('#bdFab').onclick=()=>{const p=$('#bdPanel');p.hidden=!p.hidden;$('#bdFab').setAttribute('aria-expanded',String(!p.hidden));$('#bdBubble').hidden=true;renderBuddy()};
$('#bdClose').onclick=()=>{$('#bdPanel').hidden=true;$('#bdFab').setAttribute('aria-expanded','false')};
$('#bdEdit').onclick=()=>{$('#bdPanel').hidden=true;$('.tab[data-tab=body]').click();scrollTo({top:0,behavior:'smooth'});setTimeout(()=>$('#bH').focus(),300)};
$('#bdTalk').onclick=()=>buddySay();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#bdPanel').hidden)$('#bdClose').click()});
var bdLastReps=S.reps;
function buddyOnStats(){   // 每次數字更新時重畫夥伴；做完運動偶爾說句話
  renderBuddy();
  if(S.reps>bdLastReps){bdLastReps=S.reps;const move=S.lastMove;if(move&&move.n>0&&(move.n>=5||Math.random()<.3))buddySay(`${move.ex} +${move.n} 下！${buddyTip()}`,5000)}
}
setTimeout(()=>buddySay(),2500);
