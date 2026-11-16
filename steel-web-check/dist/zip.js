/* 最小 ZIP 寫入器（STORE 不壓縮），供 xlsx／docx 封裝使用 */
(function (g) {
  'use strict';
  const enc = new TextEncoder();
  const TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(data) {
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) c = TABLE[(c ^ data[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  /* files: { 'path': string | Uint8Array } → Uint8Array */
  function zip(files) {
    const parts = [], central = [];
    let offset = 0;
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const [name, content] of Object.entries(files)) {
      const nb = enc.encode(name);
      const data = typeof content === 'string' ? enc.encode(content) : content;
      const crc = crc32(data);
      const lh = new Uint8Array(30), lv = new DataView(lh.buffer);
      lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true);
      lv.setUint16(10, dosTime, true); lv.setUint16(12, dosDate, true);
      lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true);
      lv.setUint16(26, nb.length, true); lv.setUint16(28, 0, true);
      parts.push(lh, nb, data);
      const ch = new Uint8Array(46), cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true); cv.setUint16(12, dosTime, true); cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
      cv.setUint16(28, nb.length, true); cv.setUint32(42, offset, true);
      central.push(ch, nb);
      offset += 30 + nb.length + data.length;
    }
    const cdSize = central.reduce((s, a) => s + a.length, 0);
    const end = new Uint8Array(22), ev = new DataView(end.buffer);
    const count = Object.keys(files).length;
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, count, true); ev.setUint16(10, count, true);
    ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
    const all = [...parts, ...central, end];
    const out = new Uint8Array(all.reduce((s, a) => s + a.length, 0));
    let p = 0; for (const a of all) { out.set(a, p); p += a.length; }
    return out;
  }
  const xmlEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  /* 公式標記轉純文字（Excel 用）：t_w → tw、^2 → ²、^{1.5} → ^1.5 */
  function plain(s) {
    const sup = { '2': '²', '3': '³' };
    return String(s ?? '').replace(/\^\{([^}]*)\}|\^(.)/g, (m, a, b) => { const t = a ?? b; return sup[t] || '^' + t; })
      .replace(/_\{([^}]*)\}|_(.)/g, (m, a, b) => a ?? b);
  }
  g.MiniZip = { zip, crc32, xmlEsc, plain };
})(typeof window === 'undefined' ? globalThis : window);
