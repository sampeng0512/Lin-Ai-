/* ============================================================
   02-姿勢偵測與鏡頭
   內容：每個動作怎麼判定一下（角度、門檻）、MediaPipe 姿勢模型、開關鏡頭、骨架繪製
   畫面：所有用到鏡頭的畫面
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 動作偵測設定 ================= */
// lo＝低點門檻、hi＝高點門檻。數值先降到 lo 以下，再回到 hi 以上，算 1 下。
const IDX={nose:0,l_sh:11,r_sh:12,l_el:13,r_el:14,l_wr:15,r_wr:16,l_hip:23,r_hip:24,l_kn:25,r_kn:26,l_an:27,r_an:28};
/* ===== 偵測設定（參考你的 cam.py：USE_3D、VISIBILITY_THRESHOLD、SMOOTHING_WINDOW、MODEL_COMPLEXITY、信心門檻）===== */
const isMirror=()=>S.cam.mirror&&(!!S.cam.dev||S.facing==='user');
const median=a=>{const b=[...a].sort((x,y)=>x-y),m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2};
const angN=(a,b,c)=>{const u=a.map((v,i)=>v-b[i]),w=c.map((v,i)=>v-b[i]),nu=Math.hypot(...u),nw=Math.hypot(...w);if(nu<1e-6||nw<1e-6)return null;
  return Math.acos(Math.max(-1,Math.min(1,u.reduce((s,v,i)=>s+v*w[i],0)/(nu*nw))))*180/Math.PI};
const P=(lm,n,thr=S.cam.vis)=>{const p=lm[IDX[n]];return p&&p[2]>=thr?[p[0],p[1]]:null};
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const ang=(a,b,c)=>{const v1=[a[0]-b[0],a[1]-b[1]],v2=[c[0]-b[0],c[1]-b[1]];
  const cos=(v1[0]*v2[0]+v1[1]*v2[1])/(Math.hypot(...v1)*Math.hypot(...v2)+1e-6);
  return Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI};
/* 三個點的可信度都夠才算角度；有 3D 世界座標就用 3D（不受拍攝角度影響），否則用畫面 2D 座標 */
const angles=(lm,a,b,c)=>['l','r'].map(s=>{
  const ix=[a,b,c].map(n=>IDX[`${s}_${n}`]);
  if(!ix.every(i=>lm[i]&&lm[i][2]>=S.cam.vis))return null;
  if(S.cam.use3d&&lm.w&&ix.every(i=>lm.w[i]))return angN(...ix.map(i=>lm.w[i].slice(0,3)));
  return ang(...ix.map(i=>[lm[i][0],lm[i][1]]));
}).filter(v=>v!==null);
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const torso=lm=>mean(['l','r'].map(s=>{const a=P(lm,s+'_sh'),b=P(lm,s+'_hip');return a&&b?dist(a,b):null}).filter(v=>v!==null));
const armsUp=lm=>{const t=torso(lm);if(!t)return null;
  const sh=['l','r'].map(s=>P(lm,s+'_sh')).filter(Boolean),wr=['l','r'].map(s=>P(lm,s+'_wr')).filter(Boolean);
  if(!sh.length||!wr.length)return null;return (mean(sh.map(p=>p[1]))-mean(wr.map(p=>p[1])))/t};
const kneeHeight=(lm,s)=>{const t=torso(lm),k=P(lm,s+'_kn'),h=P(lm,s+'_hip');return t&&k&&h?(h[1]-k[1])/t:null};
const EX={
 "深蹲":{en:"Squats",lo:105,hi:160,fn:lm=>mean(angles(lm,'hip','kn','an'))},
 "伏地挺身":{en:"Push-ups",lo:95,hi:150,fn:lm=>mean(angles(lm,'sh','el','wr'))},
 "捲腹":{en:"Crunches",lo:80,hi:105,fn:lm=>mean(angles(lm,'sh','hip','kn'))},
 "仰臥起坐":{en:"Sit-ups",lo:70,hi:110,fn:lm=>mean(angles(lm,'sh','hip','kn'))},
 "側平舉":{en:"Lateral Raises",lo:35,hi:75,fn:lm=>mean(angles(lm,'hip','sh','el'))},
 "二頭彎舉":{en:"Bicep Curls",lo:55,hi:140,fn:lm=>mean(angles(lm,'sh','el','wr'))},
 "開合跳":{en:"Jumping Jacks",lo:-.3,hi:.3,fn:armsUp},
 "弓箭步":{en:"Lunges",lo:105,hi:155,fn:lm=>{const a=angles(lm,'hip','kn','an');return a.length?Math.min(...a):null}},
 "臀橋":{en:"Glute Bridges",lo:135,hi:160,fn:lm=>mean(angles(lm,'sh','hip','kn'))},
 "高抬腿":{en:"High Knees",lo:-.6,hi:-.25,side:true,fn:kneeHeight},
};
/* ===== 新增動作的偵測方式 ===== */
const vertRatio=lm=>mean(['l','r'].map(s=>{const a=P(lm,s+'_sh'),b=P(lm,s+'_hip');return a&&b?Math.abs(b[1]-a[1])/(dist(a,b)+1e-6):null}).filter(v=>v!==null));
const tiltRatio=lm=>{const t=torso(lm),sh=['l','r'].map(s=>P(lm,s+'_sh')).filter(Boolean),hp=['l','r'].map(s=>P(lm,s+'_hip')).filter(Boolean);
  if(!t||!sh.length||!hp.length)return null;return Math.abs(mean(sh.map(p=>p[0]))-mean(hp.map(p=>p[0])))/t};
