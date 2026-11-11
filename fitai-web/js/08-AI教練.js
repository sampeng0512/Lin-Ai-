/* ============================================================
   08-AI教練
   內容：AI 教練：快速問題、送出問題給 WHO RAG 後端、顯示回答與來源、個人化課表
   畫面：「AI 教練」分頁
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= AI 教練 ================= */
const QUICK=['成年人每週需要多少分鐘中等強度有氧？','WHO 是否規定一週運動幾天？','高強度有氧每週建議多久？','每週五天各做30分鐘有氧可以嗎？','沒有運動習慣的人如何開始？'];
$('#quick').innerHTML=QUICK.map(q=>`<button class="btn ghost small">${q}</button>`).join('');
$$('#quick button').forEach(b=>b.onclick=()=>ask(b.textContent));
function sanitizeDisplayText(text, fallback='資料同步失敗，請稍後再試。'){
  const raw = String(text ?? '');
  if(!raw.trim())return fallback;
  const s = raw.replace(/\s+/g,' ').trim();
  const sqlLike = /(could not choose the best candidate function|best candidate function|public\.[A-Za-z0-9_]+\(|\bSELECT\b.*\bFROM\b|\bINSERT\b.*\bINTO\b|\bUPDATE\b.*\bSET\b|\bDELETE\b.*\bFROM\b|\bCREATE\b.*\bFUNCTION\b|SQL.*function|rpc\s*\(|postgresql|supabase.*function|function between:|\b[a-zA-Z_]+\s*\([^)]*\)[\s\S]*\b[a-zA-Z_]+\s*\([^)]*\))/i.test(s);
  const functionDump = /(\b[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)\s*;?\s*){2,}/.test(s);
  const longGarble = s.length > 220 && /[A-Za-z_]{3,}/.test(s) && /[();=,\[\]{}<>]/.test(s);
  const gibberish = /(?:\b(?:p_[A-Za-z0-9_]+|lin_[A-Za-z0-9_]+)\s*\([^)]*\)\s*\)|\b[A-Za-z0-9_]+\s*:\s*\b(?:true|false|null|undefined)\b)/.test(s) && /[()]/.test(s);
  if(sqlLike || functionDump || longGarble || gibberish) return fallback;
  return s;
}
function sanitizeAiReply(src){
  if(typeof src !== 'string') return '';
  const text = src.replace(/```[\s\S]*?```/g,' ').replace(/`[^`]+`/g,' ');
  const lines=[];
  for(const raw of text.split(/\n/)){
    const line=raw.trim();
    if(!line) continue;
    // 只刪掉明顯是 SQL 或後端錯誤訊息的行（區分大小寫），一般句子如「WHO (世界衛生組織)」要保留。
    // 回答在 md() 會先 esc() 才轉成 HTML，不會有 XSS，這裡不需要過濾一般英文。
    if(/could not choose the best candidate function|public\.[A-Za-z0-9_]+\(|\bSELECT\b.*\bFROM\b|\bINSERT INTO\b|\bUPDATE\b.*\bSET\b|\bDELETE FROM\b|\bCREATE (?:OR REPLACE )?FUNCTION\b/.test(line)) continue;
    lines.push(line);
  }
  const cleaned = lines.join('\n').trim();
  return cleaned || '我先整理這段內容，請重新提問。';
}
function md(src){
  const blocks=[];let t=esc(sanitizeAiReply(src)).replace(/```(?:\w*\n)?([\s\S]*?)```/g,(m,c)=>{blocks.push(c);return `\u0000${blocks.length-1}\u0000`});
  const inl=s=>s.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/`([^`]+)`/g,'<code>$1</code>');
  const out=[];let list=null,table=null;
  const flush=()=>{if(list){out.push(`<${list.t}>${list.i.join('')}</${list.t}>`);list=null}if(table){const rows=table.filter(r=>!/^\|?\s*:?-{2,}/.test(r));
    out.push('<table>'+rows.map((r,i)=>{const c=r.replace(/^\||\|$/g,'').split('|').map(x=>inl(x.trim()));return '<tr>'+c.map(x=>i?`<td>${x}</td>`:`<th>${x}</th>`).join('')+'</tr>'}).join('')+'</table>');table=null}};
  for(const line of t.split('\n')){
    let m;
    if(/^\s*\|/.test(line)){if(!table){flush();table=[]}table.push(line.trim());continue}
    if((m=line.match(/^\s*[-*]\s+(.*)/))){if(!list||list.t!=='ul'){flush();list={t:'ul',i:[]}}list.i.push(`<li>${inl(m[1])}</li>`);continue}
    if((m=line.match(/^\s*\d+[.)]\s+(.*)/))){if(!list||list.t!=='ol'){flush();list={t:'ol',i:[]}}list.i.push(`<li>${inl(m[1])}</li>`);continue}
    flush();
    if((m=line.match(/^#{1,4}\s+(.*)/)))out.push(`<h4>${inl(m[1])}</h4>`);
    else if(line.trim())out.push(`<p>${inl(line)}</p>`);
  }
  flush();return out.join('').replace(/\u0000(\d+)\u0000/g,(m,i)=>`<pre>${blocks[i]}</pre>`);
}
let asking=false;
function addMsg(role,html){const d=document.createElement('div');d.className='msgb '+(role==='user'?'me':'ai');d.innerHTML=html;$('#chat').appendChild(d);$('#chat').scrollTop=1e9;return d}
const API_BASE_URL='https://fitai-rag.onrender.com';
const RAG_API_URL=`${API_BASE_URL}/ask`;
const IS_LOCAL_API=/^http:\/\/(?:127\.0\.0\.1|localhost)\b/.test(API_BASE_URL);
const MAX_QUESTION_CHARS=500;      // 與後端 AskBody 的上限一致
const ASK_TIMEOUT_MS=70000;        // Render 免費方案閒置後第一次喚醒可能要將近一分鐘
const TEAM_TOKEN_KEY='lin_team_token';
// 組員密碼只存在這個分頁（sessionStorage），關掉分頁就要重新輸入
function getTeamToken(){
  let t='';try{t=sessionStorage.getItem(TEAM_TOKEN_KEY)||''}catch(e){}
  if(t)return t;
  t=(window.prompt('請輸入組員存取密碼')||'').trim();
  if(t){try{sessionStorage.setItem(TEAM_TOKEN_KEY,t)}catch(e){}}
  return t;
}
function forgetTeamToken(){try{sessionStorage.removeItem(TEAM_TOKEN_KEY)}catch(e){}}
async function ask(text){
  text=(text||'').trim();
  if(!text||asking)return;
  if(text.length>MAX_QUESTION_CHARS){toast(`問題太長，請精簡到 ${MAX_QUESTION_CHARS} 字以內`);return}
  const teamToken=getTeamToken();
  if(!teamToken)return;
  addMsg('user',esc(text));
  $('#chatIn').value='';
  $('#chatClear').hidden=false;
  asking=true;
  $('#chatSend').disabled=true;
  const wait=addMsg('ai','<span class="mute">正在查詢 WHO 知識庫…</span>');
  const ctrl=new AbortController();
  const abortT=setTimeout(()=>ctrl.abort(),ASK_TIMEOUT_MS);
  const slowT=setTimeout(()=>{wait.innerHTML='<span class="mute">後端喚醒中，第一次發問可能需要一分鐘，請稍候…</span>'},5000);
  try{
    let r;
    try{
      r=await fetch(RAG_API_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json','X-Team-Token':teamToken},
        body:JSON.stringify({question:text}),
        signal:ctrl.signal
      });
    }finally{clearTimeout(slowT)}
    let data=null;try{data=await r.json()}catch(e){}
    if(!r.ok){
      const err=new Error(typeof data?.detail==='string'?data.detail:('HTTP '+r.status));
      err.status=r.status;throw err;
    }
    const reply=typeof data?.answer==='string'?data.answer:'後端未傳回回答。';
    wait.innerHTML=md(reply);
    if(Array.isArray(data?.sources)&&data.sources.length){
      const refs=document.createElement('div');
      refs.className='small mute';
      refs.style.marginTop='10px';
      const heading=document.createElement('b');
      heading.textContent='檢索來源：';
      refs.appendChild(heading);
      const seen=new Set();
      for(const source of data.sources){
        const id=String(source.id||'');
        if(seen.has(id))continue;
        seen.add(id);
        const line=document.createElement('div');
        line.appendChild(document.createTextNode(id+' · '+String(source.title||'WHO 指南')+' '));
        if(typeof source.url==='string' && /^https:\/\//i.test(source.url)){
          const link=document.createElement('a');
          link.href=source.url;
          link.target='_blank';
          link.rel='noopener noreferrer';
          link.textContent='官方來源';
          link.style.color='var(--teal)';
          line.appendChild(link);
        }
        refs.appendChild(line);
      }
      wait.appendChild(refs);
    }
  }catch(e){
    const message=String(e.message||e);
    const hint=s=>'<br><span class="small mute">'+s+'</span>';
    if(e.status===401){
      // 密碼錯誤：清掉記住的密碼，把問題放回輸入框，下次送出會重新詢問
      forgetTeamToken();
      $('#chatIn').value=text;
      wait.innerHTML='組員存取密碼錯誤。'+hint('請再按一次送出，重新輸入密碼。');
    }else if(e.status===429){
      wait.innerHTML='發問太頻繁了。'+hint('請等一分鐘後再試。');
    }else if(e.status===422){
      wait.innerHTML='問題格式不正確。'+hint(`請輸入 1 到 ${MAX_QUESTION_CHARS} 字的問題。`);
    }else if(e.name==='AbortError'){
      $('#chatIn').value=text;
      wait.innerHTML='教練服務等太久沒有回應。'+hint('後端可能還在喚醒，請稍等一下再按送出。');
    }else if(e instanceof TypeError){
      wait.innerHTML=IS_LOCAL_API
        ? '無法連線到 RAG 後端：'+esc(message)+hint('請在專案根目錄的 PowerShell 執行 <code>.\\fitai-web\\backend\\start.ps1</code>，再開啟 http://127.0.0.1:8000/health 檢查狀態。')
        : '目前無法連線到教練服務。'+hint('請確認網路連線後再試一次。');
    }else{
      wait.innerHTML=IS_LOCAL_API
        ? '教練服務回應錯誤：'+esc(message)+hint('請確認 backend\\.env 的 OPENAI_API_KEY 設定，以及後端終端機的錯誤訊息。')
        : '教練服務暫時出了點問題：'+esc(message)+hint('請稍後再試。');
    }
  }finally{
    clearTimeout(abortT);
    asking=false;
    $('#chatSend').disabled=false;
    $('#chat').scrollTop=1e9;
  }
}
$('#chatSend').onclick=()=>ask($('#chatIn').value);
$('#chatIn').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();ask($('#chatIn').value)}});
$('#chatClear').onclick=()=>{$('#chat').innerHTML='';$('#chatClear').hidden=true};
const coachWorkouts={
  '下肢肌力':['深蹲','弓箭步','啞鈴羅馬尼亞硬舉','臀橋','側抬腿'],
  '上肢肌力':['伏地挺身','啞鈴上斜臥推','啞鈴俯身划船','啞鈴臥推','肩推','二頭彎舉'],
  '核心訓練':['平板支撐','捲腹','側棒式','仰臥抬腿'],
  '全身肌力':['深蹲','伏地挺身','臀橋','肩推'],
  '全身有氧':['原地踏步','開合跳','高抬腿','原地跳繩']
};
const coachWeekPlans={
  減脂:{2:['全身肌力','全身有氧'],3:['下肢肌力','上肢肌力','全身有氧'],4:['下肢肌力','上肢肌力','核心訓練','全身有氧'],5:['下肢肌力','上肢肌力','全身有氧','核心訓練','全身肌力']},
  增肌:{2:['全身肌力','全身肌力'],3:['下肢肌力','上肢肌力','全身肌力'],4:['下肢肌力','上肢肌力','下肢肌力','上肢肌力'],5:['下肢肌力','上肢肌力','核心訓練','下肢肌力','上肢肌力']},
  體能:{2:['全身肌力','全身有氧'],3:['全身肌力','核心訓練','全身有氧'],4:['下肢肌力','上肢肌力','全身有氧','核心訓練'],5:['下肢肌力','上肢肌力','全身有氧','核心訓練','全身肌力']}
};
let coachPlanNow=null,coachShareUrl='',coachBlob=null,coachBlobFor=null,coachBlobJob=null,coachPrepT=0;
function coachRecentText(trainedDays,recentReps,recentMinutes,days){
  if(!trainedDays)return '近 7 天尚無訓練紀錄，先從容易完成的強度開始，逐週增加。';
  const parts=[];
  if(recentReps>0||recentMinutes<=0)parts.push(`約 ${recentReps} 下`);
  if(recentMinutes>0)parts.push(`${recentMinutes} 分鐘`);
  return `近 7 天運動 ${trainedDays} 天、${parts.join('與 ')}。安排 ${days} 天訓練，其他日以休息或輕鬆散步恢復。`;
}
function coachPlanData(){
  const goal=$('#coachGoal').value,days=Number($('#coachDays').value),gear=$('#coachGear').value,b=bodyInfo();
  const recent=lastDays(7),trainedDays=recent.filter(day=>(Number(S.days[day.k])||0)>0||(Number(S.workDays[day.k])||0)>0).length;
  const recentReps=recent.reduce((sum,day)=>sum+(Number(S.days[day.k])||0),0);
  const recentMinutes=Math.round(recent.reduce((sum,day)=>sum+(Number(S.workDays[day.k])||0),0)/60);
  const plan=(coachWeekPlans[goal]||coachWeekPlans['體能'])[days]||coachWeekPlans['體能'][3];
  const sets=goal==='增肌'?3:2,repText=goal==='增肌'?'8–12 下':'10–12 下',rest=goal==='增肌'?90:60;
  const dayPlans=plan.map((focus,index)=>({title:`第 ${index+1} 天・${focus}`,rest,items:coachWorkouts[focus].filter(name=>gear!=='徒手'||!name.startsWith('啞鈴')).slice(0,4).map(name=>({name,dose:`${sets} 組 × ${TIMED.has(name)||['平板支撐','側棒式'].includes(name)?'30 秒':repText}`}))}));
  const wk=weekDates(),md=d=>`${d.getMonth()+1}/${d.getDate()}`;
  return {goal,days,gear,b,dayPlans,
    gearText:gear==='徒手'?'徒手訓練':gear==='啞鈴'?'啞鈴或水瓶':'可依健身房器材替換',
    gearShort:gear==='徒手'?'徒手訓練':gear==='啞鈴'?'啞鈴或水瓶':'健身房器材',
    range:`${md(wk[0])}（一）– ${md(wk[6])}（日）`,
    kcal:Math.round(goal==='減脂'?Math.max(b.bmr,b.tdee-300):goal==='增肌'?b.tdee+150:b.tdee),
    adjust:coachRecentText(trainedDays,recentReps,recentMinutes,days)};
}
function coachDropShare(){if(coachShareUrl)URL.revokeObjectURL(coachShareUrl);coachShareUrl=''}
function renderCoachPlan(){
  const p=coachPlanData(),b=p.b;coachPlanNow=p;coachDropShare();
  const workoutHtml=p.dayPlans.map(d=>`<article class="coach-result-card"><h4>${d.title}</h4><ul>${d.items.map(i=>`<li><b>${i.name}</b>：${i.dose}</li>`).join('')}</ul><p class="small mute" style="margin:6px 0 0">組間休息約 ${d.rest} 秒</p></article>`).join('');
  $('#coachResult').innerHTML=`<div class="coach-result-summary"><div><b>${p.goal}・每週 ${p.days} 天</b><span class="small mute">${p.gearText}</span></div><div><b>個人資料</b><span class="small mute">${b.h} 公分・${b.w} 公斤・BMI ${b.bmi.toFixed(1)}</span></div></div><div class="coach-result-card"><h4>依近期紀錄調整</h4><p style="margin:0">${p.adjust}</p></div>${workoutHtml}<div class="coach-result-card"><h4>飲食與恢復建議</h4><ul><li>每日消耗估算約 ${Math.round(b.tdee)} 大卡；依所選目標估算攝取約 ${p.kcal} 大卡，僅供參考，無需追求精確或過度限制。</li><li>每日蛋白質可先以約 ${Math.round(b.w*1.2)}–${Math.round(b.w*1.6)} 克作為參考，搭配均衡正餐。</li><li>每日飲水約 ${Math.round(b.w*35)} 毫升作為起點，依流汗量、氣候與身體狀況調整。</li></ul></div><p class="small mute" style="margin:0">每次先暖身 5 分鐘，結束後緩和伸展；動作疼痛或不適時請停止並尋求專業建議。</p>
  <div class="coach-share"><div class="row coach-share-acts"><button class="btn" type="button" id="coachShareBtn">分享這週建議</button><button class="btn ghost" type="button" id="coachDlBtn">下載圖片</button></div><div class="coach-share-box" id="coachShareBox" hidden><img id="coachShareImg" alt="本週訓練建議圖片預覽"><div class="row coach-share-acts"><a class="btn teal" id="coachShareDl">下載圖片</a><button class="btn ghost" type="button" id="coachCopyBtn">複製文字版</button></div></div></div>`;
  $('#coachShareBtn').onclick=()=>coachShare(false);
  $('#coachDlBtn').onclick=()=>coachShare(true);
  $('#coachCopyBtn').onclick=coachCopyText;
  coachBlob=null;coachBlobFor=null;coachBlobJob=null;clearTimeout(coachPrepT);coachPrepT=setTimeout(coachPrepare,350);
}
function coachPrepare(){
  const p=coachPlanNow;if(!p)return null;
  if(coachBlobFor===p&&coachBlobJob)return coachBlobJob;
  coachBlobFor=p;coachBlob=null;
  coachBlobJob=coachMakeImage(p).then(b=>{if(coachBlobFor===p)coachBlob=b;return b}).catch(e=>{if(coachBlobFor===p){coachBlobFor=null;coachBlobJob=null}throw e});
  return coachBlobJob;
}
function coachFileName(){return `lin-ai-本週建議-${dkey(new Date())}.png`}
function coachPlainText(p=coachPlanNow){
  if(!p)return '';
  return [`Lin AI 本週訓練建議（${p.range}）`,`${p.goal}・每週 ${p.days} 天・${p.gearShort}`,'',`【依近期紀錄調整】${p.adjust}`,'',...p.dayPlans.flatMap(d=>[`【${d.title}】`,...d.items.map(i=>`・${i.name} ${i.dose}`),`組間休息約 ${d.rest} 秒`,'']),'Lin AI 健身教練　lin-ai-coach.netlify.app'].join('\n');
}
function coachWrap(x,text,maxW){
  const tokens=String(text).match(/[A-Za-z0-9.%+\-–×/:]+|\s+|./gu)||[],lines=[];let line='';
  for(const tk of tokens){
    if(tk==='\n'){lines.push(line);line='';continue}
    if(x.measureText(line+tk).width<=maxW||!line||/^[，。、；：！？）」』】,.;:!?)]$/.test(tk)){
      if(x.measureText(tk).width>maxW&&!line){for(const ch of tk){if(x.measureText(line+ch).width>maxW&&line){lines.push(line);line=''}line+=ch}continue}
      line+=tk;
    }else{lines.push(line.trimEnd());line=/^\s+$/.test(tk)?'':tk}
  }
  if(line.trim())lines.push(line.trimEnd());
  return lines;
}
function coachPaint(x,p,W,draw){
  const F='"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif',L=72,CW=W-L*2,IN=36;
  const text=(s,font,color,tx,ty,align)=>{if(!draw)return;x.font=font;x.fillStyle=color;x.textAlign=align||'left';x.fillText(s,tx,ty);x.textAlign='left'};
  const card=(top,h,fill,stroke)=>{if(!draw)return;x.beginPath();rrect(x,L,top,CW,h,28);x.fillStyle=fill;x.fill();if(stroke){x.strokeStyle=stroke;x.lineWidth=2;x.stroke()}};
  const para=(s,font,lh,maxW)=>{x.font=font;return coachWrap(x,s,maxW).map(t=>({t,lh}))};
  let y=140;
  text('Lin AI','800 80px '+F,'#eaf4f1',L,y);
  y+=96;text('本週訓練建議','800 60px '+F,'#ffd23f',L,y);
  y+=56;text(p.range,'500 32px '+F,'#93aeb3',L,y);
  const sumLines=para(`${p.goal}・每週 ${p.days} 天・${p.gearShort}`,'700 34px '+F,46,CW-IN*2);
  y+=44;const sumH=sumLines.length*46+44;card(y,sumH,'rgba(255,210,63,.1)','rgba(255,210,63,.35)');
  sumLines.forEach((l,i)=>text(l.t,'700 34px '+F,'#ffd23f',L+IN,y+22+34+i*46));y+=sumH;
  const adj=para(p.adjust,'500 30px '+F,44,CW-IN*2);
  y+=28;const adjH=40+44+adj.length*44+30;card(y,adjH,'rgba(61,214,208,.08)','rgba(61,214,208,.3)');
  text('依近期紀錄調整','800 32px '+F,'#3dd6d0',L+IN,y+40+30);
  adj.forEach((l,i)=>text(l.t,'500 30px '+F,'#eaf4f1',L+IN,y+40+30+50+i*44));y+=adjH;
  for(const d of p.dayPlans){
    const shown=d.items.slice(0,6),more=d.items.length-shown.length;
    const rows=shown.map(i=>para(`${i.name}　${i.dose}`,'500 30px '+F,44,CW-IN*2-30));
    if(more>0)rows.push(para(`…等 ${d.items.length} 項`,'500 30px '+F,44,CW-IN*2-30));
    const titleL=para(d.title,'800 36px '+F,48,CW-IN*2);
    const bodyH=rows.reduce((a,r)=>a+r.length*44,0)+(rows.length-1)*8;
    y+=24;const h=36+titleL.length*48+16+bodyH+18+40+28;card(y,h,'rgba(255,255,255,.06)','rgba(255,255,255,.1)');
    let cy=y+36+36;titleL.forEach(l=>{text(l.t,'800 36px '+F,'#eaf4f1',L+IN,cy);cy+=48});cy+=16-48+44;
    rows.forEach((r,ri)=>{r.forEach((l,li)=>{if(li===0&&!(more>0&&ri===rows.length-1))text('•','800 30px '+F,'#ffd23f',L+IN,cy);text(l.t,'500 30px '+F,more>0&&ri===rows.length-1?'#93aeb3':'#eaf4f1',L+IN+30,cy);cy+=44});cy+=8});
    text(`組間休息約 ${d.rest} 秒`,'500 26px '+F,'#93aeb3',L+IN,y+h-28-12);
    y+=h;
  }
  y+=70;text('Lin AI 健身教練　lin-ai-coach.netlify.app','500 26px '+F,'#93aeb3',W/2,y,'center');
  return y+60;
}
async function coachMakeImage(p=coachPlanNow){
  try{await document.fonts.ready}catch(e){}
  const W=1080,m=document.createElement('canvas').getContext('2d'),H=Math.ceil(coachPaint(m,p,W,false));
  const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  const gr=x.createLinearGradient(0,0,0,H);gr.addColorStop(0,'#0f2c35');gr.addColorStop(1,'#0a1a20');x.fillStyle=gr;x.fillRect(0,0,W,H);
  x.strokeStyle='rgba(255,255,255,.045)';x.lineWidth=2;for(let i=0;i<W;i+=120){x.beginPath();x.moveTo(i,0);x.lineTo(i,H);x.stroke()}
  coachPaint(x,p,W,true);
  const blob=await new Promise(r=>c.toBlob(r,'image/png'));c.width=c.height=0;
  return blob;
}
function coachShowPreview(blob){
  coachDropShare();coachShareUrl=URL.createObjectURL(blob);
  $('#coachShareImg').src=coachShareUrl;$('#coachShareDl').href=coachShareUrl;$('#coachShareDl').download=coachFileName();
  $('#coachShareBox').hidden=false;
}
async function coachShare(download){
  const p=coachPlanNow;if(!p)return;
  const btns=[$('#coachShareBtn'),$('#coachDlBtn')];btns.forEach(b=>b.disabled=true);
  let hint='這個瀏覽器不支援直接分享，可以下載圖片或複製文字版';
  try{
    const blob=coachBlobFor===p&&coachBlob?coachBlob:await coachPrepare();
    if(!blob)throw new Error('產生圖片失敗');
    if(p!==coachPlanNow)return;
    const file=new File([blob],coachFileName(),{type:'image/png'});
    if(!download&&navigator.canShare&&navigator.share&&navigator.canShare({files:[file]})){
      try{await navigator.share({files:[file],title:'Lin AI 本週訓練建議',text:coachPlainText(p)});return}
      catch(e){if(e&&e.name==='AbortError')return;hint=e&&e.name==='NotAllowedError'?'圖片準備好了，請再按一次「分享這週建議」':'分享沒有成功，可以下載圖片或複製文字版'}
    }
    coachShowPreview(blob);
    if(download){const a=document.createElement('a');a.href=coachShareUrl;a.download=coachFileName();document.body.appendChild(a);a.click();a.remove();toast('圖片已下載')}
    else toast(hint);
    $('#coachShareBox').scrollIntoView({block:'nearest',behavior:'smooth'});
  }catch(e){toast('產生圖片失敗：'+(e&&e.message||e))}
  finally{btns.forEach(b=>{if(b.isConnected)b.disabled=false})}
}
async function coachCopyText(){
  const t=coachPlainText();if(!t)return;
  try{await navigator.clipboard.writeText(t);toast('已複製文字版建議')}catch(e){toast('無法自動複製，請長按圖片儲存或改用下載')}
}
$('#coachGenerate').onclick=renderCoachPlan;
['#coachGoal','#coachDays','#coachGear'].forEach(selector=>$(selector).addEventListener('change',renderCoachPlan));
$('#coachFaq').addEventListener('click',event=>{
  const button=event.target.closest('[data-faq]');
  if(!button)return;
  const answers={
    warmup:'先用 5–8 分鐘快走或原地踏步暖身，再以較輕鬆的幅度做當天動作。逐步增加強度，不必一開始就全力運動。',
    protein:'可把蛋白質分散在各餐，選擇蛋、豆製品、魚、雞肉或乳品等食物。實際需求會因年齡與健康狀況不同；有腎臟疾病等狀況請先詢問醫療專業人員。',
    rest:'休息日很重要。可以完全休息，或做散步、輕柔活動；若仍疲倦或有疼痛，就先讓身體恢復。',
    squat:'雙腳約與肩同寬，膝蓋朝腳尖方向，臀部向後坐並維持軀幹穩定。只蹲到舒適、不痛的幅度；膝或髖不適時請停止。'
  };
  $('#coachFaqAnswer').textContent=answers[button.dataset.faq]||'請選擇一個常見問題。';
  $('#coachFaqAnswer').hidden=false;
});

