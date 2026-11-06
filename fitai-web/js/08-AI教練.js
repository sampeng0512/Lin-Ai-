/* ============================================================
   08-AI教練
   內容：AI 教練：快速問題、送出問題給 WHO RAG 後端、顯示回答與來源、個人化課表
   畫面：「AI 教練」分頁
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= AI 教練 ================= */
const SYSTEM=`你是「Lin AI」的專業健身教練，使用繁體中文（台灣用語）回答。
任務：根據使用者的目標、程度、時間與器材，規劃具體可執行的訓練菜單，並回答訓練、動作姿勢與飲食問題。
規則：
- 資訊不足以排菜單時，先簡短詢問最多 3 個關鍵問題（目標、每週可練天數、程度/器材/傷病）；資訊夠了就直接給完整菜單。
- 菜單請用表格或條列：每天重點、動作、組數×次數（或秒數）、組間休息，並提醒暖身與收操，以及如何逐週進步。
- 動作優先使用本系統支援的：深蹲、深蹲跳、弓箭步、臀橋、側抬腿、伏地挺身、肩推、側平舉、前平舉、二頭彎舉、引體向上、啞鈴臥推、啞鈴上斜臥推、啞鈴俯身划船、俯身划船、繩索划船、高位下拉、啞鈴反向飛鳥、啞鈴羅馬尼亞硬舉、捲腹、仰臥起坐、仰臥抬腿、側彎、站姿抬膝碰肘、開合跳、高抬腿、原地踏步、原地跳繩、波比跳，以及撐住類的平板支撐、側棒式、靠牆深蹲、臀橋停留，也可加入其他徒手或啞鈴動作。
- 安全第一：不推薦極端節食或過低熱量；有疼痛、傷病、慢性病、懷孕等情況，請建議先諮詢醫師或物理治療師。你不是醫師。
- 回答簡潔、鼓勵但誠實。`;
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
    if(Array.isArray(data.sources)&&data.sources.length){
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
function renderCoachPlan(){
  const goal=$('#coachGoal').value,days=Number($('#coachDays').value),gear=$('#coachGear').value,b=bodyInfo();
  const recent=lastDays(7),trainedDays=recent.filter(day=>(Number(S.days[day.k])||0)>0||(Number(S.workDays[day.k])||0)>0).length;
  const recentReps=recent.reduce((sum,day)=>sum+(Number(S.days[day.k])||0),0);
  const recentMinutes=Math.round(recent.reduce((sum,day)=>sum+(Number(S.workDays[day.k])||0),0)/60);
  const plan=(coachWeekPlans[goal]||coachWeekPlans['體能'])[days]||coachWeekPlans['體能'][3];
  const sets=goal==='增肌'?3:2,repText=goal==='增肌'?'8–12 下':'10–12 下',rest=goal==='增肌'?90:60;
  const workoutHtml=plan.map((focus,index)=>{
    const exercises=coachWorkouts[focus].filter(name=>gear!=='徒手'||!name.startsWith('啞鈴')).slice(0,4);
    const prescription=exercises.map(name=>`<li><b>${name}</b>：${sets} 組 × ${TIMED.has(name)||['平板支撐','側棒式'].includes(name)?'30 秒':repText}</li>`).join('');
    return `<article class="coach-result-card"><h4>第 ${index+1} 天・${focus}</h4><ul>${prescription}</ul><p class="small mute" style="margin:6px 0 0">組間休息約 ${rest} 秒</p></article>`;
  }).join('');
  const kcal=Math.round(goal==='減脂'?Math.max(b.bmr,b.tdee-300):goal==='增肌'?b.tdee+150:b.tdee);
  const lastWeek=trainedDays?`近 7 天運動 ${trainedDays} 天、約 ${recentReps} 下與 ${recentMinutes} 分鐘。安排 ${days} 天訓練，其他日以休息或輕鬆散步恢復。`:'近 7 天尚無訓練紀錄，先從容易完成的強度開始，逐週增加。';
  $('#coachResult').innerHTML=`<div class="coach-result-summary"><div><b>${goal}・每週 ${days} 天</b><span class="small mute">${gear==='徒手'?'徒手訓練':gear==='啞鈴'?'啞鈴或水瓶':'可依健身房器材替換'}</span></div><div><b>個人資料</b><span class="small mute">${b.h} 公分・${b.w} 公斤・BMI ${b.bmi.toFixed(1)}</span></div></div><div class="coach-result-card"><h4>依近期紀錄調整</h4><p style="margin:0">${lastWeek}</p></div>${workoutHtml}<div class="coach-result-card"><h4>飲食與恢復建議</h4><ul><li>每日消耗估算約 ${Math.round(b.tdee)} 大卡；依所選目標估算攝取約 ${kcal} 大卡，僅供參考，無需追求精確或過度限制。</li><li>每日蛋白質可先以約 ${Math.round(b.w*1.2)}–${Math.round(b.w*1.6)} 克作為參考，搭配均衡正餐。</li><li>每日飲水約 ${Math.round(b.w*35)} 毫升作為起點，依流汗量、氣候與身體狀況調整。</li></ul></div><p class="small mute" style="margin:0">每次先暖身 5 分鐘，結束後緩和伸展；動作疼痛或不適時請停止並尋求專業建議。</p>`;
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