const kneeElbow=(lm,s)=>{const t=torso(lm),k=P(lm,s+'_kn'),e=P(lm,s+'_el');return t&&k&&e?dist(k,e)/t:null};
const legSpread=(lm,s)=>{const t=torso(lm),a=P(lm,s+'_an'),h=P(lm,s+'_hip');return t&&a&&h?Math.abs(a[0]-h[0])/t:null};
const jumpSig=(lm,sd,st)=>{ // 腳踝離「地面」多高（地面＝最近腳踝最低的位置，會慢慢跟著調整）
  const t=torso(lm),ys=['l','r'].map(s=>P(lm,s+'_an')).filter(Boolean).map(p=>p[1]);if(!t||!ys.length)return null;
  const y=mean(ys);if(st.base===undefined||y>st.base)st.base=y;else st.base+=(y-st.base)*.01;return (st.base-y)/t};
const elbowAng=lm=>mean(angles(lm,'sh','el','wr')),rowAng=lm=>{const a=angles(lm,'sh','el','wr');return a.length?Math.min(...a):null}, // 划船取彎得最多的那隻手：單手划船時支撐手不會把平均拉高
 hipAng=lm=>mean(angles(lm,'sh','hip','kn'));
const wristDrop=lm=>mean(['l','r'].map(s=>{const a=P(lm,s+'_sh'),e=P(lm,s+'_el'),w=P(lm,s+'_wr');return a&&e&&w?(w[1]-a[1])/(dist(a,e)+dist(e,w)+1e-6):null}).filter(v=>v!==null)); // 手腕比肩膀低多少（用手臂長度換算）
Object.assign(EX,{
 "深蹲跳":{en:"Jump Squats",lo:105,hi:160,fn:EX["深蹲"].fn},
 "肩推":{en:"Shoulder Press",lo:95,hi:155,fn:elbowAng},
 "仰臥抬腿":{en:"Leg Raises",lo:100,hi:150,fn:hipAng},
 "前平舉":{en:"Front Raises",lo:35,hi:75,fn:lm=>mean(angles(lm,'hip','sh','wr'))},
 "引體向上":{en:"Pull-ups",lo:75,hi:150,fn:elbowAng},
 "側抬腿":{en:"Side Leg Raises",lo:.12,hi:.35,side:true,fn:legSpread},
 "側彎":{en:"Side Bends",lo:.08,hi:.30,fn:tiltRatio},
 "站姿抬膝碰肘":{en:"Standing Knee-to-Elbow",lo:.55,hi:.9,side:true,fn:kneeElbow},
 "原地踏步":{en:"March in Place",lo:-.6,hi:-.4,side:true,fn:kneeHeight},
 "原地跳繩":{en:"Jump Rope",lo:.03,hi:.07,fn:jumpSig},
 "波比跳":{en:"Burpees",lo:.45,hi:.8,fn:vertRatio},
 "啞鈴臥推":{en:"Dumbbell Bench Press",lo:95,hi:155,fn:elbowAng,
   cue2:{fn:lm=>mean(angles(lm,'el','sh','hip')),ok:80,msg:'手肘張太開，收近身體一點（上臂和身體約 45–75 度）'}},
 "啞鈴上斜臥推":{en:"Incline Dumbbell Press",lo:95,hi:155,fn:elbowAng,
   cue2:{fn:lm=>mean(angles(lm,'el','sh','hip')),ok:80,msg:'手肘張太開，收近身體一點（上臂和身體約 45–75 度）'}},
 "啞鈴俯身划船":{en:"Bent-over Dumbbell Row",lo:95,hi:145,fn:rowAng},
 "俯身划船":{en:"Bent-over Barbell Row",lo:95,hi:145,fn:rowAng},
 "繩索划船":{en:"Seated Cable Row",lo:95,hi:145,fn:rowAng},
 "高位下拉":{en:"Lat Pulldown",lo:90,hi:145,fn:elbowAng},
 "啞鈴反向飛鳥":{en:"Reverse Dumbbell Fly",lo:.3,hi:.75,fn:wristDrop},
 "啞鈴羅馬尼亞硬舉":{en:"Dumbbell Romanian Deadlift",lo:115,hi:160,fn:hipAng},
});
const START_HIGH=new Set(['深蹲','伏地挺身','捲腹','仰臥起坐','二頭彎舉','弓箭步','引體向上','仰臥抬腿','波比跳','啞鈴臥推','啞鈴上斜臥推','啞鈴俯身划船','啞鈴反向飛鳥','啞鈴羅馬尼亞硬舉','高位下拉','繩索划船','俯身划船']);
// 計數器用 startAngle（起始姿勢）／peakAngle（動作頂點）判斷；沒另外設定就用 lo/hi
for(const [name,config] of Object.entries(EX)){config.startHigh=START_HIGH.has(name);
  if(config.startAngle===undefined)config.startAngle=config.startHigh?config.hi:config.lo;
  if(config.peakAngle===undefined)config.peakAngle=config.startHigh?config.lo:config.hi}
