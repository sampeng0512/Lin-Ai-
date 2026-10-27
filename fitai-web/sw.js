/* Lin AI 的離線快取。改了網頁內容後，把下面的版本號加 1，使用者才會拿到新的快取。 */
const VER = 'v19';
const CORE = ['./', './index.html', './manifest.webmanifest', './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open('core-' + VER)
      .then(c => c.addAll(CORE).then(() => c.add('./pose_landmarker_lite.task').catch(() => {})))   // 姿勢模型也先存起來，第一次進站就能離線用鏡頭
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

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname === 'api.anthropic.com') return;           // AI 對話不快取

  // HTML、CSS、JS：先重新驗證網路版本，離線時才回退到快取
  const isNavigation = r.mode === 'navigate';
  const isCode = isNavigation || ['document', 'style', 'script'].includes(r.destination) ||
    /\.(?:html?|css|m?js)$/i.test(u.pathname);
  if (isCode) {
    e.respondWith(
      fetch(r, { cache: 'no-cache' }).then(async res => {
        if (res.ok || res.type === 'opaque') {
          try {
            const cache = await caches.open('core-' + VER);
            await cache.put(r, res.clone());
          } catch (error) {
            console.warn('Unable to cache updated code:', error);
          }
        }
        return res;
      }).catch(async error => {
        const cached = await caches.match(r);
        if (cached) return cached;
        if (isNavigation) {
          const fallback = await caches.match('./index.html');
          if (fallback) return fallback;
        }
        throw error;
      })
    );
    return;
  }

  // 其他（姿勢模型、MediaPipe、字型、圖示）：先用快取，沒有再上網抓並存起來
  e.respondWith(
    caches.match(r).then(m => m || fetch(r).then(res => {
      if (res && (res.status === 200 || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open('rt-' + VER).then(c => c.put(r, copy));
      }
      return res;
    }))
  );
});
