/* ============================================================
   18-飲食紀錄
   內容：飲食紀錄：常見食物快速加入、每日熱量與蛋白質
   畫面：「飲食紀錄」分頁
   注意：js 檔案依編號順序載入，彼此共用同一組變數與函式（例如 01 的 $、S、save、toast）。
   ============================================================ */
'use strict';

/* ================= 飲食紀錄 ================= */
const FOODS=[['白飯 1 碗',280,5],['雞胸肉 100g',165,31],['水煮蛋 1 顆',75,6],['無糖豆漿 400ml',130,13],['地瓜 中型 1 條',130,2],['香蕉 1 根',90,1],['蛋餅 1 份',250,8],['雞腿便當',800,35],['滷肉飯 小碗',400,10],['牛肉麵 1 碗',600,30],['珍珠奶茶 全糖 700ml',550,4],['無糖優格 150g',100,8],['燕麥片 40g',150,5],['鮭魚 100g',200,20],['板豆腐 半盒',100,9],['乳清蛋白 1 份',120,24],['吐司 1 片',80,3],['水果 1 份',60,1]];
const MEALS=['早餐','午餐','晚餐','點心'];
const foodOf=k=>S.food[k]||[];
const mealAt=t=>{const h=new Date(t).getHours();return h>=5&&h<10?'早餐':h>=10&&h<14?'午餐':h>=14&&h<17?'點心':h>=17&&h<21?'晚餐':'點心'};
function foodEntry(n,kcal,pr,o={}){
  n=String(n==null?'':n).trim().slice(0,20);kcal=Math.round(+kcal);pr=Math.max(0,Math.round(+pr||0));
  if(!n||!(kcal>=0&&kcal<=5000))return null;
  const t=Number.isFinite(o.t)?o.t:Date.now(),e={n,k:kcal,p:pr,t};
  if(MEALS.includes(o.meal))e.meal=o.meal;
  if(o.src)e.src=String(o.src);
  return {key:typeof o.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(o.date)?o.date:dkey(new Date(t)),e};
}
function addFood(n,kcal,pr,o={}){
  const r=foodEntry(n,kcal,pr,o);
  if(!r){toast('請輸入食物名稱，和 0 到 5000 之間的大卡');return false}
  (S.food[r.key]=S.food[r.key]||[]).push(r.e);
  if(!o.batch){save();renderStats();renderFood()}
  return true;
}
function foodGroups(list){
  const rows=list.map((f,i)=>({f,i})),timed=rows.filter(r=>Number.isFinite(r.f.t)).sort((a,b)=>a.f.t-b.f.t),untimed=rows.filter(r=>!Number.isFinite(r.f.t));
  const groups=[];
  for(const r of timed){
    const meal=MEALS.includes(r.f.meal)?r.f.meal:mealAt(r.f.t),g=groups[groups.length-1];
    if(g&&g.meal===meal&&r.f.t-g.last<=90*60000){g.rows.push(r);g.last=r.f.t}
    else groups.push({meal,title:`${hhmm(r.f.t)} ${meal}`,last:r.f.t,rows:[r]});
  }
  if(untimed.length)groups.push({meal:'其他',title:'其他',rows:untimed});
  return groups;
}
function renderFood(){
  if(!$('#fdTotal'))return;
  const today=dkey(new Date()),list=foodOf(today),kc=list.reduce((a,f)=>a+f.k,0),pr=list.reduce((a,f)=>a+(f.p||0),0),b=bodyInfo(),tg=Math.round(b.target),left=tg-kc;
  $('#fdTotal').textContent=`今天已記錄 ${kc} 大卡`;$('#fdTarget').textContent=`目標約 ${tg} 大卡`;
  $('#fdBar').style.width=Math.min(100,kc/Math.max(tg,1)*100)+'%';
  $('#fdLeft').textContent=!list.length?'還沒有記錄，從右邊挑一個，或自己輸入。':left>=0?`還可以吃約 ${left} 大卡。`:`比目標多了約 ${-left} 大卡，沒關係，明天抓回來就好。`;
  $('#fdMacro').innerHTML=`<div class="fact"><b>${pr} g</b><span>今天蛋白質（有填的）</span></div><div class="fact"><b>${Math.round(b.w*1.6)}–${Math.round(b.w*2)} g</b><span>每日建議蛋白質</span></div>`;
  $('#fdList').innerHTML=list.length?foodGroups(list).map(g=>`<li class="fd-group-h">${esc(g.title)}<span class="small mute">${g.rows.reduce((a,r)=>a+r.f.k,0)} 大卡</span></li>`+g.rows.map(({f,i})=>`<li class="fd-item">${f.src==='ai'?'<span class="fd-src" title="AI 估算">AI</span>':''}${esc(f.n)}　<b style="color:var(--yellow)">${f.k} 大卡</b>${f.p?`　<span class="small">${f.p} g 蛋白質</span>`:''}<button class="xbtn" type="button" data-i="${i}" aria-label="刪除 ${esc(f.n)}">×</button></li>`).join('')).join(''):'<li>今天還沒有記錄。</li>';
  $$('#fdList .xbtn').forEach(x=>x.onclick=()=>{foodOf(today).splice(+x.dataset.i,1);save();renderStats();renderFood()});
  const fk=lastDays(7).map(d=>foodOf(d.k).reduce((a,f)=>a+f.k,0)).filter(v=>v>0);
  $('#fdAvg').textContent=fk.length?`近 7 天有記錄的 ${fk.length} 天，平均每天約 ${Math.round(mean(fk))} 大卡。`:'';
  renderMyFoods();
}
function saveMyFood(n,k,p){
  const r=foodEntry(n,k,p);if(!r)return false;
  const item={n:r.e.n,k:r.e.k,p:r.e.p};
  S.myFoods=[item,...S.myFoods.filter(x=>x&&x.n!==item.n)].slice(0,30);
  save();renderMyFoods();return true;
}
function delMyFood(i){
  const f=S.myFoods[i];if(!f)return;
  if(!confirm(`從「我的常吃」刪除「${f.n}」？`))return;
  S.myFoods.splice(i,1);save();renderMyFoods();
}
function renderMyFoods(){
  const box=$('#fdMine');if(!box)return;
  const L=S.myFoods.filter(f=>f&&f.n);
  $('#fdMineWrap').hidden=!L.length;
  box.innerHTML=L.map((f,i)=>`<span class="fd-mine-chip"><button class="fd-mine-add" type="button" data-i="${i}" title="約 ${f.k} 大卡">${esc(f.n)}　${f.k}</button><button class="xbtn" type="button" data-x="${i}" aria-label="從我的常吃刪除 ${esc(f.n)}">×</button></span>`).join('');
  $$('.fd-mine-add',box).forEach(b=>{
    let timer=0,longed=false;
    const stop=()=>clearTimeout(timer);
    b.onpointerdown=()=>{longed=false;timer=setTimeout(()=>{longed=true;delMyFood(+b.dataset.i)},650)};
    b.onpointerup=stop;b.onpointerleave=stop;b.onpointercancel=stop;
    b.oncontextmenu=e=>e.preventDefault();
    b.onclick=()=>{if(longed){longed=false;return}const f=S.myFoods[+b.dataset.i];if(f)addFood(f.n,f.k,f.p)};
  });
  $$('[data-x]',box).forEach(b=>b.onclick=()=>delMyFood(+b.dataset.x));
}
$('#fdQuick').innerHTML=FOODS.map((f,i)=>`<button class="btn ghost small" type="button" data-i="${i}" title="約 ${f[1]} 大卡">${esc(f[0])}　${f[1]}</button>`).join('');
$$('#fdQuick button').forEach(b=>b.onclick=()=>{const f=FOODS[+b.dataset.i];addFood(f[0],f[1],f[2])});
$('#fdAdd').onclick=()=>{if(!$('#fdName').value.trim()||$('#fdKcal').value.trim()===''){toast('請輸入食物名稱和大卡');return}if(addFood($('#fdName').value,$('#fdKcal').value,$('#fdP').value)){$('#fdName').value='';$('#fdKcal').value='';$('#fdP').value=''}};

