/* ============================================================
   20-進階偵測與錄影
   內容：進階偵測設定、前後鏡頭切換、錄影（含骨架與次數）
   畫面：「鏡頭計數」分頁的進階設定、錄影完成視窗
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 進階偵測設定 ================= */
async function listCams(){
  try{
    const ds=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
    $('#camDev').innerHTML='<option value="">自動（依前、後鏡頭選擇）</option>'+ds.map((d,i)=>`<option value="${esc(d.deviceId)}">${esc(d.label||'鏡頭 '+(i+1))}</option>`).join('');
    $('#camDev').value=S.cam.dev;if($('#camDev').value!==S.cam.dev)$('#camDev').value='';
  }catch(e){}
}
function renderCamCfg(){
  const c=S.cam;
  $$('#cfg3d button').forEach(b=>b.classList.toggle('on',(b.dataset.v==='1')===c.use3d));
  $('#cfgVis').value=Math.round(c.vis*100);$('#cfgVisO').textContent=c.vis.toFixed(2);
  $('#cfgWin').value=c.win;$('#cfgWinO').textContent=c.win;
  $('#cfgConf').value=Math.round(c.conf*100);$('#cfgConfO').textContent=c.conf.toFixed(2);
  $('#cfgModel').value=c.model;$('#cfgMirror').checked=c.mirror;$('#cfgShow').checked=c.show;
  renderFacing();
}
async function restartCam(){if(cam.running){const v=cam.view;await camStart(v)}}
$$('#cfg3d button').forEach(b=>b.onclick=()=>{S.cam.use3d=b.dataset.v==='1';save();renderCamCfg()});
$('#cfgVis').oninput=e=>{S.cam.vis=+e.target.value/100;$('#cfgVisO').textContent=S.cam.vis.toFixed(2);save()};
$('#cfgWin').oninput=e=>{S.cam.win=+e.target.value;$('#cfgWinO').textContent=S.cam.win;save()};
$('#cfgConf').onchange=e=>{S.cam.conf=+e.target.value/100;$('#cfgConfO').textContent=S.cam.conf.toFixed(2);save();resetPose();restartCam()};
$('#cfgConf').oninput=e=>{$('#cfgConfO').textContent=(+e.target.value/100).toFixed(2)};
$('#cfgModel').onchange=e=>{S.cam.model=e.target.value;save();resetPose();restartCam()};
$('#camDev').onchange=e=>{S.cam.dev=e.target.value;save();renderFacing();restartCam()};
$('#cfgMirror').onchange=e=>{S.cam.mirror=e.target.checked;save();renderFacing()};
$('#cfgShow').onchange=e=>{S.cam.show=e.target.checked;save()};
$('#cfgReset').onclick=()=>{S.cam={...DEF.cam};save();resetPose();renderCamCfg();listCams();restartCam();toast('已還原偵測設定')};
if(navigator.mediaDevices&&navigator.mediaDevices.addEventListener)navigator.mediaDevices.addEventListener('devicechange',listCams);

/* ================= 前後鏡頭 ================= */
function renderFacing(){
  $$('.stage').forEach(st=>st.classList.toggle('rear',!isMirror()));
  $$('.session-camera-switch [data-facing]').forEach(b=>{b.classList.toggle('active',b.dataset.facing===S.facing);b.setAttribute('aria-pressed',String(b.dataset.facing===S.facing))});
  $$('.facingSeg').forEach(el=>{
    el.innerHTML=`<button type="button" data-f="user" class="${S.facing==='user'?'on':''}">前鏡頭</button><button type="button" data-f="environment" class="${S.facing==='environment'?'on':''}">後鏡頭</button>`;
    $$('button',el).forEach(b=>b.onclick=async()=>{
      if(S.facing===b.dataset.f)return;S.facing=b.dataset.f;save();renderFacing();
      if(cam.running){const v=cam.view;await camStart(v)}
    });
  });
}

