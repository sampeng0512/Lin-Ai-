/* ============================================================
   19-帳號與好友排行
   內容：Supabase 帳號登入／註冊、雲端同步、好友排行、群組、頭像、QR Code 邀請與掃描
   畫面：「好友排行」分頁、登入視窗、頭像視窗、QR 視窗
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 好友排行（Supabase，選用） ================= */
/* 站長把 Supabase 的 Project URL 和 Legacy anon key 填在這兩行，部署後所有朋友就能用。
   這兩個值本來就是設計成可以公開的（資料表有鎖，只能呼叫 supabase-setup.sql 建立的函式）。 */
const FRIEND_CFG={
  url: "https://cgswbvtkayfboskqorxs.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnc3didnRrYXlmYm9za3FvcnhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NjcwOTQsImV4cCI6MjEwNzU0MzA5NH0.0cB6uYxp-mw6_CE_RxjD-tdEtqayxbRMkp1HLXIvz5w"
};const sbCfg=()=>({url:String(FRIEND_CFG.url||'').trim().replace(/\/+$/,''),key:String(FRIEND_CFG.key||'').trim()});
function frCfgOk(){const c=sbCfg();return /^https?:\/\//.test(c.url)&&c.key.length>20}
async function rpc(fn,args){
  const {url,key}=sbCfg();if(!url||!key)throw new Error('NOCFG');
  const h={'content-type':'application/json',apikey:key,Authorization:'Bearer '+key};
  let r;try{r=await fetch(`${url}/rest/v1/rpc/${fn}`,{method:'POST',headers:h,body:JSON.stringify(args)})}catch(e){throw new Error('NETWORK')}
  const txt=await r.text();let data=null;try{data=txt?JSON.parse(txt):null}catch(e){}
  if(!r.ok){const err=new Error((data&&(data.message||data.error||data.hint))||('HTTP '+r.status));err.status=r.status;err.code=data&&data.code;throw err}
  return data;
}
const ACCOUNT_TABLE='fitai_user_data';
let accountSyncMessage='紀錄已同步',cloudSaveT=0,cloudQueue=Promise.resolve();
function readAccountSession(){try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'null')}catch(e){return null}}
function saveAccountSession(raw){
  accountSession={...raw,expires_at:raw.expires_at||Math.floor(Date.now()/1000)+(raw.expires_in||3600)};
  localStorage.setItem(AUTH_KEY,JSON.stringify(accountSession));return accountSession;
}
function clearAccountSession(){accountSession=null;localStorage.removeItem(AUTH_KEY)}
async function accountAuthRequest(path,payload,token){
  const {url,key}=sbCfg();if(!url||!key)throw new Error('帳號服務尚未設定。');
  let response;try{response=await fetch(`${url}/auth/v1/${path}`,{method:'POST',headers:{'content-type':'application/json',apikey:key,Authorization:`Bearer ${token||key}`},body:JSON.stringify(payload||{})})}catch(e){throw new Error('目前無法連線到帳號服務。')}
  const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch(e){}
  if(!response.ok){const err=new Error(data&&(data.msg||data.message||data.error_description||data.error)||`帳號服務錯誤（${response.status}）`);err.status=response.status;err.code=data&&(data.code||data.error_code);throw err}
  return data;
}
function accountRestHeaders(session,extra={}){const {key}=sbCfg();return {apikey:key,Authorization:`Bearer ${session.access_token}`,'content-type':'application/json',...extra}}
const ACCOUNT_EXPIRED_KEY='fitai_auth_expired_v1';
let accountRefreshing=null,accountExpiring=false;
function syncAccountFromStorage(){
  if(!accountSession)return;
  const stored=readAccountSession();
  if(stored&&stored.user&&stored.user.id===accountSession.user.id&&stored.refresh_token&&stored.refresh_token!==accountSession.refresh_token)accountSession=stored;
}
function isAccountExpiredError(error){
  if(!error||!(error.status===400||error.status===401||error.status===403))return false;
  return /refresh_token_not_found|refresh_token_already_used|session_not_found|session_expired/.test(String(error.code||''))||/invalid refresh token|refresh token not found|already used|session.*(not found|expired)/i.test(String(error.message||''));
}
function handleAccountExpired(){
  if(accountExpiring)return;
  accountExpiring=true;
  const email=accountSession&&accountSession.user&&accountSession.user.email||'';
  try{saveNow();if(activeUserId)localStorage.setItem(dirtyKey(activeUserId),'1');sessionStorage.setItem(ACCOUNT_EXPIRED_KEY,email||'1')}catch(e){}
  noSave=true;clearAccountSession();localStorage.removeItem(ACTIVE_KEY);activeUserId='';
  setTimeout(()=>location.reload(),50);
}
function showAccountExpiredNotice(){
  let flag=null;try{flag=sessionStorage.getItem(ACCOUNT_EXPIRED_KEY);sessionStorage.removeItem(ACCOUNT_EXPIRED_KEY)}catch(e){}
  if(!flag)return;
  setAccountMode('login');
  if(flag!=='1')$('#accountEmail').value=flag;
  $('#accountDlg').showModal();renderAccount();
  showAccountStatus('登入已過期，請重新登入。尚未同步的紀錄會在登入後自動上傳。',true);
}
addEventListener('storage',e=>{
  if(e.key!==AUTH_KEY||!accountSession)return;
  if(!e.newValue){location.reload();return}
  syncAccountFromStorage();
});
async function refreshAccountSession(){
  const used=accountSession.refresh_token;
  try{
    const data=await accountAuthRequest('token?grant_type=refresh_token',{refresh_token:used});
    return saveAccountSession({...data,user:data.user||accountSession.user});
  }catch(error){
    syncAccountFromStorage();
    if(accountSession&&accountSession.refresh_token!==used&&accountSession.expires_at>Date.now()/1000+90)return accountSession;
    if(isAccountExpiredError(error)){handleAccountExpired();const err=new Error('登入已過期，請重新登入。');err.expired=true;throw err}
    throw error;
  }
}
async function freshAccountSession(){
  if(!accountSession)throw new Error('請先登入帳號。');
  syncAccountFromStorage();
  if(accountSession.expires_at>Date.now()/1000+90)return accountSession;
  if(!accountRefreshing)accountRefreshing=refreshAccountSession().finally(()=>{accountRefreshing=null});
  return accountRefreshing;
}
function readAccountCache(id){try{const raw=localStorage.getItem(`${KEY}:user:${id}`);return raw?stateFrom(JSON.parse(raw)):null}catch(e){return null}}
function writeAccountCache(id,state){localStorage.setItem(`${KEY}:user:${id}`,JSON.stringify(state))}
function accountErrorText(error){
  const message=String(error&&error.message||error);
  if(error&&error.code==='PGRST205'||/fitai_user_data|schema cache/i.test(message))return '尚未建立帳號資料表，請先在 Supabase 套用 supabase/migrations/ 裡的 SQL。';
  if(/invalid login credentials/i.test(message))return '電子郵件或密碼不正確。';
  if(/email not confirmed/i.test(message))return '請先到信箱完成驗證，再登入。';
  if(/already registered|user already exists/i.test(message))return '這個電子郵件已註冊，請直接登入。';
  if(/email address not authorized/i.test(message))return 'Supabase 預設郵件服務只寄給專案團隊成員，無法寄給一般 Gmail。請在 Supabase 設定自訂 SMTP 後再重寄。';
  if(/email rate limit exceeded|over_email_send_rate_limit|too many requests/i.test(message))return '郵件發送次數過多，請稍等幾分鐘再試。';
  if(/password should be at least|weak password/i.test(message))return '密碼未符合 Supabase 的密碼規則。';
  return message;
}
function showAccountStatus(message,isError=false){const el=$('#accountStatus');el.textContent=message;el.style.color=isError?'var(--coral)':'var(--teal)'}
function renderAccount(){
  const signed=!!accountSession;
  $('#accountSignedOut').hidden=signed;$('#accountSignedIn').hidden=!signed;
  $('#accountBtn').textContent=signed?'帳號':'登入 / 註冊';
  $('#accountBtn').setAttribute('aria-label',signed?`帳號：${accountSession.user.email||'已登入'}`:'登入或建立帳號');
  if(signed){
    const email=accountSession.user.email||'已登入',sync=$('#accountSyncText');
    $('#accountEmailText').textContent=email;$('#accountEmailText').title=email;
    $('#accountAvatar').innerHTML=avatarHTML(S.me.avatar,S.me.name||email,S.me.code||email,'lg');
    sync.querySelector('span').textContent=accountSyncMessage;
    sync.classList.toggle('pending',/待處理/.test(accountSyncMessage));sync.classList.toggle('busy',/同步中/.test(accountSyncMessage));
  }
}
function scheduleCloudSave(){
  clearTimeout(cloudSaveT);cloudSaveT=setTimeout(()=>syncAccountNow().catch(()=>{}),1200);
}
/* ===== 雲端合併：上次同步時的雲端內容（base）＋本機變化＋雲端變化，三方合併 ===== */
const baseKey=id=>`${KEY}:base:${id}`;
function readBase(id){try{const b=JSON.parse(localStorage.getItem(baseKey(id))||'null');return b&&b.state&&typeof b.at==='string'?b:null}catch(e){return null}}
function writeBase(id,state,at){try{localStorage.setItem(baseKey(id),JSON.stringify({at:String(at||''),state}))}catch(e){logErr('base save '+e.message)}}
const MERGE_SUM=['xp','reps','workSecs','stars3','formOk','formBad','prCount','holdSecs','pyFull','days.*','exs.*','dayEx.*.*','workDays.*','water.*','kx.*','dayForm.*.ok','dayForm.*.bad','ver.reps','ver.days.*','ver.exs.*','ver.dayEx.*.*','ninja.hits','ninja.plays','ninja.secs','games.*.plays'];
const MERGE_MAX=['best.*','holdBest.*','games.*.best','ninja.best.*','ninja.bestCombo','ach.*'];
const pathIs=(path,list)=>list.some(p=>{const a=p.split('.');return a.length===path.length&&a.every((x,i)=>x==='*'||x===path[i])});
const jsonEq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const jclone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
function mergeList(b,l,r){
  const key=x=>x&&typeof x==='object'&&x.id!=null?'id:'+x.id:JSON.stringify(x);
  const count=a=>{const m=new Map();for(const x of a)m.set(key(x),(m.get(key(x))||0)+1);return m};
  const B=count(b),L=count(l),R=count(r),out=[],used=new Map();
  const want=k=>Math.max(0,(R.get(k)||0)+(L.get(k)||0)-(B.get(k)||0));
  for(const x of [...l,...r]){const k=key(x),n=used.get(k)||0;if(n<want(k)){used.set(k,n+1);out.push(jclone(x))}}
  if(out.length>1&&out.every(x=>x&&Number.isFinite(x.t))){const desc=l.length>1?l[0].t>=l[l.length-1].t:r.length>1?r[0].t>=r[r.length-1].t:true;out.sort((x,y)=>desc?y.t-x.t:x.t-y.t)}
  return out;
}
function mergeVal(b,l,r,path){
  if(jsonEq(l,r))return jclone(l);
  if(jsonEq(l,b))return jclone(r);
  if(jsonEq(r,b))return jclone(l);
  if(pathIs(path,MERGE_SUM)&&(typeof l==='number'||l===undefined)&&(typeof r==='number'||r===undefined)){const v=(Number(r)||0)+(Number(l)||0)-(Number(b)||0);return Math.max(0,Math.round(v*1000)/1000)}
  if(pathIs(path,MERGE_MAX)&&typeof l==='number'&&typeof r==='number')return Math.max(l,r);
  if(path.length===1&&path[0]==='me'&&isObj(l)&&isObj(r)&&l.id!==r.id)return jclone(r.id?r:l);
  if(path.length===2&&path[0]==='pr'&&isObj(l)&&isObj(r))return jclone((Number(r.n)||0)>(Number(l.n)||0)?r:l);
  if(Array.isArray(l)&&Array.isArray(r))return mergeList(Array.isArray(b)?b:[],l,r);
  if(isObj(l)&&isObj(r)){
    const base=isObj(b)?b:{},o={};
    for(const k of new Set([...Object.keys(l),...Object.keys(r)])){const v=mergeVal(base[k],l[k],r[k],[...path,k]);if(v!==undefined)o[k]=v}
    return o;
  }
  return jclone(l===undefined?r:l);
}
function mergeStates(base,local,remote){
  const o=stateFrom(mergeVal(base||{},local,remote,[]));
  o.runs.sort((a,b)=>String(b.d).localeCompare(String(a.d))||(Number(b.t)||0)-(Number(a.t)||0));
  return o;
}
async function accountRow(session){
  const {url}=sbCfg(),id=session.user.id;
  let response;try{response=await fetch(`${url}/rest/v1/${ACCOUNT_TABLE}?select=state,updated_at&user_id=eq.${encodeURIComponent(id)}&limit=1`,{headers:accountRestHeaders(session)})}catch(e){throw new Error('目前無法連線到雲端資料庫。')}
  const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch(e){}
  if(!response.ok){const err=new Error(data&&(data.message||data.hint||data.details)||`資料庫錯誤（${response.status}）`);err.status=response.status;err.code=data&&data.code;throw err}
  return Array.isArray(data)&&data.length?data[0]:null;
}
async function accountWrite(session,state,prevAt){
  const {url}=sbCfg(),id=session.user.id;
  const target=prevAt?`?user_id=eq.${encodeURIComponent(id)}&updated_at=eq.${encodeURIComponent(prevAt)}`:'';
  let response;try{response=await fetch(`${url}/rest/v1/${ACCOUNT_TABLE}${target}`,{method:prevAt?'PATCH':'POST',headers:accountRestHeaders(session,{prefer:'return=representation'}),body:JSON.stringify(prevAt?{state}:{user_id:id,state})})}catch(e){throw new Error('目前無法連線到雲端資料庫。')}
  const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch(e){}
  if(!prevAt&&response.status===409)return null;
  if(!response.ok){const err=new Error(data&&(data.message||data.hint||data.details)||`資料庫錯誤（${response.status}）`);err.status=response.status;err.code=data&&data.code;throw err}
  return Array.isArray(data)&&data.length?data[0]:null;
}
/* 把 local 寫上雲端：雲端在上次同步後被別的裝置改過就先合併；force＝直接取代（匯入備份、清除紀錄用） */
async function pushAccountState(session,local,{force=false}={}){
  const id=session.user.id;
  for(let attempt=0;attempt<4;attempt++){
    const row=await accountRow(session),base=readBase(id);
    let next=local;
    if(row&&!force&&!(base&&base.at===row.updated_at))next=base?mergeStates(base.state,local,row.state):local;
    const saved=await accountWrite(session,next,row&&row.updated_at);
    if(saved){writeBase(id,next,saved.updated_at);return next}
  }
  throw new Error('雲端資料一直被其他裝置更新，稍後會再同步。');
}
function applyMergedState(next,snapshot){
  const current=JSON.stringify(S);
  if(current===snapshot){if(JSON.stringify(next)===snapshot)return false;S=next}
  else S=mergeStates(JSON.parse(snapshot),S,next);
  writeAccountCache(activeUserId,S);
  if(typeof refreshAfterStateChange==='function')refreshAfterStateChange();
  return current!==snapshot;
}
function syncAccountNow({force=false}={}){
  if(!accountSession||!activeUserId||noSave&&!force)return Promise.resolve();
  const snapshot=JSON.stringify(S);
  cloudQueue=cloudQueue.catch(()=>{}).then(async()=>{
    if(!accountSession||activeUserId!==accountSession.user.id)return;
    const session=await freshAccountSession(),next=await pushAccountState(session,JSON.parse(snapshot),{force});
    if(activeUserId!==session.user.id)return;
    const changedMeanwhile=applyMergedState(next,snapshot);
    if(changedMeanwhile){localStorage.setItem(dirtyKey(activeUserId),'1');scheduleCloudSave()}
    else{localStorage.removeItem(dirtyKey(activeUserId));accountSyncMessage='雲端已同步';renderAccount()}
  }).catch(error=>{accountSyncMessage='同步待處理：'+accountErrorText(error);renderAccount();logErr('account sync '+error.message);throw error});
  return cloudQueue;
}
const hasRecords=o=>!!o&&(rpNum(o.reps)>0||rpNum(o.xp)>0||rpNum(o.workSecs)>0||(o.history||[]).length>0||(o.runs||[]).length>0||(o.manual||[]).length>0||Object.keys(o.food||{}).length>0||Object.keys(o.weights||{}).length>0||Object.keys(o.water||{}).length>0);
const rpNum=v=>Number(v)||0;
async function activateAccount(rawSession){
  const session=saveAccountSession(rawSession),id=session.user.id,cached=readAccountCache(id),wasDirty=localStorage.getItem(dirtyKey(id))==='1',guest=activeUserId?null:stateFrom(JSON.parse(JSON.stringify(S)));
  try{
    const fresh=await freshAccountSession(),row=await accountRow(fresh),base=readBase(id);
    let local,force=false,clearGuest=false;
    if(cached&&wasDirty&&base)local=cached;
    else if(row){
      local=stateFrom(row.state);writeBase(id,row.state,row.updated_at);
      if(hasRecords(guest)&&confirm('這台裝置有沒登入時留下的紀錄。要把它們合併到這個帳號嗎？\n（合併後，這些紀錄會移到帳號裡；選「取消」則保留在這台裝置的訪客模式）')){local=mergeStates(freshState(),guest,local);clearGuest=true}
    }else{local=cached||guest||freshState();force=true;clearGuest=!cached&&hasRecords(guest)}
    const next=await pushAccountState(fresh,local,{force});
    activeUserId=id;localStorage.setItem(ACTIVE_KEY,id);writeAccountCache(id,next);localStorage.removeItem(dirtyKey(id));
    if(clearGuest)localStorage.removeItem(KEY);
    noSave=true;location.reload();
  }catch(error){clearAccountSession();throw error}
}
async function initializeAccount(){
  if(!activeUserId){accountSession=null;renderAccount();showAccountExpiredNotice();return}
  const saved=readAccountSession();
  if(!saved||!saved.user||saved.user.id!==activeUserId){localStorage.removeItem(ACTIVE_KEY);activeUserId='';location.reload();return}
  accountSession=saved;
  try{
    const session=await freshAccountSession(),snapshot=JSON.stringify(S),row=await accountRow(session),base=readBase(activeUserId),wasDirty=localStorage.getItem(dirtyKey(activeUserId))==='1';
    if(!row||(wasDirty&&base)){const next=await pushAccountState(session,JSON.parse(snapshot),{force:!row});if(applyMergedState(next,snapshot)){localStorage.setItem(dirtyKey(activeUserId),'1');scheduleCloudSave()}else localStorage.removeItem(dirtyKey(activeUserId))}
    else if(wasDirty){const next=await pushAccountState(session,JSON.parse(snapshot),{force:true});applyMergedState(next,snapshot);localStorage.removeItem(dirtyKey(activeUserId))}
    else{writeBase(activeUserId,row.state,row.updated_at);applyMergedState(stateFrom(row.state),snapshot);localStorage.removeItem(dirtyKey(activeUserId))}
    accountSyncMessage='雲端已同步';
  }catch(error){accountSyncMessage='同步待處理：'+accountErrorText(error);logErr('account startup '+error.message)}
  renderAccount();
}
let accountMode='login';
function setAccountMode(mode){
  accountMode=mode;const signup=mode==='signup';
  for(const b of document.querySelectorAll('.acc-tabs button'))b.setAttribute('aria-selected',String(b.dataset.mode===mode));
  $('#accountHint').textContent=signup?'建立新帳號，密碼至少 8 個字元。註冊後可能需要先到信箱完成驗證。':'登入後，訓練與個人紀錄會同步到你的帳號。';
  $('#accountConfirmWrap').hidden=!signup;$('#accountRecover').hidden=signup;
  $('#accountResend').hidden=true;
  $('#accountPassword').autocomplete=signup?'new-password':'current-password';
  $('#accountSubmit').textContent=signup?'建立帳號':'登入';$('#accountSubmit').classList.toggle('teal',signup);
  $('#accountPassword2').value='';showAccountStatus('');
}
for(const b of document.querySelectorAll('.acc-tabs button'))b.onclick=()=>setAccountMode(b.dataset.mode);
$('#accountBtn').onclick=()=>{setAccountMode('login');$('#accountDlg').showModal();renderAccount()};
$('#accountClose').onclick=()=>$('#accountDlg').close();
async function accountLogin(email,password){
  showAccountStatus('正在登入…');
  const data=await accountAuthRequest('token?grant_type=password',{email,password});await activateAccount(data);
}
async function accountSignup(email,password){
  if(password.length<8){showAccountStatus('密碼至少需要 8 個字元。',true);return}
  if(password!==$('#accountPassword2').value){showAccountStatus('兩次輸入的密碼不一致。',true);return}
  showAccountStatus('正在建立帳號…');
  const data=await accountAuthRequest('signup',{email,password});
  if(data.session)await activateAccount(data.session);
  else{setAccountMode('login');$('#accountResend').hidden=false;showAccountStatus('確認信已寄出。請查看收件匣、垃圾郵件或促銷內容；預設信件通常是確認連結，不一定是數字驗證碼。')}
}
$('#accountForm').onsubmit=async e=>{
  e.preventDefault();
  const email=$('#accountEmail').value.trim(),password=$('#accountPassword').value;
  if(!email||!password){showAccountStatus('請輸入電子郵件和密碼。',true);return}
  $('#accountSubmit').disabled=true;
  try{await(accountMode==='signup'?accountSignup:accountLogin)(email,password)}catch(error){if(/email not confirmed/i.test(String(error&&error.message||error)))$('#accountResend').hidden=false;showAccountStatus(accountErrorText(error),true)}
  finally{$('#accountSubmit').disabled=false}
};
$('#accountRecover').onclick=async()=>{
  const email=$('#accountEmail').value.trim();if(!email){showAccountStatus('請先輸入註冊用的電子郵件。',true);return}
  try{await accountAuthRequest('recover',{email});showAccountStatus('若此電子郵件已註冊，密碼重設信已寄出。')}catch(error){showAccountStatus(accountErrorText(error),true)}
};
$('#accountResend').onclick=async()=>{
  const email=$('#accountEmail').value.trim();if(!email){showAccountStatus('請先輸入註冊用的電子郵件。',true);return}
  const btn=$('#accountResend');btn.disabled=true;showAccountStatus('正在重寄確認信…');
  try{await accountAuthRequest('resend',{type:'signup',email});showAccountStatus('已要求重寄確認信。請查看收件匣、垃圾郵件或促銷內容。')}
  catch(error){showAccountStatus(accountErrorText(error),true)}
  finally{btn.disabled=false}
};
$('#accountSyncNow').onclick=async()=>{
  const btn=$('#accountSyncNow');btn.disabled=true;saveNow();
  accountSyncMessage='同步中…';renderAccount();showAccountStatus('');
  try{await syncAccountNow();accountSyncMessage='雲端已同步';renderAccount()}catch(error){}
  finally{btn.disabled=false}
};
$('#accountLogout').onclick=async()=>{
  $('#accountLogout').disabled=true;saveNow();accountExpiring=true;
  try{await syncAccountNow();const session=await freshAccountSession();await accountAuthRequest('logout?scope=local',{},session.access_token)}catch(error){logErr('account logout '+error.message)}
  clearAccountSession();localStorage.removeItem(ACTIVE_KEY);activeUserId='';location.reload();
};
function friendly(e){
  const raw=String(e&&e.message||e||'');
  const m=sanitizeDisplayText(raw,'資料同步失敗，請稍後再試。');
  if(m==='NOCFG')return '好友伺服器還沒設定';
  if(m==='NETWORK')return '連不上伺服器，請檢查網路，或網址有沒有填對';
  if(e&&e.code==='PGRST202'||(e&&e.status===404&&/function|rpc/i.test(m)))return '伺服器還沒建立好：請先在 Supabase 的 SQL Editor 執行 supabase-setup.sql';
  if(e&&e.code==='42501')return 'Supabase 好友資料庫權限尚未修好：請在 SQL Editor 執行 supabase/migrations/20261102213000_fix_friend_rpc_security.sql，再重新整理';
  if((e&&(e.status===401||e.status===403))&&/invalid api key|invalid jwt|jwt expired|invalid claim/i.test(raw))return 'Supabase 金鑰或登入憑證無效，請確認目前使用的 anon / publishable key';
  if(e&&(e.status===401||e.status===403))return '伺服器拒絕這項操作，請檢查 Supabase 好友資料庫函式與權限設定';
  if(/invalid api key|invalid jwt|jwt expired|invalid claim/i.test(raw))return 'Supabase 金鑰或登入憑證無效，請確認目前使用的 anon / publishable key';
  if(/not found/i.test(m))return '找不到這個好友代碼，請確認有沒有輸入錯';
  if(/^self$/.test(m))return '不能加自己為好友';
  if(/profile required/i.test(m))return '請先建立你的資料';
  if(/name required/i.test(m))return '請輸入暱稱';
  if(/too many/i.test(m))return '好友人數已達上限（100 位）';
  if(/group not found/i.test(m))return '找不到這個群組代碼，請確認是否輸入正確。';
  if(/group is full/i.test(m))return '這個群組已達 100 人上限。';
  if(/group membership required/i.test(m))return '你目前不是這個群組的成員，請重新整理群組清單。';
  if(/group name required/i.test(m))return '請輸入群組名稱。';
  if(/資料同步失敗|發生錯誤/i.test(m))return '資料同步失敗，請稍後再試。';
  return '發生錯誤：'+m;
}
const uuid=()=>(window.crypto&&crypto.randomUUID)?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)});
const weekKey=()=>dkey(weekDates()[0]);
const weekRepsNow=()=>weekDates().reduce((a,d)=>a+(S.ver.days[dkey(d)]||0),0);   // 好友排行只算鏡頭偵測的次數
const weekExerciseRepsNow=()=>weekDates().reduce((totals,d)=>{for(const [ex,n] of Object.entries(S.ver.dayEx[dkey(d)]||{}))totals[ex]=(totals[ex]||0)+n;return totals},{});
const frBasePayload=()=>({p_id:S.me.id,p_name:S.me.name,p_reps:S.ver.reps|0,p_xp:S.xp|0,p_streak:streaks(S.ver.days).cur|0,p_week:weekRepsNow()|0,p_week_key:weekKey()});
const frPayload=()=>({...frBasePayload(),p_ex_reps:S.ver.exs,p_week_ex_reps:weekExerciseRepsNow()});
const frSig=()=>JSON.stringify([S.me.name,S.ver.reps,S.ver.exs,S.xp,streaks(S.ver.days).cur,weekRepsNow(),weekExerciseRepsNow(),weekKey()]);
let frPending='',frRows=[],frSort='week',frAt=0,frBusy=false,frSyncT=0,frLastSig='',frLast=0,frExerciseStatsSupported=null,frCodeBusy=false;
let frGroups=[],frGroupId='',frGroupBusy=false,frGroupLoadToken=0;
async function friendUpsert(){
  if(frExerciseStatsSupported===false)return rpc('lin_upsert_profile',frBasePayload());
  try{const code=await rpc('lin_upsert_profile',frPayload());frExerciseStatsSupported=true;return code}
  catch(e){
    if(frExerciseStatsSupported===false||!(e.code==='PGRST202'||e.code==='PGRST203'||/parameter|could not find function|does not exist/i.test(String(e.message))))throw e;
    frExerciseStatsSupported=false;
    return rpc('lin_upsert_profile',frBasePayload());
  }
}
function validFriendCode(value){
  if(typeof value==='string'&&/^[A-Z0-9]{6}$/i.test(value.trim()))return value.trim().toUpperCase();
  if(Array.isArray(value)&&value.length===1)return validFriendCode(value[0]);
  if(value&&typeof value==='object')return validFriendCode(value.code||value.lin_upsert_profile);
  return '';
}
async function resolveFriendCode(result){
  const direct=validFriendCode(result);
  if(direct)return direct;
  const rows=await rpc('lin_get_board',{p_id:S.me.id,p_exercise_id:null,p_action_name:null,p_period:'weekly'});
  const mine=Array.isArray(rows)&&rows.find(row=>row.is_me);
  const recovered=validFriendCode(mine&&mine.code);
  if(recovered)return recovered;
  throw new Error('暱稱已送出，但伺服器沒有回傳好友代碼。請再按一次「儲存」重試。');
}
async function friendSync(force){
  if(!S.me.id||!frCfgOk())return;
  const sig=frSig();if(!force&&sig===frLastSig)return;
  const wait=15000-(Date.now()-frLast);
  if(!force&&wait>0){clearTimeout(frSyncT);frSyncT=setTimeout(()=>friendSync(false),wait+50);return}   // 太頻繁就延後，不要丟掉這次更新
  frLast=Date.now();
  try{const result=await friendUpsert(),code=await resolveFriendCode(result);frLastSig=sig;if(code!==S.me.code){S.me.code=code;save();renderFriends()}}
  catch(e){logErr('friendSync '+e.message)}
}
function friendSyncSoon(){if(!S.me.id||!frCfgOk()||frSig()===frLastSig)return;clearTimeout(frSyncT);frSyncT=setTimeout(()=>friendSync(false),8000)}
async function friendCreate(){
  if(frCodeBusy)return;
  const name=$('#frName').value.trim().slice(0,12);
  if(!name){toast('請輸入暱稱（最多 12 個字）');return}
  frCodeBusy=true;$('#frSaveMe').disabled=true;
  const isNew=!S.me.id,old=S.me.name;if(isNew)S.me.id=uuid();S.me.name=name;
  try{
    const result=await friendUpsert(),code=await resolveFriendCode(result);
    S.me.code=code;frLastSig=frSig();frLast=Date.now();save();
    if(S.me.avatar)pushAvatar();
    toast(isNew?`已建立，你的好友代碼是 ${S.me.code}`:'已儲存暱稱');
    if(frPending){const c=frPending;frPending='';await friendAdd(c,false)}
    await friendBoard();
  }catch(e){if(!isNew)S.me.name=old;save();toast(friendly(e))}
  finally{frCodeBusy=false;$('#frSaveMe').disabled=false;renderFriends()}
}
async function ensureFriendCode(){
  if(!frCfgOk()||!S.me.name||S.me.code||frCodeBusy)return !!S.me.code;
  frCodeBusy=true;
  const isNew=!S.me.id;
  if(isNew)S.me.id=uuid();
  const note=$('#frNote'),button=$('#frSaveMe');
  button.disabled=true;renderFriends();
  note.hidden=false;note.textContent='正在建立好友代碼…';
  try{
    const result=await friendUpsert(),code=await resolveFriendCode(result);
    S.me.code=code;frLastSig=frSig();frLast=Date.now();save();
    renderFriends();
    toast(`好友代碼已準備好：${S.me.code}`);
    return true;
  }catch(e){
    save();note.hidden=false;note.textContent=friendly(e);logErr('ensureFriendCode '+e.message);
    return false;
  }finally{
    frCodeBusy=false;button.disabled=false;
  }
}
async function friendAdd(code,confirmFirst){
  code=String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(code.length!==6){toast('好友代碼是 6 個英文字母或數字');return}
  if(!S.me.id){frPending=code;toast('先設定暱稱，建立後會自動加入好友');renderFriends();return}
  if(confirmFirst&&!confirm(`要用代碼 ${code} 加好友嗎？`))return;
  try{const nm=await rpc('lin_add_friend',{p_id:S.me.id,p_code:code});toast(`已加入好友：${nm}`);$('#frCode').value='';await friendBoard()}
  catch(e){toast(friendly(e))}
}
async function friendBoard(){
  if(!S.me.id||!frCfgOk()||frBusy){renderBoard();return}
  frBusy=true;$('#frNote').hidden=true;
  try{
    const boardArgs={p_id:S.me.id,p_exercise_id:null,p_action_name:null,p_period:'weekly'};
    let rows=await rpc('lin_get_board',boardArgs)||[];
    if(!rows.length){await friendSync(true);rows=await rpc('lin_get_board',boardArgs)||[]}   // 伺服器上的資料不見了（例如重設過）就補回去
    frRows=rows;frAt=Date.now();const n=Math.max(0,rows.length-1);
    await friendAvatars(rows);
    if(n!==S.me.friends){S.me.friends=n;save();renderStats()}
  }catch(e){$('#frNote').hidden=false;$('#frNote').textContent=friendly(e)}
  frBusy=false;renderBoard();
}
let frAvatars={},frAvatarOk=null;   // frAvatarOk=false：伺服器還沒執行 supabase-avatars.sql
const avMissing=e=>e.code==='PGRST202'||/could not find (the )?function/i.test(String(e.message));
async function friendAvatars(rows){
  if(frAvatarOk===false)return;
  try{
    const res=await rpc('lin_get_avatars',{p_codes:rows.map(r=>r.code).filter(Boolean)})||[];
    frAvatarOk=true;frAvatars=Object.fromEntries(res.map(x=>[x.code,x.avatar]));
    if(S.me.code&&(frAvatars[S.me.code]||'|')!==(S.me.avatar||'|'))pushAvatar();   // 伺服器上的頭像跟本機不同就補上
  }catch(e){if(avMissing(e))frAvatarOk=false;else logErr('friendAvatars '+e.message)}
}
async function pushAvatar(){
  if(!S.me.id||!S.me.code||!frCfgOk()||frAvatarOk===false)return;
  try{await rpc('lin_set_avatar',{p_id:S.me.id,p_code:S.me.code,p_avatar:S.me.avatar||'|'});frAvatarOk=true;frAvatars[S.me.code]=S.me.avatar||'|'}
  catch(e){if(avMissing(e))frAvatarOk=false;else logErr('pushAvatar '+e.message)}
}
let avDraft={e:'',ci:-1,img:''},avTab='人物';
function myAvatarName(){return S.me.name||(accountSession&&accountSession.user.email)||'我'}
const avDraftValue=()=>avDraft.img||(avDraft.e||avDraft.ci>=0?`${avDraft.e}|${avDraft.ci>=0?avDraft.ci:''}`:'');
function renderAvatarDlg(){
  const seed=S.me.code||myAvatarName();
  $('#avPreview').innerHTML=avatarHTML(avDraftValue(),myAvatarName(),seed,'xl');$('#avPreviewName').textContent=myAvatarName();
  $('#avTabs').innerHTML=Object.keys(AV_GROUPS).map(g=>`<button type="button" data-g="${g}" class="${g===avTab?'on':''}">${g}</button>`).join('');
  $('#avEmojis').innerHTML=AV_GROUPS[avTab].map(e=>`<button type="button" data-e="${e}" aria-label="頭像 ${e}" aria-pressed="${!avDraft.img&&e===avDraft.e}">${e}</button>`).join('');
  $('#avColorBox').hidden=!!avDraft.img;
  const shown=avDraft.ci>=0?avDraft.ci:avHash(seed)%AV_COLORS.length;
  $$('#avColors button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.ci===shown)));
}
function openAvatarDlg(){avDraft=avParse(S.me.avatar);avTab=Object.keys(AV_GROUPS).find(g=>AV_GROUPS[g].includes(avDraft.e))||'人物';renderAvatarDlg();$('#avatarDlg').showModal()}
/* 照片裁成正方形、縮到 96×96 的 JPEG，通常只有幾 KB，好友排行榜載入也快 */
async function avatarFromFile(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=url});
    const side=Math.min(img.naturalWidth,img.naturalHeight),cv=document.createElement('canvas');cv.width=cv.height=96;
    cv.getContext('2d').drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,96,96);
    for(const q of [.82,.7,.55]){const d=cv.toDataURL('image/jpeg',q);if(d.length<=20000)return d}
    throw new Error('too big');
  }finally{URL.revokeObjectURL(url)}
}
$('#avColors').innerHTML=AV_COLORS.map((c,i)=>`<button type="button" data-ci="${i}" style="background:${c}" aria-label="底色 ${i+1}"></button>`).join('');
$('#avTabs').onclick=e=>{const b=e.target.closest('button');if(b){avTab=b.dataset.g;renderAvatarDlg()}};
$('#avEmojis').onclick=e=>{const b=e.target.closest('button');if(b){avDraft.e=b.dataset.e;avDraft.img='';renderAvatarDlg()}};
$('#avColors').onclick=e=>{const b=e.target.closest('button');if(b){avDraft.ci=+b.dataset.ci;renderAvatarDlg()}};
$('#avFile').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{avDraft.img=await avatarFromFile(f);renderAvatarDlg()}catch(err){toast('這張圖片讀不出來，請換一張 JPG 或 PNG');logErr('avatar photo '+err.message)}
};
$('#avReset').onclick=()=>{avDraft.e='';avDraft.img='';renderAvatarDlg()};
$('#avCancel').onclick=()=>$('#avatarDlg').close();
$('#avSave').onclick=async()=>{
  S.me.avatar=avDraftValue();save();
  $('#avatarDlg').close();renderAccount();renderFriends();renderBoard();
  await pushAvatar();
  toast(S.me.id&&frAvatarOk===false?'頭像已儲存。要讓好友看到，請先在 Supabase 執行 supabase-avatars.sql':'頭像已更新');
};
$('#accountAvatar').onclick=openAvatarDlg;$('#frAvatarBtn').onclick=openAvatarDlg;
const wkOf=r=>r.week_key===weekKey()?r.week_reps:0;
const lvOf=r=>Math.floor(r.xp/100)+1;
const agoTxt=t=>{const m=(Date.now()-new Date(t).getTime())/60000;if(!isFinite(m))return '';return m<2?'剛剛':m<60?Math.round(m)+' 分鐘前':m<1440?Math.round(m/60)+' 小時前':Math.round(m/1440)+' 天前'};
$('#frExercise').innerHTML=optsByCat(ORDER);
$('#frExercise').value=ORDER.includes(S.statsEx)?S.statsEx:ORDER[0];
function renderBoard(){
  const el=$('#frBoard');
  if(!S.me.id){el.innerHTML='<p class="mute small">先在上面設定暱稱，才能看到排行榜。</p>';$('#frAt').textContent='';return}
  if(!frRows.length){el.innerHTML='<p class="mute small">還沒有資料。</p>';return}
  const ex=$('#frExercise').value,actionField=frSort==='week'?'week_ex_reps':'ex_reps';
  if(['week','total'].includes(frSort)&&!frRows.every(r=>r[actionField]&&typeof r[actionField]==='object')){
    el.innerHTML='<p class="notice warn small">好友伺服器尚未提供分動作統計，請更新 Supabase 的 lin_upsert_profile 與 lin_get_board，加入每個動作的累計及本週次數欄位後再使用。</p>';
    $('#frAt').textContent='';return;
  }
  const val=['week','total'].includes(frSort)?r=>Number((r[actionField]||{})[ex])||0:{streak:r=>r.streak,level:lvOf}[frSort],unit={week:'下',total:'下',streak:'天',level:'級'}[frSort];
  const rows=[...frRows].sort((a,b)=>val(b)-val(a)||String(a.name).localeCompare(String(b.name)));
  if(rows.length<2){
    el.innerHTML=`<div class="fr-empty"><div class="big">🏁</div><p><b>還沒有好友</b></p><p class="small mute">邀請朋友一起練，排行榜才會熱鬧起來！</p><div class="row" style="justify-content:center"><button class="btn teal" type="button" data-act="invite">分享邀請連結</button><button class="btn ghost" type="button" data-act="scan">掃描 QR 碼</button></div></div>`;
    $('#frAt').textContent='';return;
  }
  let rank=0,prev=null;
  const ranked=rows.map((r,i)=>{const v=val(r);if(v!==prev){rank=i+1;prev=v}return{r,v,rank}});   // 同分同名次
  const top=Math.max(1,ranked[0].v),av=(r,cls)=>avatarHTML(r.is_me?S.me.avatar:frAvatars[r.code],r.name,r.code,cls);
  const del=r=>r.is_me?'':`<button class="xbtn" type="button" data-code="${esc(r.code)}" aria-label="刪除好友 ${esc(r.name)}">×</button>`;
  /* 自己的名次＋離前一名差多少 */
  const mi=ranked.findIndex(x=>x.r.is_me),mine=ranked[mi];let tip='';
  if(mine){
    const ahead=ranked.slice(0,mi).reverse().find(x=>x.v>mine.v);
    tip=mine.rank===1?(ranked[1]&&ranked[1].v<mine.v?`你是第一名！領先第二名 <b>${mine.v-ranked[1].v}</b> ${unit} 🔥`:'你目前並列第一，再多練一點就能獨占冠軍！')
      :ahead?`再 <b>${ahead.v-mine.v}</b> ${unit}就能超越 <b>${esc(ahead.r.name)}</b>，衝！`:'';
  }
  const mineHTML=mine?`<div class="fr-mine">${av(mine.r,'')}<div class="grow"><div>你目前第 <b>${mine.rank}</b> 名 / ${rows.length} 人</div>${tip?`<div class="small">${tip}</div>`:''}</div></div>`:'';
  const pod=ranked.slice(0,3),order=pod.length===3?[pod[1],pod[0],pod[2]]:pod.length===2?[pod[1],pod[0]]:pod;
  const podHTML=`<div class="podium" style="grid-template-columns:repeat(${order.length},1fr)">${order.map(({r,v,rank})=>`<div class="pod p${Math.min(rank,3)} ${r.is_me?'me':''}">${rank===1?'<span class="crown">👑</span>':''}${av(r,rank===1?'xl':'lg')}<b>${esc(r.name)}${r.is_me?'（我）':''}</b><span class="pv">${v}<small>${unit}</small></span><span class="step">${rank}</span>${del(r)}</div>`).join('')}</div>`;
  const listHTML=ranked.slice(3).map(({r,v,rank})=>{
    const summary=`${ex} 本週 ${Number((r.week_ex_reps||{})[ex])||0}　累計 ${Number((r.ex_reps||{})[ex])||0}`;
    return `<div class="fr ${r.is_me?'me':''}"><span class="rk r${Math.min(rank,4)}">${rank}</span>${av(r,'')}<div class="grow"><b>${esc(r.name)}${r.is_me?'（我）':''}</b><span class="small mute">${summary}　連續 ${r.streak} 天　等級 ${lvOf(r)}　${agoTxt(r.updated_at)}</span><span class="meter"><i style="width:${Math.round(Math.max(0,v)/top*100)}%"></i></span></div><span class="fv">${v}<small>${unit}</small></span>${del(r)}</div>`;
  }).join('');
  const avNote=frAvatarOk===false?'<p class="notice warn small" style="margin:0 0 12px">看不到好友的頭像：好友伺服器還沒啟用頭像功能。請在 Supabase 套用 <b>supabase/migrations/</b> 裡的 SQL，再按「重新整理」。</p>':'';
  el.innerHTML=avNote+mineHTML+podHTML+listHTML;
  $('#frAt').textContent=`共 ${rows.length-1} 位好友・只計算鏡頭偵測的次數・更新於 ${hhmm(frAt)}`;
}
function setFriendGroupNote(message,isError=false){
  const note=$('#frGroupNote');
  note.hidden=!message;note.textContent=message||'';
  note.classList.toggle('warn',isError);
}
function renderFriendGroupBoard(rows){
  const el=$('#frGroupBoard');
  if(!rows.length){el.innerHTML='<p class="small mute">群組目前沒有成員資料。</p>';return}
  const sorted=[...rows].sort((a,b)=>{
    const aw=a.week_key===weekKey()?Number(a.week_reps)||0:0,bw=b.week_key===weekKey()?Number(b.week_reps)||0:0;
    return bw-aw||(Number(b.xp)||0)-(Number(a.xp)||0)||String(a.name).localeCompare(String(b.name));
  });
  const max=Math.max(1,...sorted.map(r=>r.week_key===weekKey()?Number(r.week_reps)||0:0));
  el.innerHTML=sorted.map((r,i)=>{
    const weekly=r.week_key===weekKey()?Number(r.week_reps)||0:0;
    return `<div class="fr ${r.is_me?'me':''}"><span class="rk r${Math.min(i+1,4)}">${i+1}</span>${avatarHTML(r.is_me?S.me.avatar:frAvatars[r.code],r.name,r.code,'')}<div class="grow"><b>${esc(r.name)}${r.is_me?'（我）':''}</b><span class="small mute">本週 ${weekly} 下　累計 ${Number(r.reps)||0} 下　連續 ${Number(r.streak)||0} 天　等級 ${lvOf(r)}</span><span class="meter"><i style="width:${Math.round(weekly/max*100)}%"></i></span></div><span class="fv">${weekly}<small>下</small></span></div>`;
  }).join('');
}
function renderFriendGroups(){
  const hasGroups=frGroups.length>0;
  $('#frGroupCount').textContent=hasGroups?`已加入 ${frGroups.length} 個群組`:'尚未加入群組';
  $('#frGroupContent').hidden=!hasGroups;
  $('#frGroupSelect').innerHTML=frGroups.map(g=>`<option value="${esc(g.group_id)}">${esc(g.name)}・${Number(g.member_count)||0} 人</option>`).join('');
  if(!hasGroups){frGroupId='';$('#frGroupBoard').innerHTML='<p class="small mute">建立群組後，把 6 碼群組代碼分享給朋友；朋友加入後就會出現在這裡。</p>';return}
  if(!frGroups.some(g=>g.group_id===frGroupId))frGroupId=frGroups[0].group_id;
  $('#frGroupSelect').value=frGroupId;
  const current=frGroups.find(g=>g.group_id===frGroupId);
  $('#frGroupMeta').textContent=`${Number(current.member_count)||0} 位成員${current.is_owner?'・你是群組建立者':''}`;
  $('#frGroupLeave').textContent=current.is_owner?'退出並交接群組':'退出群組';
}
async function loadFriendGroupBoard(){
  if(!frGroupId||!S.me.id)return;
  const token=++frGroupLoadToken;
  try{
    const rows=await rpc('lin_get_group_board',{p_id:S.me.id,p_group_id:frGroupId});
    if(token!==frGroupLoadToken)return;
    if(!Array.isArray(rows))throw new Error('群組排行榜回傳格式不正確');
    await friendAvatars(rows);renderFriendGroupBoard(rows);
  }catch(e){if(token===frGroupLoadToken){$('#frGroupBoard').innerHTML='';setFriendGroupNote(e.code==='PGRST202'?'群組功能尚未設定：請在 Supabase 執行 supabase/migrations/20261102220000_friend_groups.sql。':friendly(e),true)}}
}
async function loadFriendGroups(){
  if(!frCfgOk())return;
  if(!S.me.id){setFriendGroupNote('先儲存暱稱並建立好友代碼，才能建立或加入群組。');return}
  setFriendGroupNote('');
  try{
    const rows=await rpc('lin_get_groups',{p_id:S.me.id});
    if(!Array.isArray(rows))throw new Error('群組清單回傳格式不正確');
    frGroups=rows;renderFriendGroups();
    if(frGroupId)await loadFriendGroupBoard();
  }catch(e){
    setFriendGroupNote(e.code==='PGRST202'?'群組功能尚未設定：請在 Supabase 執行 supabase/migrations/20261102220000_friend_groups.sql。':friendly(e),true);
  }
}
async function createFriendGroup(){
  if(!S.me.id){setFriendGroupNote('請先儲存暱稱並取得好友代碼。',true);return}
  const name=$('#frGroupName').value.trim().slice(0,30);
  if(!name){setFriendGroupNote('請輸入群組名稱。',true);return}
  const button=$('#frGroupCreate');button.disabled=true;
  try{
    const group=await rpc('lin_create_group',{p_id:S.me.id,p_name:name});
    if(!group||!group.id||!group.code)throw new Error('建立成功但伺服器沒有回傳群組代碼');
    $('#frGroupName').value='';frGroupId=group.id;
    await loadFriendGroups();setFriendGroupNote(`已建立「${group.name}」，群組代碼：${group.code}。分享代碼讓朋友加入。`);
  }catch(e){setFriendGroupNote(e.code==='PGRST202'?'群組功能尚未設定：請在 Supabase 執行 supabase/migrations/20261102220000_friend_groups.sql。':friendly(e),true)}
  finally{button.disabled=false}
}
async function joinFriendGroup(){
  if(!S.me.id){setFriendGroupNote('請先儲存暱稱並取得好友代碼。',true);return}
  const code=$('#frGroupCode').value.toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(code.length!==6){setFriendGroupNote('群組代碼需為 6 個英文字母或數字。',true);return}
  const button=$('#frGroupJoin');button.disabled=true;
  try{
    const group=await rpc('lin_join_group',{p_id:S.me.id,p_code:code});
    if(!group||!group.id)throw new Error('加入成功但伺服器沒有回傳群組資訊');
    $('#frGroupCode').value='';frGroupId=group.id;
    await loadFriendGroups();setFriendGroupNote(`已加入群組「${group.name}」。`);
  }catch(e){setFriendGroupNote(e.code==='PGRST202'?'群組功能尚未設定：請在 Supabase 執行 supabase/migrations/20261102220000_friend_groups.sql。':friendly(e),true)}
  finally{button.disabled=false}
}
async function leaveFriendGroup(){
  const group=frGroups.find(g=>g.group_id===frGroupId);if(!group)return;
  const promptText=group.is_owner?'退出後會把群組管理權交給最早加入的成員；若只剩你，群組會刪除。確定退出？':'確定退出這個群組？';
  if(!confirm(promptText))return;
  try{
    await rpc('lin_leave_group',{p_id:S.me.id,p_group_id:frGroupId});
    frGroups=frGroups.filter(g=>g.group_id!==frGroupId);frGroupId='';renderFriendGroups();setFriendGroupNote('已退出群組。');
    if(frGroups.length)await loadFriendGroups();
  }catch(e){setFriendGroupNote(e.code==='PGRST202'?'群組功能尚未設定：請在 Supabase 執行 supabase/migrations/20261102220000_friend_groups.sql。':friendly(e),true)}
}
$('#frGroupCreate').onclick=createFriendGroup;
$('#frGroupJoin').onclick=joinFriendGroup;
$('#frGroupCode').addEventListener('keydown',e=>{if(e.key==='Enter')joinFriendGroup()});
$('#frGroupSelect').onchange=()=>{
  frGroupId=$('#frGroupSelect').value;
  renderFriendGroups();loadFriendGroupBoard();
};
$('#frGroupLeave').onclick=leaveFriendGroup;
$('#frGroupCopy').onclick=async()=>{
  const group=frGroups.find(g=>g.group_id===frGroupId);if(!group)return;
  try{await navigator.clipboard.writeText(group.invite_code);setFriendGroupNote(`已複製群組代碼：${group.invite_code}`)}
  catch(e){prompt('請複製群組代碼：',group.invite_code)}
};
function renderFriends(){
  const ok=frCfgOk();
  $('#frNoCfg').hidden=true;
  $('#frMain').hidden=false;
  $('#frName').value=S.me.name||$('#frName').value;
  $('#frAvatarBtn').innerHTML=avatarHTML(S.me.avatar,S.me.name||$('#frName').value||myAvatarName(),S.me.code||myAvatarName(),'lg');
  $('#frSaveMe').textContent=S.me.id?'儲存':'儲存暱稱';
  $('#frInfo').hidden=!S.me.name && !S.me.code;
  $('#frInfoName').textContent=S.me.name||$('#frName').value||'尚未設定';
  $('#frInfoCode').textContent=S.me.code||'—';
  $('#frMeBox').hidden=true;
  if(S.me.code)renderMyQR($('#frQR'),3);
  else{$('#frQR').dataset.link='';$('#frQR').innerHTML=`<span class="small">${S.me.name?(frCodeBusy?'正在準備好友 QR…':'好友代碼尚未建立，按「儲存」重試'):'儲存暱稱後產生好友 QR'}</span>`}
  $('#frAddBox').hidden=!ok;
  const boardCard=$('#frBoard')&&$('#frBoard').closest('.card');
  if(boardCard)boardCard.hidden=!S.me.id||!ok;
  $$('#frSort button').forEach(b=>b.classList.toggle('on',b.dataset.v===frSort));
  if(frPending&&ok){$('#frNote').hidden=false;$('#frNote').textContent=S.me.id?'':`你收到好友邀請（代碼 ${frPending}）。先設定暱稱，建立後會自動加入。`}
  else{$('#frNote').hidden=true;$('#frNote').textContent='';}
}
$('#frSaveMe').onclick=friendCreate;
$('#frName').addEventListener('keydown',e=>{if(e.key==='Enter')friendCreate()});
$('#frAdd').onclick=()=>friendAdd($('#frCode').value,false);
$('#frCode').addEventListener('keydown',e=>{if(e.key==='Enter')friendAdd($('#frCode').value,false)});
$('#frRefresh').onclick=()=>{if(frAvatarOk===false)frAvatarOk=null;friendBoard()};   // 剛執行完 SQL 時，按重新整理就會重新抓頭像
seg($('#frSort'),b=>{frSort=b.dataset.v;renderBoard()});
$('#frExercise').onchange=renderBoard;

