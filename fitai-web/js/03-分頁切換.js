/* ============================================================
   03-分頁切換
   內容：首頁選模式、下方分頁按鈕切換、切換模式按鈕
   畫面：首頁、下方分頁列
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 分頁切換 ================= */
const modeHome=$('#modeHome');
const modeLabel=$('#modeLabel');
function transitionStep(from,to){
  const change=()=>{from.hidden=true;to.hidden=false};
  if(document.startViewTransition)document.startViewTransition(change);
  else{change();to.classList.remove('step-view');void to.offsetWidth;to.classList.add('step-view')}
  $('main').scrollTo({top:0,behavior:'instant'});
  to.closest('.panel')?.scrollTo({top:0,behavior:'instant'});
}
function enterMode(mode){
  document.body.dataset.mode=mode;
  document.body.dataset.theme=mode;
  modeHome.hidden=true;
  modeLabel.textContent=mode==='professional'?'專業訓練':'輕鬆遊戲';
  renderStats(true);
  const firstTab=mode==='game'?'game':'cam';
  $(`.tab[data-tab="${firstTab}"]`).click();
  window.scrollTo({top:0,behavior:'smooth'});
}
$$('[data-mode-choice]').forEach(button=>button.addEventListener('click',()=>enterMode(button.dataset.modeChoice)));
$('#modeHomeBtn').addEventListener('click',()=>{
  exitFull();
  if(cam.running||cam.starting)camStop();
  delete document.body.dataset.primaryView;
  document.body.removeAttribute('data-mode');
  document.body.removeAttribute('data-theme');
  modeLabel.textContent='';
  modeHome.hidden=false;
  window.scrollTo({top:0,behavior:'smooth'});
});
$$('.tab').forEach(b=>b.onclick=()=>{
  document.body.dataset.primaryView=['cam','timer'].includes(b.dataset.tab)?b.dataset.tab:'';
  $$('.tab').forEach(t=>t.setAttribute('aria-selected',t===b));
  $$('.panel').forEach(p=>p.classList.toggle('active',p.id==='tab-'+b.dataset.tab));
  b.scrollIntoView({inline:'center',block:'nearest'});
  $('main').scrollTop=0;
  exitFull();
  if(b.dataset.tab==='stats')renderStatsTab();
  if(b.dataset.tab==='ach')renderAch();
  if(b.dataset.tab==='food')renderFood();
  if(b.dataset.tab==='runk')rkRender();
  if(b.dataset.tab==='coach')renderCoachPlan();
  if(b.dataset.tab==='friends'){
    renderFriends();
    if(S.me.name&&!S.me.code)ensureFriendCode().then(ok=>{if(ok){friendBoard();loadFriendGroups()}});
    else{friendBoard();loadFriendGroups()}
  }
  if(cam.running||cam.starting)camStop();
  if(b.dataset.tab!=='timer'&&tRunning)tCtl.aborted=true;
});
const seg=(el,onPick)=>$$('button',el).forEach(b=>b.onclick=()=>{$$('button',el).forEach(x=>x.classList.toggle('on',x===b));onPick(b)});
$$('#tab-stats [data-stats-view]').forEach(button=>button.addEventListener('click',()=>{
  const view=button.dataset.statsView;
  $$('#tab-stats [data-stats-view]').forEach(item=>{const selected=item===button;item.classList.toggle('on',selected);item.setAttribute('aria-selected',String(selected))});
  $$('#tab-stats [data-stats-panel]').forEach(panel=>{panel.hidden=panel.dataset.statsPanel!==view});
  $('main').scrollTop=0;
}));
let guideFilter='全部';
$('#guideFilters').addEventListener('click',event=>{
  const button=event.target.closest('[data-guide-filter]');
  if(!button)return;
  guideFilter=button.dataset.guideFilter;
  $$('#guideFilters [data-guide-filter]').forEach(item=>{const selected=item===button;item.classList.toggle('on',selected);item.setAttribute('aria-pressed',String(selected))});
  renderGuide();
});