/* ================= 錄影（含骨架、次數、倒數） ================= */
let recUrl=null;
/* 優先用 H.264 的 mp4（手機和 Windows 都能直接播放）；不支援時改用 webm。 */
function makeRecorder(stream){
  for(const m of ['video/mp4;codecs=avc1.42E01E','video/mp4;codecs=avc1','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4']){
    if(!MediaRecorder.isTypeSupported(m))continue;
    try{
      const mr=new MediaRecorder(stream,{mimeType:m,videoBitsPerSecond:1800000}),actual=(mr.mimeType||m).toLowerCase();
      if(actual.includes('mp4')&&/vp[89]|av01/.test(actual))continue;   // mp4 裡包 VP9 很多播放器打不開，改用 webm
      return mr;
    }catch(e){}
  }
  return new MediaRecorder(stream);
}
function drawRec(v,counter){
  const c=rec.canvas,x=rec.ctx,cw=c.width,ch=c.height,k=cw/640;
  const F='"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif';
  x.save();if(isMirror()){x.translate(cw,0);x.scale(-1,1)}
  x.drawImage(v.video,0,0,cw,ch);x.drawImage(v.canvas,0,0,cw,ch);x.restore();
  const name=counter?counter.key:v.nm.textContent,cnt=counter?counter.count:(+v.n.textContent||0);
  x.fillStyle='rgba(10,26,32,.62)';x.beginPath();rrect(x,10*k,10*k,170*k,112*k,16*k);x.fill();
  x.fillStyle='#93aeb3';x.font=`700 ${16*k}px ${F}`;x.fillText(name,22*k,34*k);
  x.fillStyle='#ffd23f';x.font=`800 ${66*k}px ${F}`;x.fillText(String(cnt),22*k,100*k);
  const nw=x.measureText(String(cnt)).width;x.fillStyle='#eaf4f1';x.font=`700 ${20*k}px ${F}`;x.fillText(v.unit||'下',22*k+nw+6*k,100*k);
  if(v.miniState){
    const m=v.miniState,col={work:'#ffd23f',rest:'#3dd6d0',prepare:'#2b4750',danger:'#ff6b57'}[m.kind]||'#ffd23f';
    x.fillStyle=col;x.beginPath();rrect(x,cw-132*k,10*k,122*k,86*k,16*k);x.fill();
    x.fillStyle=(m.kind==='prepare'||m.kind==='danger')?'#ffffff':'#0a1a20';x.textAlign='center';
    x.font=`700 ${14*k}px ${F}`;x.fillText(m.label.length>9?m.label.slice(0,9)+'…':m.label,cw-71*k,32*k);
    x.font=`800 ${46*k}px ${F}`;x.fillText(String(m.r),cw-71*k,84*k);x.textAlign='left';
  }
  if(v.cueInfo&&performance.now()<v.cueInfo.until){
    x.font=`800 ${20*k}px ${F}`;const w=x.measureText(v.cueInfo.text).width+36*k;
    x.fillStyle=v.cueInfo.bad?'#ff6b57':'rgba(61,214,208,.95)';x.beginPath();rrect(x,(cw-w)/2,ch-70*k,w,38*k,19*k);x.fill();
    x.fillStyle=v.cueInfo.bad?'#fff':'#0a1a20';x.textAlign='center';x.fillText(v.cueInfo.text,cw/2,ch-44*k);x.textAlign='left';
  }
  x.fillStyle='rgba(234,244,241,.7)';x.font=`700 ${14*k}px ${F}`;x.textAlign='right';x.fillText('Lin AI',cw-12*k,ch-10*k);x.textAlign='left';
}
function recBtnState(v,on){
  v.recBtn.classList.toggle('on',on);v.recBtn.setAttribute('aria-label',on?'停止錄影':'開始錄影');
  $('span',v.recBtn).textContent=on?'0:00':'錄影';
}
function recStart(v){
  if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){toast('這個瀏覽器不支援錄影，建議用 Chrome 或最新的 Safari');return}
  if(!(cam.running&&cam.view===v)){toast('請先開啟鏡頭，再開始錄影');return}
  const W=v.video.videoWidth,H=v.video.videoHeight,sc=Math.min(1,960/Math.max(W,H));
  rec.canvas=rec.canvas||document.createElement('canvas');rec.ctx=rec.canvas.getContext('2d');rec.scale=sc;
  rec.canvas.width=Math.round(W*sc);rec.canvas.height=Math.round(H*sc);
  try{rec.mr=makeRecorder(rec.canvas.captureStream(30))}
  catch(e){toast('無法開始錄影：'+e.message);return}
  rec.chunks=[];rec.mr.ondataavailable=e=>{if(e.data&&e.data.size)rec.chunks.push(e.data)};
  rec.mr.onstop=()=>finishRec(rec.mr.mimeType);
  drawRec(v,v.getCounter());rec.mr.start(1000);rec.on=true;rec.view=v;rec.t0=Date.now();recBtnState(v,true);
  rec.timer=setInterval(()=>{
    const sec=(Date.now()-rec.t0)/1000;$('span',v.recBtn).textContent=mmss(sec);
    if(sec>=300){toast('已錄滿 5 分鐘，自動停止');recStop()}
  },500);
}
function recStop(){
  if(!rec.on)return;rec.on=false;clearInterval(rec.timer);
  if(rec.view)recBtnState(rec.view,false);
  try{rec.mr.stop()}catch(e){}
}
function finishRec(mime){
  const type=(mime||'video/webm').split(';')[0],ext=type.includes('mp4')?'mp4':'webm';
  const blob=new Blob(rec.chunks,{type});rec.chunks=[];
  if(blob.size<1000){toast('錄影檔是空的，請再試一次');return}
  exitFull();
  if(recUrl)URL.revokeObjectURL(recUrl);
  recUrl=URL.createObjectURL(blob);
  const name=`lin-ai-錄影-${dkey(new Date())}-${hhmm(Date.now()).replace(':','')}.${ext}`;
  $('#recVideo').src=recUrl;$('#recDl').href=recUrl;$('#recDl').download=name;
  $('#recInfo').textContent=`長度約 ${mmss((Date.now()-rec.t0)/1000)}，大小 ${(blob.size/1048576).toFixed(1)} MB。影片只在你的裝置上，沒有上傳，也沒有收音。`;
  const f=new File([blob],name,{type});
  $('#recShare').hidden=!(navigator.canShare&&navigator.canShare({files:[f]}));
  $('#recShare').onclick=()=>navigator.share({files:[f],title:'Lin AI 訓練錄影'}).catch(()=>{});
  const dlg=$('#recDlg');if(dlg.showModal)dlg.showModal();else dlg.setAttribute('open','');
}
$('#recClose').onclick=()=>{const d=$('#recDlg');if(d.close)d.close();else d.removeAttribute('open')};
$('#recDlg').addEventListener('close',()=>{const v=$('#recVideo');v.pause();v.removeAttribute('src');v.load();if(recUrl){URL.revokeObjectURL(recUrl);recUrl=null}});

