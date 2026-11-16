/* 匯出：Excel 計算書（含可重算公式）與 Word 報告 */
(function (g) {
  'use strict';
  const { plain } = g.MiniZip;
  const { ST, colName } = g.SimpleXLSX;
  const C = g.SteelCalc;
  const fm = C.fm;

  const LOAD_TXT = { single: '單側翼板集中壓力', double: '同斷面上下翼板相向集中壓力（各為 P）' };
  const SHAPE_TXT = { rolled: '熱軋 H 型鋼（h = d − 2k）', welded: '銲接組合 H 型鋼（h = d − 2tf）' };
  const REL_TXT = { free: '未拘束', braced: '已拘束（側向支撐）' };
  const ROT_TXT = { yes: '有轉動拘束', no: '無轉動拘束' };

  function stepLine(s) {
    const parts = [s.sym];
    if (s.expr) parts.push(s.expr);
    if (s.sub) parts.push(s.sub);
    return parts.join(' = ');
  }
  function overallText(res) {
    if (!res.governing) return '無適用之檢核項目';
    return res.pass ? '全部適用項目通過' : '有檢核項目不通過';
  }
  function dateText(x) { return x.date || new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' }); }

  /* ================= Excel ================= */
  function excelSheets(res) {
    const x = res.input, v = res.v;
    const IN = '輸入資料', CA = '計算過程';
    const ref = (sheet, col, row) => "'" + sheet + "'!" + col + row;

    // ---------- 輸入資料 ----------
    const inRows = [], vars = {}, coefCells = {};
    inRows.push([{ v: '型鋼腹板集中載重檢核 — 輸入資料', s: ST.title }]);
    inRows.push([{ v: '黃色儲存格可修改，修改後「計算過程」與「檢核摘要」會自動重算數值；條件文字說明為匯出時快照。', s: ST.note }]);
    const info = [['專案名稱', x.project], ['構材編號', x.member], ['設計規範', res.code.name], ['設計者', x.designer], ['日期', dateText(x)]];
    info.forEach(([a, b]) => inRows.push([{ v: a, s: ST.bold }, { v: b || '', s: ST.text }]));
    inRows.push([]);
    inRows.push(['項目', '符號', '輸入值', '輸入單位', '計算值', '計算單位'].map(t => ({ v: t, s: ST.header })));
    const addVar = (key, label, sym, val, unit, conv, cunit, cval, input = true) => {
      const r = inRows.length + 1;
      const f = conv.replace(/#/g, 'C' + r);
      inRows.push([{ v: label, s: ST.text }, { v: plain(sym), s: ST.text }, { v: val, s: input ? ST.input : ST.num3 }, { v: unit, s: ST.text }, { v: cval, f, s: ST.num3 }, { v: cunit, s: ST.text }]);
      vars[key] = ref(IN, 'E', r);
      return r;
    };
    const rows = {};
    rows.d = addVar('d', '型鋼全深', 'd', x.d, 'mm', '#/10', 'cm', v.d);
    rows.bf = addVar('bf', '翼板寬度', 'b_f', x.bf, 'mm', '#/10', 'cm', v.bf);
    rows.tw = addVar('tw', '腹板厚度', 't_w', x.tw, 'mm', '#/10', 'cm', v.tw);
    rows.tf = addVar('tf', '翼板厚度', 't_f', x.tf, 'mm', '#/10', 'cm', v.tf);
    rows.r = addVar('r', x.shape === 'rolled' ? '圓角半徑' : '銲道腳長', 'r', x.r, 'mm', '#/10', 'cm', v.r);
    addVar('Fy', '腹板降伏應力', 'F_{yw}', x.Fy, 'kgf/cm²', '#/1000', 'tf/cm²', v.Fy);
    addVar('E', '彈性模數', 'E', x.E, 'kgf/cm²', '#/1000', 'tf/cm²', v.E);
    addVar('P', '集中壓力需求（' + res.reqLabel + '）', 'P', x.P, 'tf', '#', 'tf', v.P);
    addVar('N', '承壓長度', 'N', x.N, 'mm', '#/10', 'cm', v.N);
    addVar('a', '載重點至構材端距離', 'a', x.a, 'mm', '#/10', 'cm', v.a);
    addVar('Lb', '載重點處最大無側撐長度', 'L_b', x.Lb, 'mm', '#/10', 'cm', v.Lb);
    addVar('M', '載重點處需求彎矩 |M|', 'M', x.M, 'tf·m', '#*100', 'tf·cm', v.M);
    // Ix 與 Sx
    {
      const D = vars.d, B = vars.bf, T = vars.tw, F = vars.tf, Rr = vars.r;
      const fillet = x.shape === 'rolled' ? '+4*(1-PI()/4)*' + Rr + '^2*(' + D + '/2-' + F + '-' + Rr + '*(10-3*PI())/(12-3*PI()))^2' : '';
      const rI = inRows.length + 1;
      inRows.push([{ v: '強軸慣性矩（由尺寸計算' + (x.shape === 'rolled' ? '，含圓角' : '') + '）', s: ST.text }, { v: 'Ix', s: ST.text }, { v: '', s: ST.text }, { v: '', s: ST.text },
        { v: res.sp.Ix, f: '(' + B + '*' + D + '^3-(' + B + '-' + T + ')*(' + D + '-2*' + F + ')^3)/12' + fillet, s: ST.num2 }, { v: 'cm⁴', s: ST.text }]);
      const rS = inRows.length + 1;
      const manual = x.sxMode === 'manual';
      inRows.push([{ v: '強軸彈性斷面模數' + (manual ? '（使用者輸入）' : '（= Ix /(d/2)）'), s: ST.text }, { v: 'Sx', s: ST.text }, manual ? { v: x.Sx, s: ST.input } : { v: '', s: ST.text }, { v: manual ? 'cm³' : '', s: ST.text },
        { v: v.Sx, f: manual ? 'C' + rS : 'E' + rI + '/(' + D + '/2)', s: ST.num2 }, { v: 'cm³', s: ST.text }]);
      vars.Sx = ref(IN, 'E', rS);
    }
    addVar('rot', '受壓翼板轉動拘束（1 = 有，0 = 無）', 'ρ', v.rot, '', '#', '', v.rot);
    inRows.push([{ v: '斷面型式', s: ST.text }, '', { v: SHAPE_TXT[x.shape], s: ST.text }]);
    inRows.push([{ v: '受壓模式', s: ST.text }, '', { v: LOAD_TXT[x.load], s: ST.text }]);
    inRows.push([{ v: '兩翼板相對側移', s: ST.text }, '', { v: REL_TXT[x.relative], s: ST.text }]);
    inRows.push([]);
    inRows.push(['規範係數', '符號', '數值', '條文', '備註', ''].map(t => ({ v: t, s: ST.header })));
    for (const c of C.COEFS[res.codeKey]) {
      const r = inRows.length + 1;
      inRows.push([{ v: c.label, s: ST.text }, { v: plain(c.sym), s: ST.text }, { v: res.K[c.key], s: ST.input }, { v: c.ref, s: ST.text }, { v: c.verify ? '由 AISC 公式換算為 tf-cm，請以規範原文確認' : '', s: ST.text }, '']);
      coefCells[c.key] = ref(IN, 'C', r);
    }

    // ---------- 計算過程 ----------
    const caRows = [], stepCell = {}, caMerges = [], caHeights = {};
    caRows.push([{ v: '型鋼腹板集中載重檢核 — 詳細計算過程（' + res.code.short + '）', s: ST.title }]);
    caRows.push([{ v: '單位：長度 cm、力 tf、應力 tf/cm²、彎矩 tf·cm。「結果」欄為 Excel 公式，引用「輸入資料」工作表。', s: ST.note }]);
    caRows.push(['編號', '說明', '符號', '公式', '代入計算', '結果', '單位'].map(t => ({ v: t, s: ST.header })));
    const resolve = (xf) => xf.replace(/\{#(\w+)\}/g, (m, k) => { if (!stepCell[k]) throw new Error('未定義步驟 ' + k); return stepCell[k]; })
      .replace(/\{c:(\w+)\}/g, (m, k) => { if (!coefCells[k]) throw new Error('未定義係數 ' + k); return coefCells[k]; })
      .replace(/\{(\w+)\}/g, (m, k) => { if (!vars[k]) throw new Error('未定義變數 ' + k); return vars[k]; });
    const section = (title) => { const r = caRows.length; caRows.push([{ v: title, s: ST.section }, { v: '', s: ST.section }, { v: '', s: ST.section }, { v: '', s: ST.section }, { v: '', s: ST.section }, { v: '', s: ST.section }, { v: '', s: ST.section }]); caMerges.push('A' + (r + 1) + ':G' + (r + 1)); };
    const textRow = (label, t) => { const r = caRows.length; caRows.push([{ v: label, s: ST.bold }, { v: t, s: ST.text }, '', '', '', '', '']); caMerges.push('B' + (r + 1) + ':G' + (r + 1)); caHeights[r] = Math.max(22, 18 * Math.ceil(t.length / 70)); };
    const pushStep = (no, s) => {
      const r = caRows.length + 1;
      const cell = s.xf ? { v: s.value, f: resolve(s.xf), s: ST.num3 } : { v: s.value, s: ST.num3 };
      caRows.push([{ v: no, s: ST.text }, { v: s.label, s: ST.text }, { v: plain(s.sym), s: ST.text }, { v: plain(s.expr), s: ST.text }, { v: plain(s.sub), s: ST.text }, cell, { v: s.unit, s: ST.text }]);
      stepCell[s.key] = ref(CA, 'F', r);
      return r;
    };
    section('0. 前置計算');
    res.pre.forEach((s, i) => pushStep('0.' + (i + 1), s));
    const capRows = {};
    res.checks.forEach((c, ci) => {
      section((ci + 1) + '. ' + c.name + '（' + c.en + '）　' + c.ref + (c.eq ? ' ' + c.eq : ''));
      c.conds.forEach(t => textRow('適用條件', t));
      if (c.formula) textRow('規範公式', plain(c.formula));
      c.steps.forEach((s, i) => pushStep((ci + 1) + '.' + (i + 1), s));
      if (c.state === 'calc') {
        const dc = stepCell[c.id + '_DC'];
        const r = caRows.length + 1;
        caRows.push([{ v: '判定', s: ST.bold }, { v: 'D/C ≤ 1.0', s: ST.text }, '', '', '', { v: c.status, f: 'IF(' + dc + '<=1,"通過","不通過")', s: c.ratio <= 1 ? ST.pass : ST.fail }, '']);
        capRows[c.id] = r;
      } else {
        textRow('判定', c.status + '：' + c.reason);
      }
      c.notes.forEach(t => textRow('附註', plain(t)));
    });

    // ---------- 檢核摘要 ----------
    const suRows = [];
    suRows.push([{ v: '型鋼腹板集中載重檢核 — 檢核摘要', s: ST.title }]);
    suRows.push([{ v: x.project + '｜' + x.member + '｜' + res.code.name, s: ST.note }]);
    suRows.push([]);
    const capName = plain(res.capLabel);
    suRows.push(['檢核項目', '規範條文', '適用性', '標稱強度 (tf)', '係數', capName + ' (tf)', '需求 P (tf)', 'D/C', '判定'].map(t => ({ v: t, s: ST.header })));
    const first = suRows.length + 1;
    res.checks.forEach(c => {
      if (c.state === 'calc') {
        const rnStep = stepCell[c.id + '_Rn'], capStep = stepCell[c.id + '_cap'], dc = stepCell[c.id + '_DC'];
        const r = suRows.length + 1;
        suRows.push([{ v: c.name, s: ST.bold }, { v: c.ref, s: ST.text }, { v: '檢核', s: ST.text }, { v: c.Rn, f: rnStep, s: ST.num2 }, { v: c.factorDesc, s: ST.text }, { v: c.cap, f: capStep, s: ST.num2 }, { v: v.P, f: vars.P, s: ST.num2 }, { v: c.ratio, f: dc, s: ST.num3 },
          { v: c.status, f: 'IF(H' + r + '<=1,"通過","不通過")', s: c.ratio <= 1 ? ST.pass : ST.fail }]);
      } else {
        suRows.push([{ v: c.name, s: ST.bold }, { v: c.ref, s: ST.text }, { v: c.status, s: ST.neutral }, { v: '—', s: ST.neutral }, { v: '—', s: ST.neutral }, { v: '—', s: ST.neutral }, { v: v.P, f: vars.P, s: ST.num2 }, { v: '—', s: ST.neutral }, { v: c.status, s: ST.neutral }]);
      }
    });
    const last = suRows.length;
    suRows.push([]);
    const maxRow = suRows.length + 1;
    const gov = res.governing;
    suRows.push([{ v: '最大需求／容量比', s: ST.bold }, '', '', '', '', '', '', { v: gov ? gov.ratio : 0, f: 'MAX(H' + first + ':H' + last + ')', s: ST.big }, { v: overallText(res), f: 'IF(H' + maxRow + '<=1,"全部適用項目通過","有檢核項目不通過")', s: res.pass ? ST.pass : ST.fail }]);
    suRows.push([{ v: '控制項目', s: ST.bold }, { v: gov ? gov.name : '—', s: ST.text }]);
    suRows.push([]);
    suRows.push([{ v: '不適用／不需檢核的項目不列入 D/C 比較。不通過時可考慮設置承壓加勁板、腹板補強板，或增加承壓長度 N。', s: ST.note }]);

    // ---------- 規範說明 ----------
    const noRows = [[{ v: '規範依據與適用範圍', s: ST.title }], []];
    const notes = notesList(res);
    notes.forEach((t, i) => noRows.push([{ v: (i + 1) + '.', s: ST.text }, { v: t, s: ST.text }]));

    return [
      { name: '檢核摘要', cols: [18, 26, 11, 15, 16, 18, 13, 11, 12], rows: suRows, merges: ['A2:I2', 'A' + (maxRow + 3) + ':I' + (maxRow + 3)], tabSelected: true, landscape: true },
      { name: IN, cols: [40, 10, 16, 12, 14, 12], rows: inRows, merges: ['A2:F2'], freeze: 0 },
      { name: CA, cols: [8, 24, 16, 34, 46, 14, 10], rows: caRows, merges: ['A2:G2', ...caMerges], heights: caHeights, freeze: 3, landscape: true },
      { name: '規範說明', cols: [5, 110], rows: noRows, heights: Object.fromEntries(noRows.map((r, i) => [i, i > 1 ? 34 : 22])) }
    ];
  }

  function notesList(res) {
    const n = [];
    n.push('設計規範：' + res.code.name + '。');
    if (res.family === 'aisc') n.push('AISC 360-22 第 J10 節：J10.2 腹板局部降伏、J10.3 腹板壓皺、J10.4 腹板側向挫屈、J10.5 腹板受壓挫屈。AISC 公式為因次一致，本工具以 tf、cm 計算；Cr 由 MPa 換算為 tf/cm²。');
    else n.push('台灣規範第 11.2 節（構材受集中載重）：11.2.3 腹板局部降伏、11.2.4 腹板壓皺、11.2.5 腹板側向挫屈、11.2.6 腹板受壓挫屈。');
    if (res.verifyCoefs.length) n.push('標示「請以規範原文確認」之係數係由對應 AISC 公式換算為 tf-cm 單位之值，使用前請以所依據版本之規範條文核對；如有差異可於網頁「規範係數」區修改。');
    if (res.codeKey === 'tw-asd') n.push('容許應力法之腹板受壓挫屈係數預設採極限設計法係數 1100 除以 1.67（保守值），請依規範原文確認。');
    n.push('需求載重 P：' + (res.asd ? '請輸入使用載重（容許應力／ASD 載重組合）。' : '請輸入因數化載重（LRFD 載重組合）。') + '本工具不自動組合載重。');
    n.push('適用範圍：雙對稱 H／I 型鋼、無加勁板、集中力垂直作用於翼板且對稱於腹板。未包含加勁板、補強板及整體構材設計。');
    n.push('腹板側向挫屈僅適用於單側集中壓力、且載重點處受壓翼板與受拉翼板相對側向位移未受拘束者；細長參數超過上限（有轉動拘束 2.3、無轉動拘束 1.7）時不需檢核。');
    n.push('腹板受壓挫屈僅適用於同一斷面上下翼板同時承受一對相向集中壓力；載重距構材端小於 d/2 時強度折減 50%。');
    n.push('本計算結果僅供設計參考，須由結構專業技師覆核。');
    return n;
  }

  function buildExcel(res) {
    return g.SimpleXLSX.build(excelSheets(res), { title: '型鋼腹板集中載重檢核', creator: res.input.designer || '' });
  }

  /* ================= Word ================= */
  function buildWord(res, images = {}) {
    const D = g.MiniDocx, { P, R, rich, table } = D;
    const x = res.input, v = res.v;
    const W = D.CONTENT_W;
    const body = [];
    const imgs = [];
    let picId = 1;
    const addImage = (im, widthCm, caption) => {
      if (!im) return;
      imgs.push(im);
      const cx = Math.round(widthCm * 360000), cy = Math.round(cx * im.h / im.w);
      body.push(P(D.imageRun('rIdImg' + imgs.length, picId++, cx, cy, caption), { align: 'center', keepNext: true, after: 40 }));
      body.push(P(R(caption), { style: 'Caption' }));
    };
    const H1 = t => body.push(P(R(t), { style: 'Heading1' }));
    const H2 = t => body.push(P(R(t), { style: 'Heading2' }));
    const para = (t, o = {}) => body.push(P(rich(t, o.r || {}), o));
    const bullet = t => body.push(P(R('•　') + rich(t), { indent: 360, hanging: 240, after: 40 }));

    body.push(P(R('型鋼腹板集中載重檢核計算書', {}), { style: 'Title' }));
    body.push(P(R('Concentrated Forces on Wide-Flange Webs', { size: 11, color: '5F6F6A', i: true }), { align: 'center', after: 240 }));
    const ok = res.pass;
    const concl = overallText(res) + (res.governing ? '（控制項目：' + res.governing.name + '，D/C = ' + fm(res.governing.ratio, 3) + '）' : '');
    body.push(table([
      [{ t: '專案名稱', b: true, shade: 'E8EFEA' }, { t: x.project || '', span: 3 }],
      [{ t: '構材編號', b: true, shade: 'E8EFEA' }, x.member || '', { t: '斷面', b: true, shade: 'E8EFEA' }, x.preset && x.preset !== 'custom' ? x.preset : 'H' + fm(x.d) + '×' + fm(x.bf) + '×' + fm(x.tw) + '×' + fm(x.tf)],
      [{ t: '設計規範', b: true, shade: 'E8EFEA' }, { t: res.code.name, span: 3 }],
      [{ t: '設計者', b: true, shade: 'E8EFEA' }, x.designer || '', { t: '日期', b: true, shade: 'E8EFEA' }, dateText(x)],
      [{ t: '檢核結論', b: true, shade: 'E8EFEA' }, { t: concl, span: 3, b: true, color: ok ? '1E6B3A' : 'B42318', shade: ok ? 'E3F1E6' : 'FBE0DD' }]
    ], { widths: [1700, 3119, 1700, 3119], size: 10.5 }));

    // 一、設計依據
    H1('一、設計依據與假設');
    notesList(res).forEach(bullet);

    // 二、輸入資料
    H1('二、輸入資料');
    const meta = C.INPUT_META;
    const inRow = (k, val, unit, conv) => [meta[k][0], { t: meta[k][1], rich: true, align: 'center' }, { t: val, align: 'right' }, { t: unit, align: 'center' }, { t: conv, align: 'right' }];
    const inTable = [['項目', '符號', '輸入值', '單位', '計算用值'],
      inRow('d', fm(x.d), 'mm', fm(v.d) + ' cm'), inRow('bf', fm(x.bf), 'mm', fm(v.bf) + ' cm'), inRow('tw', fm(x.tw), 'mm', fm(v.tw) + ' cm'), inRow('tf', fm(x.tf), 'mm', fm(v.tf) + ' cm'),
      [x.shape === 'rolled' ? '圓角半徑' : '銲道腳長', { t: 'r', align: 'center' }, { t: fm(x.r), align: 'right' }, { t: 'mm', align: 'center' }, { t: fm(v.r) + ' cm', align: 'right' }],
      inRow('Fy', fm(x.Fy), 'kgf/cm²', fm(v.Fy) + ' tf/cm²'), inRow('E', fm(x.E), 'kgf/cm²', fm(v.E) + ' tf/cm²'),
      [meta.P[0] + '（' + res.reqLabel + '）', { t: 'P', align: 'center' }, { t: fm(x.P), align: 'right' }, { t: 'tf', align: 'center' }, { t: fm(v.P) + ' tf', align: 'right' }],
      inRow('N', fm(x.N), 'mm', fm(v.N) + ' cm'), inRow('a', fm(x.a), 'mm', fm(v.a) + ' cm'), inRow('Lb', fm(x.Lb), 'mm', fm(v.Lb) + ' cm'), inRow('M', fm(x.M), 'tf·m', fm(v.M) + ' tf·cm'),
      [x.sxMode === 'manual' ? '強軸彈性斷面模數（使用者輸入）' : '強軸彈性斷面模數（由尺寸計算）', { t: 'S_x', rich: true, align: 'center' }, { t: fm(v.Sx), align: 'right' }, { t: 'cm³', align: 'center' }, { t: fm(v.Sx) + ' cm³', align: 'right' }],
      ['斷面型式', { t: '—', align: 'center' }, { t: SHAPE_TXT[x.shape], span: 3 }],
      ['受壓模式', { t: '—', align: 'center' }, { t: LOAD_TXT[x.load], span: 3 }],
      ['兩翼板相對側移／受壓翼板轉動', { t: '—', align: 'center' }, { t: REL_TXT[x.relative] + '／' + ROT_TXT[x.rotation], span: 3 }]
    ];
    body.push(table(inTable, { header: true, widths: [3200, 1100, 1500, 1300, 2538] }));
    H2('規範係數');
    body.push(table([['係數', '符號', '採用值', '條文', '備註']].concat(C.COEFS[res.codeKey].map(c => [c.label, { t: c.sym, rich: true, align: 'center' }, { t: fm(res.K[c.key]), align: 'right' }, { t: c.ref, align: 'center' }, c.verify ? '換算值，請以規範原文確認' : ''])),
      { header: true, widths: [3600, 900, 1100, 1300, 2738], size: 9.5 }));

    // 三、示意圖
    H1('三、尺寸與受力示意');
    addImage(images.section, 10, '圖 1　斷面尺寸示意');
    addImage(images.elevation, 16, '圖 2　立面受力與應力擴散示意');

    // 四、摘要
    H1('四、檢核結果摘要');
    const capName = res.capLabel;
    const sum = [['檢核項目', '規範條文', { t: '容量 ' + capName + '（tf）', rich: true }, '需求 P（tf）', 'D/C', '判定']];
    res.checks.forEach(c => {
      const st = c.state === 'calc' ? (c.ratio <= 1 ? { shade: 'E3F1E6', color: '1E6B3A' } : { shade: 'FBE0DD', color: 'B42318' }) : { shade: 'EEEEEE', color: '5F6F6A' };
      sum.push([{ t: c.name, b: true }, c.ref, { t: c.state === 'calc' ? fm(c.cap, 2) : '—', align: 'right' }, { t: fm(v.P, 2), align: 'right' }, { t: c.state === 'calc' ? fm(c.ratio, 3) : '—', align: 'right' }, Object.assign({ t: c.status, b: true, align: 'center' }, st)]);
    });
    body.push(table(sum, { header: true, widths: [1900, 2500, 1700, 1300, 1000, 1238] }));
    para('結論：' + concl, { r: { b: true, color: ok ? '1E6B3A' : 'B42318' } });

    // 五、詳細計算
    H1('五、詳細計算過程');
    para('計算單位：長度 cm、力 tf、應力 tf/cm²、彎矩 tf·cm（輸入值已依上表換算）。', { r: { color: '5F6F6A', size: 10 } });
    H2('5.0　前置計算');
    body.push(stepTable(res.pre));
    res.checks.forEach((c, i) => {
      H2('5.' + (i + 1) + '　' + c.name + '（' + c.en + '）');
      if (images['mode' + c.id]) addImage(images['mode' + c.id], 4.6, '圖 ' + (3 + i) + '　' + c.name + '示意');
      para('規範條文：' + c.ref + (c.eq ? ' ' + c.eq : ''), { r: { b: true } });
      if (c.conds.length) { para('適用條件判斷：', { r: { b: true }, keepNext: true }); c.conds.forEach(bullet); }
      if (c.state !== 'calc' && !c.steps.length) {
        body.push(P(R('判定：' + c.status + '。' + c.reason, { b: true, color: '5F6F6A' }), { shade: 'F2F2F2', border: '9AA5A1', before: 60, after: 120 }));
        return;
      }
      if (c.formula) {
        para('規範公式：', { r: { b: true }, keepNext: true });
        body.push(P(rich(c.formula, { font: 'Cambria Math', size: 11.5 }), { shade: 'F3F7F4', border: '256C58', align: 'left', before: 40, after: 120, indent: 200 }));
      }
      para('計算步驟：', { r: { b: true }, keepNext: true });
      body.push(stepTable(c.steps));
      if (c.state === 'calc') {
        const capSym = res.asd ? (res.family === 'tw' ? 'R_a' : 'R_n/Ω') : 'φR_n';
        const okc = c.ratio <= 1;
        body.push(P(rich('判定：P = ' + fm(v.P, 2) + ' tf ' + (okc ? '≤' : '>') + ' ' + capSym + ' = ' + fm(c.cap, 2) + ' tf，D/C = ' + fm(c.ratio, 3) + (okc ? ' ≤ 1.0　→ 通過' : ' > 1.0　→ 不通過'), { b: true, color: okc ? '1E6B3A' : 'B42318' }),
          { shade: okc ? 'E3F1E6' : 'FBE0DD', border: okc ? '1E6B3A' : 'B42318', before: 60, after: 120 }));
      } else {
        body.push(P(R('判定：' + c.status + '。' + c.reason, { b: true, color: '5F6F6A' }), { shade: 'F2F2F2', border: '9AA5A1', before: 60, after: 120 }));
      }
      c.notes.forEach(t => para('註：' + t, { r: { size: 9.5, color: '5F6F6A' } }));
    });

    // 六、結論
    H1('六、結論與建議');
    para(concl, { r: { b: true } });
    if (!ok) {
      bullet('不通過項目建議：於載重點設置全深或半深承壓加勁板、加設腹板補強板，或增加承壓長度 N 後重新檢核。');
      if (res.checks.some(c => c.id === 'S' && c.state === 'calc' && c.ratio > 1)) bullet('腹板側向挫屈不通過時，亦可於載重點處設置側向支撐，拘束兩翼板相對側移。');
    }
    bullet('本計算書由「型鋼腹板檢核 WEB / CHECK」產生，結果須經結構專業技師覆核。');

    function stepTable(steps) {
      const rows = [['步驟', '說明', '計算式', '結果']];
      steps.forEach((s, i) => rows.push([{ t: String(i + 1), align: 'center' }, s.label, { c: rich(stepLine(s), { font: 'Cambria Math', size: 10 }) }, { c: rich(fm(s.value) + (s.unit ? ' ' + s.unit : ''), { b: true, size: 10 }), align: 'right' }]));
      return table(rows, { header: true, widths: [700, 2300, 4938, 1700], size: 10 });
    }

    return D.build({
      body, images: imgs,
      title: '型鋼腹板集中載重檢核計算書', creator: x.designer || '',
      header: (x.project || '') + '｜' + (x.member || '') + '｜' + res.code.short,
      footer: '型鋼腹板集中載重檢核計算書'
    });
  }

  g.SteelExport = { buildExcel, buildWord, excelSheets, notesList, stepLine };
})(typeof window === 'undefined' ? globalThis : window);
