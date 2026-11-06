/* ============================================================
   99-找程式位置（開發者工具，一般使用者看不到）
   用法：在網址後面加上 ?找程式，例如
         http://127.0.0.1:8000/index.html?找程式
   畫面右下角會出現「🔍 找程式」按鈕。打開後點畫面上任何東西，
   就會列出它的 HTML、程式（js）和樣式（css）在哪個檔案第幾行。
   打開時點擊不會觸發原本的功能；要正常操作就再按一次按鈕關掉。
   ============================================================ */
'use strict';
(() => {
  const q = decodeURIComponent(location.search);
  if (!/找程式|[?&]dev\b/.test(q)) return;

  // 每個區塊的中文名稱與主要程式檔（跟 index.html 裡的註解一致）
  const REGIONS = {
    modeHome: ['首頁（選模式）', 'js/03-分頁切換.js'],
    accountDlg: ['登入／註冊視窗', 'js/19-帳號與好友排行.js'],
    voiceDlg: ['語音設定視窗', 'js/01-共用工具與資料.js'],
    scanDlg: ['掃描 QR Code 視窗', 'js/19-帳號與好友排行.js'],
    qrDlg: ['邀請 QR Code 視窗', 'js/19-帳號與好友排行.js'],
    avatarDlg: ['選頭像視窗', 'js/19-帳號與好友排行.js'],
    planBar: ['訓練提醒列', 'js/17-課表與訓練提醒.js'],
    updateBar: ['新版本提示列', 'js/23-安裝App與啟動.js'],
    installBar: ['安裝 App 提示列', 'js/23-安裝App與啟動.js'],
    toast: ['提示訊息', 'js/01-共用工具與資料.js'],
    waterBar: ['喝水提醒列', 'js/09-喝水提醒.js'],
    'tab-cam': ['鏡頭計數分頁', 'js/04-鏡頭計數.js'],
    'tab-timer': ['訓練計時器分頁', 'js/05-訓練計時器.js'],
    'tab-runk': ['跑步分頁', 'js/10-跑步.js'],
    'tab-game': ['挑戰與遊戲分頁', 'js/06-挑戰與小遊戲.js'],
    'tab-stats': ['統計紀錄分頁', 'js/11-統計與成就.js'],
    'tab-friends': ['好友排行分頁', 'js/19-帳號與好友排行.js'],
    'tab-body': ['身體數據與菜單分頁', 'js/07-身體數據與菜單.js'],
    'tab-ach': ['成就徽章分頁', 'js/11-統計與成就.js'],
    'tab-food': ['飲食紀錄分頁', 'js/18-飲食紀錄.js'],
    'tab-guide': ['動作教學分頁', 'js/13-動作教學.js'],
    'tab-coach': ['AI 教練分頁', 'js/08-AI教練.js'],
    foot: ['頁尾', 'js/23-安裝App與啟動.js'],
    tabs: ['下方分頁列', 'js/03-分頁切換.js'],
    bdPanel: ['健身夥伴面板', 'js/21-健身夥伴.js'],
    musicPanel: ['訓練音樂面板', 'js/22-訓練音樂.js'],
    recDlg: ['錄影完成視窗', 'js/20-進階偵測與錄影.js'],
    gameDetails: ['遊戲說明視窗', 'js/06-挑戰與小遊戲.js'],
  };

  // ---------- 讀取所有檔案內容 ----------
  const files = [];   // {name, lines}
  const pageUrl = location.href.split('#')[0].split('?')[0];
  async function loadFiles() {
    const list = [['index.html', pageUrl]];
    document.querySelectorAll('link[rel=stylesheet][href^="css/"]').forEach(l => list.push([decodeURIComponent(l.getAttribute('href')), l.href]));
    document.querySelectorAll('script[src^="js/"]').forEach(s => { const n = decodeURIComponent(s.getAttribute('src')); if (!n.includes('99-')) list.push([n, s.src]); });
    await Promise.all(list.map(async ([name, url]) => {
      try { const t = await (await fetch(url, { cache: 'no-store' })).text(); files.push({ name, lines: t.split(/\r?\n/) }); }
      catch (e) { console.warn('找程式：讀不到', name, e); }
    }));
    const order = list.map(x => x[0]);
    files.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  }

  function search(needles, kind, max) {
    const hits = [];
    for (const f of files) {
      if (kind === 'js' && !f.name.endsWith('.js')) continue;
      if (kind === 'css' && !f.name.endsWith('.css')) continue;
      if (kind === 'html' && f.name !== 'index.html') continue;
      f.lines.forEach((text, i) => {
        if (hits.length < max && needles.some(n => text.includes(n))) hits.push({ file: f.name, line: i + 1, text: text.trim() });
      });
    }
    return hits;
  }

  // ---------- 分析點到的元素 ----------
  const classes = el => [...el.classList].filter(c => c !== 'fc-outline');
  function describe(el) {
    const tag = el.tagName.toLowerCase();
    const label = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    const cls = classes(el);
    return `<${tag}${el.id ? ' id="' + el.id + '"' : ''}${cls.length ? ' class="' + cls.join(' ') + '"' : ''}>${label ? '「' + label + '」' : ''}`;
  }
  function analyse(clicked) {
    // 點到按鈕裡的圖示或文字時，以整個按鈕為準
    const target = clicked.closest('button,a,input,select,textarea,label,summary,[role=tab],[role=button]') || clicked;
    // 往上找最多 6 層，收集 id 與 data-* 屬性
    const chain = [];
    for (let el = target, d = 0; el && el !== document.body && d < 6; el = el.parentElement, d++) chain.push(el);
    const withId = chain.find(el => el.id);
    const region = (() => { for (let el = target; el; el = el.parentElement) if (el.id && REGIONS[el.id]) return REGIONS[el.id]; return null; })();

    const jsNeedles = [], cssNeedles = [], htmlNeedles = [];
    for (const el of chain) {
      if (el.id) { jsNeedles.push(`#${el.id}`, `'${el.id}'`, `"${el.id}"`); if (!htmlNeedles.length) htmlNeedles.push(`id="${el.id}"`); }
      for (const a of el.attributes) if (a.name.startsWith('data-') && a.value && a.value.length < 30) { jsNeedles.push(`${a.name}=${a.value}`, `${a.name}="${a.value}"`, `${a.name}='${a.value}'`); if (!htmlNeedles.length) htmlNeedles.push(`${a.name}="${a.value}"`); }
      if (jsNeedles.length) break;      // 找到最近一層有 id / data 的就停
    }
    // 沒有用 id 或 data-* 找到程式時，改用 class 找（例如所有分頁按鈕都用 '.tab' 綁定）
    let js = jsNeedles.length ? search(jsNeedles, 'js', 8) : [];
    if (!js.length) {
      const clsNeedles = classes(target).flatMap(c => [`'.${c}'`, `".${c}"`, `('.${c}`, `('.${c}[`, `'.${c}[`, `\`.${c}[`]);
      js = clsNeedles.length ? search(clsNeedles, 'js', 8) : [];
    }
    // 樣式：先列專屬這個 id 的，再列 class 的
    const cssId = target.id ? search([`#${target.id}`], 'css', 4) : [];
    classes(target).forEach(c => cssNeedles.push(`.${c}{`, `.${c},`, `.${c} `, `.${c}:`, `.${c}[`, `.${c}>`, `.${c}.`));
    const cssCls = cssNeedles.length ? search(cssNeedles, 'css', 6 - cssId.length) : [];
    return {
      el: describe(target),
      anchor: withId ? describe(withId) : null,
      region,
      html: htmlNeedles.length ? search(htmlNeedles, 'html', 3) : [],
      js,
      css: cssId.concat(cssCls),
    };
  }

  // ---------- 介面 ----------
  const ui = document.createElement('div');
  ui.setAttribute('data-find-code', '');
  ui.innerHTML = `<style>
    [data-find-code]{position:fixed;right:12px;bottom:90px;z-index:2147483647;font:13px/1.5 system-ui,"Noto Sans TC",sans-serif;color:#e8f1f4}
    [data-find-code] .fc-btn{display:block;margin-left:auto;padding:8px 14px;border:0;border-radius:999px;background:#1d3a44;color:#fff;font:inherit;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:pointer}
    [data-find-code] .fc-btn.on{background:#e0a400;color:#111}
    [data-find-code] .fc-panel{width:min(92vw,520px);max-height:60vh;overflow:auto;margin-bottom:8px;padding:12px 14px;border-radius:12px;background:#0d1b21;border:1px solid #2b4a55;box-shadow:0 8px 30px rgba(0,0,0,.5)}
    [data-find-code] h4{margin:10px 0 4px;font-size:13px;color:#ffd257}
    [data-find-code] .fc-hit{margin:2px 0;padding:4px 6px;border-radius:6px;background:#12262e;cursor:pointer}
    [data-find-code] .fc-hit b{color:#74f0c0}
    [data-find-code] .fc-hit code{display:block;color:#a9c0c8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:12px ui-monospace,Consolas,monospace}
    [data-find-code] .fc-mute{color:#8aa3ab}
    .fc-outline{outline:2px dashed #e0a400 !important;outline-offset:2px !important}
  </style><div class="fc-panel" hidden></div><button class="fc-btn" type="button">🔍 找程式</button>`;
  const btn = ui.querySelector('.fc-btn'), panel = ui.querySelector('.fc-panel');
  let on = false, hovered = null, loaded = null;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hitsHtml = (title, hits, empty) => `<h4>${title}</h4>` + (hits.length
    ? hits.map(h => `<div class="fc-hit" data-copy="${esc(h.file + ':' + h.line)}" title="點一下複製「檔案:行號」"><b>${esc(h.file)}</b> 第 ${h.line} 行<code>${esc(h.text.slice(0, 160))}</code></div>`).join('')
    : `<div class="fc-mute">${empty}</div>`);

  function show(r) {
    panel.hidden = false;
    panel.innerHTML =
      `<div><b>你點的是：</b>${esc(r.el)}</div>` +
      (r.anchor && r.anchor !== r.el ? `<div class="fc-mute">所在元素：${esc(r.anchor)}</div>` : '') +
      (r.region ? `<div><b>位置：</b>${esc(r.region[0])}　<b>主要程式：</b>${esc(r.region[1])}</div>` : '') +
      hitsHtml('畫面（HTML）', r.html, '這個元素是程式產生的，請看下面的程式位置。') +
      hitsHtml('程式（js）', r.js, r.region ? `沒有直接找到，請先看 ${r.region[1]}。` : '沒有找到，請參考 程式地圖.md。') +
      hitsHtml('樣式（css）', r.css, '沒有找到專屬的樣式。');
    console.log('[找程式]', r);
  }

  // 有開啟的 <dialog> 時，面板要放進 dialog 裡面才不會被蓋住
  const mount = () => { const d = [...document.querySelectorAll('dialog[open]')].pop(); const host = d || document.body; if (ui.parentNode !== host) host.appendChild(ui); };

  function onClick(e) {
    if (!on) return;
    const copy = e.target.closest('[data-copy]');
    if (copy) { navigator.clipboard?.writeText(copy.dataset.copy).catch(() => {}); copy.style.background = '#1f4d3c'; return; }
    if (e.target.closest('[data-find-code]')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    mount();
    loaded.then(() => show(analyse(e.target)));
  }
  function onOver(e) {
    if (!on || e.target.closest('[data-find-code]')) return;
    hovered?.classList.remove('fc-outline'); hovered = e.target; hovered.classList.add('fc-outline');
  }
  function toggle() {
    on = !on;
    btn.classList.toggle('on', on);
    btn.textContent = on ? '🔍 找程式：開啟中（點我關閉）' : '🔍 找程式';
    if (on) { loaded = loaded || loadFiles(); panel.hidden = false; panel.innerHTML = '<div class="fc-mute">點畫面上任何東西，這裡會顯示它在哪個檔案第幾行。</div>'; }
    else { panel.hidden = true; hovered?.classList.remove('fc-outline'); hovered = null; }
  }

  btn.addEventListener('click', toggle);
  // 用捕獲階段，搶在原本的按鈕功能之前攔下點擊
  for (const t of ['click', 'pointerdown', 'mousedown', 'touchstart']) window.addEventListener(t, e => { if (on && !e.target.closest('[data-find-code]')) { if (t === 'click') onClick(e); else { e.stopImmediatePropagation(); } } }, { capture: true, passive: false });
  ui.addEventListener('click', onClick);
  window.addEventListener('mouseover', onOver, true);
  document.body.appendChild(ui);
  // 視窗（dialog）打開或關上時，把工具搬到最上層的視窗裡，按鈕才按得到
  new MutationObserver(mount).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
})();
