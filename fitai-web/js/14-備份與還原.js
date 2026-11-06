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
  r.onload=()=>{
    try{
      const o=JSON.parse(r.result);
      if(!o||typeof o!=='object'||typeof o.reps!=='number')throw new Error('這不是 Lin AI 的備份檔');
      if(!confirm('匯入會取代目前這個瀏覽器裡的所有紀錄，確定嗎？'))return;
      noSave=true;localStorage.setItem(KEY,JSON.stringify(normalizeState({...DEF,...o})));location.reload();
    }catch(err){toast('匯入失敗：'+err.message)}
  };
  r.readAsText(f);e.target.value='';
};

