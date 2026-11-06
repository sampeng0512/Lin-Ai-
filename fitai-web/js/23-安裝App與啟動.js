/* ============================================================
   23-安裝App與啟動
   內容：安裝成 App（PWA）、離線、分頁圖示，以及網頁打開時的啟動流程
   畫面：安裝提示列、新版本提示列、頁尾
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 安裝成 App（PWA）與離線 ================= */
let deferredInstall=null;
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function showInstall(){
  if(isStandalone()){if(!S.installNo){S.installNo=true;save()}$('#installBar').hidden=true;return}
  if(S.installNo){$('#installBar').hidden=true;return}
  if(deferredInstall){$('#installTxt').textContent='把 Lin AI 安裝到手機，像 App 一樣使用，第一次載入後也能離線用。';$('#installGo').hidden=false;$('#installBar').hidden=false}
  else if(isIOS()){$('#installTxt').textContent='iPhone 安裝方法：用 Safari 打開，按下方的「分享」按鈕，選「加入主畫面」，就能像 App 一樣使用。';$('#installGo').hidden=true;$('#installBar').hidden=false}
}
const displayModeQuery=matchMedia('(display-mode: standalone)');
if(displayModeQuery.addEventListener)displayModeQuery.addEventListener('change',showInstall);
else if(displayModeQuery.addListener)displayModeQuery.addListener(showInstall);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;showInstall()});
window.addEventListener('appinstalled',()=>{S.installNo=true;save();$('#installBar').hidden=true;toast('已加到主畫面')});
$('#installGo').onclick=async()=>{if(!deferredInstall)return;deferredInstall.prompt();try{await deferredInstall.userChoice}catch(e){}deferredInstall=null;$('#installBar').hidden=true};
$('#installNo').onclick=()=>{S.installNo=true;save();$('#installBar').hidden=true};
window.addEventListener('offline',()=>toast('目前離線：已載入功能與內建訓練建議仍可使用'));
window.addEventListener('online',()=>{toast('已恢復連線');if(accountSession)syncAccountNow().catch(()=>{})});
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
  const hadController=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadController)$('#updateBar').hidden=false});   // 新版程式接手了，提醒使用者重新整理
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(reg=>{
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reg.update().catch(()=>{})});   // App 從背景切回來時也檢查新版
  }).catch(e=>logErr('sw: '+e.message)));
}
$('#updateGo').onclick=()=>location.reload();
$('#foot').textContent='Lin AI　版本 '+APP_VERSION;
function diagText(){
  const c=S.cam;
  return ['Lin AI 診斷資訊','版本：'+APP_VERSION,'時間：'+new Date().toISOString(),'網址：'+location.origin+location.pathname,
    '瀏覽器：'+navigator.userAgent,'螢幕：'+screen.width+'x'+screen.height+'　視窗：'+innerWidth+'x'+innerHeight+'　像素比：'+devicePixelRatio,
    '離線快取：'+(navigator.serviceWorker&&navigator.serviceWorker.controller?'已啟用':'未啟用'),
    '鏡頭功能：'+(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia?'有':'沒有')+'　錄影：'+(window.MediaRecorder?'有':'沒有')+'　語音：'+('speechSynthesis' in window?'有':'沒有')+'　通知：'+('Notification' in window?Notification.permission:'不支援'),
    '偵測設定：'+JSON.stringify({use3d:c.use3d,vis:c.vis,win:c.win,model:c.model,conf:c.conf,mirror:c.mirror,dev:c.dev?'已選':'自動'}),
    '姿勢模型：'+(poseLM?'已載入':'尚未載入'),'好友伺服器：'+(typeof frCfgOk==='function'&&frCfgOk()?'已設定':'未設定'),
    '最近錯誤：'+(ERRS.length?'\n  '+ERRS.join('\n  '):'無')].join('\n');
}
const TAB_ICONS={
 cam:'<path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
 timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 3h6"/>',
 runk:'<circle cx="14" cy="4.5" r="2"/><path d="M6 21l3.5-6 3 2.5V22M8 11l3-4 3.5 2 2.5 3H20M11 7l-1.5 5.5 3 3"/>',
 game:'<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>',
 stats:'<path d="M5 20V10M12 20V4M19 20v-8"/>',
 ach:'<circle cx="12" cy="9" r="5"/><path d="M9 13.5 7 21l5-3 5 3-2-7.5"/>',
 friends:'<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 5a3.5 3.5 0 0 1 0 7M18 14c2.2.7 3.5 2.7 3.5 6"/>',
 body:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 10a4 4 0 0 1 8 0M12 10l2-2"/>',
 food:'<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-3 5-3 8h3v10"/>',
 guide:'<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10"/>',
 coach:'<path d="M4 5h16v11H9l-5 4z"/>'};
const TAB_SHORT={cam:'鏡頭',timer:'計時',runk:'跑步',game:'挑戰',stats:'紀錄',ach:'徽章',friends:'好友',body:'身體',food:'飲食',guide:'教學',coach:'教練'};
$$('.tab').forEach(b=>{const ic=TAB_ICONS[b.dataset.tab];if(ic){const label=b.textContent;b.dataset.short=TAB_SHORT[b.dataset.tab];b.setAttribute('aria-label',label);b.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${ic}</svg><span class="tab-label">${label}</span>`}});

/* ================= 啟動 ================= */
if(S.waterOn&&!S.waterNext)waterSchedule();
const idle=f=>('requestIdleCallback' in window)?requestIdleCallback(f,{timeout:1500}):setTimeout(f,60);
renderCamCfg();renderHold();setInterval(planTick,20000);setTimeout(planTick,4000);
(async()=>{   // 等帳號登入狀態確認後再畫出其餘畫面
await initializeAccount();
renderMusic();showInstall();renderFacing();renderVoice();applyBody();calc();renderCoachPlan();renderStats(true);renderHist();chRefresh();renderNinja();renderRun();renderPose();rkRender();rkRecover();plan();
renderFriends();if(S.me.name&&!S.me.code)ensureFriendCode();setTimeout(handleInvite,600);
idle(()=>{listCams();renderSched();renderFood();renderGuide();renderWeights();renderPresets();renderAch()});   // 第一次畫面先出來，其餘慢慢補
window.__fit={renderStats,rpc,friendSync,friendBoard,friendAdd,friendCreate,FRIEND_CFG,frCfgOk,renderFriends,normalizeState,ERRS,diagText,APP_VERSION,saveNow,angles,angleAt,resetPose,renderCamCfg,hold,holdCheck,holdFrame,holdFinish,holdView,trainSummary,planTick,addFood,renderFood,renderSched,music,Synth,STYLES,musicStart,musicStop,rec,recStart,recStop,toggleFull,ACH,achState,notePR,dailyTask,checkDaily,renderAch,renderHeat,loadPreset,makeShare,waterTick,addWater,showWater,addReps,streaks,checkBadges,renderStatsTab,say,CUES,RepCounter,EX,MODES,nj,njFinish,rn,rnFinish,rnView,ps,psFinish,psView,POSES,kcalToday,kcalTotal,renderBuddy,rk,rkRender,runMet,runKcal,S,runPhases,ph,md,bodyInfo,camStart,cam,camView,chView,get chCounter(){return chCounter},get camCounter(){return camCounter}};
})();
