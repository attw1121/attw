/* 示意圖（純 SVG 字串，可直接嵌入網頁，也可轉 PNG 放入 Word 報告） */
(function (g) {
  'use strict';
  const COL = { steel: '#d9e2dc', edge: '#29453f', dim: '#2f6f9f', load: '#c0392b', zone: '#f0b44c', zoneFill: 'rgba(240,180,76,.35)', text: '#1d2f2b', muted: '#6b7d78', bg: '#ffffff', warn: '#b45309' };
  const FONT = "'Microsoft JhengHei','Noto Sans TC','PingFang TC','Heiti TC',sans-serif";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fm = (x, d = 1) => { let s = Number(x).toFixed(d); return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1'); };

  /* 文字標記 → tspan（t_w、b_f、F_{yw}） */
  function rich(s) {
    let out = '', i = 0;
    while (i < s.length) {
      const ch = s[i];
      if ((ch === '_' || ch === '^') && i + 1 < s.length) {
        let body;
        if (s[i + 1] === '{') { const j = s.indexOf('}', i); body = s.slice(i + 2, j); i = j + 1; } else { body = s[i + 1]; i += 2; }
        out += '<tspan baseline-shift="' + (ch === '_' ? 'sub' : 'super') + '" font-size="75%">' + esc(body) + '</tspan>';
      } else { out += esc(ch); i++; }
    }
    return out;
  }
  function text(x, y, s, o = {}) {
    return '<text x="' + x + '" y="' + y + '" font-family="' + FONT + '" font-size="' + (o.size || 13) + '" fill="' + (o.color || COL.text) + '" text-anchor="' + (o.anchor || 'middle') + '"' + (o.weight ? ' font-weight="' + o.weight + '"' : '') + (o.rotate ? ' transform="rotate(' + o.rotate + ' ' + x + ' ' + y + ')"' : '') + '>' + rich(s) + '</text>';
  }
  const line = (x1, y1, x2, y2, c = COL.edge, w = 1, extra = '') => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + c + '" stroke-width="' + w + '" ' + extra + '/>';
  const defs = '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9 z" fill="' + COL.dim + '"/></marker>' +
    '<marker id="arL" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="' + COL.load + '"/></marker>' +
    '<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="' + COL.zone + '" stroke-width="2"/></pattern></defs>';
  /* 尺寸線（含延伸線與兩端箭頭） */
  function dimH(x1, x2, y, label, o = {}) {
    return line(x1, y, x2, y, COL.dim, 1, 'marker-start="url(#ar)" marker-end="url(#ar)"') + text((x1 + x2) / 2 + (o.dx || 0), y - 6, label, { color: COL.dim, size: o.size || 12.5, anchor: o.anchor });
  }
  function dimV(x, y1, y2, label, o = {}) {
    const lx = o.side === 'left' ? x - 8 : x + 8;
    return line(x, y1, x, y2, COL.dim, 1, 'marker-start="url(#ar)" marker-end="url(#ar)"') + text(lx, (y1 + y2) / 2 + 4, label, { color: COL.dim, size: o.size || 12.5, anchor: o.side === 'left' ? 'end' : 'start' });
  }
  const ext = (x1, y1, x2, y2) => line(x1, y1, x2, y2, COL.muted, 0.7, 'stroke-dasharray="3 3"');
  const svg = (w, h, body, title) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(title) + '"><rect width="100%" height="100%" fill="' + COL.bg + '"/>' + defs + body + '</svg>';

  /* ---------- 斷面圖 ---------- */
  function section(x) {
    const W = 480, H = 400;
    const s = Math.min(290 / x.d, 220 / x.bf);
    const D = x.d * s, B = x.bf * s;
    const T = Math.max(x.tw * s, 4), F = Math.max(x.tf * s, 5), R = Math.max(x.r * s, x.r > 0 ? 3 : 0);
    const cx = 190, top = 62, bot = top + D, L = cx - B / 2, Rr = cx + B / 2, wl = cx - T / 2, wr = cx + T / 2;
    const rolled = x.shape !== 'welded';
    let p;
    if (rolled) {
      // 含圓角之 H 型外框（順時針）
      p = ['M', L, top, 'H', Rr, 'V', top + F, 'H', wr + R, 'A', R, R, 0, 0, 0, wr, top + F + R, 'V', bot - F - R, 'A', R, R, 0, 0, 0, wr + R, bot - F, 'H', Rr, 'V', bot, 'H', L, 'V', bot - F, 'H', wl - R, 'A', R, R, 0, 0, 0, wl, bot - F - R, 'V', top + F + R, 'A', R, R, 0, 0, 0, wl - R, top + F, 'H', L, 'Z'].join(' ');
    } else {
      p = ['M', L, top, 'H', Rr, 'V', top + F, 'H', wr, 'V', bot - F, 'H', Rr, 'V', bot, 'H', L, 'V', bot - F, 'H', wl, 'V', top + F, 'H', L, 'Z'].join(' ');
    }
    let b = '<path d="' + p + '" fill="' + COL.steel + '" stroke="' + COL.edge + '" stroke-width="1.4"/>';
    if (!rolled && R > 0) {
      const tri = (x0, y0, dx, dy) => '<path d="M' + x0 + ' ' + y0 + ' l' + dx + ' 0 L' + x0 + ' ' + (y0 + dy) + ' z" fill="#9fb3aa" stroke="' + COL.edge + '" stroke-width=".8"/>';
      b += tri(wr, top + F, R, R) + tri(wl, top + F, -R, R) + tri(wr, bot - F, R, -R) + tri(wl, bot - F, -R, -R);
    }
    const kpx = (x.tf + x.r) * s, kTop = top + Math.max(kpx, F + R), kBot = bot - Math.max(kpx, F + R);
    const hTop = rolled ? kTop : top + F, hBot = rolled ? kBot : bot - F;
    // k 線
    b += line(wl - 34, kTop, wr + 150, kTop, COL.warn, 0.8, 'stroke-dasharray="5 3"') + line(wl - 34, kBot, wr + 150, kBot, COL.warn, 0.8, 'stroke-dasharray="5 3"');
    b += text(wl - 38, kTop + 4, 'k 線', { color: COL.warn, size: 11, anchor: 'end' });
    // 尺寸：bf（上）
    b += ext(L, top - 4, L, top - 30) + ext(Rr, top - 4, Rr, top - 30) + dimH(L, Rr, top - 22, 'b_f = ' + fm(x.bf) + ' mm');
    // d（左）
    b += ext(L - 4, top, L - 40, top) + ext(L - 4, bot, L - 40, bot) + dimV(L - 32, top, bot, 'd = ' + fm(x.d), { side: 'left' });
    // tf / k / h（右）
    const xr1 = Rr + 18, xr2 = Rr + 62, xr3 = Rr + 140;
    b += ext(Rr + 4, top, xr3 + 6, top) + ext(Rr + 4, top + F, xr1 + 6, top + F);
    b += line(xr1, top - 14, xr1, top, COL.dim, 1, 'marker-end="url(#ar)"') + line(xr1, top + F + 14, xr1, top + F, COL.dim, 1, 'marker-end="url(#ar)"') + text(xr1 - 4, top - 18, 't_f = ' + fm(x.tf), { color: COL.dim, size: 12, anchor: 'start' });
    b += dimV(xr2, top, kTop, '');
    b += text(xr2 + 6, (top + kTop) / 2 + 4, 'k = ' + fm(x.tf + x.r), { color: COL.dim, size: 12, anchor: 'start' });
    b += ext(wr + 4, hTop, xr3 + 6, hTop) + ext(wr + 4, hBot, xr3 + 6, hBot);
    b += dimV(xr3, hTop, hBot, 'h = ' + fm(rolled ? x.d - 2 * (x.tf + x.r) : x.d - 2 * x.tf));
    // tw（腹板中段）
    const ym = (top + bot) / 2 + 40;
    b += line(wl - 34, ym, wl, ym, COL.dim, 1, 'marker-end="url(#ar)"') + line(wr + 34, ym, wr, ym, COL.dim, 1, 'marker-end="url(#ar)"');
    b += text(wl - 38, ym + 4, 't_w = ' + fm(x.tw), { color: COL.dim, size: 12, anchor: 'end' });
    // r 標示
    if (R > 0) b += text(wr + R + 10, top + F + R + 14, (rolled ? 'r = ' : '銲道 s = ') + fm(x.r), { color: COL.muted, size: 11, anchor: 'start' });
    b += text(cx, H - 14, (rolled ? '熱軋 H 型鋼' : '銲接組合 H 型鋼') + '斷面（單位 mm，依比例繪製）', { color: COL.muted, size: 12 });
    return svg(W, H, b, '斷面尺寸示意');
  }

  /* ---------- 立面受力圖 ---------- */
  function elevation(x, res) {
    const W = 760, H = 380;
    const dbl = x.load === 'double';
    const top = 120, D = 150, bot = top + D;           // 梁深固定繪製高度
    const sc = D / x.d;                                 // mm → px（垂直、水平同比例）
    const F = Math.max(x.tf * sc, 6), k = Math.max((x.tf + x.r) * sc, F + 4);
    const x0 = 60;                                      // 構材端
    // 載重點水平位置：依比例，但限制於可視範圍內
    let aPx = x.a * sc, broken = false;
    const maxA = 430;
    if (aPx > maxA) { aPx = maxA; broken = true; }
    const xp = x0 + aPx;
    const Npx = Math.max(x.N * sc, 8);
    const xEnd = W - 30;
    let b = '';
    // 梁（翼板＋腹板）
    b += '<rect x="' + x0 + '" y="' + top + '" width="' + (xEnd - x0) + '" height="' + D + '" fill="#eef3ef" stroke="none"/>';
    b += '<rect x="' + x0 + '" y="' + top + '" width="' + (xEnd - x0) + '" height="' + F + '" fill="' + COL.steel + '" stroke="' + COL.edge + '"/>';
    b += '<rect x="' + x0 + '" y="' + (bot - F) + '" width="' + (xEnd - x0) + '" height="' + F + '" fill="' + COL.steel + '" stroke="' + COL.edge + '"/>';
    b += line(x0, top, x0, bot, COL.edge, 1.6) + line(xEnd, top, xEnd, bot, COL.muted, 1, 'stroke-dasharray="4 4"');
    b += text(x0 - 6, top - 6, '構材端', { size: 11.5, color: COL.muted, anchor: 'start' });
    // k 線
    b += line(x0, top + k, xEnd, top + k, COL.warn, 0.8, 'stroke-dasharray="5 3"') + line(x0, bot - k, xEnd, bot - k, COL.warn, 0.8, 'stroke-dasharray="5 3"');
    b += text(xEnd - 4, top + k + 13, 'k 線', { color: COL.warn, size: 11, anchor: 'end' });
    if (broken) {
      const xb = x0 + maxA * 0.55;
      b += '<path d="M' + (xb - 6) + ' ' + (top - 8) + ' l12 -10 M' + (xb + 2) + ' ' + (top - 8) + ' l12 -10" stroke="' + COL.muted + '" stroke-width="1.2"/>';
      b += '<path d="M' + (xb - 6) + ' ' + (bot + 18) + ' l12 -10 M' + (xb + 2) + ' ' + (bot + 18) + ' l12 -10" stroke="' + COL.muted + '" stroke-width="1.2"/>';
      b += text(xb + 4, top - 22, '（距離截斷）', { size: 10.5, color: COL.muted });
    }
    // 擴散區（局部降伏）
    const interior = x.a > x.d;
    const zoneTop = (() => {
      const L1 = xp - Npx / 2, R1 = xp + Npx / 2, sp2 = 2.5 * k;
      const left = interior ? L1 - sp2 : Math.max(x0, L1 - sp2), right = R1 + sp2;
      return { left, right, path: '<path d="M' + L1 + ' ' + top + ' L' + R1 + ' ' + top + ' L' + right + ' ' + (top + k) + ' L' + left + ' ' + (top + k) + ' Z" fill="' + COL.zoneFill + '" stroke="' + COL.zone + '" stroke-width="1"/>' };
    })();
    b += zoneTop.path;
    // 承壓板與載重
    const plate = (y, up) => '<rect x="' + (xp - Npx / 2) + '" y="' + (up ? y : y - 7) + '" width="' + Npx + '" height="7" fill="#7d8f88" stroke="' + COL.edge + '"/>';
    b += plate(top - 7, true);
    b += line(xp, top - 70, xp, top - 10, COL.load, 3, 'marker-end="url(#arL)"') + text(xp + 10, top - 52, 'P = ' + fm(x.P, 2) + ' tf', { color: COL.load, size: 14, weight: 700, anchor: 'start' });
    b += ext(xp - Npx / 2, top - 12, xp - Npx / 2, top - 34) + ext(xp + Npx / 2, top - 12, xp + Npx / 2, top - 34);
    b += dimH(xp - Npx / 2, xp + Npx / 2, top - 24, 'N = ' + fm(x.N), { size: 11.5, dx: -Npx / 2 - 30 });
    // k 線處有效長度
    b += dimH(zoneTop.left, zoneTop.right, top + k + 26, (interior ? '5k + N' : '2.5k + N') + ' = ' + fm((interior ? 5 : 2.5) * (x.tf + x.r) + x.N), { size: 11.5 });
    if (dbl) {
      const L1 = xp - Npx / 2, R1 = xp + Npx / 2, sp2 = 2.5 * k;
      const left = interior ? L1 - sp2 : Math.max(x0, L1 - sp2), right = R1 + sp2;
      b += '<path d="M' + L1 + ' ' + bot + ' L' + R1 + ' ' + bot + ' L' + right + ' ' + (bot - k) + ' L' + left + ' ' + (bot - k) + ' Z" fill="' + COL.zoneFill + '" stroke="' + COL.zone + '" stroke-width="1"/>';
      b += '<rect x="' + (xp - Npx / 2) + '" y="' + bot + '" width="' + Npx + '" height="7" fill="#7d8f88" stroke="' + COL.edge + '"/>';
      b += line(xp, bot + 72, xp, bot + 10, COL.load, 3, 'marker-end="url(#arL)"') + text(xp + 10, bot + 60, 'P = ' + fm(x.P, 2) + ' tf', { color: COL.load, size: 14, weight: 700, anchor: 'start' });
    } else {
      // 支承反力示意
      b += '<path d="M' + (x0 + 14) + ' ' + (bot + 2) + ' l-12 20 h24 z" fill="none" stroke="' + COL.edge + '" stroke-width="1.2"/>';
    }
    // 載重點中心線
    b += line(xp, top - 4, xp, bot + 4, COL.load, 0.8, 'stroke-dasharray="6 3 1 3"');
    // a、d、d/2 標示（梁下方）
    const yA = bot + (dbl ? 96 : 40);
    b += ext(x0, bot + 4, x0, yA + 8) + ext(xp, bot + 4, xp, yA + 8);
    b += dimH(x0, xp, yA, 'a = ' + fm(x.a) + ' mm');
    const dPx = x.d * sc, yD = yA + 34;
    if (dPx < 700) {
      b += line(x0, yD, x0 + dPx, yD, COL.muted, 1, 'marker-end="url(#ar)"') + text(x0 + dPx + 4, yD + 4, 'd', { color: COL.muted, size: 11.5, anchor: 'start' });
      b += line(x0 + dPx / 2, yD - 6, x0 + dPx / 2, yD + 6, COL.muted, 1) + text(x0 + dPx / 2, yD + 18, 'd/2', { color: COL.muted, size: 11 });
    }
    // 梁深
    b += ext(xEnd, top, xEnd + 4, top);
    b += dimV(x0 - 22, top, bot, 'd', { side: 'left' });
    // Lb
    if (!dbl) b += text(W - 30, 22, 'L_b = ' + fm(x.Lb) + ' mm（載重點處最大無側撐長度）', { size: 11.5, color: COL.muted, anchor: 'end' });
    b += text(W / 2, H - 10, dbl ? '立面：同斷面上下翼板相向集中壓力（承壓長度與 k 依比例，距離可能截斷）' : '立面：單側翼板集中壓力（承壓長度與 k 依比例，距離可能截斷）', { size: 11.5, color: COL.muted });
    return svg(W, H, b, '立面受力示意');
  }

  /* ---------- 四種極限狀態示意（小圖） ---------- */
  function mode(id) {
    const W = 220, H = 150;
    let b = '';
    const beam = (yt, yb, xl = 20, xr = 200) => '<rect x="' + xl + '" y="' + yt + '" width="' + (xr - xl) + '" height="8" fill="' + COL.steel + '" stroke="' + COL.edge + '"/><rect x="' + xl + '" y="' + (yb - 8) + '" width="' + (xr - xl) + '" height="8" fill="' + COL.steel + '" stroke="' + COL.edge + '"/>';
    const arrowDown = (x, y1, y2) => line(x, y1, x, y2, COL.load, 2.5, 'marker-end="url(#arL)"');
    if (id === 'Y') {
      b += beam(40, 120) + arrowDown(110, 6, 34);
      b += '<path d="M95 48 L125 48 L148 64 L72 64 Z" fill="url(#hatch)" stroke="' + COL.zone + '"/>';
      b += line(20, 64, 200, 64, COL.warn, .8, 'stroke-dasharray="4 3"');
      b += text(110, 142, '腹板 k 線處局部降伏', { size: 12 });
    } else if (id === 'C') {
      b += beam(40, 120) + arrowDown(110, 6, 34);
      b += '<path d="M110 48 C 100 58, 122 64, 108 74 C 98 82, 118 90, 110 112" fill="none" stroke="' + COL.load + '" stroke-width="2"/>';
      b += line(110, 48, 110, 112, COL.edge, 1, 'stroke-dasharray="3 3"');
      b += text(110, 142, '翼板下腹板局部壓皺', { size: 12 });
    } else if (id === 'S') {
      // 斷面視：上翼板受壓、下翼板側移
      b += '<rect x="70" y="30" width="80" height="8" fill="' + COL.steel + '" stroke="' + COL.edge + '"/>';
      b += '<path d="M110 38 C 112 70, 140 90, 150 112" fill="none" stroke="' + COL.edge + '" stroke-width="3"/>';
      b += '<rect x="110" y="112" width="80" height="8" fill="' + COL.steel + '" stroke="' + COL.edge + '"/>';
      b += '<rect x="70" y="112" width="80" height="8" fill="none" stroke="' + COL.muted + '" stroke-dasharray="3 3"/>' + line(110, 38, 110, 112, COL.muted, 1, 'stroke-dasharray="3 3"');
      b += arrowDown(110, 2, 28) + line(152, 128, 182, 128, COL.dim, 1.5, 'marker-end="url(#ar)"');
      b += text(110, 146, '受拉翼板相對側移', { size: 12 });
    } else {
      b += beam(40, 112) + arrowDown(110, 6, 34) + line(110, 146, 110, 118, COL.load, 2.5, 'marker-end="url(#arL)"');
      b += '<path d="M110 48 Q 140 76 110 104" fill="none" stroke="' + COL.load + '" stroke-width="2"/>' + line(110, 48, 110, 104, COL.edge, 1, 'stroke-dasharray="3 3"');
      b += text(170, 80, '腹板', { size: 11, color: COL.muted }) + text(170, 94, '整體挫屈', { size: 11, color: COL.muted });
    }
    return svg(W, H, b, '極限狀態示意');
  }

  g.SteelDiagram = { section, elevation, mode };
})(typeof window === 'undefined' ? globalThis : window);