const CATMAP={"深蹲":"下肢","弓箭步":"下肢","臀橋":"下肢","啞鈴羅馬尼亞硬舉":"下肢","側抬腿":"下肢",
 "伏地挺身":"上肢","啞鈴臥推":"上肢","啞鈴上斜臥推":"上肢","啞鈴俯身划船":"上肢","俯身划船":"上肢","繩索划船":"上肢","高位下拉":"上肢","啞鈴反向飛鳥":"上肢","肩推":"上肢","側平舉":"上肢","前平舉":"上肢","二頭彎舉":"上肢","引體向上":"上肢",
 "捲腹":"核心","仰臥起坐":"核心","仰臥抬腿":"核心","側彎":"核心","站姿抬膝碰肘":"核心",
 "開合跳":"全身有氧","深蹲跳":"全身有氧","高抬腿":"全身有氧","原地踏步":"全身有氧","原地跳繩":"全身有氧","波比跳":"全身有氧"};
for(const [k,c] of Object.entries(CATMAP))EX[k].cat=c;
const CATS=['下肢','上肢','核心','全身有氧'];
const ORDER=Object.keys(CATMAP);
const optsByCat=(names,label=n=>n)=>CATS.map(c=>{const g=names.filter(n=>EX[n]&&EX[n].cat===c);return g.length?`<optgroup label="${c}">${g.map(n=>`<option value="${n}">${label(n)}</option>`).join('')}</optgroup>`:''}).join('');

/* 姿勢提醒：type 'min'＝這一下動作的最低點要小於等於 ok；'max'＝最高點要大於等於 ok */
const CUES={
 "深蹲":{type:'min',ok:100,msg:'核心收緊，再蹲低一點'},
 "伏地挺身":{type:'min',ok:90,msg:'胸口再壓低一點，手肘彎到 90 度'},
 "捲腹":{type:'min',ok:75,msg:'上半身再捲起來一點'},
 "仰臥起坐":{type:'min',ok:65,msg:'起身再高一點，胸口靠近膝蓋'},
 "側平舉":{type:'max',ok:80,msg:'手臂舉到與肩同高'},
 "二頭彎舉":{type:'min',ok:50,msg:'彎舉到頂，手肘再彎緊一點'},
 "開合跳":{type:'max',ok:.5,msg:'手臂舉高過頭'},
 "弓箭步":{type:'min',ok:100,msg:'再往下沉，前腿膝蓋接近 90 度'},
 "臀橋":{type:'max',ok:165,msg:'臀部頂高，肩、髖、膝成一直線'},
 "高抬腿":{type:'max',ok:-.15,msg:'膝蓋抬到髖部高度'},
};
Object.assign(CUES,{
 "深蹲跳":{type:'min',ok:105,msg:'下蹲再深一點，再用力跳起來'},
 "肩推":{type:'max',ok:160,msg:'手臂推到伸直'},
 "啞鈴臥推":{type:'max',ok:160,msg:'手臂推到伸直，但不要鎖死手肘'},
 "啞鈴上斜臥推":{type:'max',ok:160,msg:'往斜上方推到手臂伸直，但不要鎖死手肘'},
 "啞鈴俯身划船":{type:'min',ok:90,msg:'手肘再往後拉，把啞鈴拉到腰側'},
 "俯身划船":{type:'min',ok:90,msg:'手肘再往後拉，把槓拉到肚臍附近'},
 "繩索划船":{type:'min',ok:90,msg:'手肘再往後拉，握把拉到肚子前'},
 "高位下拉":{type:'min',ok:80,msg:'再往下拉一點，把槓拉到上胸'},
 "啞鈴反向飛鳥":{type:'min',ok:.2,msg:'手臂往兩側再抬高，接近與背同高'},
 "啞鈴羅馬尼亞硬舉":{type:'min',ok:110,msg:'髖部再往後推，啞鈴沿著腿往下，背保持平直'},
 "仰臥抬腿":{type:'min',ok:100,msg:'腿抬高一點，接近與地面垂直'},
 "前平舉":{type:'max',ok:80,msg:'手臂舉到與肩同高'},
 "引體向上":{type:'min',ok:70,msg:'再拉高一點，下巴過槓'},
 "側抬腿":{type:'max',ok:.4,msg:'腿再往外抬高一點，身體不要歪'},
 "側彎":{type:'max',ok:.3,msg:'身體再往側邊彎一點'},
 "站姿抬膝碰肘":{type:'min',ok:.6,msg:'膝蓋抬高，靠近手肘'},
});
for(const [k,q] of Object.entries(CUES))EX[k].cue=q;
/* 節奏提醒：兩下之間的最短時間（秒）。開合跳、高抬腿是有氧，不檢查。 */
const TEMPO={"深蹲":1.8,"伏地挺身":1.6,"二頭彎舉":1.6,"弓箭步":1.8,"側平舉":1.6,"臀橋":1.6,"捲腹":1.4,"仰臥起坐":1.6};
Object.assign(TEMPO,{"啞鈴臥推":1.6,"肩推":1.6,"仰臥抬腿":1.8,"前平舉":1.6,"引體向上":2.0,"啞鈴上斜臥推":1.6,"啞鈴俯身划船":1.6,"俯身划船":1.6,"繩索划船":1.6,"高位下拉":1.6,"啞鈴反向飛鳥":1.6,"啞鈴羅馬尼亞硬舉":2.0});
for(const [k,v] of Object.entries(TEMPO))EX[k].tempo=v;

