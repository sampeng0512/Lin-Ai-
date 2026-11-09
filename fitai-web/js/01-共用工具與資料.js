/* ============================================================
   01-共用工具與資料
   內容：共用小工具（$、esc、toast）、存檔資料 S、熱量計算、語音播報、上方統計數字
   畫面：上方列的統計數字、語音設定視窗、右下提示訊息
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const APP_VERSION='2026.10.23-v1';
const ERRS=[];
const logErr=m=>{ERRS.push(new Date().toLocaleTimeString()+'  '+String(m).slice(0,220));if(ERRS.length>8)ERRS.shift()};
addEventListener('error',e=>logErr(`${e.message} @${(e.filename||'').split('/').pop()}:${e.lineno}`));
addEventListener('unhandledrejection',e=>logErr('promise: '+((e.reason&&e.reason.message)||e.reason)));
const mmss=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};

/* ================= 資料儲存（只存在使用者自己的瀏覽器） ================= */
const KEY='fitai_web_v1',AUTH_KEY='fitai_auth_v1',ACTIVE_KEY='fitai_active_user_v1';
let activeUserId=localStorage.getItem(ACTIVE_KEY)||'',accountSession=null;
const stateKey=()=>activeUserId?`${KEY}:user:${activeUserId}`:KEY;
const dirtyKey=id=>`${KEY}:dirty:${id}`;
const DEF={history:[],xp:0,reps:0,workSecs:0,workDays:{},statsEx:'深蹲',bossIdx:0,bossLoop:0,bossHp:null,combo:0,lastMove:null,defeated:0,best:{},log:[],blog:[],days:{},exs:{},badges:{},goal:50,voice:true,water:{},waterLog:[],waterHit:{},waterGoal:2000,stars3:0,formOk:0,prCount:0,pr:{},dayEx:{},dailyDone:{},weights:{},presets:[],ach:{},facing:'user',musicSrc:'built',musicStyle:'energy',musicBpm:135,musicVol:.35,musicAuto:false,holdBest:{},holdSecs:0,holdLog:[],dayForm:{},formBad:0,food:{},sched:{},schedOn:false,schedTime:'19:00',schedSeen:{},schedNext:0,cam:{use3d:true,vis:.65,win:5,model:'full',conf:.7,show:false,dev:'',mirror:true},me:{id:'',code:'',name:'',friends:0,avatar:''},sb:{url:'',key:''},voiceCfg:{uri:'',rate:1,pitch:1,vol:1,every:1},manual:[],games:{run:{best:0,plays:0,log:[]},pose:{best:0,plays:0,log:[]},pyr:{best:0,plays:0,log:[]},rhythm:{best:0,plays:0,log:[]},dodge:{best:0,plays:0,log:[]}},body:{set:false,sex:'男',age:25,h:170,w:65,act:1.2,goal:'維持'},kx:{},kxHold0:-1,ninja:{best:{},bestCombo:0,hits:0,plays:0,secs:0,log:[]},pyFull:0,runs:[],runCfg:{mode:'gps',voice:true,speed:8}};
let S;
try{S={...DEF,...JSON.parse(localStorage.getItem(stateKey())||'{}')}}catch(e){S={...DEF}}
/* 讀進來的資料型別不對（舊版備份、手動改壞）時，把那一欄還原成預設值，避免整個網站壞掉 */
function normalizeState(o){
  for(const [k,d] of Object.entries(DEF)){
    if(d===null)continue;
    const v=o[k],t=Array.isArray(d)?'array':typeof d;
    const ok=t==='array'?Array.isArray(v):t==='object'?(v&&typeof v==='object'&&!Array.isArray(v)):t==='number'?Number.isFinite(v):typeof v===t;
    if(!ok)o[k]=Array.isArray(d)?[]:(typeof d==='object'?{...d}:d);
  }
  o.cam={...DEF.cam,...o.cam,use3d:true,vis:.65,win:5,model:'full',conf:.7,show:false,dev:'',mirror:true};o.me={...DEF.me,...o.me};o.sb={...DEF.sb,...o.sb};o.body={...DEF.body,...o.body};o.voiceCfg={...DEF.voiceCfg,...o.voiceCfg};o.runCfg={...DEF.runCfg,...o.runCfg};o.ninja={...JSON.parse(JSON.stringify(DEF.ninja)),...o.ninja};
  {const g=JSON.parse(JSON.stringify(DEF.games));for(const k in g)g[k]={...g[k],...(o.games&&o.games[k])};o.games=g}
  if(!(o.kxHold0>=0))o.kxHold0=o.holdSecs||0;
  /* ver：鏡頭偵測到的次數（好友排行只看這個）。舊資料沒有來源，用「鏡頭計數」的歷史紀錄補回 */
  if(!o.ver||typeof o.ver!=='object'){
    o.ver={reps:0,exs:{},days:{},dayEx:{}};
    const dk=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    for(const h of o.history||[]){const n=h.n|0;if(!(n>0)||!h.t||/、|計時訓練/.test(h.ex||''))continue;const k=dk(new Date(h.t)),V=o.ver;
      V.reps+=n;V.days[k]=(V.days[k]||0)+n;V.exs[h.ex]=(V.exs[h.ex]||0)+n;const de=V.dayEx[k]||(V.dayEx[k]={});de[h.ex]=(de[h.ex]||0)+n}
  }
  for(const f of ['exs','days','dayEx'])if(!o.ver[f]||typeof o.ver[f]!=='object')o.ver[f]={};
  if(!Number.isFinite(o.ver.reps))o.ver.reps=0;
  return o;
}
S=normalizeState(S);
/* 頭像：「表情|顏色編號」短字串，或縮小過的照片 data:image/...；沒選的人用名字首字＋由代碼決定的顏色，好友一樣分得出來 */
const AV_GROUPS={
  '人物':['🧑','👦','👧','👨','👩','🧔','👱','👱‍♀️','🧑‍🦱','👩‍🦰','👨‍🦳','👵','🧑‍🎓','🧑‍💻','🧑‍🚀','🥷','🦸','🦹','🧙','🧛','😎','🤓','😤','🥳'],
  '運動':['💪','🏋️','🔥','⚡','🏃','🧘','🥊','🚴','🏊','⛹️','🤸','⭐','🏆','🎯','🚀','👑'],
  '動物':['🐯','🦁','🐻','🐼','🐨','🦊','🐶','🐱','🐰','🐸','🐧','🦄','🐺','🦅','🦈','🐉'],
};
const AV_EMOJI=Object.values(AV_GROUPS).flat();
const AV_COLORS=['#ffd23f','#3dd6d0','#ff6b57','#8fd16a','#b48cff','#5aa9ff','#ff8fc7','#ffb347'];
const AV_IMG=/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
function avParse(av){
  av=String(av||'');if(av.length<=20000&&AV_IMG.test(av))return{e:'',ci:-1,img:av};
  const [e='',c='']=av.split('|'),ci=parseInt(c,10);return{e:AV_EMOJI.includes(e)?e:'',ci:Number.isInteger(ci)&&ci>=0&&ci<AV_COLORS.length?ci:-1,img:''};
}
const avHash=s=>{let h=0;for(const ch of String(s||''))h=(h*31+ch.codePointAt(0))|0;return Math.abs(h)};
function avatarHTML(av,name,seed,cls=''){
  const p=avParse(av);
  if(p.img)return `<span class="av ${cls} img" aria-hidden="true"><img src="${p.img}" alt=""></span>`;
  const ci=p.ci>=0?p.ci:avHash(seed||name)%AV_COLORS.length,txt=p.e||([...String(name||'').trim()][0]||'?').toUpperCase();
  return `<span class="av ${cls}${p.e?' emo':''}" style="background:${AV_COLORS[ci]}" aria-hidden="true">${esc(txt)}</span>`;
}
const scriptCache={};
function loadScript(src){return scriptCache[src]||(scriptCache[src]=new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>{delete scriptCache[src];no(new Error('load '+src))};document.head.appendChild(s)}))}
/* 連續多次修改只寫一次（250 毫秒內合併），離開頁面前一定會寫入 */
let noSave=false,saveT=0;
const saveNow=()=>{clearTimeout(saveT);saveT=0;if(noSave)return;try{localStorage.setItem(stateKey(),JSON.stringify(S));if(accountSession&&activeUserId){localStorage.setItem(dirtyKey(activeUserId),'1');scheduleCloudSave()}}catch(e){}};
const save=()=>{if(!saveT)saveT=setTimeout(saveNow,250)};
addEventListener('pagehide',()=>{saveNow();if(accountSession)syncAccountNow().catch(()=>{})});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){saveNow();if(accountSession)syncAccountNow().catch(()=>{})}});
const level=()=>Math.floor(S.xp/100)+1;
const dkey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dayN=k=>{const [y,m,d]=k.split('-').map(Number);return Math.round(Date.UTC(y,m-1,d)/864e5)};
function addWorkTime(seconds,k=dkey(new Date())){
  const secs=Math.max(0,Math.round(Number(seconds)||0));
  if(!secs)return;
  S.workSecs+=secs;
  S.workDays[k]=(Number(S.workDays[k])||0)+secs;
}
/* ver＝其中有幾下是鏡頭偵測到的（好友排行只算這部分）；k＝記在哪一天 */
function addReps(n,ex,ver=0,k=dkey(new Date())){
  if(!(n>0))return;S.reps+=n;S.days[k]=(S.days[k]||0)+n;
  if(ex){S.lastMove={ex,n};S.exs[ex]=(S.exs[ex]||0)+n;const de=S.dayEx[k]||(S.dayEx[k]={});de[ex]=(de[ex]||0)+n}
  ver=Math.min(n,Math.max(0,ver|0));
  if(ver){const V=S.ver;V.reps+=ver;V.days[k]=(V.days[k]||0)+ver;if(ex){V.exs[ex]=(V.exs[ex]||0)+ver;const de=V.dayEx[k]||(V.dayEx[k]={});de[ex]=(de[ex]||0)+ver}}
}
function subReps(n,ex,k){   // 刪除自訂紀錄時扣回去
  const dec=(o,key)=>{o[key]=Math.max(0,(o[key]||0)-n);if(!o[key])delete o[key]};
  S.reps=Math.max(0,S.reps-n);dec(S.days,k);
  if(ex){dec(S.exs,ex);if(S.dayEx[k]){dec(S.dayEx[k],ex);if(!Object.keys(S.dayEx[k]).length)delete S.dayEx[k]}}
}
/* ===== 消耗熱量：用「修正 MET」= MET × 自己的基礎代謝（由身高、體重、年齡、性別算出）=====
   每個動作：[MET, 每下約幾秒]；大卡 = MET × BMR/86400 × 秒數 */
