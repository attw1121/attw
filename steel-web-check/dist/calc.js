/*
 * 型鋼腹板集中載重檢核 — 計算核心（無 DOM 依賴，可於 Node 測試）
 * 內部計算單位：長度 cm、力 tf、應力 tf/cm²、彎矩 tf·cm
 * 輸入單位：尺寸 mm、Fy/E kgf/cm²、P tf、M tf·m、Sx cm³
 *
 * 每一步驟同時提供：說明、符號、公式（簡易標記）、代入式、數值，以及
 * Excel 公式樣板（{變數} 代表輸入值，{#步驟} 代表前面步驟的儲存格）。
 * 公式標記：x_{sub}、x^{sup}，單字元可省略大括號（t_w、N^2）。
 */
(function (g) {
  'use strict';

  const CODES = {
    'aisc-lrfd': { family: 'aisc', method: 'lrfd', name: 'AISC 360-22 — LRFD 荷重與強度係數設計法', short: 'AISC 360-22 LRFD' },
    'aisc-asd': { family: 'aisc', method: 'asd', name: 'AISC 360-22 — ASD 容許強度設計法', short: 'AISC 360-22 ASD' },
    'tw-lrfd': { family: 'tw', method: 'lrfd', name: '鋼構造建築物鋼結構設計技術規範 — 鋼結構極限設計法', short: '台灣規範 極限設計法' },
    'tw-asd': { family: 'tw', method: 'asd', name: '鋼構造建築物鋼結構設計技術規範 — 鋼結構容許應力設計法', short: '台灣規範 容許應力法' }
  };

  // MPa → tf/cm²：1 MPa = 10.19716 kgf/cm² = 0.01019716 tf/cm²
  const MPA_TO_TFCM2 = 0.0101971621;

  /* 規範係數（可由使用者覆寫）。verify=true 表示為由 AISC 公式換算之 tf-cm 係數，須以規範原文確認。 */
  const COEFS = {
    'aisc-lrfd': [
      { key: 'phiY', sym: 'φ', label: '腹板局部降伏 強度折減係數', v: 1.00, ref: 'J10.2' },
      { key: 'phiC', sym: 'φ', label: '腹板壓皺 強度折減係數', v: 0.75, ref: 'J10.3' },
      { key: 'phiS', sym: 'φ', label: '腹板側向挫屈 強度折減係數', v: 0.85, ref: 'J10.4' },
      { key: 'phiB', sym: 'φ', label: '腹板受壓挫屈 強度折減係數', v: 0.90, ref: 'J10.5' },
      { key: 'Cr1', sym: 'C_r', label: 'Cr（|M_u| < M_y）tf/cm²（= 6.62×10⁶ MPa）', v: round(6.62e6 * MPA_TO_TFCM2, 1), ref: 'J10.4' },
      { key: 'Cr2', sym: 'C_r', label: 'Cr（|M_u| ≥ M_y）tf/cm²（= 3.31×10⁶ MPa）', v: round(3.31e6 * MPA_TO_TFCM2, 1), ref: 'J10.4' },
      { key: 'Qf', sym: 'Q_f', label: '翼板應力狀態係數 Qf（寬翼型鋼 = 1.0）', v: 1.0, ref: 'J10.3/J10.5' }
    ],
    'aisc-asd': [
      { key: 'omY', sym: 'Ω', label: '腹板局部降伏 安全係數', v: 1.50, ref: 'J10.2' },
      { key: 'omC', sym: 'Ω', label: '腹板壓皺 安全係數', v: 2.00, ref: 'J10.3' },
      { key: 'omS', sym: 'Ω', label: '腹板側向挫屈 安全係數', v: 1.76, ref: 'J10.4' },
      { key: 'omB', sym: 'Ω', label: '腹板受壓挫屈 安全係數', v: 1.67, ref: 'J10.5' },
      { key: 'Cr1', sym: 'C_r', label: 'Cr（1.5|M_a| < M_y）tf/cm²（= 6.62×10⁶ MPa）', v: round(6.62e6 * MPA_TO_TFCM2, 1), ref: 'J10.4' },
      { key: 'Cr2', sym: 'C_r', label: 'Cr（1.5|M_a| ≥ M_y）tf/cm²（= 3.31×10⁶ MPa）', v: round(3.31e6 * MPA_TO_TFCM2, 1), ref: 'J10.4' },
      { key: 'Qf', sym: 'Q_f', label: '翼板應力狀態係數 Qf（寬翼型鋼 = 1.0）', v: 1.0, ref: 'J10.3/J10.5' }
    ],
    'tw-lrfd': [
      { key: 'phiY', sym: 'φ', label: '腹板局部降伏 強度折減係數', v: 1.00, ref: '11.2.3' },
      { key: 'phiC', sym: 'φ', label: '腹板壓皺 強度折減係數', v: 0.75, ref: '11.2.4' },
      { key: 'phiS', sym: 'φ', label: '腹板側向挫屈 強度折減係數', v: 0.85, ref: '11.2.5' },
      { key: 'phiB', sym: 'φ', label: '腹板受壓挫屈 強度折減係數', v: 0.90, ref: '11.2.6' },
      { key: 'Cc1', sym: 'C', label: '腹板壓皺係數（距端 ≥ d/2）√(tf/cm²)', v: 36, ref: '11.2.4', verify: true },
      { key: 'Cc2', sym: 'C', label: '腹板壓皺係數（距端 < d/2）√(tf/cm²)', v: 18, ref: '11.2.4', verify: true },
      { key: 'Cr1', sym: 'C_r', label: 'Cr（M_u < M_y）tf/cm²', v: 67600, ref: '11.2.5', verify: true },
      { key: 'Cr2', sym: 'C_r', label: 'Cr（M_u ≥ M_y）tf/cm²', v: 33800, ref: '11.2.5', verify: true },
      { key: 'Cb', sym: 'C_b', label: '腹板受壓挫屈係數 √(tf/cm²)', v: 1100, ref: '11.2.6', verify: true }
    ],
    'tw-asd': [
      { key: 'kY', sym: 'F_a/F_y', label: '腹板局部降伏 容許壓應力比（F_a = 0.66 F_y）', v: 0.66, ref: '11.2.3', verify: true },
      { key: 'Cc1', sym: 'C', label: '腹板壓皺係數（距端 ≥ d/2）√(tf/cm²)', v: 18, ref: '11.2.4', verify: true },
      { key: 'Cc2', sym: 'C', label: '腹板壓皺係數（距端 < d/2）√(tf/cm²)', v: 9, ref: '11.2.4', verify: true },
      { key: 'Cs', sym: 'C_s', label: '腹板側向挫屈係數 tf/cm²', v: 480, ref: '11.2.5', verify: true },
      { key: 'Cb', sym: 'C_b', label: '腹板受壓挫屈容許係數 √(tf/cm²)（保守取 1100/1.67）', v: 660, ref: '11.2.6', verify: true }
    ]
  };

  const REFS = {
    aisc: { y: 'AISC 360-22 §J10.2', c: 'AISC 360-22 §J10.3', s: 'AISC 360-22 §J10.4', b: 'AISC 360-22 §J10.5' },
    tw: { y: '規範 11.2.3 腹板局部降伏', c: '規範 11.2.4 腹板壓皺', s: '規範 11.2.5 腹板側向挫屈', b: '規範 11.2.6 腹板受壓挫屈' }
  };

  /* 常用熱軋 H 型鋼（CNS/JIS 標準尺寸，mm）：d, bf, tw, tf, r */
  const PRESETS = [
    ['H200×100×5.5×8', 200, 100, 5.5, 8, 11], ['H250×125×6×9', 250, 125, 6, 9, 12],
    ['H300×150×6.5×9', 300, 150, 6.5, 9, 13], ['H350×175×7×11', 350, 175, 7, 11, 14],
    ['H400×200×8×13', 400, 200, 8, 13, 16], ['H450×200×9×14', 450, 200, 9, 14, 18],
    ['H500×200×10×16', 500, 200, 10, 16, 20], ['H600×200×11×17', 600, 200, 11, 17, 22],
    ['H588×300×12×20', 588, 300, 12, 20, 28], ['H700×300×13×24', 700, 300, 13, 24, 28],
    ['H300×300×10×15', 300, 300, 10, 15, 18], ['H350×350×12×19', 350, 350, 12, 19, 20],
    ['H400×400×13×21', 400, 400, 13, 21, 22]
  ].map(([name, d, bf, tw, tf, r]) => ({ name, d, bf, tw, tf, r }));

  const DEFAULTS = {
    project: '示範辦公大樓新建工程', member: 'B1 小梁支承處', designer: '王小明', date: '',
    code: 'tw-lrfd', shape: 'rolled', preset: 'H400×200×8×13',
    d: 400, bf: 200, tw: 8, tf: 13, r: 16,
    Fy: 3300, E: 2040000,
    P: 30, load: 'single', N: 100, a: 1500, Lb: 4000, M: 12,
    sxMode: 'auto', Sx: 1190,
    relative: 'free', rotation: 'yes',
    coef: {}
  };

  const INPUT_META = {
    d: ['型鋼全深', 'd', 'mm'], bf: ['翼板寬度', 'b_f', 'mm'], tw: ['腹板厚度', 't_w', 'mm'], tf: ['翼板厚度', 't_f', 'mm'],
    r: ['圓角半徑／銲道腳長', 'r', 'mm'], Fy: ['腹板降伏應力', 'F_{yw}', 'kgf/cm²'], E: ['彈性模數', 'E', 'kgf/cm²'],
    P: ['集中壓力需求', 'P', 'tf'], N: ['承壓長度', 'N', 'mm'], a: ['載重點至構材端距離', 'a', 'mm'],
    Lb: ['載重點處最大無側撐長度', 'L_b', 'mm'], M: ['載重點處需求彎矩 |M|', 'M', 'tf·m'], Sx: ['強軸彈性斷面模數', 'S_x', 'cm³']
  };

  function round(x, n) { const p = 10 ** n; return Math.round(x * p) / p; }

  /* 數值格式：代入式用（無千分位） */
  function fm(x, dg) {
    if (!Number.isFinite(x)) return String(x);
    const ax = Math.abs(x);
    if (dg === undefined) dg = ax >= 1000 ? 1 : ax >= 100 ? 2 : ax >= 1 ? 3 : ax === 0 ? 0 : 4;
    let s = x.toFixed(dg);
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }

  function coefsFor(code, overrides) {
    const out = {};
    for (const c of COEFS[code]) {
      const o = overrides && overrides[code] && overrides[code][c.key];
      out[c.key] = Number.isFinite(o) && o > 0 ? o : c.v;
    }
    return out;
  }

  /* 斷面性質（含圓角近似）：Ix、Sx */
  function sectionProps(d, bf, tw, tf, r, shape) {
    // mm 輸入 → cm 輸出
    const D = d / 10, B = bf / 10, T = tw / 10, F = tf / 10, R = r / 10;
    const hw = D - 2 * F;
    let A = 2 * B * F + hw * T;
    let I = (B * D ** 3 - (B - T) * hw ** 3) / 12;
    if (shape === 'rolled' && R > 0) {
      const af = (1 - Math.PI / 4) * R * R;           // 單一圓角面積
      const cy = R * (10 - 3 * Math.PI) / (12 - 3 * Math.PI); // 圓角形心距翼板內緣
      const y = D / 2 - F - cy;
      A += 4 * af; I += 4 * af * y * y;
    }
    return { A, Ix: I, Sx: I / (D / 2) };
  }

  function validate(x) {
    const e = [];
    for (const k of ['d', 'bf', 'tw', 'tf', 'Fy', 'E', 'Lb']) if (!(Number.isFinite(x[k]) && x[k] > 0)) e.push(INPUT_META[k][0] + '（' + k + '）必須大於 0');
    for (const k of ['r', 'P', 'N', 'a', 'M']) if (!(Number.isFinite(x[k]) && x[k] >= 0)) e.push(INPUT_META[k][0] + '（' + k + '）必須大於或等於 0');
    if (x.sxMode === 'manual' && !(Number.isFinite(x.Sx) && x.Sx > 0)) e.push('強軸彈性斷面模數 Sx 必須大於 0');
    if (!CODES[x.code]) e.push('未知的設計規範');
    if (e.length) return e;
    const k = x.tf + x.r;
    if (x.tw >= x.bf) e.push('腹板厚度 tw 必須小於翼板寬度 bf');
    if (2 * x.tf >= x.d) e.push('翼板厚度過大：需 2tf < d');
    if (2 * k >= x.d) e.push('k = tf + r 過大：需 2k < d（腹板淨深須大於 0）');
    return e;
  }

  function calculate(raw) {
    const x = Object.assign({}, DEFAULTS, raw);
    const errors = validate(x);
    if (errors.length) return { errors };

    const code = CODES[x.code], fam = code.family, asd = code.method === 'asd';
    const K = coefsFor(x.code, x.coef);
    const ref = REFS[fam];

    // ---- 單位換算（mm→cm、kgf/cm²→tf/cm²、tf·m→tf·cm）
    const sp = sectionProps(x.d, x.bf, x.tw, x.tf, x.r, x.shape);
    const v = {
      d: x.d / 10, bf: x.bf / 10, tw: x.tw / 10, tf: x.tf / 10, r: x.r / 10,
      N: x.N / 10, a: x.a / 10, Lb: x.Lb / 10,
      Fy: x.Fy / 1000, E: x.E / 1000, P: x.P, M: x.M * 100,
      Sx: x.sxMode === 'manual' ? x.Sx : sp.Sx
    };
    v.k = v.tf + v.r;
    v.h = x.shape === 'rolled' ? v.d - 2 * v.k : v.d - 2 * v.tf;
    v.My = v.Fy * v.Sx;
    v.rot = x.rotation === 'yes' ? 1 : 0;

    const pre = [];   // 前置計算步驟
    const S = (list) => (key, label, sym, expr, sub, value, unit, xf) => { list.push({ key, label, sym, expr, sub, value, unit: unit || '', xf: xf || null }); return value; };
    const P0 = S(pre);
    P0('k', '翼板外緣至腹板圓角趾端距離', 'k', 't_f + r', fm(v.tf) + ' + ' + fm(v.r), v.k, 'cm', '{tf}+{r}');
    if (x.shape === 'rolled') P0('h', '腹板淨深（熱軋：扣除圓角）', 'h', 'd − 2k', fm(v.d) + ' − 2 × ' + fm(v.k), v.h, 'cm', '{d}-2*{#k}');
    else P0('h', '腹板淨深（銲接組合：翼板間淨距）', 'h', 'd − 2t_f', fm(v.d) + ' − 2 × ' + fm(v.tf), v.h, 'cm', '{d}-2*{tf}');
    P0('My', '斷面降伏彎矩', 'M_y', 'F_y S_x', fm(v.Fy) + ' × ' + fm(v.Sx), v.My, 'tf·cm', '{Fy}*{Sx}');

    const checks = [];
    const ratioOf = (cap) => cap > 0 ? v.P / cap : Infinity;

    function finish(c, Rn, capKey, capValue, factorDesc) {
      c.Rn = Rn; c.cap = capValue; c.ratio = ratioOf(capValue);
      c.status = c.ratio <= 1 ? '通過' : '不通過';
      c.state = 'calc';
      c.factorDesc = factorDesc;
      c.steps.push({ key: c.id + '_DC', label: '需求／容量比', sym: 'D/C', expr: 'P / ' + (asd ? (fam === 'tw' ? 'R_a' : 'R_n/Ω') : 'φR_n'), sub: fm(v.P) + ' / ' + fm(capValue), value: c.ratio, unit: '', xf: '{P}/{#' + capKey + '}' });
      checks.push(c);
    }
    function skip(c, state, reason) {
      c.state = state; c.status = state === 'na' ? '不適用' : '不需檢核'; c.reason = reason; c.Rn = null; c.cap = null; c.ratio = null;
      checks.push(c);
    }
    function capStep(c, St, Rn) {
      // LRFD：φRn；ASD（AISC）：Rn/Ω
      const id = c.id;
      if (asd) {
        const om = K[{ Y: 'omY', C: 'omC', S: 'omS', B: 'omB' }[id]];
        St(id + '_om', '安全係數', 'Ω', '', '', om, '', '{c:' + { Y: 'omY', C: 'omC', S: 'omS', B: 'omB' }[id] + '}');
        const cap = Rn / om;
        St(id + '_cap', '容許強度', 'R_n/Ω', '', fm(Rn) + ' / ' + fm(om), cap, 'tf', '{#' + id + '_Rn}/{#' + id + '_om}');
        return cap;
      }
      const pk = { Y: 'phiY', C: 'phiC', S: 'phiS', B: 'phiB' }[id];
      const phi = K[pk];
      St(id + '_phi', '強度折減係數', 'φ', '', '', phi, '', '{c:' + pk + '}');
      const cap = phi * Rn;
      St(id + '_cap', '設計強度', 'φR_n', '', fm(phi) + ' × ' + fm(Rn), cap, 'tf', '{#' + id + '_phi}*{#' + id + '_Rn}');
      return cap;
    }

    const reqLabel = asd ? (fam === 'tw' ? '使用載重' : 'ASD 載重組合') : '因數化載重';

    /* ===== 1. 腹板局部降伏 ===== */
    {
      const c = { id: 'Y', name: '腹板局部降伏', en: 'Web Local Yielding', ref: ref.y, steps: [], conds: [], notes: [] };
      const St = S(c.steps);
      const interior = v.a > v.d;
      const C = interior ? 5 : 2.5;
      c.conds.push('載重點至構材端距離 a = ' + fm(v.a) + ' cm ' + (interior ? '>' : '≤') + ' d = ' + fm(v.d) + ' cm → ' + (interior ? '內部載重，應力擴散寬度 5k + N' : '端部載重（或反力），應力擴散寬度 2.5k + N'));
      St('Y_C', '擴散係數', 'C_k', interior ? '5（a > d）' : '2.5（a ≤ d）', '', C, '', 'IF({a}>{d},5,2.5)');
      const Lw = C * v.k + v.N;
      St('Y_L', '腹板有效承壓長度（k 線處）', 'l_e', 'C_k k + N', fm(C) + ' × ' + fm(v.k) + ' + ' + fm(v.N), Lw, 'cm', '{#Y_C}*{#k}+{N}');
      if (fam === 'tw' && asd) {
        const kY = K.kY;
        const Fa = kY * v.Fy;
        St('Y_Fa', '腹板容許壓應力', 'F_a', fm(kY) + ' F_{yw}', fm(kY) + ' × ' + fm(v.Fy), Fa, 'tf/cm²', '{c:kY}*{Fy}');
        const fa = v.P / (v.tw * Lw);
        St('Y_fa', '腹板 k 線處實際壓應力', 'f_a', 'P / [t_w (C_k k + N)]', fm(v.P) + ' / (' + fm(v.tw) + ' × ' + fm(Lw) + ')', fa, 'tf/cm²', '{P}/({tw}*{#Y_L})');
        const Ra = Fa * v.tw * Lw;
        St('Y_Rn', '容許集中載重', 'R_a', 'F_a t_w (C_k k + N)', fm(Fa) + ' × ' + fm(v.tw) + ' × ' + fm(Lw), Ra, 'tf', '{#Y_Fa}*{tw}*{#Y_L}');
        St('Y_cap', '容許強度', 'R_a', '', '', Ra, 'tf', '{#Y_Rn}');
        c.formula = 'R_a = ' + fm(kY) + ' F_{yw} t_w (C_k k + N)；等同 f_a = P / [t_w (C_k k + N)] ≤ ' + fm(kY) + ' F_{yw}';
        finish(c, Ra, 'Y_cap', Ra, '容許應力 F_a = ' + fm(kY) + 'F_y');
      } else {
        const Rn = v.Fy * v.tw * Lw;
        St('Y_Rn', '標稱強度', 'R_n', 'F_{yw} t_w (C_k k + N)', fm(v.Fy) + ' × ' + fm(v.tw) + ' × ' + fm(Lw), Rn, 'tf', '{Fy}*{tw}*{#Y_L}');
        const cap = capStep(c, St, Rn);
        c.formula = 'R_n = F_{yw} t_w (' + (interior ? '5k' : '2.5k') + ' + N)';
        finish(c, Rn, 'Y_cap', cap, asd ? 'Ω = ' + fm(K.omY) : 'φ = ' + fm(K.phiY));
      }
    }

    /* ===== 2. 腹板壓皺 ===== */
    {
      const c = { id: 'C', name: '腹板壓皺', en: 'Web Local Crippling', ref: ref.c, steps: [], conds: [], notes: [] };
      const St = S(c.steps);
      const far = v.a >= v.d / 2;
      const Nd = v.N / v.d;
      // 台灣容許應力法（沿用 AISC ASD 89）端部未區分 N/d > 0.2
      const branchB = !far && Nd > 0.2 && !(fam === 'tw' && asd);
      c.conds.push('a = ' + fm(v.a) + ' cm ' + (far ? '≥' : '<') + ' d/2 = ' + fm(v.d / 2) + ' cm → ' + (far ? '載重距構材端 ≥ d/2' : '載重距構材端 < d/2（端部）'));
      if (!far) c.conds.push('N/d = ' + fm(Nd, 4) + (fam === 'tw' && asd ? '（容許應力法端部公式不分 N/d）' : (Nd > 0.2 ? ' > 0.2 → 採 (4N/d − 0.2)' : ' ≤ 0.2 → 採 3N/d')));
      St('C_Nd', '承壓長度比', 'N/d', 'N / d', fm(v.N) + ' / ' + fm(v.d), Nd, '', '{N}/{d}');
      const A = branchB ? 4 * Nd - 0.2 : 3 * Nd;
      St('C_A', '承壓長度項', 'A', branchB ? '4(N/d) − 0.2' : '3(N/d)', branchB ? '4 × ' + fm(Nd, 4) + ' − 0.2' : '3 × ' + fm(Nd, 4), A, '',
        fam === 'tw' && asd ? '3*{#C_Nd}' : 'IF(AND({a}<{d}/2,{#C_Nd}>0.2),4*{#C_Nd}-0.2,3*{#C_Nd})');
      const tr = (v.tw / v.tf) ** 1.5;
      St('C_tr', '腹板翼板厚度比項', '(t_w/t_f)^{1.5}', '', '(' + fm(v.tw) + ' / ' + fm(v.tf) + ')^{1.5}', tr, '', '({tw}/{tf})^1.5');
      const br = 1 + A * tr;
      St('C_br', '括號項', 'B', '1 + A (t_w/t_f)^{1.5}', '1 + ' + fm(A, 4) + ' × ' + fm(tr, 4), br, '', '1+{#C_A}*{#C_tr}');
      let Rn;
      if (fam === 'aisc') {
        const Cc = far ? 0.80 : 0.40;
        St('C_Cc', '係數', 'C', far ? '0.80（a ≥ d/2）' : '0.40（a < d/2）', '', Cc, '', 'IF({a}>={d}/2,0.8,0.4)');
        const rt = Math.sqrt(v.E * v.Fy * v.tf / v.tw);
        St('C_rt', '根號項', '√(E F_{yw} t_f / t_w)', '', '√(' + fm(v.E) + ' × ' + fm(v.Fy) + ' × ' + fm(v.tf) + ' / ' + fm(v.tw) + ')', rt, 'tf/cm²', 'SQRT({E}*{Fy}*{tf}/{tw})');
        Rn = Cc * v.tw ** 2 * br * rt * K.Qf;
        St('C_Rn', '標稱強度', 'R_n', 'C t_w^2 B √(E F_{yw} t_f/t_w) Q_f', fm(Cc) + ' × ' + fm(v.tw) + '^2 × ' + fm(br, 4) + ' × ' + fm(rt) + ' × ' + fm(K.Qf), Rn, 'tf', '{#C_Cc}*{tw}^2*{#C_br}*{#C_rt}*{c:Qf}');
        c.formula = 'R_n = ' + (far ? '0.80' : '0.40') + ' t_w^2 [1 + ' + (branchB ? '(4N/d − 0.2)' : '3(N/d)') + ' (t_w/t_f)^{1.5}] √(E F_{yw} t_f / t_w) Q_f';
        c.eq = far ? '(J10-4)' : branchB ? '(J10-5b)' : '(J10-5a)';
      } else {
        const Cc = far ? K.Cc1 : K.Cc2;
        St('C_Cc', '規範係數（tf-cm 單位）', 'C', far ? fm(K.Cc1) + '（a ≥ d/2）' : fm(K.Cc2) + '（a < d/2）', '', Cc, '', 'IF({a}>={d}/2,{c:Cc1},{c:Cc2})');
        const rt = Math.sqrt(v.Fy * v.tf / v.tw);
        St('C_rt', '根號項', '√(F_{yw} t_f / t_w)', '', '√(' + fm(v.Fy) + ' × ' + fm(v.tf) + ' / ' + fm(v.tw) + ')', rt, '√(tf/cm²)', 'SQRT({Fy}*{tf}/{tw})');
        Rn = Cc * v.tw ** 2 * br * rt;
        St('C_Rn', asd ? '容許集中載重' : '標稱強度', asd ? 'R_a' : 'R_n', 'C t_w^2 B √(F_{yw} t_f/t_w)', fm(Cc) + ' × ' + fm(v.tw) + '^2 × ' + fm(br, 4) + ' × ' + fm(rt, 4), Rn, 'tf', '{#C_Cc}*{tw}^2*{#C_br}*{#C_rt}');
        c.formula = (asd ? 'R_a' : 'R_n') + ' = ' + fm(Cc) + ' t_w^2 [1 + ' + (branchB ? '(4N/d − 0.2)' : '3(N/d)') + ' (t_w/t_f)^{1.5}] √(F_{yw} t_f / t_w)';
      }
      if (fam === 'tw' && asd) {
        St('C_cap', '容許強度', 'R_a', '', '', Rn, 'tf', '{#C_Rn}');
        finish(c, Rn, 'C_cap', Rn, '容許應力法公式已含安全係數');
      } else {
        const cap = capStep(c, St, Rn);
        finish(c, Rn, 'C_cap', cap, asd ? 'Ω = ' + fm(K.omC) : 'φ = ' + fm(K.phiC));
      }
    }

    /* ===== 3. 腹板側向挫屈 ===== */
    {
      const c = { id: 'S', name: '腹板側向挫屈', en: 'Web Sidesway Buckling', ref: ref.s, steps: [], conds: [], notes: [] };
      const St = S(c.steps);
      const limit = v.rot ? 2.3 : 1.7;
      if (x.load === 'double') {
        skip(c, 'na', '雙側翼板同時承受相向壓力，無受拉翼板，本極限狀態僅適用於單側集中壓力。');
      } else if (x.relative === 'braced') {
        skip(c, 'na', '載重點處受壓翼板與受拉翼板之相對側向位移已拘束，無需檢核。');
      } else {
        const q = (v.h / v.tw) / (v.Lb / v.bf);
        c.conds.push('兩翼板相對側向位移未拘束；受壓翼板' + (v.rot ? '有' : '無') + '轉動拘束 → 適用上限 ' + limit);
        St('S_q', '細長參數', 'q', '(h/t_w) / (L_b/b_f)', '(' + fm(v.h) + ' / ' + fm(v.tw) + ') / (' + fm(v.Lb) + ' / ' + fm(v.bf) + ')', q, '', '({#h}/{tw})/({Lb}/{bf})');
        if (q > limit) {
          c.conds.push('q = ' + fm(q, 4) + ' > ' + limit + ' → 依規範不需檢核此極限狀態');
          c.steps.push({ key: 'S_lim', label: '適用上限', sym: 'q_{lim}', expr: v.rot ? '2.3（有轉動拘束）' : '1.7（無轉動拘束）', sub: '', value: limit, unit: '', xf: null });
          skip(c, 'nr', 'q = ' + fm(q, 4) + ' > ' + limit + '，依規範此極限狀態不需檢核。');
        } else {
          c.conds.push('q = ' + fm(q, 4) + ' ≤ ' + limit + ' → 需檢核');
          const q3 = 0.4 * q ** 3;
          const brk = v.rot + q3;
          St('S_br', '括號項', 'B', v.rot ? '1 + 0.4 q^3' : '0.4 q^3', (v.rot ? '1 + ' : '') + '0.4 × ' + fm(q, 4) + '^3', brk, '', '{rot}+0.4*{#S_q}^3');
          let Rn;
          if (fam === 'tw' && asd) {
            Rn = K.Cs * v.tw ** 3 / v.h * brk;
            St('S_Rn', '容許集中載重', 'R_a', 'C_s t_w^3 / h × B', fm(K.Cs) + ' × ' + fm(v.tw) + '^3 / ' + fm(v.h) + ' × ' + fm(brk, 4), Rn, 'tf', '{c:Cs}*{tw}^3/{#h}*{#S_br}');
            c.formula = 'R_a = ' + fm(K.Cs) + ' t_w^3 / h × [' + (v.rot ? '1 + ' : '') + '0.4 ((h/t_w)/(L_b/b_f))^3]';
            St('S_cap', '容許強度', 'R_a', '', '', Rn, 'tf', '{#S_Rn}');
            finish(c, Rn, 'S_cap', Rn, '容許應力法公式已含安全係數');
          } else {
            const mFac = asd ? 1.5 : 1.0;
            const low = mFac * v.M < v.My;
            const mSym = asd ? '1.5|M_a|' : '|M_u|';
            c.conds.push(mSym + ' = ' + fm(mFac * v.M) + ' tf·cm ' + (low ? '<' : '≥') + ' M_y = ' + fm(v.My) + ' tf·cm → C_r = ' + fm(low ? K.Cr1 : K.Cr2) + ' tf/cm²');
            St('S_Cr', '係數（依載重點彎矩）', 'C_r', low ? mSym + ' < M_y' : mSym + ' ≥ M_y', '', low ? K.Cr1 : K.Cr2, 'tf/cm²', 'IF(' + (asd ? '1.5*' : '') + '{M}<{#My},{c:Cr1},{c:Cr2})');
            Rn = (low ? K.Cr1 : K.Cr2) * v.tw ** 3 * v.tf / v.h ** 2 * brk;
            St('S_Rn', '標稱強度', 'R_n', 'C_r t_w^3 t_f / h^2 × B', fm(low ? K.Cr1 : K.Cr2) + ' × ' + fm(v.tw) + '^3 × ' + fm(v.tf) + ' / ' + fm(v.h) + '^2 × ' + fm(brk, 4), Rn, 'tf', '{#S_Cr}*{tw}^3*{tf}/{#h}^2*{#S_br}');
            c.formula = 'R_n = C_r t_w^3 t_f / h^2 × [' + (v.rot ? '1 + ' : '') + '0.4 ((h/t_w)/(L_b/b_f))^3]';
            const cap = capStep(c, St, Rn);
            finish(c, Rn, 'S_cap', cap, asd ? 'Ω = ' + fm(K.omS) : 'φ = ' + fm(K.phiS));
          }
          c.notes.push('L_b 取載重點處任一翼板之最大無側撐長度；本項非整體側向扭轉挫屈檢核。');
        }
      }
    }

    /* ===== 4. 腹板受壓挫屈 ===== */
    {
      const c = { id: 'B', name: '腹板受壓挫屈', en: 'Web Compression Buckling', ref: ref.b, steps: [], conds: [], notes: [] };
      const St = S(c.steps);
      if (x.load !== 'double') {
        skip(c, 'na', '僅適用於同一斷面上、下翼板同時承受一對相向集中壓力；目前為單側集中壓力。');
      } else {
        const near = v.a < v.d / 2;
        c.conds.push('上、下翼板同時承受相向集中壓力 P');
        c.conds.push('a = ' + fm(v.a) + ' cm ' + (near ? '<' : '≥') + ' d/2 = ' + fm(v.d / 2) + ' cm → ' + (near ? '強度折減 50%' : '不折減'));
        St('B_beta', '端部折減係數', 'β', near ? '0.5（a < d/2）' : '1.0（a ≥ d/2）', '', near ? 0.5 : 1, '', 'IF({a}<{d}/2,0.5,1)');
        let Rn;
        if (fam === 'aisc') {
          const rt = Math.sqrt(v.E * v.Fy);
          St('B_rt', '根號項', '√(E F_{yw})', '', '√(' + fm(v.E) + ' × ' + fm(v.Fy) + ')', rt, 'tf/cm²', 'SQRT({E}*{Fy})');
          Rn = 24 * v.tw ** 3 * rt / v.h * K.Qf * (near ? 0.5 : 1);
          St('B_Rn', '標稱強度', 'R_n', 'β × 24 t_w^3 √(E F_{yw}) / h × Q_f', fm(near ? 0.5 : 1) + ' × 24 × ' + fm(v.tw) + '^3 × ' + fm(rt) + ' / ' + fm(v.h) + ' × ' + fm(K.Qf), Rn, 'tf', '{#B_beta}*24*{tw}^3*{#B_rt}/{#h}*{c:Qf}');
          c.formula = 'R_n = 24 t_w^3 √(E F_{yw}) / h × Q_f' + (near ? '，a < d/2 時折減 50%' : '');
        } else {
          const rt = Math.sqrt(v.Fy);
          St('B_rt', '根號項', '√F_{yw}', '', '√' + fm(v.Fy), rt, '√(tf/cm²)', 'SQRT({Fy})');
          Rn = K.Cb * v.tw ** 3 * rt / v.h * (near ? 0.5 : 1);
          St('B_Rn', asd ? '容許集中載重' : '標稱強度', asd ? 'R_a' : 'R_n', 'β × C_b t_w^3 √F_{yw} / h', fm(near ? 0.5 : 1) + ' × ' + fm(K.Cb) + ' × ' + fm(v.tw) + '^3 × ' + fm(rt, 4) + ' / ' + fm(v.h), Rn, 'tf', '{#B_beta}*{c:Cb}*{tw}^3*{#B_rt}/{#h}');
          c.formula = (asd ? 'R_a' : 'R_n') + ' = ' + fm(K.Cb) + ' t_w^3 √F_{yw} / h' + (near ? '，a < d/2 時折減 50%' : '');
        }
        if (fam === 'tw' && asd) {
          St('B_cap', '容許強度', 'R_a', '', '', Rn, 'tf', '{#B_Rn}');
          finish(c, Rn, 'B_cap', Rn, '容許應力法公式已含安全係數');
        } else {
          const cap = capStep(c, St, Rn);
          finish(c, Rn, 'B_cap', cap, asd ? 'Ω = ' + fm(K.omB) : 'φ = ' + fm(K.phiB));
        }
      }
    }

    // 依固定順序排列
    const order = { Y: 0, C: 1, S: 2, B: 3 };
    checks.sort((p, q) => order[p.id] - order[q.id]);
    const active = checks.filter(c => c.state === 'calc');
    const governing = active.reduce((m, c) => (!m || c.ratio > m.ratio ? c : m), null);
    const pass = active.every(c => c.ratio <= 1);
    const verifyCoefs = COEFS[x.code].filter(c => c.verify).map(c => c.key);

    return {
      errors: [], input: x, code, codeKey: x.code, asd, family: fam, v, sp, K, pre, checks, governing, pass,
      reqLabel, verifyCoefs,
      capLabel: asd ? (fam === 'tw' ? '容許強度 R_a' : '容許強度 R_n/Ω') : '設計強度 φR_n'
    };
  }

  g.SteelCalc = { CODES, COEFS, PRESETS, DEFAULTS, INPUT_META, calculate, sectionProps, coefsFor, fm };
})(typeof window === 'undefined' ? globalThis : window);