$('#frBoard').onclick=async e=>{
  const act=e.target.closest('[data-act]');if(act){act.dataset.act==='scan'?startScan():shareInvite();return}
  const b=e.target.closest('[data-code]');if(!b||!confirm('確定要刪除這位好友嗎？對方的名單裡也會移除你。'))return;
  try{await rpc('lin_remove_friend',{p_id:S.me.id,p_code:b.dataset.code});toast('已刪除好友');await friendBoard()}catch(err){toast(friendly(err))}
};
const inviteLink=()=>{
  const base=/^(localhost|127\.0\.0\.1)$/.test(location.hostname)?'https://lin-ai-coach.netlify.app/':`${location.origin}${location.pathname}`;
  return `${base}?add=${S.me.code}`;
};
async function shareInvite(){
  const link=inviteLink(),text=`來跟我一起用 Lin AI 健身，加我好友！我的好友代碼：${S.me.code}`;
  if(navigator.share){try{await navigator.share({title:'Lin AI 好友邀請',text,url:link});return}catch(e){if(e.name==='AbortError')return}}
  try{await navigator.clipboard.writeText(text+'\n'+link);toast('已複製邀請文字和連結')}catch(e){prompt('請全選複製：',text+'\n'+link)}
}
const frInviteButton=$('#frInvite');if(frInviteButton)frInviteButton.onclick=shareInvite;
/* ===== QR Code：產生自己的邀請 QR、用鏡頭或相簿圖片掃朋友的 ===== */
const QR_GEN='https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js',QR_READ='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
async function renderMyQR(el,cell){
  const link=inviteLink();if(el.dataset.link===link)return;
  try{await loadScript(QR_GEN);const q=window.qrcode(0,'M');q.addData(link);q.make();el.innerHTML=q.createSvgTag({cellSize:cell,margin:1,scalable:true});el.dataset.link=link}
  catch(e){el.innerHTML=`<span class="small">QR 載入失敗，請檢查網路。<br>好友代碼：${esc(S.me.code)}</span>`;logErr('qr gen '+e.message)}
}
$('#frQR').onclick=()=>{if(!S.me.code){toast('好友代碼還在準備中，請稍後再試');return}$('#qrCode').textContent=S.me.code;$('#qrBig').dataset.link='';renderMyQR($('#qrBig'),8);$('#qrDlg').showModal()};
$('#qrClose').onclick=()=>$('#qrDlg').close();
function codeFromQR(text){
  text=String(text||'').trim();
  try{const u=new URL(text);const c=u.searchParams.get('add');if(c)return c.toUpperCase().replace(/[^A-Z0-9]/g,'')}catch(e){}
  const c=text.toUpperCase().replace(/[^A-Z0-9]/g,'');return c.length===6?c:'';
}
let qrDetector;
async function qrReader(){   // 有原生 BarcodeDetector 就用（Android Chrome），沒有就載入 jsQR
  if(qrDetector!==undefined)return qrDetector;
  try{if('BarcodeDetector' in window&&(await BarcodeDetector.getSupportedFormats()).includes('qr_code')){const d=new BarcodeDetector({formats:['qr_code']});return qrDetector=async src=>{const r=await d.detect(src);return r[0]&&r[0].rawValue}}}catch(e){}
  await loadScript(QR_READ);
  const cv=document.createElement('canvas'),cx=cv.getContext('2d',{willReadFrequently:true});
  return qrDetector=async src=>{
    const w=src.videoWidth||src.naturalWidth||src.width,h=src.videoHeight||src.naturalHeight||src.height;if(!w||!h)return '';
    const k=Math.min(1,640/Math.max(w,h));cv.width=Math.round(w*k);cv.height=Math.round(h*k);cx.drawImage(src,0,0,cv.width,cv.height);
    const r=window.jsQR(cx.getImageData(0,0,cv.width,cv.height).data,cv.width,cv.height);return r&&r.data;
  };
}
function handleScanned(text){
  const code=codeFromQR(text);
  if(!code){$('#scanMsg').textContent='這不是 Lin AI 的好友 QR 碼，換一個試試。';return false}
  if($('#scanDlg').open)$('#scanDlg').close();
  if(code===S.me.code){toast('這是你自己的 QR 碼喔');return true}
  friendAdd(code,true);return true;
}
const scan={stream:null,timer:0};
function stopScan(){clearTimeout(scan.timer);if(scan.stream){scan.stream.getTracks().forEach(t=>t.stop());scan.stream=null}$('#scanVideo').srcObject=null}
async function startScan(){
  $('#scanMsg').textContent='正在開啟鏡頭…';$('#scanDlg').showModal();
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){$('#scanMsg').textContent='這個瀏覽器不能開鏡頭，請改用「從相簿讀取」。';return}
  try{
    const read=await qrReader();
    scan.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    if(!$('#scanDlg').open){stopScan();return}
    const v=$('#scanVideo');v.srcObject=scan.stream;await v.play();
    $('#scanMsg').textContent='把朋友的 QR 碼放進框框裡。';
    const tick=async()=>{
      if(!scan.stream)return;
      try{const t=await read(v);if(t&&handleScanned(t))return}catch(e){}
      scan.timer=setTimeout(tick,180);
    };tick();
  }catch(e){stopScan();$('#scanMsg').textContent=e.name==='NotAllowedError'?'沒有鏡頭權限。請在瀏覽器設定允許鏡頭，或改用「從相簿讀取」。':'無法開啟鏡頭，請改用「從相簿讀取」。';logErr('scan '+e.message)}
}
$('#scanDlg').addEventListener('close',stopScan);
$('#scanClose').onclick=()=>$('#scanDlg').close();
$('#frScan').onclick=startScan;
$('#frScanFile').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  const url=URL.createObjectURL(f);
  try{
    const img=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=url});
    const t=await(await qrReader())(img);
    if(!t||!codeFromQR(t))toast('這張圖裡找不到 Lin AI 的好友 QR 碼');else handleScanned(t);
  }catch(err){toast('讀不到這張圖片，請換一張試試');logErr('scan file '+err.message)}
  finally{URL.revokeObjectURL(url)}
};
const frCopyButton=$('#frCopy');if(frCopyButton)frCopyButton.onclick=async()=>{try{await navigator.clipboard.writeText(S.me.code);toast('已複製好友代碼')}catch(e){prompt('好友代碼：',S.me.code)}};
const frDeleteButton=$('#frDelete');if(frDeleteButton)frDeleteButton.onclick=async()=>{
  if(!S.me.id||!confirm('確定要刪除你在伺服器上的資料嗎？你會從所有好友的排行榜消失，也要重新加好友。'))return;
  try{await rpc('lin_delete_me',{p_id:S.me.id});S.me={...DEF.me,avatar:S.me.avatar};frRows=[];frLastSig='';save();toast('已刪除');renderFriends();renderBoard();renderStats()}catch(e){toast(friendly(e))}
};
setInterval(()=>{if(!document.hidden&&$('#tab-friends').classList.contains('active'))friendBoard()},60000);
(function(){   // 邀請連結：https://網站/?add=ABC123
  try{const u=new URL(location.href),c=u.searchParams.get('add');
    if(c){frPending=c.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);u.searchParams.delete('add');history.replaceState(null,'',u.pathname+u.search+u.hash)}}catch(e){logErr('invite: '+e.message)}
})();
function handleInvite(){
  if(!frPending)return;
  $('.tab[data-tab=friends]').click();
  if(S.me.id&&frCfgOk()){const c=frPending;frPending='';friendAdd(c,true)}else renderFriends();
}

