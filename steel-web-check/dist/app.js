/* 介面：輸入、即時計算、示意圖、計算過程顯示與匯出 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const C = window.SteelCalc, Dg = window.SteelDiagram, X = window.SteelExport;
  const fm = C.fm;
  const STORE = 'web-check-v2';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* 公式標記 → HTML */
  function rich(s) {
    let out = '', i = 0; s = String(s ?? '');
    while (i < s.length) {
      const ch = s[i];
      if ((ch === '_' || ch === '^') && i + 1 < s.length) {
        let body;
        if (s[i + 1] === '{') { const j = s.indexOf('}', i); body = s.slice(i + 2, j); i = j + 1; } else { body = s[i + 1]; i += 2; }
        out += (ch === '_' ? '<sub>' : '<sup>') + esc(body) + (ch === '_' ? '</sub>' : '</sup>');
      } else { out += esc(ch); i++; }
    }
    return out;
  }
  const num = (n, d = 2) => Number(n).toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d });

  /* ---------- 建立輸入欄位 ---------- */
  const NUM_FIELDS = {
    geomFields: ['d', 'bf', 'tw', 'tf', 'r'],
    matFields: ['Fy', 'E'],
    loadFields: ['P', 'N', 'a', 'M', 'Lb']
  };
  const HINTS = {
    d: '型鋼全深', bf: '翼板寬', tw: '腹板厚', tf: '翼板厚', r: '熱軋：圓角半徑；銲接：銲道腳長',
    Fy: '如 SN400B：2400、SN490B：3300', E: '一般取 2,040,000',
    P: '單一翼板傳入之集中力', N: '承壓板沿梁軸向長度（端部反力 N ≥ k）', a: '載重中心至最近構材端', M: '用於判斷 Cr（|M| < My）', Lb: '載重點處任一翼板之最大無側撐長度'
  };
  for (const [box, keys] of Object.entries(NUM_FIELDS)) {
    $(box).innerHTML = keys.map(k => {
      const [label, sym, unit] = C.INPUT_META[k];
      return '<label for="' + k + '" title="' + esc(HINTS[k] || '') + '"><span class="lbl">' + esc(label) + ' <i class="symbol">' + rich(sym) + '</i></span>' +
        '<span class="input-unit"><input id="' + k + '" type="number" step="any" min="0" inputmode="decimal" required><em>' + esc(unit) + '</em></span></label>';
    }).join('');
  }
  $('preset').innerHTML = '<option value="custom">自訂尺寸</option>' + C.PRESETS.map(p => '<option>' + esc(p.name) + '</option>').join('');

  const TEXT_KEYS = ['project', 'member', 'designer', 'date', 'code', 'shape', 'preset', 'load', 'relative', 'rotation', 'sxMode'];
  const NUM_KEYS = [].concat(...Object.values(NUM_FIELDS), ['Sx']);
  let coefOverrides = {};
  let state = null, result = null;

  function read() {
    const x = {};
    for (const k of TEXT_KEYS) x[k] = $(k).value;
    for (const k of NUM_KEYS) { const s = $(k).value.trim(); x[k] = s === '' ? NaN : Number(s); }
    x.coef = coefOverrides;
    return x;
  }
  function apply(x) {
    for (const k of TEXT_KEYS) if (x[k] !== undefined) $(k).value = x[k];
    for (const k of NUM_KEYS) if (x[k] !== undefined && Number.isFinite(x[k])) $(k).value = x[k];
    coefOverrides = x.coef && typeof x.coef === 'object' ? JSON.parse(JSON.stringify(x.coef)) : {};
    buildCoefFields();
    render();
  }

  /* ---------- 規範係數欄位 ---------- */
  function buildCoefFields() {
    const code = $('code').value;
    const K = C.coefsFor(code, coefOverrides);
    $('coefFields').innerHTML = C.COEFS[code].map(c => {
      const changed = K[c.key] !== c.v;
      return '<label class="coef"><span class="lbl">' + rich(c.label) + (c.verify ? ' <b class="flag">待確認</b>' : '') + (changed ? ' <b class="flag changed">已修改</b>' : '') +
        '<small>' + esc(c.ref) + '｜預設 ' + fm(c.v) + '</small></span><input type="number" step="any" min="0" data-coef="' + c.key + '" value="' + K[c.key] + '"></label>';
    }).join('');
  }
  $('coefFields').addEventListener('change', e => {
    const k = e.target.dataset.coef; if (!k) return;
    const code = $('code').value, val = Number(e.target.value);
    coefOverrides[code] = coefOverrides[code] || {};
    const def = C.COEFS[code].find(c => c.key === k).v;
    if (Number.isFinite(val) && val > 0 && val !== def) coefOverrides[code][k] = val; else delete coefOverrides[code][k];
    buildCoefFields(); render();
  });
  $('coefReset').onclick = () => { delete coefOverrides[$('code').value]; buildCoefFields(); render(); toast('已恢復預設係數'); };

  /* ---------- 繪製結果 ---------- */
  function statusClass(c) { return c.state === 'calc' ? (c.ratio <= 1 ? 'ok' : 'ng') : 'na'; }

  function render() {
    state = read();
    result = C.calculate(state);
    const code = C.CODES[state.code];
    const asd = code.method === 'asd';
    $('codeHelp').textContent = code.family === 'tw'
      ? (asd ? '容許應力法：以使用載重比較容許載重 R_a（公式已含安全係數）。' : '極限設計法：以因數化載重比較設計強度 φR_n。').replace(/_/g, '')
      : (asd ? 'ASD：以 ASD 載重組合比較容許強度 Rn/Ω。' : 'LRFD：以因數化載重比較設計強度 φRn。');
    $('loadHelp').textContent = (asd ? 'P、M 請輸入使用（ASD）載重組合值。' : 'P、M 請輸入因數化（LRFD）載重組合值。') + '本工具不自動組合載重。';
    $('sxWrap').hidden = state.sxMode !== 'manual';
    $('rotation').disabled = state.relative === 'braced' || state.load === 'double';
    $('relative').disabled = state.load === 'double';

    const invalid = result.errors.length > 0;
    $('error').hidden = !invalid;
    $('error').innerHTML = invalid ? '<b>請修正輸入：</b>' + result.errors.map(esc).join('；') : '';
    for (const b of ['btnExcel', 'btnWord', 'btnPrint']) $(b).disabled = invalid;

    // 衍生值與示意圖（輸入合理時才畫）
    if (invalid) { $('output').innerHTML = ''; $('derived').innerHTML = ''; return; }
    const v = result.v;
    $('derived').innerHTML = '<span>k = <b>' + fm(v.k * 10) + '</b> mm</span><span>h = <b>' + fm(v.h * 10) + '</b> mm</span><span>h/t<sub>w</sub> = <b>' + fm(v.h / v.tw, 2) + '</b></span><span>S<sub>x</sub> = <b>' + fm(v.Sx, 1) + '</b> cm³</span><span>M<sub>y</sub> = <b>' + fm(v.My / 100, 2) + '</b> tf·m</span>';
    $('figSection').innerHTML = Dg.section(state);
    $('figElevation').innerHTML = Dg.elevation(state, result);
    const dl = (t, val) => '<dt>' + rich(t) + '</dt><dd>' + val + '</dd>';
    $('figData').innerHTML = '<div class="sec">斷面</div>' + dl('斷面', esc(state.preset !== 'custom' ? state.preset : '自訂') + '（' + ($('shape').selectedOptions[0].textContent) + '）') +
      dl('d × b_f', fm(state.d) + ' × ' + fm(state.bf) + ' mm') + dl('t_w／t_f', fm(state.tw) + '／' + fm(state.tf) + ' mm') + dl('k／h', fm(v.k * 10) + '／' + fm(v.h * 10) + ' mm') +
      '<div class="sec">材料</div>' + dl('F_{yw}／E', fm(state.Fy) + '／' + fm(state.E) + ' kgf/cm²') +
      '<div class="sec">載重與位置</div>' + dl('P', fm(state.P) + ' tf（' + (state.load === 'double' ? '上下相向' : '單側') + '）') + dl('N', fm(state.N) + ' mm') + dl('a', fm(state.a) + ' mm（' + (v.a > v.d ? '> d' : v.a >= v.d / 2 ? 'd/2 ～ d' : '< d/2') + '）') +
      dl('L_b', fm(state.Lb) + ' mm') + dl('|M|', fm(state.M) + ' tf·m') +
      '<div class="sec">拘束</div>' + dl('相對側移', state.relative === 'braced' ? '已拘束' : '未拘束') + dl('翼板轉動', state.rotation === 'yes' ? '有拘束' : '無拘束');

    const r = result, g = r.governing;
    const tone = !g ? 'na' : r.pass ? 'ok' : 'ng';
    const title = !g ? '無適用之檢核項目' : r.pass ? '全部適用項目通過' : '有檢核項目不通過';
    let html = '<section class="summary ' + tone + '"><div><div class="small-label">CHECK SUMMARY · ' + esc(state.member) + ' · ' + esc(code.short) + '</div><h2>' + title + '</h2>' +
      (g ? '<p>控制項目：<b>' + g.name + '</b>　' + rich(r.capLabel) + ' = ' + num(g.cap) + ' tf　需求 P = ' + num(v.P) + ' tf</p>' : '') + '</div>' +
      '<div class="big-ratio"><strong>' + (g ? num(g.ratio, 3) : '—') + '</strong><span>最大 D/C（需 ≤ 1.000）</span></div></section>';

    html += '<div class="result-grid">' + r.checks.map(c => {
      const sc = statusClass(c);
      const pct = c.state === 'calc' ? Math.min(c.ratio, 1.5) / 1.5 * 100 : 0;
      return '<a class="result-card ' + sc + '" href="#chk-' + c.id + '"><div class="card-top"><h3>' + c.name + '</h3><span class="badge ' + sc + '">' + c.status + '</span></div>' +
        '<div class="ref">' + esc(c.ref) + '</div>' +
        '<div class="capacity">' + (c.state === 'calc' ? num(c.cap) + ' <small>tf</small>' : '<small>' + esc(c.status) + '</small>') + '</div>' +
        '<div class="bar" aria-hidden="true"><i style="width:' + pct + '%"></i><b style="left:' + (100 / 1.5) + '%"></b></div>' +
        '<div class="card-bottom">' + (c.state === 'calc' ? 'D/C = <b>' + num(c.ratio, 3) + '</b>' : '不列入比較') + '</div></a>';
    }).join('') + '</div>';

    html += '<div class="process-heading"><h2>詳細計算過程</h2><button type="button" class="secondary small" id="toggleAll">全部收合</button></div>';
    html += '<details class="calc-detail" open><summary><span class="step">00</span>前置計算（單位換算與斷面參數）</summary><div class="detail-content">' +
      unitTable(r) + stepTable(r.pre) + '</div></details>';
    html += r.checks.map((c, i) => {
      const sc = statusClass(c);
      let body = '<div class="detail-grid"><div class="mode-fig">' + Dg.mode(c.id) + '</div><div>' +
        '<p class="ref-line"><b>規範條文：</b>' + esc(c.ref) + (c.eq ? ' ' + c.eq : '') + '</p>' +
        (c.conds.length ? '<p class="mini-title">適用條件判斷</p><ul class="conds">' + c.conds.map(t => '<li>' + rich(t) + '</li>').join('') + '</ul>' : '') + '</div></div>';
      if (c.formula) body += '<p class="mini-title">規範公式</p><div class="equation">' + rich(c.formula) + '</div>';
      if (c.steps.length) body += '<p class="mini-title">計算步驟</p>' + stepTable(c.steps);
      if (c.state === 'calc') {
        const capSym = r.asd ? (r.family === 'tw' ? 'R_a' : 'R_n/Ω') : 'φR_n';
        body += '<div class="verdict ' + sc + '">P = ' + num(v.P) + ' tf ' + (c.ratio <= 1 ? '≤' : '>') + ' ' + rich(capSym) + ' = ' + num(c.cap) + ' tf　D/C = ' + num(c.ratio, 3) + '　→ <b>' + c.status + '</b></div>';
      } else {
        body += '<div class="verdict na"><b>' + c.status + '</b>：' + esc(c.reason) + '</div>';
      }
      body += c.notes.map(t => '<p class="note">註：' + rich(t) + '</p>').join('');
      return '<details class="calc-detail" id="chk-' + c.id + '" open><summary><span class="step">0' + (i + 1) + '</span>' + c.name + '<span class="en">' + c.en + '</span><span class="badge ' + sc + '">' + c.status + '</span></summary><div class="detail-content">' + body + '</div></details>';
    }).join('');
    html += '<section class="panel notes"><h2>規範依據與適用範圍</h2><ol>' + X.notesList(r).map(t => '<li>' + rich(t) + '</li>').join('') + '</ol></section>';
    $('output').innerHTML = html;
    $('toggleAll').onclick = () => {
      const ds = [...document.querySelectorAll('.calc-detail')], open = ds.some(d => !d.open);
      ds.forEach(d => { d.open = open; }); $('toggleAll').textContent = open ? '全部收合' : '全部展開';
    };
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* 無法儲存時忽略 */ }
  }

  function stepTable(steps) {
    return '<div class="table-wrap"><table class="steps"><thead><tr><th>說明</th><th>計算式</th><th>結果</th></tr></thead><tbody>' + steps.map(s =>
      '<tr><td>' + esc(s.label) + '</td><td class="expr">' + rich(X.stepLine(s)) + '</td><td class="val">' + fm(s.value) + (s.unit ? ' <small>' + esc(s.unit) + '</small>' : '') + '</td></tr>').join('') + '</tbody></table></div>';
  }
  function unitTable(r) {
    const x = r.input, v = r.v;
    const rows = [['d', x.d, 'mm', v.d, 'cm'], ['b_f', x.bf, 'mm', v.bf, 'cm'], ['t_w', x.tw, 'mm', v.tw, 'cm'], ['t_f', x.tf, 'mm', v.tf, 'cm'], ['r', x.r, 'mm', v.r, 'cm'], ['N', x.N, 'mm', v.N, 'cm'], ['a', x.a, 'mm', v.a, 'cm'], ['L_b', x.Lb, 'mm', v.Lb, 'cm'],
      ['F_{yw}', x.Fy, 'kgf/cm²', v.Fy, 'tf/cm²'], ['E', x.E, 'kgf/cm²', v.E, 'tf/cm²'], ['P', x.P, 'tf', v.P, 'tf'], ['M', x.M, 'tf·m', v.M, 'tf·cm'], ['S_x', v.Sx, 'cm³', v.Sx, 'cm³']];
    return '<p class="mini-title">單位換算（計算採 tf、cm）</p><div class="unit-chips">' + rows.map(([s, a, u1, b, u2]) => '<span><i>' + rich(s) + '</i> ' + fm(a) + ' ' + u1 + ' → <b>' + fm(b) + '</b> ' + u2 + '</span>').join('') + '</div>';
  }

  /* ---------- 互動 ---------- */
  function toast(s) { const t = $('toast'); t.textContent = s; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800); }
  $('inputs').addEventListener('submit', e => e.preventDefault());
  $('inputs').addEventListener('input', e => {
    if (['d', 'bf', 'tw', 'tf', 'r'].includes(e.target.id)) $('preset').value = 'custom';
    if (!e.target.dataset.coef) render();
  });
  $('code').addEventListener('change', () => { buildCoefFields(); render(); });
  $('preset').addEventListener('change', () => {
    const p = C.PRESETS.find(q => q.name === $('preset').value);
    if (p) { for (const k of ['d', 'bf', 'tw', 'tf', 'r']) $(k).value = p[k]; $('shape').value = 'rolled'; }
    render();
  });
  for (const id of ['shape', 'load', 'relative', 'rotation', 'sxMode']) $(id).addEventListener('change', render);

  function download(bytes, name, type) {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  const fileBase = () => '型鋼腹板檢核_' + (state.member || '計算書').replace(/[\\/:*?"<>|\s]+/g, '_');

  $('btnExcel').onclick = () => {
    try { download(X.buildExcel(result), fileBase() + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('已匯出 Excel 計算書'); }
    catch (e) { toast('匯出失敗：' + e.message); }
  };

  /* SVG → PNG（供 Word 嵌入） */
  function svgToPng(svgText, scale = 2) {
    return new Promise((resolve, reject) => {
      const m = svgText.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
      const w = Number(m[1]), h = Number(m[2]);
      const img = new Image();
      const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
      img.onload = () => {
        const cv = document.createElement('canvas'); cv.width = w * scale; cv.height = h * scale;
        const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(async b => { if (!b) return reject(new Error('圖片轉換失敗')); resolve({ png: new Uint8Array(await b.arrayBuffer()), w, h }); }, 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('圖片載入失敗')); };
      img.src = url;
    });
  }
  $('btnWord').onclick = async () => {
    const btn = $('btnWord'); btn.disabled = true; const label = btn.textContent; btn.textContent = '產生中…';
    try {
      const images = {};
      try {
        images.section = await svgToPng(Dg.section(state));
        images.elevation = await svgToPng(Dg.elevation(state, result));
        for (const id of ['Y', 'C', 'S', 'B']) images['mode' + id] = await svgToPng(Dg.mode(id));
      } catch (e) { toast('示意圖轉換失敗，報告將不含圖片'); }
      download(X.buildWord(result, images), fileBase() + '_計算書.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      toast('已產生 Word 計算書');
    } catch (e) { toast('產生失敗：' + e.message); }
    finally { btn.disabled = false; btn.textContent = label; }
  };

  let printOpen = [];
  window.addEventListener('beforeprint', () => { printOpen = [...document.querySelectorAll('details')].map(d => d.open); document.querySelectorAll('details').forEach(d => { d.open = true; }); });
  window.addEventListener('afterprint', () => document.querySelectorAll('details').forEach((d, i) => { d.open = printOpen[i] ?? d.open; }));
  $('btnPrint').onclick = () => window.print();

  $('btnSave').onclick = () => download(JSON.stringify({ app: 'web-check', version: 2, inputs: state }, null, 2), fileBase() + '_輸入.json', 'application/json');
  $('btnLoad').onclick = () => $('file').click();
  $('file').onchange = async () => {
    try {
      const obj = JSON.parse(await $('file').files[0].text());
      if (obj.version !== 2 || !obj.inputs || typeof obj.inputs !== 'object') throw new Error('檔案格式不符（需為本工具 v2 匯出之 JSON）');
      const x = obj.inputs;
      if (!C.CODES[x.code]) throw new Error('未知的設計規範');
      for (const [k, ok] of [['shape', ['rolled', 'welded']], ['load', ['single', 'double']], ['relative', ['free', 'braced']], ['rotation', ['yes', 'no']], ['sxMode', ['auto', 'manual']]])
        if (!ok.includes(x[k])) throw new Error('條件欄位 ' + k + ' 不正確');
      for (const k of NUM_KEYS) if (k !== 'Sx' && !Number.isFinite(x[k])) throw new Error('數值欄位 ' + k + ' 不正確');
      apply(Object.assign({}, C.DEFAULTS, x));
      toast('已載入輸入資料');
    } catch (e) { toast('無法載入：' + e.message); }
    finally { $('file').value = ''; }
  };
  $('btnReset').onclick = () => { apply(Object.assign({}, C.DEFAULTS, { date: today() })); toast('已載入範例'); };

  function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  let initial = Object.assign({}, C.DEFAULTS, { date: today() });
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (saved && C.CODES[saved.code]) initial = Object.assign({}, initial, saved);
  } catch (e) { /* 使用預設 */ }
  apply(initial);
})();
