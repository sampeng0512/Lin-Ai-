/* ============================================================
   14-備份與還原
   內容：匯出／匯入備份檔
   畫面：「統計紀錄」分頁的備份與還原
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 備份與還原 ================= */
$('#stExport').onclick=()=>{
  const blob=new Blob([JSON.stringify(S)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`lin-ai-備份-${dkey(new Date())}.json`;document.body.appendChild(a);a.click();a.remove();
  toast('已匯出備份檔');
};
$('#stImport').onchange=e=>{
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=async()=>{
    let o;
    try{
      o=JSON.parse(r.result);
      if(!o||typeof o!=='object'||typeof o.reps!=='number')throw new Error('這不是 Lin AI 的備份檔');
    }catch(err){toast('匯入失敗：'+err.message);return}
    if(!confirm(accountSession?'匯入會取代這個帳號（包含雲端）的所有紀錄，確定嗎？':'匯入會取代目前這個瀏覽器裡的所有紀錄，確定嗎？'))return;
    const keep=S;noSave=true;clearTimeout(saveT);saveT=0;
    try{
      S=stateFrom(o);
      if(accountSession&&activeUserId){clearTimeout(cloudSaveT);await syncAccountNow({force:true});localStorage.removeItem(dirtyKey(activeUserId))}
      localStorage.setItem(stateKey(),JSON.stringify(S));location.reload();
    }catch(err){S=keep;noSave=false;toast('匯入失敗：'+accountErrorText(err))}
  };
  r.readAsText(f);e.target.value='';
};