class RepCounter{
  constructor(key){this.key=key;this.cfg=EX[key];this.relax=.06;this.reset()}
  reset(){this.count=0;this.cueTotal=0;this.cueBad=0;this.hist=[];this.cycles=[];this.tempoFast=0;this.store={};this.trk={};this.lastRepAt=0;
    (this.cfg.side?['l','r']:['_']).forEach(s=>this.trk[s]={phase:'seek-start',lastCount:0,v:null,cmin:0,cmax:0,c2:-Infinity,peakValid:false})}
  lost(){this.store={};Object.values(this.trk).forEach(t=>{t.v=null;t.phase='seek-start';t.cmin=0;t.cmax=0;t.c2=-Infinity;t.peakValid=false})}
  _eval(ext){const q=this.cfg.cue;if(!q)return null;const bad=q.type==='min'?ext>q.ok:ext<q.ok;
    this.cueTotal++;if(bad)this.cueBad++;this.hist=[...this.hist,bad?1:0].slice(-3);return {bad,msg:q.msg}}
  _eval2(ext){const q=this.cfg.cue2,bad=ext>q.ok;this.cueTotal++;if(bad)this.cueBad++;this.hist=[...this.hist,bad?1:0].slice(-3);return {bad,msg:q.msg}}
  update(lm,now){
    const c=this.cfg,gap=(c.hi-c.lo)*this.relax,angleGap=Math.abs(c.startAngle-c.peakAngle)*this.relax,lo=c.lo+gap,hi=c.hi-gap,
      startLimit=c.startHigh?c.startAngle-angleGap:c.startAngle+angleGap,peakLimit=c.startHigh?c.peakAngle+angleGap:c.peakAngle-angleGap,
      vals=[],ev=[],cooldown=Math.max(450,(c.tempo||.75)*650);
    for(const [s,t] of Object.entries(this.trk)){
      const raw=c.fn(lm,s,this.store);
      if(raw===null){t.v=null;t.phase='seek-start';continue}
      t.v=t.v===null?raw:t.v+(raw-t.v)*.32;const v=t.v;vals.push(v);
      const v2=c.cue2?c.cue2.fn(lm,s,this.store):null;
      if(t.phase==='seek-start'&&(c.startHigh?v>=startLimit:v<=startLimit)){t.phase='seek-peak';t.cmin=v;t.cmax=v;t.c2=-Infinity;t.peakValid=false}
      if(t.phase!=='seek-start'){t.cmin=Math.min(t.cmin,v);t.cmax=Math.max(t.cmax,v);if(v2!==null)t.c2=Math.max(t.c2,v2)}
      if(t.phase==='seek-peak'&&(c.startHigh?v<=peakLimit:v>=peakLimit)){t.phase='seek-return';t.peakValid=!c.peakGuard||c.peakGuard(lm,s,this.store)}
      if(t.phase==='seek-return'&&c.peakGuard&&c.peakGuard(lm,s,this.store))t.peakValid=true;
      if(t.phase==='seek-return'&&(c.startHigh?v>=startLimit:v<=startLimit)&&now-this.lastRepAt>=cooldown){
        if(!t.peakValid){t.phase='seek-peak';t.cmin=v;t.cmax=v;t.c2=-Infinity;continue}
        this.count++;t.phase='seek-peak';t.peakValid=false;this.lastRepAt=now;
        for(const other of Object.values(this.trk))if(other!==t&&other.phase==='seek-return'){other.phase='seek-peak';other.peakValid=false}
        const cyc=t.lastCount?(now-t.lastCount)/1000:null;t.lastCount=now;
        if(c.tempo&&cyc!==null){this.cycles=[...this.cycles,cyc].slice(-6);if(cyc<c.tempo){this.tempoFast++;ev.push({kind:'tempo',bad:true,msg:'動作再放慢一些，保持穩定節奏'})}else this.tempoFast=0}
        if(c.cue2&&isFinite(t.c2))ev.push(this._eval2(t.c2));
        if(c.cue){const e=this._eval(c.cue.type==='min'?t.cmin:t.cmax);e&&ev.push(e)}
        t.cmin=v;t.cmax=v;t.c2=-Infinity;
      }
    }
    const value=mean(vals);
    return {value,lo,hi,ev,status:value===null?'nobody':(Object.values(this.trk).some(t=>t.phase!=='seek-peak')?'low':'ready')};
  }
}

