// 計算核心與匯出測試：node steel-web-check/tests/run_tests.js
'use strict';
const path = require('path');
const fs = require('fs');
const DIST = path.join(__dirname, '..', 'dist');
for (const f of ['zip', 'calc', 'xlsx', 'docx', 'diagram', 'export']) require(path.join(DIST, f + '.js'));
const C = globalThis.SteelCalc, X = globalThis.SteelExport, Dg = globalThis.SteelDiagram;

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + e.message); }
}
const near = (a, b, tol = 1e-6, msg = '') => { if (Math.abs(a - b) > tol * Math.max(1, Math.abs(b))) throw new Error(msg + ' 期望 ' + b + '，實得 ' + a); };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(msg + ' 期望 ' + JSON.stringify(b) + '，實得 ' + JSON.stringify(a)); };
const chk = (r, id) => r.checks.find(c => c.id === id);

// 參考斷面：H400×200×8×13，k = 26 mm（r = 13），與 v1 已驗證案例相同
const REF = { code: 'aisc-lrfd', d: 400, bf: 200, tw: 8, tf: 13, r: 13, N: 100, a: 400, Fy: 2450, E: 2040000, Lb: 4000, P: 20, M: 0 };

console.log('計算核心');
t('AISC 局部降伏端部 (a ≤ d)：Rn = (2.5k + N)Fy tw = 32.34 tf', () => near(chk(C.calculate(REF), 'Y').Rn, 32.34));
t('AISC 局部降伏內部 (a > d)：C = 5', () => near(chk(C.calculate({ ...REF, a: 401 }), 'Y').Rn, (5 * 2.6 + 10) * 2.45 * 0.8));
t('AISC 腹板壓皺 a ≥ d/2 (J10-4)：62.848 tf', () => near(chk(C.calculate(REF), 'C').Rn, 62.8479601295095));
t('AISC 腹板壓皺 a < d/2、N/d ≤ 0.2 (J10-5a)', () => {
  const r = C.calculate({ ...REF, a: 100, N: 80 }); const A = 3 * 0.2;
  near(chk(r, 'C').Rn, 0.4 * 0.64 * (1 + A * (0.8 / 1.3) ** 1.5) * Math.sqrt(2040 * 2.45 * 1.3 / 0.8));
});
t('AISC 腹板壓皺 a < d/2、N/d > 0.2 (J10-5b)', () => {
  const r = C.calculate({ ...REF, a: 100, N: 120 }); const A = 4 * 0.3 - 0.2;
  near(chk(r, 'C').Rn, 0.4 * 0.64 * (1 + A * (0.8 / 1.3) ** 1.5) * Math.sqrt(2040 * 2.45 * 1.3 / 0.8)); eq(chk(r, 'C').eq, '(J10-5b)');
});
t('AISC 側向挫屈：有轉動拘束、q ≤ 2.3 需檢核，Cr = 6.62×10⁶ MPa', () => {
  const r = C.calculate(REF), c = chk(r, 'S'); eq(c.state, 'calc');
  const h = 40 - 2 * 2.6, q = (h / 0.8) / (400 / 20), Cr = 6.62e6 * 0.0101971621;
  near(c.Rn, Math.round(Cr * 10) / 10 * 0.512 * 1.3 / h ** 2 * (1 + 0.4 * q ** 3)); near(c.cap, 0.85 * c.Rn);
});
t('AISC 側向挫屈：q > 2.3 不需檢核', () => eq(chk(C.calculate({ ...REF, Lb: 3000 }), 'S').state, 'nr'));
t('AISC 側向挫屈：無轉動拘束上限 1.7', () => eq(chk(C.calculate({ ...REF, rotation: 'no', Lb: 4000 }), 'S').state, 'nr'));
t('AISC 側向挫屈：|Mu| ≥ My 時 Cr 減半', () => {
  const a = chk(C.calculate(REF), 'S'), b = chk(C.calculate({ ...REF, M: 1000 }), 'S'); near(b.Rn / a.Rn, 0.5, 1e-3);
});
t('AISC ASD：1.5|Ma| 與 My 比較', () => {
  const r0 = C.calculate({ ...REF, code: 'aisc-asd' }); const My = r0.v.My / 100; // tf·m
  const lo = chk(C.calculate({ ...REF, code: 'aisc-asd', M: My / 1.5 * 0.99 }), 'S'), hi = chk(C.calculate({ ...REF, code: 'aisc-asd', M: My / 1.5 * 1.01 }), 'S');
  near(hi.Rn / lo.Rn, 0.5, 1e-3);
});
t('側向挫屈：相對側移已拘束 → 不適用', () => eq(chk(C.calculate({ ...REF, relative: 'braced' }), 'S').state, 'na'));
t('側向挫屈：雙側相向受壓 → 不適用', () => eq(chk(C.calculate({ ...REF, load: 'double' }), 'S').state, 'na'));
t('受壓挫屈：單側載重 → 不適用', () => eq(chk(C.calculate(REF), 'B').state, 'na'));
t('AISC 受壓挫屈：24 tw³ √(E Fy)/h，a < d/2 折減 50%', () => {
  const far = chk(C.calculate({ ...REF, load: 'double', a: 200 }), 'B'), nearE = chk(C.calculate({ ...REF, load: 'double', a: 199 }), 'B');
  near(far.Rn, 24 * 0.512 * Math.sqrt(2040 * 2.45) / 34.8); near(nearE.Rn, far.Rn / 2); near(far.cap, 0.9 * far.Rn);
});
t('AISC ASD 安全係數 1.50／2.00／1.76／1.67', () => {
  const r = C.calculate({ ...REF, code: 'aisc-asd' });
  near(chk(r, 'Y').cap, chk(r, 'Y').Rn / 1.5); near(chk(r, 'C').cap, chk(r, 'C').Rn / 2); near(chk(r, 'S').cap, chk(r, 'S').Rn / 1.76);
  const d = C.calculate({ ...REF, code: 'aisc-asd', load: 'double' }); near(chk(d, 'B').cap, chk(d, 'B').Rn / 1.67);
});
t('台灣極限設計法 壓皺係數 36／18、φ = 0.75', () => {
  const r = C.calculate({ ...REF, code: 'tw-lrfd' }), c = chk(r, 'C');
  near(c.Rn, 36 * 0.64 * (1 + 0.75 * (0.8 / 1.3) ** 1.5) * Math.sqrt(2.45 * 1.3 / 0.8)); near(c.cap, 0.75 * c.Rn);
  const e = chk(C.calculate({ ...REF, code: 'tw-lrfd', a: 100, N: 80 }), 'C'); near(e.Rn, 18 * 0.64 * (1 + 0.6 * (0.8 / 1.3) ** 1.5) * Math.sqrt(2.45 * 1.3 / 0.8));
});
t('台灣極限設計法 與 AISC LRFD 結果差異 < 2%（係數換算一致性）', () => {
  const a = C.calculate({ ...REF, load: 'double', a: 300 }), b = C.calculate({ ...REF, code: 'tw-lrfd', load: 'double', a: 300 });
  for (const id of ['Y', 'C', 'B']) near(chk(b, id).cap, chk(a, id).cap, 0.02, id);
  near(chk(C.calculate({ ...REF, code: 'tw-lrfd' }), 'S').cap, chk(C.calculate(REF), 'S').cap, 0.01, 'S');
});
t('台灣容許應力法 局部降伏 Ra = 0.66Fy tw (5k+N)', () => {
  const c = chk(C.calculate({ ...REF, code: 'tw-asd', a: 1000 }), 'Y'); near(c.cap, 0.66 * 2.45 * 0.8 * (5 * 2.6 + 10));
});
t('台灣容許應力法 壓皺 18／9、端部不分 N/d', () => {
  const c = chk(C.calculate({ ...REF, code: 'tw-asd', a: 100, N: 200 }), 'C'); near(c.cap, 9 * 0.64 * (1 + 3 * 0.5 * (0.8 / 1.3) ** 1.5) * Math.sqrt(2.45 * 1.3 / 0.8));
});
t('台灣容許應力法 側向挫屈 480 tw³/h [1 + 0.4q³]', () => {
  const c = chk(C.calculate({ ...REF, code: 'tw-asd' }), 'S'); const h = 34.8, q = (h / 0.8) / 20; near(c.cap, 480 * 0.512 / h * (1 + 0.4 * q ** 3));
});
t('規範係數可覆寫', () => {
  const c = chk(C.calculate({ ...REF, code: 'tw-asd', load: 'double', a: 300, coef: { 'tw-asd': { Cb: 1100 } } }), 'B'); near(c.cap, 1100 * 0.512 * Math.sqrt(2.45) / 34.8);
});
t('銲接組合斷面 h = d − 2tf', () => near(C.calculate({ ...REF, shape: 'welded', r: 6 }).v.h, 40 - 2.6));
t('自動 Sx 與型錄值相近（H400×200×8×13 約 1190 cm³）', () => near(C.sectionProps(400, 200, 8, 13, 16, 'rolled').Sx, 1190, 0.01));
t('不合理輸入被阻擋', () => {
  if (!C.calculate({ ...REF, tw: 0 }).errors.length) throw new Error('tw = 0 未阻擋');
  if (!C.calculate({ ...REF, tf: 100, r: 120 }).errors.length) throw new Error('2k ≥ d 未阻擋');
  if (!C.calculate({ ...REF, P: NaN }).errors.length) throw new Error('NaN 未阻擋');
});
t('P = 0 時 D/C = 0 且通過', () => { const r = C.calculate({ ...REF, P: 0 }); eq(r.pass, true); near(r.governing.ratio, 0); });
t('超載判定為不通過，控制項目取最大 D/C', () => {
  const r = C.calculate({ ...REF, P: 100 }); eq(r.pass, false);
  const m = Math.max(...r.checks.filter(c => c.state === 'calc').map(c => c.ratio)); near(r.governing.ratio, m);
});

