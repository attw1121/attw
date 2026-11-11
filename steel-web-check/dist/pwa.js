(() => {
  'use strict';
  const status = document.getElementById('pwa-status');
  const install = document.getElementById('pwa-install');
  const update = document.getElementById('pwa-update');
  let promptEvent, registration, offlineReady = false, refreshing = false;
  const setStatus = () => {
    status.textContent = offlineReady
      ? (navigator.onLine ? '離線已就緒：可安裝至裝置，隨時使用。' : '目前離線：計算與匯出可正常使用。')
      : (navigator.onLine ? '正在準備離線使用…' : '目前離線，請先連網完成首次載入。');
  };
  window.addEventListener('online', setStatus);
  window.addEventListener('offline', setStatus);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); promptEvent = event; install.hidden = false;
  });
  install.addEventListener('click', async () => {
    if (!promptEvent) return;
    const pending = promptEvent; promptEvent = null; install.hidden = true;
    await pending.prompt(); await pending.userChoice;
  });
  window.addEventListener('appinstalled', () => { install.hidden = true; promptEvent = null; });
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    status.textContent = '此瀏覽器目前無法提供離線功能；可連網使用，或改用支援 PWA 的瀏覽器。';
    return;
  }
  const showUpdate = () => { if (registration.waiting && navigator.serviceWorker.controller) update.hidden = false; };
  update.addEventListener('click', () => {
    if (!registration.waiting) return;
    refreshing = true; update.disabled = true;
    registration.waiting.postMessage('SKIP_WAITING');
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (refreshing) location.reload(); });
  window.addEventListener('load', async () => {
    try {
      setStatus();
      registration = await navigator.serviceWorker.register('./sw.js', {scope: './', updateViaCache: 'none'});
      showUpdate();
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (worker) worker.addEventListener('statechange', showUpdate);
      });
      await navigator.serviceWorker.ready;
      offlineReady = true; setStatus();
    } catch (error) {
      status.textContent = '離線準備未完成，請連網重新整理；目前仍可使用已載入的計算工具。';
    }
  });
})();