/* ================= 姿勢模型與鏡頭（MediaPipe，在使用者自己的裝置上執行） ================= */
const VER='0.10.14';
let poseLM=null,posePromise=null;
function resetPose(){if(poseLM&&poseLM.close){try{poseLM.close()}catch(e){}}poseLM=null;posePromise=null}
function loadPose(){
  if(window.__fakePose){poseLM=window.__fakePose;return Promise.resolve(poseLM)}
  if(poseLM)return Promise.resolve(poseLM);
  if(posePromise)return posePromise;
  posePromise=(async()=>{
    const mod=await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`);
    const V=mod.PoseLandmarker?mod:(mod.default||mod);
    const fileset=await V.FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/wasm`);
    const mk=S.cam.model,models=[`pose_landmarker_${mk}.task`,`https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${mk}/float16/1/pose_landmarker_${mk}.task`];
    let lastErr;
    for(const m of models)for(const d of ['GPU','CPU']){
      try{
        poseLM=await V.PoseLandmarker.createFromOptions(fileset,{baseOptions:{modelAssetPath:m,delegate:d},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.7,minPosePresenceConfidence:.65,minTrackingConfidence:.7});
        return poseLM;
      }catch(e){lastErr=e;console.warn('model load failed',m,d,e)}
    }
    throw lastErr||new Error('模型載入失敗');
  })().catch(e=>{posePromise=null;throw e});
  return posePromise;
}

