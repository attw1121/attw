(() => {
  'use strict';
  const form = document.querySelector('#repair-form');
  const submitButton = document.querySelector('#submit-button');
  const refreshButton = document.querySelector('#refresh-button');
  const formMessage = document.querySelector('#form-message');
  const listMessage = document.querySelector('#list-message');
  const list = document.querySelector('#request-list');
  const filterButtons = document.querySelectorAll('[data-urgency]');
  const filterMessage = document.querySelector('#filter-message');
  let requests = [];
  let selectedUrgency = '全部';
  const config = window.REPAIR_CONFIG;
  let client;
  let loading = false;
  let submitting = false;

  function message(element, text, kind = '') {
    element.textContent = text;
    element.className = `message ${kind}`;
  }
  function node(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text ?? '';
    return element;
  }
  function render(rows) {
    list.replaceChildren();
    for (const row of rows) {
      const card = node('li', 'request-card', '');
      const top = node('div', 'card-top', '');
      top.append(node('span', 'badge', row.category),
        node('span', `badge ${row.urgency === '高' ? 'high' : ''}`, `緊急：${row.urgency}`),
        node('span', 'status', row.status));
      const meta = node('div', 'meta', `報修人：${row.reporter_name}`);
      const date = new Date(row.created_at);
      const time = node('time', '', Number.isNaN(date.getTime()) ? '登記時間不明' :
        new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Taipei' }).format(date) + '（台北時間）');
      if (!Number.isNaN(date.getTime())) time.dateTime = date.toISOString();
      meta.append(time);
      card.append(top, node('h3', '', row.location), node('p', 'description', row.description), meta);
      list.append(card);
    }
  }
  // 僅在已載入的清單上篩選，不發出任何額外資料庫請求。
  function renderFilteredRequests() {
    const visible = selectedUrgency === '全部' ? requests :
      requests.filter((row) => row.urgency === selectedUrgency);
    render(visible);
    message(filterMessage, requests.length && !visible.length ?
      `最近載入的報修中，沒有緊急程度為「${selectedUrgency}」的紀錄。` : '');
    for (const button of filterButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.urgency === selectedUrgency));
    }
  }
  for (const button of filterButtons) {
    button.addEventListener('click', () => {
      selectedUrgency = button.dataset.urgency;
      renderFilteredRequests();
    });
  }
  async function loadRequests() {
    if (loading) return false;
    loading = true;
    refreshButton.disabled = true;
    list.setAttribute('aria-busy', 'true');
    message(listMessage, '正在載入最近報修…');
    try {
      const { data, error } = await client.from('repair_requests')
        .select('id,created_at,reporter_name,location,category,description,urgency,status')
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(20);
      if (error) throw error;
      requests = data || [];
      renderFilteredRequests();
      message(listMessage, data?.length ? '' : '目前還沒有報修紀錄。');
      return true;
    } catch (error) {
      message(listMessage, `讀取失敗，請重新整理再試。${error.message || '請檢查網路連線。'}`, 'error');
      return false;
    } finally {
      loading = false;
      refreshButton.disabled = false;
      list.setAttribute('aria-busy', 'false');
    }
  }
  try {
    if (!window.supabase || !config?.supabaseUrl || !config?.supabasePublishableKey) {
      throw new Error('服務載入失敗，請檢查網路後重新載入頁面。');
    }
    client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  } catch (error) {
    submitButton.disabled = true;
    refreshButton.disabled = true;
    message(formMessage, error.message, 'error');
    message(listMessage, '目前無法連線至報修服務。', 'error');
    return;
  }
  for (const field of form.querySelectorAll('input, textarea')) {
    field.addEventListener('input', () => field.setCustomValidity(''));
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    for (const field of form.querySelectorAll('input, textarea')) {
      field.setCustomValidity(field.value.trim() ? '' : '請填寫內容，不能只有空白。');
    }
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    // 僅傳入五個填表欄位；id、created_at、status 一律由資料庫預設值產生。
    const payload = Object.fromEntries(['reporter_name', 'location', 'category', 'description', 'urgency']
      .map((key) => [key, String(values.get(key)).trim()]));
    submitting = true;
    submitButton.disabled = true;
    submitButton.textContent = '送出中…';
    message(formMessage, '正在送出報修…');
    try {
      const { error } = await client.from('repair_requests').insert(payload);
      if (error) throw error;
      form.reset();
      message(formMessage, '報修已成功送出！', 'success');
      const refreshed = await loadRequests();
      if (!refreshed) message(formMessage, '報修已成功送出！清單尚未更新，請按「重新整理」，不需重複送出。', 'success');
    } catch (error) {
      message(formMessage, `未能確認送出成功：${error.message || '連線異常'}。內容已保留；重試前請先重新整理清單，避免重複登記。`, 'error');
    } finally {
      submitting = false;
      submitButton.disabled = false;
      submitButton.textContent = '送出報修 ↗';
    }
  });
  refreshButton.addEventListener('click', loadRequests);
  loadRequests();
})();
