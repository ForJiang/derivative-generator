/* 导函数生成器引擎测试：node tests/engine.test.cjs */
'use strict';
const E = require('../assets/js/engine.js');

let passed = 0, failed = 0;
const failures = [];

function ok(cond, label, detail) {
  if (cond) { passed++; return; }
  failed++;
  failures.push(label + (detail ? '  →  ' + detail : ''));
}

function close(a, b, tol) {
  if (!isFinite(a) || !isFinite(b)) return false;
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) / scale <= tol;
}

function symDeriv(src, x, order) {
  const r = E.derivativeOf(src, order || 1);
  return E.evaluate(r.result, x);
}

function numDeriv(src, x, h, order) {
  // n 阶中心差分: f⁽ⁿ⁾ ≈ Σ (-1)^k C(n,k) f(x + (n-2k)h/2) / hⁿ
  order = order || 1;
  const ast = E.parse(src);
  const f = (t) => E.evaluate(ast, t);
  const C = [[1]];
  for (let n = 1; n <= order; n++) {
    C[n] = [1];
    for (let k = 1; k <= n; k++) C[n][k] = (C[n - 1][k - 1] || 0) + (C[n - 1][k] || 0);
  }
  let sum = 0;
  for (let k = 0; k <= order; k++) {
    sum += Math.pow(-1, k) * C[order][k] * f(x + ((order - 2 * k) * h) / 2);
  }
  return sum / Math.pow(h, order);
}

/* ---------- 1. 数值验证：符号导数 vs 中心差分 ---------- */
const NUM_CASES = [
  ['x^2', [0.5, 1.7, -2.3]],
  ['x^3 - 3x + 1', [0.5, 1.7, -2.3]],
  ['2x + 3', [0.5, 1.7]],
  ['sin(x)', [0.5, 1.7, -2.3]],
  ['cos(x)', [0.5, 1.7, -2.3]],
  ['tan(x)', [0.3, 1.0, 2.0]],
  ['cot(x)', [0.5, 1.2, -0.8]],
  ['sec(x)', [0.3, 1.0, 2.0]],
  ['csc(x)', [0.5, 1.2, -0.8]],
  ['sin(x)cos(x)', [0.5, 1.7, -2.3]],
  ['xsin(x)', [0.5, 1.7, -2.3]],
  ['2sin(x)cos(x)', [0.5, 1.7]],
  ['x^x', [0.5, 1.3, 2.2]],
  ['x^(x+1)', [0.5, 1.3, 2.2]],
  ['ln(x)', [0.5, 1.7, 3.1]],
  ['ln(x)/x', [0.5, 1.7, 3.1]],
  ['log(x)', [0.5, 1.7, 3.1]],
  ['lg(x)', [0.5, 1.7, 3.1]],
  ['log2(x)', [0.5, 1.7, 3.1]],
  ['e^x', [0.5, 1.7, -1.2]],
  ['exp(-x^2)', [0.5, 1.7, -1.2]],
  ['2^x', [0.5, 1.7, -1.2]],
  ['sqrt(x)', [0.5, 2.3, 4.1]],
  ['sqrt(x^2 + 1)', [0.5, 1.7, -2.3]],
  ['cbrt(x)', [1.7, -2.3, 8]],
  ['1/(1 + x^2)', [0.5, 1.7, -2.3]],
  ['(x + 1)^10', [0.5, 1.7, -0.3]],
  ['x^(-2)', [0.5, 1.7, -2.3]],
  ['abs(x)', [0.5, 1.7, -2.3]],
  ['asin(x/2)', [0.5, 1.2, -1.2]],
  ['acos(x/2)', [0.5, 1.2, -1.2]],
  ['atan(x)', [0.5, 1.7, -2.3]],
  ['sinh(x)', [0.5, 1.7, -2.3]],
  ['cosh(x)', [0.5, 1.7, -2.3]],
  ['tanh(x)', [0.5, 1.7, -2.3]],
  ['asinh(x)', [0.5, 1.7, -2.3]],
  ['acosh(1 + x^2)', [0.5, 1.7]],
  ['atanh(x/2)', [0.3, -0.3, 0.7]],
  ['exp(x)cos(x)', [0.5, 1.7, -1.2]],
  ['x^2sin(x) + x^3cos(x)', [0.5, 1.7, -1.2]],
  ['sin(x^2)', [0.5, 1.7, -1.2]],
  ['sin(cos(x))', [0.5, 1.7, -1.2]],
  ['e^x·sin(x)', [0.5, 1.7, -1.2]],
  ['1/sin(x)', [0.5, 1.2, -0.8]],
  ['(x^2 + 1)/(x - 1)', [0.5, 2.7, -1.2]],
  ['x/2', [0.5, 1.7, -2.3]],
  ['pi·x^2', [0.5, 1.7]],
  ['e·x', [0.5, 1.7]],
  ['-x^2 + 3x', [0.5, 1.7]]
];

