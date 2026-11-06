/* Lin AI 的離線快取。
   網頁、CSS、JS 都是「網路優先」，有網路就一定拿最新版，所以平常改程式不用動版本號；
   只有想清掉舊快取（例如換了姿勢模型、圖示）時才把下面的版本號加 1。 */
const VER = 'v23';
// 新增或改名 css/、js/ 檔案時，要同步更新下面兩個清單（跟 index.html 載入的順序一樣）
const CSS_FILES = ['01-基本樣式', '02-視覺強化', '03-首頁與模式主題', '04-遊戲畫面', '05-鏡頭與計時器畫面', '06-版面調整與手機'];
const JS_FILES = ['01-共用工具與資料', '02-姿勢偵測與鏡頭', '03-分頁切換', '04-鏡頭計數', '05-訓練計時器', '06-挑戰與小遊戲', '07-身體數據與菜單', '08-AI教練', '09-喝水提醒', '10-跑步', '11-統計與成就', '12-我的菜單', '13-動作教學', '14-備份與還原', '15-撐住挑戰', '16-AI教練紀錄摘要', '17-課表與訓練提醒', '18-飲食紀錄', '19-帳號與好友排行', '20-進階偵測與錄影', '21-健身夥伴', '22-訓練音樂', '23-安裝App與啟動'];
const CORE = ['./', './index.html', './manifest.webmanifest', './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/apple-touch-icon.png',
  ...CSS_FILES.map(n => `./css/${n}.css`), ...JS_FILES.map(n => `./js/${n}.js`)];
const NET_TIMEOUT = 4000;   // 網路太慢時，最多等這麼久就先用快取頂著（背景還是會繼續抓新版）

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open('core-' + VER)
      .then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))   // 安裝時略過 HTTP 快取，避免把舊檔存進新快取
        .then(() => c.add('./assets/models/pose_landmarker_lite.task').catch(() => {})))     // 姿勢模型也先存起來，第一次進站就能離線用鏡頭
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.endsWith('-' + VER)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const okToCache = res => res && (res.status === 200 || res.type === 'opaque');

function put(cacheName, req, res) {
  if (!okToCache(res)) return Promise.resolve();
  const copy = res.clone();
  return caches.open(cacheName).then(c => c.put(req, copy)).catch(() => {});
}

// 網路優先：用 no-cache 向伺服器確認是否有新版（不吃瀏覽器的 HTTP 快取），成功就更新快取；
// 斷線或等太久才用快取，等太久的情況下載完仍會在背景更新快取，下次開就是新版。
function networkFirst(e, req, fallback) {
  const net = fetch(req, { cache: 'no-cache' });
  e.waitUntil(net.then(res => put('core-' + VER, req, res)).catch(() => {}));
  const cached = () => caches.match(req).then(m => m || (fallback && caches.match(fallback)));
  return new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done && r) { done = true; resolve(r); } };
    const timer = setTimeout(() => cached().then(finish), NET_TIMEOUT);
    net.then(res => { clearTimeout(timer); finish(res); })
       .catch(() => { clearTimeout(timer); cached().then(m => finish(m || Response.error())); });
  });
}

// 先回快取、同時在背景抓新版存起來（下次就是新的）；沒快取就等網路
function staleWhileRevalidate(e, req) {
  const net = fetch(req).then(res => put('rt-' + VER, req, res).then(() => res));
  e.waitUntil(net.catch(() => {}));
  return caches.match(req).then(m => m || net);
}

// 快取優先：內容不會變的大檔（姿勢模型、字型檔、圖片）
function cacheFirst(req) {
  return caches.match(req).then(m => m || fetch(req).then(res => { put('rt-' + VER, req, res); return res; }));
}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
  if (u.hostname === 'fitai-rag.onrender.com' || u.hostname.endsWith('.supabase.co')) return;   // AI 問答後端、帳號資料不快取
  const sameOrigin = u.origin === self.location.origin;
  const isCode = /\.(html?|css|m?js|json|webmanifest)$/i.test(u.pathname) || r.destination === 'script' || r.destination === 'style' || r.destination === 'manifest';

  // 網頁本體與自己網站的 HTML / CSS / JS：網路優先
  if (r.mode === 'navigate' || (sameOrigin && (isCode || u.pathname.endsWith('/')))) {
    e.respondWith(networkFirst(e, r, r.mode === 'navigate' ? './index.html' : null));
    return;
  }

  // 外部 CDN 的 CSS / JS（Google Fonts 的 CSS、MediaPipe）：先用快取、背景更新
  if (isCode) {
    e.respondWith(staleWhileRevalidate(e, r));
    return;
  }

  // 其他（姿勢模型、字型檔、圖示）：先用快取，沒有再上網抓並存起來
  e.respondWith(cacheFirst(r));
});