const AIF={photo:null,when:null,items:[],busy:false,meal:'',mealTouched:false,left:null,note:''};
function aiShow(part){
  $('#fdAiPhotoBox').hidden=part!=='photo';$('#fdAiTextBox').hidden=part!=='text';$('#fdAiResult').hidden=part!=='result';
  $('#fdAiLogin').hidden=part!=='login';
}
function aiMsg(text){$('#fdAiMsg').textContent=text||'';$('#fdAiMsg').hidden=!text}
function aiBusy(on){
  AIF.busy=on;$('#fdAiBusy').hidden=!on;
  $$('#fdAi button,#fdAi input,#fdAi textarea').forEach(el=>el.disabled=on);
}
function aiDropPhoto(){
  if(AIF.photo&&AIF.photo.url)URL.revokeObjectURL(AIF.photo.url);
  AIF.photo=null;$('#fdAiPrev').removeAttribute('src');$('#fdAiFile').value='';
}
function aiReset(){
  aiDropPhoto();AIF.when=null;AIF.items=[];AIF.meal='';AIF.mealTouched=false;AIF.note='';
  $('#fdAiHint').value='';$('#fdAiDesc').value='';$('#fdAiResult').innerHTML='';aiMsg('');aiShow('');
}
function aiNeedLogin(){
  if(accountSession)return false;
  aiDropPhoto();aiMsg('');aiShow('login');return true;
}
function exifTime(buf){
  try{
    const v=new DataView(buf);if(v.byteLength<4||v.getUint16(0)!==0xFFD8)return null;
    let o=2;
    while(o+4<=v.byteLength){
      const m=v.getUint16(o);if((m&0xFF00)!==0xFF00)return null;
      if(m===0xFFDA||m===0xFFD9)return null;
      const len=v.getUint16(o+2);
      if(m===0xFFE1&&o+10<=v.byteLength&&v.getUint32(o+4)===0x45786966)return exifTiffTime(v,o+10);
      o+=2+len;
    }
  }catch(e){}
  return null;
}
function exifTiffTime(v,s){
  const le=v.getUint16(s)===0x4949,u16=p=>v.getUint16(p,le),u32=p=>v.getUint32(p,le);
  if(u16(s+2)!==42)return null;
  const find=(ifd,tag)=>{const n=u16(ifd);for(let i=0;i<n;i++){const e=ifd+2+i*12;if(e+12>v.byteLength)return null;if(u16(e)===tag)return e}return null};
  const ifd0=s+u32(s+4),ptr=find(ifd0,0x8769);
  const e=ptr?find(s+u32(ptr+8),0x9003):null;if(!e)return null;
  const off=s+u32(e+8);let str='';
  for(let i=0;i<19&&off+i<v.byteLength;i++)str+=String.fromCharCode(v.getUint8(off+i));
  const m=/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(str);if(!m)return null;
  const d=new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]);
  return isNaN(d)?null:d.getTime();
}
function aiDayRange(){const max=new Date(),min=new Date();min.setDate(max.getDate()-7);return {min:dkey(min),max:dkey(max)}}
function aiValidWhen(t){if(!Number.isFinite(t)||t>Date.now()+5*60000)return null;const r=aiDayRange(),k=dkey(new Date(t));return k>=r.min&&k<=r.max?t:null}
function aiWhenText(t){const d=new Date(t),today=dkey(new Date()),y=new Date();y.setDate(y.getDate()-1);const k=dkey(d);return `${k===today?'今天':k===dkey(y)?'昨天':`${d.getMonth()+1}/${d.getDate()}`} ${hhmm(t)}`}
function aiLoadImage(url){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>res(img);img.onerror=()=>rej(new Error('decode'));img.src=url})}
async function aiShrink(url){
  const img=await aiLoadImage(url),w=img.naturalWidth,h=img.naturalHeight;
  if(!w||!h)throw new Error('decode');
  const sc=Math.min(1,1024/Math.max(w,h)),c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(w*sc));c.height=Math.max(1,Math.round(h*sc));
  const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);
  const data=c.toDataURL('image/jpeg',.8);c.width=c.height=0;img.src='';
  return data.slice(data.indexOf(',')+1);
}
async function aiCall(body){
  const s=await freshAccountSession(),{url,key}=sbCfg();
  if(!url||!key)throw new Error('AI 服務尚未設定。');
  const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),40000);
  let r,text;
  try{
    r=await fetch(`${url}/functions/v1/food-ai`,{method:'POST',headers:{Authorization:'Bearer '+s.access_token,apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:ac.signal});
    text=await r.text();
  }catch(e){throw new Error(e&&e.name==='AbortError'?'AI 辨識逾時（超過 40 秒），請再試一次。':'連線失敗，請檢查網路後再試一次。')}
  finally{clearTimeout(tm)}
  let data=null;try{data=text?JSON.parse(text):null}catch(e){}
  if(!r.ok||!data||data.error)throw new Error(data&&data.message||`AI 辨識失敗（${r.status}），請稍後再試。`);
  return data;
}
async function aiRun(mode){
  if(AIF.busy||aiNeedLogin())return;
  let body,hint='';
  if(mode==='image'){
    if(!AIF.photo){toast('請先選一張照片');return}
    hint=$('#fdAiHint').value.trim().slice(0,200);
  }else{
    const t=$('#fdAiDesc').value.trim();
    if(!t){toast('請先描述這餐吃了什麼');$('#fdAiDesc').focus();return}
    body={mode:'text',text:t.slice(0,400)};
  }
  aiMsg('');aiBusy(true);
  try{
    if(mode==='image'){
      let image;
      try{image=await aiShrink(AIF.photo.url)}catch(e){throw new Error('這張照片的格式無法讀取（可能是 HEIC），請改選 JPEG 照片或截圖後再試。')}
      body={mode:'image',image,mime:'image/jpeg'};if(hint)body.text=hint;
    }
    const data=await aiCall(body);body=null;
    if(mode==='image')aiDropPhoto();
    AIF.left=Number.isFinite(+data.limit)&&Number.isFinite(+data.used)?Math.max(0,data.limit-data.used):null;
    const items=Array.isArray(data.items)?data.items.filter(i=>i&&String(i.name||'').trim()):[];
    if(data.recognized===false||!items.length){
      aiShow('text');if(hint)$('#fdAiDesc').value=hint;
      aiMsg('辨識不出來，請用打字描述這餐吃了什麼。'+(AIF.left!=null?`（今天還可以用 AI ${AIF.left} 次）`:''));
      setTimeout(()=>$('#fdAiDesc').focus(),0);return;
    }
    AIF.items=items.map(i=>({n:String(i.name).trim().slice(0,20),portion:String(i.portion||'').trim().slice(0,20),k:Math.max(0,Math.min(5000,Math.round(+i.kcal||0))),p:Math.max(0,Math.round(+i.protein_g||0)),fav:false}));
    AIF.note=String(data.note||'').trim();
    if(!AIF.when)AIF.when=Date.now();
    AIF.meal=mealAt(AIF.when);AIF.mealTouched=false;
    aiRenderResult();aiShow('result');
  }catch(e){
    body=null;aiMsg(String(e&&e.message||e));
  }finally{aiBusy(false)}
}
function aiItemName(it){return (it.portion&&!it.n.includes(it.portion)?`${it.n} ${it.portion}`:it.n).trim().slice(0,20)}
function aiTotal(){return AIF.items.reduce((a,i)=>a+(Math.round(+i.k)||0),0)}
function aiRenderResult(){
  const r=aiDayRange(),d=new Date(AIF.when),box=$('#fdAiResult');
  box.innerHTML=`<div class="row" style="justify-content:space-between;align-items:baseline"><h4 style="margin:0">確認這餐的內容</h4><b class="fd-ai-total" id="fdAiTotal"></b></div>
  <div class="fd-ai-items" id="fdAiItems"></div>
  <button class="btn ghost small" type="button" id="fdAiAddRow">＋ 自己加一項</button>
  ${AIF.note?`<p class="small" style="margin:0">${esc(AIF.note)}</p>`:''}
  <p class="small mute" style="margin:0">熱量是 AI 依照片或描述的估計，只當參考。份量和做法不同差很多，請不要因為數字而過度節食。</p>
  <div><span class="f">餐別</span><div class="seg fd-ai-meal" id="fdAiMeal">${MEALS.map(m=>`<button type="button" data-m="${m}" class="${m===AIF.meal?'on':''}">${m}</button>`).join('')}</div></div>
  <div class="row fd-ai-when">
    <div class="grow"><label class="f" for="fdAiDate">用餐日期</label><input type="date" id="fdAiDate" min="${r.min}" max="${r.max}" value="${dkey(d)}"></div>
    <div class="grow"><label class="f" for="fdAiTime">時間</label><input type="time" id="fdAiTime" value="${hhmm(AIF.when)}"></div>
  </div>
  ${AIF.left!=null?`<p class="small mute" style="margin:0">今天還可以用 AI ${AIF.left} 次。</p>`:''}
  <div class="row"><button class="btn" type="button" id="fdAiSave">確認記錄</button><button class="btn ghost" type="button" id="fdAiDiscard">取消</button></div>`;
  aiRenderItems();
  $('#fdAiAddRow').onclick=()=>{AIF.items.push({n:'',portion:'',k:0,p:0,fav:false});aiRenderItems();const ins=$$('#fdAiItems .fd-ai-name');if(ins.length)ins[ins.length-1].focus()};
  seg($('#fdAiMeal'),b=>{AIF.meal=b.dataset.m;AIF.mealTouched=true});
  const syncMeal=()=>{const t=aiPickedTime();if(t==null||AIF.mealTouched)return;AIF.meal=mealAt(t);$$('#fdAiMeal button').forEach(b=>b.classList.toggle('on',b.dataset.m===AIF.meal))};
  $('#fdAiTime').onchange=syncMeal;$('#fdAiDate').onchange=syncMeal;
  $('#fdAiSave').onclick=aiCommit;
  $('#fdAiDiscard').onclick=()=>{aiReset();toast('已取消，沒有記錄任何資料')};
}
function aiRenderItems(){
  const box=$('#fdAiItems');
  box.innerHTML=AIF.items.length?AIF.items.map((it,i)=>`<div class="fd-ai-item" data-i="${i}">
    <div class="fd-ai-item-top"><input type="text" class="fd-ai-name" maxlength="20" value="${esc(it.n)}" placeholder="食物名稱" aria-label="第 ${i+1} 項名稱"><button class="xbtn" type="button" data-del="${i}" aria-label="刪除這一項">×</button></div>
    <div class="fd-ai-fields">
      <label>份量<input type="text" class="fd-ai-portion" maxlength="20" value="${esc(it.portion)}" placeholder="例如：1 碗"></label>
      <label>大卡<input type="number" class="fd-ai-k" min="0" max="5000" step="10" value="${it.k}"></label>
      <label>蛋白質 g<input type="number" class="fd-ai-p" min="0" max="300" value="${it.p||''}"></label>
    </div>
    <button class="fd-ai-fav" type="button" data-fav="${i}" aria-pressed="${it.fav}">${it.fav?'★ 已加到我的常吃':'☆ 加到我的常吃'}</button>
  </div>`).join(''):'<p class="small mute" style="margin:0">目前沒有項目，按「＋ 自己加一項」新增。</p>';
  $$('.fd-ai-item',box).forEach(row=>{
    const it=AIF.items[+row.dataset.i];
    $('.fd-ai-name',row).oninput=e=>{it.n=e.target.value;it.fav=false;aiFavBtn(row,it)};
    $('.fd-ai-portion',row).oninput=e=>{it.portion=e.target.value;it.fav=false;aiFavBtn(row,it)};
    $('.fd-ai-k',row).oninput=e=>{it.k=e.target.value;it.fav=false;aiFavBtn(row,it);aiShowTotal()};
    $('.fd-ai-p',row).oninput=e=>{it.p=e.target.value;it.fav=false;aiFavBtn(row,it)};
  });
  $$('[data-del]',box).forEach(b=>b.onclick=()=>{AIF.items.splice(+b.dataset.del,1);aiRenderItems()});
  $$('[data-fav]',box).forEach(b=>b.onclick=()=>{
    const it=AIF.items[+b.dataset.fav];
    if(!saveMyFood(aiItemName(it),it.k,it.p)){toast('請先填好名稱和 0 到 5000 之間的大卡');return}
    it.fav=true;aiFavBtn(b.closest('.fd-ai-item'),it);toast(`已加到我的常吃：${aiItemName(it)}`);
  });
  aiShowTotal();
}
function aiFavBtn(row,it){const b=$('.fd-ai-fav',row);b.textContent=it.fav?'★ 已加到我的常吃':'☆ 加到我的常吃';b.setAttribute('aria-pressed',String(it.fav))}
function aiShowTotal(){const el=$('#fdAiTotal');if(el)el.textContent=`合計 ${aiTotal()} 大卡`}
function aiPickedTime(){
  const d=$('#fdAiDate').value,tm=$('#fdAiTime').value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!/^\d{2}:\d{2}/.test(tm))return null;
  const t=new Date(`${d}T${tm.slice(0,5)}:00`).getTime();
  return Number.isFinite(t)?t:null;
}
function aiCommit(){
  const r=aiDayRange(),d=$('#fdAiDate').value,t=aiPickedTime();
  if(t==null){toast('請選擇用餐日期和時間');return}
  if(d<r.min||d>r.max){toast('只能記錄今天往前 7 天內的餐點');return}
  const rows=AIF.items.filter(i=>String(i.n).trim()||String(i.k).trim()&&+i.k>0);
  if(!rows.length){toast('沒有可以記錄的項目');return}
  const entries=rows.map(i=>foodEntry(aiItemName(i),i.k,i.p,{date:d,t,meal:AIF.meal,src:'ai'}));
  if(entries.some(e=>!e)){toast('每一項都要有名稱，大卡要在 0 到 5000 之間');return}
  for(const e of entries)(S.food[e.key]=S.food[e.key]||[]).push(e.e);
  save();renderStats();renderFood();
  const n=entries.length,kc=entries.reduce((a,e)=>a+e.e.k,0),day=d===dkey(new Date())?'':`（${d.slice(5).replace('-','/')}）`,meal=entries[0].e.meal||'';
  aiReset();toast(`已記錄${meal} ${n} 項，共 ${kc} 大卡${day}`);
}
$('#fdAiPhoto').onclick=()=>{if(AIF.busy||aiNeedLogin())return;aiMsg('');$('#fdAiFile').click()};
$('#fdAiText').onclick=()=>{
  if(AIF.busy||aiNeedLogin())return;
  aiDropPhoto();AIF.when=null;aiMsg('');aiShow('text');setTimeout(()=>$('#fdAiDesc').focus(),0);
};
$('#fdAiLoginBtn').onclick=()=>{aiShow('');$('#accountBtn').click()};
$('#fdAiFile').onchange=async e=>{
  const file=e.target.files&&e.target.files[0];if(!file)return;
  aiDropPhoto();
  if(file.type&&!file.type.startsWith('image/')){aiMsg('請選擇照片檔。');return}
  const url=URL.createObjectURL(file);
  try{await aiLoadImage(url)}catch(err){URL.revokeObjectURL(url);$('#fdAiFile').value='';aiMsg('這張照片的格式無法讀取（可能是 HEIC），請改選 JPEG 照片或截圖後再試。');return}
  let taken=null;try{taken=exifTime(await file.slice(0,262144).arrayBuffer())}catch(err){}
  AIF.photo={url};AIF.when=aiValidWhen(taken)||Date.now();
  $('#fdAiPrev').src=url;$('#fdAiWhenTxt').textContent=`用餐時間：${aiWhenText(AIF.when)}${taken&&aiValidWhen(taken)?'（照片拍攝時間）':''}`;
  aiMsg('');aiShow('photo');
};
$('#fdAiSendPhoto').onclick=()=>aiRun('image');
$('#fdAiSendText').onclick=()=>aiRun('text');
$('#fdAiCancelPhoto').onclick=()=>{aiReset()};
$('#fdAiCancelText').onclick=()=>{aiReset()};
