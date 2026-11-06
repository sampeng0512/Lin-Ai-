/* ============================================================
   12-我的菜單
   內容：把計時器設定存成自己的菜單
   畫面：「訓練計時器」分頁的我的菜單
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 我的菜單（計時器預設） ================= */
function renderPresets(){
  $('#mpList').innerHTML=S.presets.length?S.presets.map((m,i)=>`<span class="chip2"><button type="button" data-i="${i}" class="ld">${esc(m.name)}</button><button class="x" type="button" data-i="${i}" aria-label="刪除 ${esc(m.name)}">×</button></span>`).join(''):'<span class="small mute">還沒有存過菜單。</span>';
  $$('#mpList .ld').forEach(b=>b.onclick=()=>loadPreset(S.presets[+b.dataset.i]));
  $$('#mpList .x').forEach(b=>b.onclick=()=>{S.presets.splice(+b.dataset.i,1);save();renderPresets()});
}
function loadPreset(m){
  if(!m||!MODES[m.mode])return;
  tMode=m.mode;$$('#tModes button').forEach(b=>b.classList.toggle('on',b.dataset.k===tMode));tRender();
  $$('#tParams input').forEach(i=>{const v=m.params&&m.params[i.dataset.k];if(v!==undefined){i.value=v;i.previousElementSibling.textContent=i.value}});
  if(m.picks)$$('#tPickList input').forEach(i=>i.checked=m.picks.includes(i.value));
  $('#tPrep').value=m.prep;$('#tPrepO').textContent=m.prep;tBuild();tCamUi();toast(`已載入菜單：${m.name}`);
}
$('#mpSave').onclick=()=>{
  const name=$('#mpName').value.trim();if(!name){toast('先幫這個菜單取個名字');return}
  const m={name,mode:tMode,params:tParams(),picks:$$('#tPickList input:checked').map(i=>i.value),prep:+$('#tPrep').value};
  const i=S.presets.findIndex(x=>x.name===name);
  if(i>=0)S.presets[i]=m;else{if(S.presets.length>=8){toast('最多存 8 個菜單，請先刪掉一個');return}S.presets.push(m)}
  $('#mpName').value='';save();renderPresets();toast(`已儲存菜單：${name}`);
};

