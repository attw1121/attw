(() => {
  'use strict';
  const installButton = document.querySelector('#install-button');
  const connectionMessage = document.querySelector('#connection-message');
  const pwaMessage = document.querySelector('#pwa-message');
  const submitButton = document.querySelector('#submit-button');
  const refreshButton = document.querySelector('#refresh-button');
  let installPrompt;

  function updateConnection() {
    const offline = !navigator.onLine;
    connectionMessage.textContent = offline ?
      '目前離線：可開啟網頁，但無法送出或更新清單；已顯示的資料可能不是最新。輸入不會儲存，請勿關閉或重新載入頁面。' : '';
    // 若 SDK 載入失敗，不因恢復網路就啟用尚未初始化的表單。
    if (window.supabase && window.REPAIR_CONFIG) {
      submitButton.disabled = offline || submitButton.textContent.includes('送出中');
      refreshButton.disabled = offline || document.querySelector('#request-list').getAttribute('aria-busy') === 'true';
    }
  }
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);
  updateConnection();

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });
  installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    installButton.hidden = true;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch {
      pwaMessage.textContent = '請使用瀏覽器選單將報修登記加入主畫面。';
    } finally {
      installPrompt = null;
    }
  });
  window.addEventListener('appinstalled', () => {
    installButton.hidden = true;
    installPrompt = null;
  });

  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        if (registration.waiting) showUpdate();
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate();
          });
        });
      } catch {
        pwaMessage.textContent = '離線功能尚未啟用；仍可在線上使用。請連線後重新開啟頁面。';
      }
    });
  }
  function showUpdate() {
    pwaMessage.textContent = '有新版本可用。完成操作後，關閉此網站的所有視窗，再重新開啟即可更新；未送出內容不會保留。';
  }
})();