const STAGE_HTML=`<div class="stage"><video class="v" playsinline muted></video><canvas class="c"></canvas>
<div class="score"><span class="n">0</span><span class="u">下</span><span class="nm"></span></div>
<div class="cue" hidden></div><div class="hint" hidden></div><div class="dbg" hidden></div><div class="chip">鏡頭未開啟</div><div class="gauge"><i></i></div>
<button class="fsbtn" type="button" aria-label="全螢幕"></button>
<button class="recbtn" type="button" aria-label="開始錄影"><i></i><span>錄影</span></button>
<button class="rstbtn" type="button" aria-label="次數歸零（不儲存）" hidden>↺ 歸零</button>
<div class="tmini" hidden><span class="tl"></span><span class="tn"></span></div>
<button class="btn fsgo" type="button" hidden></button>
<div class="msg" hidden></div></div>`;
const rec={on:false,mr:null,chunks:[],canvas:null,ctx:null,view:null,t0:0,timer:0,scale:1};
const rrect=(c,...a)=>c.roundRect?c.roundRect(...a):c.rect(...a.slice(0,4));
const ICON_EXP='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const ICON_CMP='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
/* ---- 全螢幕：支援的瀏覽器用原生全螢幕，iPhone Safari 等不支援時用「鋪滿整個視窗」代替 ---- */
let fullStage=null;
function setFull(stage,on){
  stage.classList.toggle('full',on);
  const b=$('.fsbtn',stage);b.setAttribute('aria-label',on?'結束全螢幕':'全螢幕');b.innerHTML=on?ICON_CMP:ICON_EXP;
  const g=$('.fsgo',stage);if(g)g.hidden=!(on&&stage._go);
  document.body.style.overflow=on?'hidden':'';
  fullStage=on?stage:null;
}
async function toggleFull(stage){
  if(stage.classList.contains('full')){setFull(stage,false);if(document.fullscreenElement){try{await document.exitFullscreen()}catch(e){}}return}
  setFull(stage,true);
  try{if(stage.requestFullscreen)await stage.requestFullscreen({navigationUI:'hide'});else if(stage.webkitRequestFullscreen)stage.webkitRequestFullscreen()}catch(e){}
}
function exitFull(){if(fullStage){const st=fullStage;setFull(st,false);if(document.fullscreenElement){try{document.exitFullscreen()}catch(e){}}}}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&fullStage)setFull(fullStage,false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&fullStage)exitFull()});
function makeView(host,getCounter,go){
  host.innerHTML=STAGE_HTML;
  const q=s=>$(s,host),stage=q('.stage');stage._go=go||null;
  stage.classList.toggle('rear',!isMirror());
  q('.fsbtn').innerHTML=ICON_EXP;q('.fsbtn').onclick=()=>toggleFull(stage);stage.ondblclick=e=>{if(!e.target.closest('button'))toggleFull(stage)};
  if(go)q('.fsgo').onclick=go.click;
  const view={stage,go,recBtn:q('.recbtn'),miniState:null,cueInfo:null,fsgo:q('.fsgo'),tmini:q('.tmini'),tl:q('.tmini .tl'),tn:q('.tmini .tn'),video:q('.v'),canvas:q('.c'),n:q('.n'),nm:q('.nm'),chip:q('.chip'),gaugeEl:q('.gauge i'),msg:q('.msg'),cueEl:q('.cue'),hintEl:q('.hint'),dbgEl:q('.dbg'),hasWorld:false,badFrames:0,spoken:0,cueT:0,getCounter,
    setMsg(t){const loading=t==='正在準備 AI 視覺教練...',show=!!t&&!t.startsWith('鏡頭已關閉');this.msg.textContent=t;this.msg.hidden=!show;const owner=this.stage.closest('.cam-session');if(owner){owner.classList.toggle('is-loading',loading);owner.classList.toggle('is-error',show&&!loading)}},
    reset(){this.n.textContent='0';this.chip.className='chip';this.chip.textContent='鏡頭未開啟';this.gaugeEl.style.width='0'}};
  q('.recbtn').onclick=()=>(rec.on&&rec.view===view)?recStop():recStart(view);
  return view;
}
const CHIP={ready:['姿勢標準！','ready'],low:['動作幅度再完整一點','low'],nobody:['請將全身保持在畫面框線內','warn'],rest:['休息中','']};
let lastCueSay=0;
function handleCue(v,counter,e,now){
  if(e.kind==='tempo'){
    clearTimeout(v.cueT);v.cueEl.hidden=false;v.cueEl.className='cue bad';v.cueEl.textContent=e.msg;
    v.cueT=setTimeout(()=>{v.cueEl.hidden=true},2400);v.cueInfo={text:e.msg,bad:true,until:now+2400};
    if(counter.tempoFast>=2&&now-lastCueSay>6000){lastCueSay=now;say('放慢一點')}
    return;
  }
  const dk=dkey(new Date()),df=S.dayForm[dk]||(S.dayForm[dk]={ok:0,bad:0});
  if(e.bad){S.formBad=(S.formBad||0)+1;df.bad++}else df.ok++;
  if(!e.bad)S.formOk=(S.formOk||0)+1;
  clearTimeout(v.cueT);v.cueEl.hidden=false;v.cueEl.className='cue '+(e.bad?'bad':'ok');v.cueEl.textContent=e.bad?e.msg:'姿勢標準！';
  v.cueT=setTimeout(()=>{v.cueEl.hidden=true},e.bad?2400:900);
  v.cueInfo={text:e.bad?e.msg:'姿勢標準！',bad:e.bad,until:now+(e.bad?2400:900)};
  if(e.bad&&counter.hist.slice(-2).join()==='1,1'&&now-lastCueSay>6000){lastCueSay=now;say(e.msg)}
}
const cam={running:false,starting:false,requestId:0,view:null,stream:null,raf:0,lastT:-1,onStop:null,filtered:null};
const CONN=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
function drawSkeleton(ctx,lm,k=1){
  ctx.lineWidth=5*k;ctx.lineCap='round';ctx.strokeStyle='#3dd6d0';
  for(const [a,b] of CONN){if(lm[a][2]>.5&&lm[b][2]>.5){ctx.beginPath();ctx.moveTo(lm[a][0],lm[a][1]);ctx.lineTo(lm[b][0],lm[b][1]);ctx.stroke()}}
  for(const i of [0,11,12,13,14,15,16,23,24,25,26,27,28]){if(lm[i][2]>.5){ctx.beginPath();ctx.arc(lm[i][0],lm[i][1],7*k,0,7);ctx.fillStyle='#0a1a20';ctx.fill();ctx.beginPath();ctx.arc(lm[i][0],lm[i][1],5*k,0,7);ctx.fillStyle='#ffd23f';ctx.fill()}}
}
const JOINTS=[[11,13,15],[12,14,16],[13,11,23],[14,12,24],[11,23,25],[12,24,26],[23,25,27],[24,26,28]];   // 手肘、肩、髖、膝（跟 cam.py 的 JOINT_CONFIG 一樣，左右都顯示）
function angleAt(lm,i1,i2,i3){
  if([i1,i2,i3].some(i=>!lm[i]||lm[i][2]<S.cam.vis))return null;
  if(S.cam.use3d&&lm.w&&[i1,i2,i3].every(i=>lm.w[i]))return angN(lm.w[i1].slice(0,3),lm.w[i2].slice(0,3),lm.w[i3].slice(0,3));
  return angN([lm[i1][0],lm[i1][1]],[lm[i2][0],lm[i2][1]],[lm[i3][0],lm[i3][1]]);
}
function drawAngles(ctx,lm,k){
  const flip=isMirror();ctx.font=`700 ${15*k}px sans-serif`;ctx.textBaseline='middle';
  for(const [i1,i2,i3] of JOINTS){
    const a=angleAt(lm,i1,i2,i3);if(a===null)continue;
    ctx.save();ctx.translate(lm[i2][0],lm[i2][1]);if(flip)ctx.scale(-1,1);   // 畫面是鏡像的，文字要反向翻回來才看得懂
    ctx.beginPath();ctx.arc(0,0,6*k,0,7);ctx.fillStyle='#3dd6d0';ctx.fill();
    const txt=a.toFixed(0)+'°';ctx.lineWidth=4*k;ctx.strokeStyle='rgba(10,26,32,.9)';ctx.strokeText(txt,10*k,-12*k);ctx.fillStyle='#ffffff';ctx.fillText(txt,10*k,-12*k);
    ctx.restore();
  }
}
const LM=Array.from({length:33},()=>[0,0,0]),WLM=Array.from({length:33},()=>[0,0,0,0]);   // 每幀重複使用，不再每幀配置新陣列
const setT=(el,t)=>{if(el.textContent!==t)el.textContent=t};
const setC=(el,c)=>{if(el.className!==c)el.className=c};
function scheduleTick(){
  const vid=cam.view&&cam.view.video;
  if(vid&&vid.requestVideoFrameCallback)cam.vf=vid.requestVideoFrameCallback(tick);   // 有新的影像才處理，省電又準時
  else cam.raf=requestAnimationFrame(tick);
}
function tick(){
  if(!cam.running)return;
  const v=cam.view,vid=v.video,counter=v.getCounter();
  if(vid.readyState>=2&&vid.currentTime!==cam.lastT){
    cam.lastT=vid.currentTime;
    const W=vid.videoWidth,H=vid.videoHeight;
    if(v.canvas.width!==W){v.canvas.width=W;v.canvas.height=H}
    const ctx=v.canvas.getContext('2d');ctx.clearRect(0,0,W,H);
    let res=null;try{res=poseLM.detectForVideo(vid,performance.now())}catch(e){console.warn(e)}
    const raw=res&&res.landmarks&&res.landmarks[0];
    let info={status:'nobody',value:null},msg='';
    if(raw){
      const lm=LM,nL=Math.min(raw.length,33);
      cam.filtered=cam.filtered||Array.from({length:33},()=>null);
      for(let i=0;i<nL;i++){
        const p=raw[i],a=lm[i],confidence=p.visibility===undefined?1:p.visibility,px=p.x*W,py=p.y*H,prev=cam.filtered[i];
        if(!prev||confidence<.25)cam.filtered[i]=[px,py,p.z||0,confidence];
        else{prev[0]+=(px-prev[0])*.42;prev[1]+=(py-prev[1])*.42;prev[2]+=((p.z||0)-prev[2])*.42;prev[3]+=(confidence-prev[3])*.42}
        const filtered=cam.filtered[i];a[0]=filtered[0];a[1]=filtered[1];a[2]=filtered[3];
      }
      const wr=res.worldLandmarks&&res.worldLandmarks[0];
      if(wr){for(let i=0;i<Math.min(wr.length,33);i++){const p=wr[i],a=WLM[i];a[0]=p.x;a[1]=p.y;a[2]=p.z;a[3]=p.visibility}lm.w=WLM}else lm.w=null;
      v.hasWorld=!!lm.w;
      drawSkeleton(ctx,lm,Math.max(1,W/640));if(S.cam.show)drawAngles(ctx,lm,Math.max(1,W/640));if(counter)info=counter.update(lm,performance.now());
      if(v.onLm)v.onLm(lm,performance.now());
      let nv=0,x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
      for(let i=0;i<nL;i++){const p=lm[i];if(p[2]>.5){nv++;if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<y0)y0=p[1];if(p[1]>y1)y1=p[1]}}
      if(nv){
        const size=Math.max((x1-x0)/W,(y1-y0)/H);
        if(counter&&info.status==='nobody')msg=size>.92?'離太近，請退後一點':'有些關節沒入鏡，請調整位置或角度，讓全身入鏡';
        else if(size<.4)msg='離太遠，請靠近一點，讓人佔畫面一半以上';
      }
    }else{cam.filtered=null;if(counter)counter.lost();msg='請站到鏡頭前，讓 AI 教練看見全身';if(v.onLm)v.onLm(null,performance.now())}
    if(!counter)info={status:'rest',value:null};
    v.badFrames=msg&&counter?v.badFrames+1:0;
    if(!v.manualHint){const showHint=v.badFrames>20;if(v.hintEl.hidden===showHint)v.hintEl.hidden=!showHint;if(showHint&&v.hintEl.textContent!==msg)v.hintEl.textContent=msg}
    if(counter){
      setT(v.n,String(counter.count));
      if(counter.count!==v.spoken){if(counter.count>v.spoken){sayCount(counter.count);v.n.classList.remove('count-pop');void v.n.offsetWidth;v.n.classList.add('count-pop');clearTimeout(v.popT);v.popT=setTimeout(()=>v.n.classList.remove('count-pop'),380)}v.spoken=counter.count}
      if(info.ev)for(const e of info.ev)handleCue(v,counter,e,performance.now());
    }else v.spoken=0;
    let [txt,cls]=CHIP[info.status];
    let gw=(!counter||info.value===null)?'0':Math.round(Math.max(0,Math.min(1,(info.value-counter.cfg.lo)/(counter.cfg.hi-counter.cfg.lo)))*100)+'%';
    if(v.chipFn){const r=v.chipFn();txt=r[0];cls=r[1]}
    if(v.gaugeFn)gw=v.gaugeFn();
    setT(v.chip,txt);setC(v.chip,'chip '+cls);
    if(v._g!==gw){v._g=gw;v.gaugeEl.style.width=gw}
    {const nf=performance.now();if(cam.lastF){const f=1000/Math.max(1,nf-cam.lastF);cam.fps=cam.fps?cam.fps*.9+f*.1:f}cam.lastF=nf}
    if(S.cam.show){v.dbgEl.hidden=false;setT(v.dbgEl,`FPS ${Math.round(cam.fps||0)}　${S.cam.use3d&&v.hasWorld?'3D':'2D'}　模型：${S.cam.model}　門檻 ${S.cam.vis}`)}else if(!v.dbgEl.hidden)v.dbgEl.hidden=true;
    if(rec.on&&rec.view===v)drawRec(v,counter);
    if(v.go&&!v.fsgo.hidden){const t=v.go.label();if(v.fsgo.textContent!==t)v.fsgo.textContent=t}
    if(v.onFrame)v.onFrame(info);
    if(gameActiveKey&&$('#gameArena')&&!$('#gameArena').hidden)syncArcadeHud();
  }
  scheduleTick();
}
async function camStart(view){
  camStop();
  const requestId=cam.requestId;cam.starting=true;cam.view=view;cam.filtered=null;
  view.setMsg('正在準備 AI 視覺教練...');
  try{await loadPose()}catch(e){if(cam.requestId!==requestId)return false;cam.starting=false;view.setMsg('AI 教練暫時無法啟動，請檢查網路後再試一次。');console.error(e);return false}
  if(cam.requestId!==requestId)return false;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){cam.starting=false;view.setMsg('此裝置目前無法使用鏡頭，請確認瀏覽器權限與安全連線。');return false}
  const dim={width:{ideal:1280},height:{ideal:720}};
  let stream;
  try{stream=await navigator.mediaDevices.getUserMedia({video:{...dim,facingMode:{ideal:S.facing}},audio:false})}
  catch(e){if(cam.requestId!==requestId)return false;cam.starting=false;view.setMsg('請允許使用鏡頭，並確認沒有其他程式正在使用。');logErr('camera permission '+e.message);return false}
  if(cam.requestId!==requestId){stream.getTracks().forEach(t=>t.stop());return false}
  cam.stream=stream;view.video.srcObject=cam.stream;
  try{await view.video.play()}catch(e){cam.starting=false;view.setMsg('無法播放鏡頭畫面，請重新開始訓練。');logErr('camera playback '+e.message);camStop();return false}
  if(cam.requestId!==requestId){stream.getTracks().forEach(t=>t.stop());return false}
  listCams();
  if(view.video.videoWidth)view.stage.style.aspectRatio=`${view.video.videoWidth} / ${view.video.videoHeight}`;   // 手機直拿時畫面比例跟著變，不會被裁掉
  view.setMsg('');cam.view=view;cam.running=true;cam.starting=false;cam.lastT=-1;cam.filtered=null;if(view===camView)$('#camSession').classList.add('is-running');scheduleTick();
  try{cam.wake=await navigator.wakeLock?.request('screen')}catch(e){}
  return true;
}
function camStop(){
  cam.requestId++;cam.starting=false;
  if(rec.on)recStop();
  const was=cam.running;cam.running=false;cancelAnimationFrame(cam.raf);
  if(cam.vf&&cam.view&&cam.view.video.cancelVideoFrameCallback){try{cam.view.video.cancelVideoFrameCallback(cam.vf)}catch(e){}}cam.vf=0;
  if(cam.wake){cam.wake.release().catch(()=>{});cam.wake=null}
  if(cam.stream){cam.stream.getTracks().forEach(t=>t.stop());cam.stream=null}
  cam.filtered=null;$('#camSession').classList.remove('is-running','is-loading','is-error');
  if(cam.view){cam.view.video.srcObject=null;const c=cam.view.canvas;c.getContext('2d').clearRect(0,0,c.width,c.height);
    cam.view.chip.className='chip';cam.view.chip.textContent='鏡頭未開啟';cam.view.gaugeEl.style.width='0';cam.view.hintEl.hidden=true;cam.view.setMsg('鏡頭已關閉。')}
  if(was&&cam.onStop)cam.onStop();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(cam.running||cam.starting))camStop()});
addEventListener('pagehide',()=>{if(cam.running||cam.starting)camStop()});