for (const [src, points] of NUM_CASES) {
  for (const x of points) {
    const s = symDeriv(src, x);
    const n = numDeriv(src, x, 1e-5);
    ok(close(s, n, 1e-4), `数值验证 ${src} @ x=${x}`, `符号=${s} 差分=${n}`);
  }
}

/* 高阶导数数值验证 */
const ORDER_CASES = [
  ['x^3', 2, [0.5, 1.7, -2.3]],
  ['x^3', 3, [0.5, 1.7]],
  ['sin(x)', 2, [0.5, 1.7, -2.3]],
  ['sin(x)', 3, [0.5, 1.7, -2.3]],
  ['sin(x)', 4, [0.5, 1.7]],
  ['e^x', 3, [0.5, 1.7]],
  ['x^4', 4, [0.5, 1.7]],
  ['ln(1 + x^2)', 2, [0.5, 1.7, -1.2]],
  ['exp(-x^2)', 2, [0.5, 1.2]]
];
for (const [src, order, points] of ORDER_CASES) {
  for (const x of points) {
  const s = symDeriv(src, x, order);
  const n = numDeriv(src, x, order >= 2 ? 1e-2 : 1e-5, order); // 高阶差分用大步长
  ok(close(s, n, order >= 2 ? 5e-3 : 1e-4), `高阶验证 ${src} 第${order}阶 @ x=${x}`, `符号=${s} 差分=${n}`);
  }
}

/* ---------- 2. 化简结果字符串断言 ---------- */
function dtext(src, order) {
  return E.toText(E.derivativeOf(src, order).result);
}
ok(dtext('x^2') === '2x', `化简 x^2'`, dtext('x^2'));
ok(dtext('x') === '1', `化简 x'`, dtext('x'));
ok(dtext('5') === '0', `化简 5'`, dtext('5'));
ok(dtext('sin(x)') === 'cos(x)', `化简 sin(x)'`, dtext('sin(x)'));
ok(dtext('cos(x)') === '-sin(x)', `化简 cos(x)'`, dtext('cos(x)'));
ok(dtext('e^x') === 'e^x', `化简 (e^x)'`, dtext('e^x'));
ok(dtext('2x + 3') === '2', `化简 (2x+3)'`, dtext('2x + 3'));
ok(dtext('x^x') === 'x^x*(ln(x) + 1)', `化简 (x^x)'`, dtext('x^x'));
ok(dtext('x^2 + x') === '2x + 1', `化简 (x^2+x)'`, dtext('x^2 + x'));
ok(dtext('sin(x)') === 'cos(x)', `化简 sin(x)'`, dtext('sin(x)'));
ok(dtext('sqrt(x)') === '1/(2sqrt(x))', `化简 (sqrt x)'`, dtext('sqrt(x)'));
ok(dtext('tan(x)') === 'sec(x)^2', `化简 (tan x)'`, dtext('tan(x)'));
ok(dtext('sin(x)', 2) === '-sin(x)', `化简 sin''`, dtext('sin(x)', 2));
ok(dtext('sin(x)', 4) === 'sin(x)', `化简 sin''''`, dtext('sin(x)', 4));
ok(dtext('x·sin(x)') === 'sin(x) + x*cos(x)', `化简 (x·sin x)'`, dtext('x·sin(x)'));
ok(dtext('ln(x)') === '1/x', `化简 (ln x)'`, dtext('ln(x)'));

/* ---------- 3. 解析往返一致性 ---------- */
const ROUNDTRIP = [
  'x^2', 'sin(x)cos(x)', 'x^x', 'ln(x)/x', 'e^x·sin(x)',
  'sqrt(x^2 + 1)', '2sin(x) - 3cos(x)', '(x + 1)(x - 1)',
  'x^(1/2)', '2^x', '1/(1 + x^2)', '-x^2 + 3x', 'abs(x)',
  'tan(x)', 'pi·x', 'e^(2x)', 'lg(x)', 'atanh(x/2)'
];
for (const src of ROUNDTRIP) {
  const ast = E.parse(src);
  const txt = E.toText(ast);
  let same = true, detail = '';
  try {
    const ast2 = E.parse(txt);
    for (const x of [0.37, 1.21, 2.87, -1.44]) {
      const a = E.evaluate(ast, x), b = E.evaluate(ast2, x);
      if (isFinite(a) && isFinite(b) && !close(a, b, 1e-9)) { same = false; detail = `x=${x}: ${a} vs ${b}`; break; }
    }
  } catch (e) { same = false; detail = txt + ' → ' + e.message; }
  ok(same, `往返一致 ${src}`, detail);
}

