/* ============================================================
   07-身體數據與菜單
   內容：BMI／基礎代謝計算、每週訓練菜單產生
   畫面：「身體數據與菜單」分頁
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 身體數據與菜單 ================= */
let sex=S.body.sex,goalType=S.body.goal;
seg($('#bSex'),b=>{sex=b.dataset.v;calc(true)});seg($('#bGoal'),b=>{goalType=b.dataset.v;calc(true)});
['#bAge','#bH','#bW','#bAct'].forEach(s=>$(s).oninput=()=>calc(true));
function applyBody(){   // 把存起來的身體數據填回表單（換裝置登入也會帶過來）
  const b=S.body;sex=b.sex;goalType=b.goal;
  $('#bAge').value=b.age;$('#bH').value=b.h;$('#bW').value=b.w;$('#bAct').value=String(b.act);
  $$('#bSex button').forEach(x=>x.classList.toggle('on',x.dataset.v===sex));$$('#bGoal button').forEach(x=>x.classList.toggle('on',x.dataset.v===goalType));
}
function bodyInfo(){
  const age=+$('#bAge').value||25,h=+$('#bH').value||170,w=+$('#bW').value||65,act=+$('#bAct').value;
  const bmi=w/((h/100)**2),bmr=10*w+6.25*h-5*age+(sex==='男'?5:-161),tdee=bmr*act;
  const target={減脂:Math.max(tdee-400,bmr),維持:tdee,增肌:tdee+300}[goalType];
  return {age,h,w,bmi,bmr,tdee,target,cat:bmi<18.5?'過輕':bmi<24?'正常':bmi<27?'過重':'肥胖'};
}
function calc(edited){
  const b=bodyInfo(),f=(v,l)=>`<div class="fact"><b>${v}</b><span>${l}</span></div>`;
  $('#bOut').innerHTML=`<div class="fact bmi-fact"><b>${b.bmi.toFixed(1)}</b><span><span>BMI</span><strong>${b.cat}</strong></span></div>`+f(Math.round(b.bmr),'基礎代謝（大卡）')+f(Math.round(b.tdee),'每日總消耗（大卡）')+
    f(Math.round(b.target),`建議攝取（${goalType}，大卡）`)+f(Math.round(b.w*1.6)+'–'+Math.round(b.w*2),'蛋白質（克）')+f((b.w*35/1000).toFixed(1),'每日喝水（公升）');
  const ok=b.h>=120&&b.h<=220&&b.w>=30&&b.w<=200&&b.age>=10&&b.age<=100;
  if(ok){S.body={set:S.body.set||!!edited,sex,age:b.age,h:b.h,w:b.w,act:+$('#bAct').value||1.2,goal:goalType};save();renderStats(true)}
}
const GROUPS={"下肢":["深蹲","弓箭步","臀橋","啞鈴羅馬尼亞硬舉（可用水瓶）","側抬腿","深蹲跳"],"上肢核心":["伏地挺身","肩推（可用水瓶）","二頭彎舉（可用水瓶）","側平舉（可用水瓶）","啞鈴上斜臥推（可用水瓶）","啞鈴俯身划船（可用水瓶）","捲腹","仰臥抬腿"],"有氧燃脂":["開合跳","高抬腿","原地跳繩","波比跳","原地踏步"],"全身":["深蹲","伏地挺身","啞鈴俯身划船（可用水瓶）","捲腹","波比跳","弓箭步"]};
const CNT={新手:4,中階:5,進階:6};
const TIMED=new Set(["開合跳","高抬腿","原地跳繩","原地踏步"]);
const SPLITS={2:["全身","有氧燃脂"],3:["下肢","上肢核心","有氧燃脂"],4:["下肢","上肢核心","有氧燃脂","全身"],5:["下肢","上肢核心","有氧燃脂","全身","有氧燃脂"]};
const LEVELS={新手:[3,10,60,30],中階:[4,12,45,40],進階:[5,15,30,45]};
const EXTRA={減脂:'收操：做一輪 4 分鐘 Tabata（到「訓練計時器」選 Tabata）。',增肌:'動作放慢，下放 3 秒；每組做到接近力竭前 1–2 下。',提升體能:'組間心率稍微恢復再開始下一組，逐週增加 1–2 下。'};
function plan(){
  const g=$('#pGoal').value,[sets,reps,rest,timed]=LEVELS[$('#pLevel').value],days=+$('#pDays').value;
  $('#pDaysO').textContent=days;
  $('#planOut').innerHTML=SPLITS[days].map((grp,i)=>`<details ${i===0?'open':''}><summary>第 ${i+1} 天，${grp}</summary><ul>${GROUPS[grp].slice(0,CNT[$('#pLevel').value]).map(e=>{
    const base=e.replace(/（.*）/,'');return `<li><b>${e}</b>：${sets} 組 × ${TIMED.has(base)?timed+' 秒':reps+' 下'}，組間休息 ${rest} 秒</li>`}).join('')}</ul><p class="small mute">${EXTRA[g]}</p></details>`).join('');
}
['#pGoal','#pLevel','#pDays'].forEach(s=>$(s).oninput=plan);