const EX_MET={深蹲:[5,3],伏地挺身:[3.8,3],捲腹:[2.8,3],仰臥起坐:[3.8,3],側平舉:[3.5,3],前平舉:[3.5,3],二頭彎舉:[3.5,3],肩推:[3.5,3],啞鈴臥推:[3.5,3],
 開合跳:[8,1.2],弓箭步:[4,3],臀橋:[3,3],高抬腿:[8,.8],深蹲跳:[8,2.5],仰臥抬腿:[2.8,3],引體向上:[8,3.5],
 側抬腿:[2.8,2.5],側彎:[2.5,2.5],站姿抬膝碰肘:[4,1.5],原地踏步:[3.5,1],原地跳繩:[11,.5],波比跳:[8,4],
 啞鈴上斜臥推:[3.5,3],啞鈴俯身划船:[3.5,3],啞鈴反向飛鳥:[3,3],啞鈴羅馬尼亞硬舉:[4,3.5],
 高位下拉:[3.5,3],繩索划船:[3.5,3],俯身划船:[5,3]};
const bmrOf=b=>Math.max(800,10*b.w+6.25*b.h-5*b.age+(b.sex==='男'?5:-161));
const kcalPerSec=met=>met*bmrOf(S.body)/86400;
const exKcal=(ex,n)=>{const [met,sec]=EX_MET[String(ex).replace(/（.*?）/g,'').trim()]||[4,2.5];return kcalPerSec(met)*sec*n};
const exMapKcal=(m,reps)=>{let named=0,k=0;for(const [e,n] of Object.entries(m||{})){named+=n;k+=exKcal(e,n)}return k+exKcal('',Math.max(0,(reps||0)-named))};
function addKcal(k){if(!(k>0))return;const d=dkey(new Date());S.kx[d]=(S.kx[d]||0)+k}   // 撐住、健身忍者這類「按秒算」的熱量
const kcalOn=d=>exMapKcal(S.dayEx[d],S.days[d])+(S.kx[d]||0);
const kcalToday=()=>kcalOn(dkey(new Date()));
const kcalTotal=()=>exMapKcal(S.exs,S.reps)+Object.values(S.kx).reduce((a,b)=>a+b,0)+(S.kxHold0||0)*kcalPerSec(4);   // kxHold0：這個功能上線前就累積的撐住秒數
function streaks(days=S.days){
  const nums=Object.keys(days).filter(k=>days[k]>0).map(dayN).sort((x,y)=>x-y);
  let longest=0,run=0,prev=null;
  for(const n of nums){run=(prev!==null&&n===prev+1)?run+1:1;longest=Math.max(longest,run);prev=n}
  const set=new Set(nums),today=dayN(dkey(new Date()));
  let cur=0,n=set.has(today)?today:today-1;while(set.has(n)){cur++;n--}
  return {cur,longest};
}
const maxDay=ex=>Math.max(0,...Object.values(S.dayEx).map(day=>Number(day?.[ex])||0));
const ACH=[
 {id:'reps',g:'次',n:'深蹲達人',d:'深蹲累計完成的次數',t:[100,500,2000],u:'下',v:()=>Number(S.exs['深蹲'])||0},
 {id:'day',g:'日',n:'深蹲爆發',d:'一天內完成的深蹲次數',t:[50,100,200],u:'下',v:()=>maxDay('深蹲')},
 {id:'streak',g:'連',n:'連續打卡',d:'連續有運動的天數',t:[3,7,30],u:'天',v:()=>streaks().longest},
 {id:'timer',g:'時',n:'計時達人',d:'計時器訓練的分鐘數',t:[10,60,300],u:'分鐘',v:()=>Math.floor(S.workSecs/60)},
 {id:'stars',g:'星',n:'三星挑戰',d:'一分鐘挑戰拿到三顆星的次數',t:[1,5,20],u:'次',v:()=>S.stars3||0},
 {id:'boss',g:'忍',n:'健身忍者',d:'健身忍者累計擊中數',t:[50,300,1000],u:'個',v:()=>S.ninja.hits},
 {id:'runkm',g:'步',n:'長跑健將',d:'跑步累計的公里數',t:[5,42,200],u:'公里',v:()=>Math.floor(runKmTotal())},
 {id:'runner',g:'跑',n:'跑酷高手',d:'障礙跑酷最高分',t:[150,400,800],u:'分',v:()=>S.games.run.best},
 {id:'poser',g:'姿',n:'姿勢大師',d:'姿勢配對最高分',t:[500,1500,3000],u:'分',v:()=>S.games.pose.best},
 {id:'pyr',g:'塔',n:'金字塔登頂',d:'完整完成金字塔挑戰的次數',t:[1,5,20],u:'次',v:()=>S.pyFull||0},
 {id:'lv',g:'升',n:'遊戲等級',d:'遊戲等級',t:[5,10,20],u:'級',v:()=>level()},
 {id:'var',g:'全',n:'全能運動員',d:'做過的不同動作數',t:[5,12,20],u:'種',v:()=>Object.keys(S.exs).length},
 {id:'water',g:'水',n:'補水達人',d:'喝水達標的天數',t:[1,7,30],u:'天',v:()=>Object.keys(S.waterHit).length},
 {id:'daily',g:'令',n:'每日挑戰',d:'完成每日挑戰的天數',t:[1,7,30],u:'天',v:()=>Object.keys(S.dailyDone).length},
 {id:'form',g:'正',n:'姿勢標兵',d:'姿勢被判定「標準」的下數',t:[50,300,1000],u:'下',v:()=>S.formOk||0},
 {id:'pr',g:'破',n:'破紀錄',d:'刷新個人單組紀錄的次數',t:[1,10,30],u:'次',v:()=>S.prCount||0},
 {id:'hold',g:'撐',n:'撐住達人',d:'撐住類動作累計的秒數',t:[60,300,1200],u:'秒',v:()=>S.holdSecs||0},
 {id:'food',g:'食',n:'飲食紀錄',d:'有記錄飲食的天數',t:[3,14,60],u:'天',v:()=>Object.keys(S.food).filter(k=>S.food[k].length).length},
 {id:'friends',g:'友',n:'社交達人',d:'好友人數',t:[1,5,10],u:'位',v:()=>S.me.friends||0},
 {id:'weigh',g:'秤',n:'體重追蹤',d:'記錄體重的天數',t:[1,7,30],u:'天',v:()=>Object.keys(S.weights).length},
];
const TIERN=['','銅','銀','金'],TIERC=['#93aeb3','#cd7f32','#c8d1da','#ffd23f'];
const achState=a=>{const v=a.v(),tier=a.t.filter(x=>v>=x).length;return {v,tier,next:a.t[tier]}};
/* 一般提示：馬上顯示，新的蓋掉舊的（才不會看到過期的訊息）。成就、每日挑戰這類「不能漏掉」的提示用 toast(文字, true)，會排隊一則一則顯示。 */
const toastQ=[];let toastShowing=false,toastT=0;
function showToast(t,ms){const el=$('#toast');const safe=sanitizeDisplayText(t,'發生錯誤，請稍後再試。');clearTimeout(toastT);el.textContent=safe;el.hidden=false;toastShowing=true;toastT=setTimeout(nextToast,ms)}
function nextToast(){const t=toastQ.shift();if(!t){toastShowing=false;$('#toast').hidden=true;return}showToast(t,3200)}
function toast(t,queued){
  const safe=sanitizeDisplayText(t,'發生錯誤，請稍後再試。');
  if(queued){toastQ.push(safe);if(!toastShowing)nextToast();return}   // 排隊的提示：等目前顯示的那則結束再出現
  showToast(safe,3200);                                              // 一般提示：馬上顯示；排隊中的提示不會被丟掉，會接在後面
}
function checkBadges(silent){
  let changed=false;
  for(const a of ACH){
    const {tier}=achState(a),old=S.ach[a.id]||0;
    if(tier>old){S.ach[a.id]=tier;changed=true;if(!silent)toast(`${old?'成就升級':'成就解鎖'}：${a.n}（${TIERN[tier]}）`,true)}
  }
  if(changed)save();
}
/* 語音（瀏覽器內建，不需要網路） */
/* 自動挑最自然的中文語音：Edge 的「曉臻／曉雨 Natural」、Chrome 的「Google 國語（臺灣）」、Apple 的「美佳」都比預設的機器音好聽很多 */
const hasTTS='speechSynthesis' in window;
function voiceScore(v){
  const n=v.name,l=(v.lang||'').toLowerCase().replace('_','-');
  if(!/^(zh|cmn)/.test(l))return -1;
  let sc=l.includes('tw')||l.includes('hant')?30:l.includes('cn')||l.includes('hans')?18:l.includes('hk')?5:10;
  if(/natural|neural|online/i.test(n))sc+=60;
  if(/google/i.test(n))sc+=40;
  if(/hsiaochen|hsiaoyu|曉臻|曉雨|xiaoxiao|xiaoyi|mei-?jia|美佳|ting-?ting|婷婷|premium|enhanced|增強|優化/i.test(n))sc+=25;
  if(/hanhan|yating|zhiwei|huihui|kangkang|yaoyao/i.test(n)&&!/online|natural/i.test(n))sc-=20;   // Windows 舊版桌面語音，聲音比較機械
  if(v.localService===false)sc+=5;
  return sc;
}
let ttsVoices=[];
function loadVoices(){
  if(!hasTTS)return;
  ttsVoices=speechSynthesis.getVoices().map(v=>({v,sc:voiceScore(v)})).filter(x=>x.sc>=0).sort((a,b)=>b.sc-a.sc).map(x=>x.v);
  if($('#voiceDlg').open)renderVoiceDlg();
}
if(hasTTS){loadVoices();speechSynthesis.addEventListener?.('voiceschanged',loadVoices)}
const pickVoice=()=>ttsVoices.find(v=>v.voiceURI===S.voiceCfg.uri)||ttsVoices[0]||null;
function say(text,o={}){
  if(!(S.voice||o.force)||!hasTTS)return;
  try{
    if(o.cancel)speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(String(text)),c=S.voiceCfg,v=pickVoice();
    if(v){u.voice=v;u.lang=v.lang}else u.lang='zh-TW';
    u.rate=Math.max(.5,Math.min(2,(o.rate||1.05)*c.rate));u.pitch=c.pitch;u.volume=c.vol;
    speechSynthesis.speak(u);
  }catch(e){}
}
function sayCount(n){const e=S.voiceCfg.every||1;if(e===1||n%e===0)say(n,{cancel:true})}   // 報數頻率：每下／每 5 下／每 10 下
function renderVoice(){const b=$('#voiceBtn');b.textContent='語音報數：'+(S.voice?'開':'關');b.setAttribute('aria-pressed',S.voice)}
function renderVoiceDlg(){
  const c=S.voiceCfg,cur=pickVoice();
  $('#vcOn').checked=S.voice;
  $('#vcVoice').innerHTML=ttsVoices.length?ttsVoices.map((v,i)=>`<option value="${esc(v.voiceURI)}">${i===0?'⭐ ':''}${esc(v.name)}（${esc(v.lang)}）</option>`).join(''):'<option value="">找不到中文語音</option>';
  if(cur)$('#vcVoice').value=cur.voiceURI;
  $('#vcRate').value=c.rate;$('#vcRateO').textContent=c.rate.toFixed(2)+'×';
  $('#vcPitch').value=c.pitch;$('#vcPitchO').textContent=c.pitch.toFixed(2);
  $('#vcVol').value=Math.round(c.vol*100);$('#vcVolO').textContent=Math.round(c.vol*100)+'%';
  $$('#vcEvery button').forEach(b=>b.classList.toggle('on',+b.dataset.v===c.every));
  const natural=cur&&/natural|neural|online|google|premium|enhanced/i.test(cur.name);
  $('#vcNote').textContent=!hasTTS?'這個瀏覽器不支援語音。':!ttsVoices.length?'這台裝置沒有安裝中文語音。Windows 可到「設定 → 時間與語言 → 語音」加入中文（台灣）語音。':
    natural?'已選用自然語音，聽起來最像真人。':'目前的語音比較機械。用 Microsoft Edge 開啟可使用「曉臻 Natural」，Chrome 可選「Google 國語（臺灣）」，iPhone 可到「設定 → 輔助使用 → 語音內容 → 聲音」下載「美佳（增強版）」。';
}
$('#voiceBtn').onclick=()=>{loadVoices();renderVoiceDlg();$('#voiceDlg').showModal()};
(()=>{const b=$('#fsBtn'),d=document,el=d.documentElement;
  const req=el.requestFullscreen||el.webkitRequestFullscreen,exit=d.exitFullscreen||d.webkitExitFullscreen;
  const cur=()=>d.fullscreenElement||d.webkitFullscreenElement;
  if(!req||matchMedia('(display-mode: standalone)').matches)return;
  b.hidden=false;
  const sync=()=>{const on=!!cur();b.textContent=on?'離開全螢幕':'全螢幕';b.setAttribute('aria-pressed',on)};
  b.onclick=()=>{try{const r=cur()?exit.call(d):req.call(el);if(r&&r.catch)r.catch(()=>toast('瀏覽器不允許全螢幕'))}catch(e){toast('瀏覽器不允許全螢幕')}};
  d.addEventListener('fullscreenchange',sync);d.addEventListener('webkitfullscreenchange',sync);sync();
})();
$('#vcOn').onchange=e=>{S.voice=e.target.checked;save();renderVoice();if(S.voice)say('語音報數已開啟',{cancel:true})};
$('#vcVoice').onchange=e=>{S.voiceCfg.uri=e.target.value;save();renderVoiceDlg();say('你好，我是你的健身教練，我們開始吧！',{cancel:true,force:true})};
$('#vcRate').oninput=e=>{S.voiceCfg.rate=+e.target.value;$('#vcRateO').textContent=S.voiceCfg.rate.toFixed(2)+'×';save()};
$('#vcPitch').oninput=e=>{S.voiceCfg.pitch=+e.target.value;$('#vcPitchO').textContent=S.voiceCfg.pitch.toFixed(2);save()};
$('#vcVol').oninput=e=>{S.voiceCfg.vol=e.target.value/100;$('#vcVolO').textContent=e.target.value+'%';save()};
$('#vcRate').onchange=$('#vcPitch').onchange=$('#vcVol').onchange=()=>say('一、二、三，很好，保持節奏！',{cancel:true,force:true});
$('#vcEvery').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.voiceCfg.every=+b.dataset.v;save();renderVoiceDlg()};
$('#vcTest').onclick=()=>say('第十下！做得很好，再撐一下，你可以的！',{cancel:true,force:true});
$('#vcReset').onclick=()=>{S.voiceCfg={...DEF.voiceCfg};save();renderVoiceDlg();say('已恢復預設語音',{cancel:true,force:true})};
$('#vcClose').onclick=()=>$('#voiceDlg').close();
$('#stats').onclick=e=>{const b=e.target.closest('[data-go]');if(b){const t=$(`.tab[data-tab=${b.dataset.go}]`);if(t){t.click();scrollTo({top:0,behavior:'smooth'})}}};
function renderStats(silent){
  const tile=(cls,tab,title,val,lbl,sub,pct)=>`<button type="button" class="stat ${cls}" data-go="${tab}" title="${title}"><b>${val}</b><span>${lbl}</span><small>${sub}</small>${pct===undefined?'':`<i class="sbar"><i style="width:${pct}%"></i></i>`}</button>`;
  $('#stats').innerHTML=
    tile('','stats','今日訓練時間',Math.round((Number(S.workDays[dkey(new Date())])||0)/60),'今日訓練（分）','今日累計')+
    tile('','stats','今日消耗熱量',Math.round(kcalToday()),'今日消耗（大卡）','今日估算')+
    tile('','ach',`經驗值 ${S.xp%100} / 100`,`等級 ${level()}`,'目前等級',`${S.xp%100}/100 經驗值`,S.xp%100);
  const gameCombo=Math.max(0,Number(S.ninja.bestCombo)||0);
  const gameScore=Math.max(0,Number(S.games.run.best)||0,Number(S.games.pose.best)||0,...Object.values(S.ninja.best||{}).map(value=>Number(value)||0));
  $('#headerGameCombo').textContent=gameCombo;
  $('#headerGameScore').textContent=gameScore;
  $('#headerGameLevel').textContent=`等級 ${level()}`;
  checkDaily();renderDaily();friendSyncSoon();buddyOnStats();
  checkBadges(silent);
  if($('#tab-ach').classList.contains('active'))renderAch();
  if($('#tab-stats').classList.contains('active'))renderStatsTab();
}