/* ---------- 4. 隐式乘法 ---------- */
const pairs = [['2x', '2*x'], ['xsin(x)', 'x*sin(x)'], ['2sin(x)cos(x)', '2*sin(x)*cos(x)'], ['x(x+1)', 'x*(x+1)']];
for (const [a, b] of pairs) {
  const va = E.evaluate(E.parse(a), 1.3);
  const vb = E.evaluate(E.parse(b), 1.3);
  ok(close(va, vb, 1e-12), `隐式乘法 ${a} ≡ ${b}`, `${va} vs ${vb}`);
}
let threw = false;
try { E.parse('3xq'); } catch (e) { threw = true; }
ok(threw, '未知字母 q 应报错');

/* ---------- 5. 解析报错 ---------- */
const BAD = ['', '   ', 'sin', 'x+', 'x*', '(x+1', 'x)', '2..3', 'y', 'x^^2', 'log(x, 2)', '()'];
for (const bad of BAD) {
  let t = false;
  try { E.parse(bad); } catch (e) { t = e.isParseError || true; }
  ok(t, `非法输入应报错: "${bad}"`);
}

/* ---------- 6. 步骤记录 ---------- */
{
  const r = E.derivativeOf('sin(x)·x^2', 1);
  ok(r.steps.length >= 3, '乘积应有多个求导步骤', 'steps=' + r.steps.length);
  ok(r.steps.every(s => s.rule && s.src && s.tpl), '每个步骤都含法则与模板');
  const r2 = E.derivativeOf('x^2', 1);
  ok(r2.steps.length >= 1, '幂函数也应有步骤');
}

/* ---------- 7. 渲染冒烟 ---------- */
{
  const r = E.derivativeOf('sin(x)cos(x)', 1);
  const html = E.toHTML({ t: 'call', fn: 'ln', a: r.result }).s;
  ok(html.includes('frac') === false && html.includes('ln') && html.includes('<sup>') === false || html.length > 0, 'HTML 渲染不抛错');
  ok(E.toHTML(r.result).s.includes('sin'), '结果 HTML 含 sin');
}

/* ---------- 8. 新增绘图函数（floor/ceil/round/sign/sinc） ---------- */
{
  const ev = (src, x) => E.evaluate(E.parse(src), x);
  ok(ev('floor(2.7)', 0) === 2, 'floor(2.7)=2', ev('floor(2.7)', 0));
  ok(ev('floor(-2.1)', 0) === -3, 'floor(-2.1)=-3', ev('floor(-2.1)', 0));
  ok(ev('ceil(1.2)', 0) === 2, 'ceil(1.2)=2', ev('ceil(1.2)', 0));
  ok(ev('ceil(-1.2)', 0) === -1, 'ceil(-1.2)=-1', ev('ceil(-1.2)', 0));
  ok(ev('round(2.5)', 0) === 3, 'round(2.5)=3', ev('round(2.5)', 0));
  ok(ev('sign(-3)', 0) === -1, 'sign(-3)=-1', ev('sign(-3)', 0));
  ok(ev('sinc(0)', 0) === 1, 'sinc(0)=1', ev('sinc(0)', 0));
  ok(close(ev('sinc(x)', 1.5), Math.sin(1.5) / 1.5, 1e-12), 'sinc(1.5)=sin(1.5)/1.5');
  ok(ev('floor(x) + ceil(x)', 1.5) === 3, 'floor+ceil 组合求值');
  // sinc 可导，数值验证
  for (const x of [0.5, 1.7, -1.2]) {
    const s = symDeriv('sinc(x)', x);
    const n = numDeriv('sinc(x)', x, 1e-5);
    ok(close(s, n, 1e-4), `数值验证 sinc(x) @ x=${x}`, `符号=${s} 差分=${n}`);
  }
  // sinc 复合
  const s2 = symDeriv('sinc(2x)', 0.7);
  const n2 = numDeriv('sinc(2x)', 0.7, 1e-5);
  ok(close(s2, n2, 1e-4), '数值验证 sinc(2x) @ x=0.7', `符号=${s2} 差分=${n2}`);
  // 不可导函数求导应报友好错误
  for (const bad of ['floor(x)', 'sign(x)', 'ceil(x)', 'round(x)', 'floor(2x + 1)']) {
    let threw = null;
    try { E.derivativeOf(bad, 1); } catch (e) { threw = e.message; }
    ok(threw !== null && threw.includes('不可导'), `求导 ${bad} 应报不可导`, threw || '未抛错');
  }
  // 与 floor 组合的可导部分：错误信息可读即可（整体不可导）
  let mixErr = null;
  try { E.derivativeOf('x^2 + floor(x)', 1); } catch (e) { mixErr = e.message; }
  ok(mixErr !== null && mixErr.includes('floor'), 'x^2 + floor(x) 求导报 floor 不可导', mixErr || '未抛错');
}

console.log(`\n通过 ${passed} 项，失败 ${failed} 项`);
if (failures.length) {
  console.log('\n失败明细:');
  failures.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
