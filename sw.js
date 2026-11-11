'use strict';
// 更新靜態檔案時遞增版本；不快取 API、報修資料、表單內容或其他子工具。
const CACHE_PREFIX = `repair-pwa:${self.registration.scope}:`;
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const ROOT = self.registration.scope;
const SHELL = ['index.html', 'style.css', 'app.js', 'config.js', 'pwa.js',
  'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png']
  .map((path) => new URL(path, ROOT).href);
const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL);
    // CDN 無法連線時不妨礙離線外殼安裝；SDK 成功下載後才快取。
    try {
      const response = await fetch(SDK, { mode: 'cors' });
      if (response.ok && response.type !== 'opaque') await cache.put(SDK, response);
    } catch { /* 離線時由原網頁提示服務無法連線。 */ }
  })());
  // 不強制啟用，避免使用者填表途中混用新版資源。
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const rootUrl = new URL(ROOT);
  const isHome = url.origin === rootUrl.origin &&
    (url.pathname === rootUrl.pathname || url.pathname === new URL('index.html', ROOT).pathname);
  if (request.mode === 'navigate' && isHome) {
    event.respondWith(caches.open(CACHE_NAME).then((cache) => cache.match(SHELL[0]))
      .then((cached) => cached || fetch(request)));
    return;
  }
  // 僅攔截精確列出的靜態資源；Supabase 所有讀寫一律走網路，不存入 Cache Storage。
  if (!SHELL.includes(request.url) && request.url !== SDK) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type !== 'opaque') await cache.put(request, response.clone());
    return response;
  })());
});