console.log('匯出');
const r = C.calculate({ ...C.DEFAULTS });
t('每個計算步驟都有 Excel 公式或固定值，且引用均可解析', () => {
  for (const code of Object.keys(C.CODES)) for (const load of ['single', 'double']) {
    const res = C.calculate({ ...C.DEFAULTS, code, load, a: load === 'double' ? 150 : 1500 });
    X.excelSheets(res); // 未定義引用會丟出錯誤
  }
});
t('Excel 為有效 ZIP，含 4 個工作表', () => {
  const b = X.buildExcel(r); const s = Buffer.from(b).toString('latin1');
  eq(s.slice(0, 2), 'PK'); eq(new Set(s.match(/xl\/worksheets\/sheet\d\.xml/g)).size, 4);
});
t('Word 為有效 ZIP，含 document.xml 與四項檢核標題', () => {
  const b = X.buildWord(r, {}); const s = Buffer.from(b).toString('utf8');
  if (!s.includes('word/document.xml')) throw new Error('缺 document.xml');
  for (const n of ['腹板局部降伏', '腹板壓皺', '腹板側向挫屈', '腹板受壓挫屈']) if (!s.includes(n)) throw new Error('缺 ' + n);
});
t('示意圖 SVG 產生', () => {
  for (const s of [Dg.section(r.input), Dg.elevation(r.input, r), Dg.section({ ...r.input, shape: 'welded' }), Dg.elevation({ ...r.input, load: 'double', a: 100 }, r)])
    if (!s.startsWith('<svg') || s.includes('NaN') || s.includes('undefined')) throw new Error('SVG 異常');
});

if (process.argv[2] === '--samples') {
  fs.writeFileSync(path.join(__dirname, '..', '範例計算書.xlsx'), X.buildExcel(r));
  console.log('已更新範例計算書.xlsx');
}
console.log('\n' + passed + ' 通過，' + failed + ' 失敗');
process.exit(failed ? 1 : 0);
