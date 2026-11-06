/* ============================================================
   04-鏡頭計數
   內容：鏡頭計數分頁：選動作、開始／結束、歷史紀錄
   畫面：「鏡頭計數」分頁
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 鏡頭計數分頁 ================= */
$('#camEx').innerHTML=optsByCat(ORDER,n=>n);
let camCounter=new RepCounter(ORDER[0]);
const camView=makeView($('[data-stage=cam]'),()=>camCounter);
camView.nm.textContent=ORDER[0];
const camRst=$('.rstbtn',camView.stage);camRst.hidden=false;
camRst.onclick=()=>{   // 只歸零不儲存；要記錄請按「儲存這組並歸零」
  if(camCounter.count===0)return;
  camCounter.reset();camView.n.textContent='0';$('#camSave').disabled=true;$('#camFormV').textContent='—';$('#camTempoV').textContent='—';
  toast('次數已歸零（這組沒有儲存）');
};
let camStandard='normal';
const setCamBtns=on=>{$('#camStart').disabled=on;$('#camStop').disabled=!on;$('#camSave').disabled=!on&&camCounter.count===0};
$('#camEx').onchange=e=>{camCounter=new RepCounter(e.target.value);camCounter.relax=camStandard==='strict'?.14:.06;camView.nm.textContent=e.target.value;camView.n.textContent='0';$('#camCurrent').textContent=e.target.value};
$('#camEx').addEventListener('change',()=>{if(!$('#camSession').hidden) return;transitionStep($('#camPicker'),$('#camSession'));renderHist()});
$('#camMovementGrid').onclick=e=>{
  const card=e.target.closest('[data-ex]');if(!card)return;
  $('#camEx').value=card.dataset.ex;$('#camEx').dispatchEvent(new Event('change'));
};
$('#camBegin').onclick=()=>$('#camStart').click();
$('#camBack').onclick=()=>{if(camCounter.count>0)$('#camSave').click();if(cam.running||cam.starting)camStop();transitionStep($('#camSession'),$('#camPicker'))};
$('#camEnd').onclick=()=>{
  if(camCounter.count>0)$('#camSave').click();
  if(cam.running||cam.starting)camStop();
  transitionStep($('#camSession'),$('#camPicker'));
};
$('#camStandard').onclick=e=>{
  const button=e.target.closest('[data-standard]');if(!button)return;
  camStandard=button.dataset.standard;camCounter.relax=camStandard==='strict'?.14:.06;
  $$('button',e.currentTarget).forEach(item=>item.classList.toggle('on',item===button));
};
$$('.session-camera-switch [data-facing]').forEach(button=>button.onclick=()=>{
  const target=$(`.facingSeg button[data-f="${button.dataset.facing}"]`);
  if(target)target.click();
});
$('#camStart').onclick=async()=>{
  $('#camStart').disabled=true;
  const ok=await camStart(camView);
  if(ok){camView.onFrame=()=>{$('#camSave').disabled=camCounter.count===0;$('#camFormV').textContent=camCounter.cueTotal?Math.round((1-camCounter.cueBad/camCounter.cueTotal)*100)+'%':'—';$('#camTempoV').textContent=camCounter.cycles.length?(camCounter.cycles.reduce((a,b)=>a+b,0)/camCounter.cycles.length).toFixed(1):'—'};setCamBtns(true)}else $('#camStart').disabled=false;
};
$('#camStop').onclick=()=>camStop();
cam.onStop=()=>{if(typeof hold!=='undefined'&&hold.on)holdFinish(false);$('#hCamBtn').disabled=false;$('#hCamOff').disabled=true;$('#camStart').disabled=false;$('#camStop').disabled=true;$('#chCamBtn').disabled=false;$('#chCamOff').disabled=true;$('#tCamBtn').disabled=false;$('#tCamOff').disabled=true;$('#camSave').disabled=camCounter.count===0};
$('#camSave').onclick=()=>{
  if(camCounter.count<=0)return;
  S.history.unshift({ex:camCounter.key,n:camCounter.count,t:Date.now()});S.history=S.history.slice(0,30);
  notePR(camCounter.key,camCounter.count);addReps(camCounter.count,camCounter.key,camCounter.count);camCounter.reset();camView.n.textContent='0';
  $('#camSave').disabled=true;save();renderStats();renderHist();
};
function renderHist(){
  $('#histList').innerHTML=S.history.length?S.history.slice(0,8).map(h=>{const d=new Date(h.t);
    return `<li>${esc(h.ex)}　<b style="color:var(--yellow)">${h.n} 下</b>　<span class="small">${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}</span></li>`}).join(''):'<li>還沒有紀錄。做完一組後按「儲存這組並歸零」。</li>';
}

