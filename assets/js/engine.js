/*
 * 导函数生成器 - 符号求导引擎（零依赖，浏览器 / Node 通用）
 *
 * AST 节点：
 *   {t:'num', v}                    数字
 *   {t:'var'}                       变量 x
 *   {t:'const', name:'e'|'pi'}      常量
 *   {t:'call', fn, a}               一元函数
 *   {t:'add'|'sub'|'mul'|'div'|'pow', a, b}
 *   {t:'neg', a}                    一元负号
 *   {t:'d', a}                      求导步骤占位符 d/dx[a]
 */
(function () {
  'use strict';

  /* ---------------- 工具 ---------------- */

  function parseErr(src, pos, msg) {
    const e = new Error('第 ' + (pos + 1) + ' 个字符附近：' + msg);
    e.pos = pos;
    e.isParseError = true;
    return e;
  }

  function num(v) { return { t: 'num', v: v }; }
  function call(fn, a) { return { t: 'call', fn: fn, a: a }; }
  function mul(a, b) { return { t: 'mul', a: a, b: b }; }
  function add(a, b) { return { t: 'add', a: a, b: b }; }
  function div(a, b) { return { t: 'div', a: a, b: b }; }
  function pow(a, b) { return { t: 'pow', a: a, b: b }; }
  function neg(a) { return { t: 'neg', a: a }; }
  function hole(u) { return { t: 'd', a: u }; }

  function isNum(n, v) { return !!n && n.t === 'num' && (v === undefined || n.v === v); }
  function isZero(n) { return !!n && n.t === 'num' && n.v === 0; }

  function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  function hasX(node) {
    switch (node.t) {
      case 'var': return true;
      case 'num': case 'const': case 'd': return false;
      case 'call': return hasX(node.a);
      case 'neg': return hasX(node.a);
      default: return hasX(node.a) || hasX(node.b);
    }
  }

  // 数字是否"干净"（整数或 6 位以内小数），用于决定要不要把分数折叠成小数
  function isCleanNumber(v) {
    if (!isFinite(v)) return false;
    if (Number.isInteger(v)) return true;
    if (Math.abs(v) > 1e15) return false;
    return Math.round(v * 1e6) / 1e6 === v;
  }

  function fmtNum(v) {
    if (Object.is(v, -0)) v = 0;
    if (Number.isInteger(v)) return String(v);
    return String(parseFloat(v.toPrecision(10)));
  }

  function gcd(a, b) {
    a = Math.round(Math.abs(a));
    b = Math.round(Math.abs(b));
    while (b) { const t = a % b; a = b; b = t; }
    return a || 1;
  }

  /* ---------------- 词法分析 ---------------- */

  const FUNCTION_NAMES = [
    'asinh', 'acosh', 'atanh', 'asin', 'acos', 'atan',
    'sinh', 'cosh', 'tanh', 'sqrt', 'cbrt',
    'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
    'floor', 'round',
    'log2', 'log', 'ln', 'exp', 'abs', 'lg',
    'ceil', 'sign', 'sinc'
  ];
  // 贪心最长匹配用，长的在前
  const KNOWN_WORDS = FUNCTION_NAMES.concat(['pi', 'e']).sort(function (a, b) { return b.length - a.length; });

  function normalize(src) {
    return String(src)
      .replace(/[×·⋅]/g, '*').replace(/÷/g, '/')
      .replace(/[−–—]/g, '-')
      .replace(/π/g, 'pi')
      .replace(/\*\*/g, '^')
      .replace(/√/g, 'sqrt')
      .replace(/（/g, '(').replace(/）/g, ')').replace(/，/g, ',')
      .replace(/²/g, '^2').replace(/³/g, '^3')
      .toLowerCase();
  }

  function tokenize(src) {
    const s = normalize(src);
    const toks = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (/[0-9.]/.test(c)) {
        let j = i;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        const str = s.slice(i, j);
        if ((str.match(/\./g) || []).length > 1) throw parseErr(src, i, '数字格式不对："' + str + '"');
        toks.push({ t: 'num', v: parseFloat(str), pos: i });
        i = j; continue;
      }
      if (/[a-zA-Z]/.test(c)) {
        let j = i;
        while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
        const run = s.slice(i, j);
        let k = 0;
        while (k < run.length) {
          let matched = null;
          for (const w of KNOWN_WORDS) {
            if (run.startsWith(w, k)) { matched = w; break; }
          }
          if (matched) {
            if (matched === 'log' && s[i + k + 3] === '2') {
              // log2 特判：2 紧跟在字母串后面
              toks.push({ t: 'fn', name: 'log2', pos: i + k });
              j++;   // 把 2 一并吃掉
              k += 4;
              continue;
            }
            if (matched === 'pi') toks.push({ t: 'const', name: 'pi', pos: i + k });
            else if (matched === 'e') toks.push({ t: 'const', name: 'e', pos: i + k });
            else toks.push({ t: 'fn', name: matched, pos: i + k });
            k += matched.length;
          } else if (run[k] === 'x') {
            toks.push({ t: 'var', pos: i + k });
            k++;
          } else {
            throw parseErr(src, i + k, '不认识的符号 "' + run[k] + '"（目前只支持变量 x，常量 e 和 pi）');
          }
        }
        i = j; continue;
      }
      if ('+-*/^(),'.indexOf(c) >= 0) { toks.push({ t: 'op', ch: c, pos: i }); i++; continue; }
      throw parseErr(src, i, '不认识的字符 "' + c + '"');
    }
    return toks;
  }

  /* ---------------- 语法分析（递归下降） ---------------- */

  function parse(src) {
    if (!src || !String(src).trim()) throw new Error('请先输入一个函数，例如 x^2 或 sin(x)');
    const toks = tokenize(src);
    if (toks.length === 0) throw parseErr(src, 0, '请输入一个函数');
    let p = 0;
    function peek() { return toks[p]; }
    function isOp(ch) { const tk = toks[p]; return tk && tk.t === 'op' && tk.ch === ch; }
    function expectOp(ch) {
      if (!isOp(ch)) {
        const tk = toks[p];
        throw parseErr(src, tk ? tk.pos : src.length, '这里应该是 "' + ch + '"');
      }
      p++;
    }
    function startsFactor(tk) {
      return tk && (tk.t === 'num' || tk.t === 'var' || tk.t === 'const' || tk.t === 'fn' ||
        (tk.t === 'op' && tk.ch === '('));
    }

    function parseAdd() {
      let a = parseMul();
      while (isOp('+') || isOp('-')) {
        const op = toks[p++].ch;
        const b = parseMul();
        a = op === '+' ? { t: 'add', a: a, b: b } : { t: 'sub', a: a, b: b };
      }
      return a;
    }

    function parseMul() {
      let a = parseUnary();
      for (;;) {
        if (isOp('*') || isOp('/')) {
          const op = toks[p++].ch;
          const b = parseUnary();
          a = op === '*' ? { t: 'mul', a: a, b: b } : { t: 'div', a: a, b: b };
        } else if (startsFactor(peek())) {
          // 隐式乘法：2x、2sin(x)、x(x+1)
          const b = parseUnary();
          a = { t: 'mul', a: a, b: b };
        } else break;
      }
      return a;
    }

    function parseUnary() {
      if (isOp('-')) { p++; return { t: 'neg', a: parseUnary() }; }
      if (isOp('+')) { p++; return parseUnary(); }
      return parsePow();
    }

    function parsePow() {
      const base = parseAtom();
      if (isOp('^')) {
        p++;
        const exp = parseUnary(); // 右结合，指数可带负号
        return { t: 'pow', a: base, b: exp };
      }
      return base;
    }

    function parseAtom() {
      const tk = toks[p++];
      if (!tk) throw parseErr(src, src.length, '表达式不完整');
      if (tk.t === 'num') return num(tk.v);
      if (tk.t === 'var') return { t: 'var' };
      if (tk.t === 'const') return { t: 'const', name: tk.name };
      if (tk.t === 'fn') {
        if (!isOp('(')) throw parseErr(src, tk.pos, '函数 ' + tk.name + ' 后面要加括号，例如 ' + tk.name + '(x)');
        p++;
        const arg = parseAdd();
        if (isOp(',')) throw parseErr(src, toks[p].pos, '不支持多参数函数');
        expectOp(')');
        return { t: 'call', fn: tk.name, a: arg };
      }
      if (tk.t === 'op' && tk.ch === '(') {
        const e = parseAdd();
        expectOp(')');
        return e;
      }
      if (tk.t === 'op' && '*-/^)'.indexOf(tk.ch) >= 0) {
        throw parseErr(src, tk.pos, '"' + tk.ch + '" 前面缺少内容');
      }
      throw parseErr(src, tk.pos, '这里出现了意外的 "' + tk.ch + '"');
    }

    const result = parseAdd();
    if (p < toks.length) {
      const tk = toks[p];
      throw parseErr(src, tk.pos, tk.t === 'op' ? '出现了多余的 "' + tk.ch + '"' : '这里多了内容');
    }
    return result;
  }

  /* ---------------- 求值 ---------------- */

  const EVAL_FUNCS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    cot: function (x) { return 1 / Math.tan(x); },
    sec: function (x) { return 1 / Math.cos(x); },
    csc: function (x) { return 1 / Math.sin(x); },
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
    ln: Math.log, log: Math.log10, lg: Math.log10, log2: Math.log2,
    exp: Math.exp, sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
    floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
    sinc: function (x) { return x === 0 ? 1 : Math.sin(x) / x; }
  };

  function evaluate(node, x) {
    switch (node.t) {
      case 'num': return node.v;
      case 'var': return x;
      case 'const': return node.name === 'e' ? Math.E : Math.PI;
      case 'neg': return -evaluate(node.a, x);
      case 'add': return evaluate(node.a, x) + evaluate(node.b, x);
      case 'sub': return evaluate(node.a, x) - evaluate(node.b, x);
      case 'mul': return evaluate(node.a, x) * evaluate(node.b, x);
      case 'div': return evaluate(node.a, x) / evaluate(node.b, x);
      case 'pow': return Math.pow(evaluate(node.a, x), evaluate(node.b, x));
      case 'call': return EVAL_FUNCS[node.fn](evaluate(node.a, x));
      case 'd': return NaN;
      default: return NaN;
    }
  }

  /* ---------------- 基本导数公式（u 为里层函数，D 为对 u 的求导方式） ---------------- */

  const FUNCS = {
    sin:   { d: (u, D) => mul(call('cos', u), D(u)) },
    cos:   { d: (u, D) => neg(mul(call('sin', u), D(u))) },
    tan:   { d: (u, D) => mul(pow(call('sec', u), num(2)), D(u)) },
    cot:   { d: (u, D) => neg(mul(pow(call('csc', u), num(2)), D(u))) },
    sec:   { d: (u, D) => mul(mul(call('sec', u), call('tan', u)), D(u)) },
    csc:   { d: (u, D) => neg(mul(mul(call('csc', u), call('cot', u)), D(u))) },
    asin:  { d: (u, D) => div(D(u), call('sqrt', { t: 'sub', a: num(1), b: pow(u, num(2)) })) },
    acos:  { d: (u, D) => neg(div(D(u), call('sqrt', { t: 'sub', a: num(1), b: pow(u, num(2)) }))) },
    atan:  { d: (u, D) => div(D(u), { t: 'add', a: num(1), b: pow(u, num(2)) }) },
    sinh:  { d: (u, D) => mul(call('cosh', u), D(u)) },
    cosh:  { d: (u, D) => mul(call('sinh', u), D(u)) },
    tanh:  { d: (u, D) => div(D(u), pow(call('cosh', u), num(2))) },
    asinh: { d: (u, D) => div(D(u), call('sqrt', { t: 'add', a: pow(u, num(2)), b: num(1) })) },
    acosh: { d: (u, D) => div(D(u), call('sqrt', { t: 'sub', a: pow(u, num(2)), b: num(1) })) },
    atanh: { d: (u, D) => div(D(u), { t: 'sub', a: num(1), b: pow(u, num(2)) }) },
    ln:    { d: (u, D) => div(D(u), u) },
    log:   { d: (u, D) => div(D(u), mul(u, call('ln', num(10)))) },
    lg:    { d: (u, D) => div(D(u), mul(u, call('ln', num(10)))) },
    log2:  { d: (u, D) => div(D(u), mul(u, call('ln', num(2)))) },
    exp:   { d: (u, D) => mul(call('exp', u), D(u)) },
    sqrt:  { d: (u, D) => div(D(u), mul(num(2), call('sqrt', u))) },
    cbrt:  { d: (u, D) => div(D(u), mul(num(3), pow(call('cbrt', u), num(2)))) },
    abs:   { d: (u, D) => div(mul(D(u), u), call('abs', u)) },
    sinc:  { d: (u, D) => div({ t: 'sub', a: mul(mul(call('cos', u), D(u)), u), b: mul(call('sin', u), D(u)) }, pow(u, num(2))) },
    // 阶梯/分段函数：图像可以画，但几乎处处不可导，符号求导没有意义
    floor: { nonDiff: true },
    ceil:  { nonDiff: true },
    round: { nonDiff: true },
    sign:  { nonDiff: true }
  };

  function ruleName(node) {
    switch (node.t) {
      case 'add': case 'sub': return '和差法则（导数的线性性）';
      case 'mul': return '乘积法则 (uv)′ = u′v + uv′';
      case 'div': return '商法则 (u/v)′ = (u′v − uv′) / v²';
      case 'neg': return '导数的线性性 (−u)′ = −u′';
      case 'call': return '基本导数公式 + 链式法则';
      case 'pow': {
        const uHas = hasX(node.a), vHas = hasX(node.b);
        if (uHas && !vHas) return '幂函数法则 (uⁿ)′ = n·uⁿ⁻¹·u′';
        if (!uHas && vHas) return '指数函数法则 (cᵘ)′ = cᵘ·ln c·u′';
        return '幂指函数求导（对数求导法）';
      }
      default: return '基本导数公式';
    }
  }

  // 求导（steps 传入数组时顺带记录求导步骤）
  function differentiate(node, steps) {
    function D(child) { return differentiate(child, steps); }
    if (steps && steps.length < 40 && node.t !== 'num' && node.t !== 'var' && node.t !== 'const') {
      steps.push({ src: node, tpl: diffTemplate(node), rule: ruleName(node) });
    }
    switch (node.t) {
      case 'num': case 'const': return num(0);
      case 'var': return num(1);
      case 'd': return num(0);
      case 'neg': return { t: 'neg', a: D(node.a) };
      case 'add': return { t: 'add', a: D(node.a), b: D(node.b) };
      case 'sub': return { t: 'sub', a: D(node.a), b: D(node.b) };
      case 'mul': return {
        t: 'add',
        a: { t: 'mul', a: D(node.a), b: node.b },
        b: { t: 'mul', a: node.a, b: D(node.b) }
      };
      case 'div': return {
        t: 'div',
        a: {
          t: 'sub',
          a: { t: 'mul', a: D(node.a), b: node.b },
          b: { t: 'mul', a: node.a, b: D(node.b) }
        },
        b: pow(node.b, num(2))
      };
      case 'pow': {
        const u = node.a, v = node.b;
        const uHas = hasX(u), vHas = hasX(v);
        if (uHas && !vHas) {
          // (u^n)' = n · u^(n-1) · u'
          return mul(mul(v, pow(u, { t: 'sub', a: v, b: num(1) })), D(u));
        }
        if (!uHas && vHas) {
          // (c^u)' = c^u · ln c · u'
          return mul(mul(node, call('ln', u)), D(v));
        }
        if (!uHas && !vHas) return num(0);
        // u^v = e^(v ln u)
        return mul(node, {
          t: 'add',
          a: mul(D(v), call('ln', u)),
          b: div(mul(v, D(u)), u)
        });
      }
      case 'call': {
        const fdef = FUNCS[node.fn];
        if (!fdef) return num(0);
        if (fdef.nonDiff) {
          throw new Error(node.fn + ' 是阶梯/分段函数，几乎处处不可导，不支持符号求导（图像仍可正常绘制）');
        }
        return fdef.d(node.a, D);
      }
      default: return num(0);
    }
  }

  // 只实例化当前节点这一层的法则，里层用 d/dx[·] 占位 —— 用于展示步骤
  function diffTemplate(node) {
    switch (node.t) {
      case 'num': case 'const': return num(0);
      case 'var': return num(1);
      case 'neg': return { t: 'neg', a: hole(node.a) };
      case 'add': return { t: 'add', a: hole(node.a), b: hole(node.b) };
      case 'sub': return { t: 'sub', a: hole(node.a), b: hole(node.b) };
      case 'mul': return {
        t: 'add',
        a: { t: 'mul', a: hole(node.a), b: node.b },
        b: { t: 'mul', a: node.a, b: hole(node.b) }
      };
      case 'div': return {
        t: 'div',
        a: {
          t: 'sub',
          a: { t: 'mul', a: hole(node.a), b: node.b },
          b: { t: 'mul', a: node.a, b: hole(node.b) }
        },
        b: pow(node.b, num(2))
      };
      case 'pow': {
        const u = node.a, v = node.b;
        const uHas = hasX(u), vHas = hasX(v);
        if (uHas && !vHas) return mul(mul(v, pow(u, { t: 'sub', a: v, b: num(1) })), hole(u));
        if (!uHas && vHas) return mul(mul(node, call('ln', u)), hole(v));
        return mul(node, {
          t: 'add',
          a: mul(hole(v), call('ln', u)),
          b: div(mul(v, hole(u)), u)
        });
      }
      case 'call': {
        const fdef = FUNCS[node.fn];
        if (!fdef || fdef.nonDiff) {
          throw new Error(node.fn + ' 是阶梯/分段函数，几乎处处不可导，不支持符号求导（图像仍可正常绘制）');
        }
        return fdef.d(node.a, hole);
      }
      case 'd': return node;
      default: return num(0);
    }
  }

  /* ---------------- 化简 ---------------- */

  function mulNode(a, b) { return { t: 'mul', a: a, b: b }; }

  // 加减链展平 + 同类项合并：a + (b − a) → b，2xcos + 2xcos → 2·(2xcos)
  // isSub：根节点是 a − b 还是 a + b。返回 null 表示无变化
  function flattenSumPass(a, b, isSub) {
    const terms = [];
    (function go(n, s) {
      if (n.t === 'add') { go(n.a, s); go(n.b, s); }
      else if (n.t === 'sub') { go(n.a, s); go(n.b, -s); }
      else terms.push({ s: s, n: n });
    })({ t: isSub ? 'sub' : 'add', a: a, b: b }, 1);
    const merged = [];
    for (const t of terms) {
      const key = JSON.stringify(t.n);
      const m = merged.find(function (m) { return m.key === key; });
      if (m) m.s += t.s;
      else merged.push({ key: key, s: t.s, n: t.n });
    }
    const kept = merged.filter(function (m) { return m.s !== 0; });
    if (!kept.length) return num(0);
    const changed = kept.length !== terms.length || terms.length > 2 ||
      kept.some(function (k) { return Math.abs(k.s) > 1; });
    if (!changed) return null;
    function coef(k, n) { return k === 1 ? n : { t: 'mul', a: num(k), b: n }; }
    let acc;
    const first = kept[0];
    if (first.s > 0) acc = coef(first.s, first.n);
    else acc = { t: 'neg', a: coef(-first.s, first.n) };
    for (let i = 1; i < kept.length; i++) {
      const k = kept[i];
      acc = k.s < 0
        ? { t: 'sub', a: acc, b: coef(-k.s, k.n) }
        : { t: 'add', a: acc, b: coef(k.s, k.n) };
    }
    return acc;
  }

  function simplifyPass(node) {
    switch (node.t) {
      case 'num': case 'var': case 'const': case 'd': return node;

      case 'neg': {
        const a = simplifyPass(node.a);
        if (a.t === 'num') return num(-a.v);
        if (a.t === 'neg') return a.a;
        // −(p − q)/v → (q − p)/v
        if (a.t === 'div' && a.a.t === 'sub') {
          return { t: 'div', a: { t: 'sub', a: a.a.b, b: a.a.a }, b: a.b };
        }
        return rebuild(node, { a: a });
      }

      case 'add': {
        const a = simplifyPass(node.a), b = simplifyPass(node.b);
        if (a.t === 'num' && b.t === 'num') return num(a.v + b.v);
        if (isZero(a)) return b;
        if (isZero(b)) return a;
        if (isNum(b) && b.v < 0) return { t: 'sub', a: a, b: num(-b.v) };
        if (isNum(a) && a.v < 0) return { t: 'sub', a: b, b: num(-a.v) };
        if (b.t === 'neg') return { t: 'sub', a: a, b: b.a };
        if (a.t === 'neg') return { t: 'sub', a: b, b: a.a };
        const fl = flattenSumPass(a, b, false);
        if (fl !== null) return fl;
        if (eq(a, b)) return { t: 'mul', a: num(2), b: a };
        return rebuild(node, { a: a, b: b });
      }

      case 'sub': {
        const a = simplifyPass(node.a), b = simplifyPass(node.b);
        if (a.t === 'num' && b.t === 'num') return num(a.v - b.v);
        if (isZero(b)) return a;
        if (isNum(b) && b.v < 0) return { t: 'add', a: a, b: num(-b.v) };
        if (isZero(a)) return { t: 'neg', a: b };
        if (b.t === 'neg') return { t: 'add', a: a, b: b.a };
        const fl = flattenSumPass(a, b, true);
        if (fl !== null) return fl;
        if (eq(a, b)) return num(0);
        return rebuild(node, { a: a, b: b });
      }

      case 'mul': {
        const a = simplifyPass(node.a), b = simplifyPass(node.b);
        // 负号上提
        if (a.t === 'neg') return { t: 'neg', a: simplifyPass({ t: 'mul', a: a.a, b: b }) };
        if (b.t === 'neg') return { t: 'neg', a: simplifyPass({ t: 'mul', a: a, b: b.a }) };
        if (isZero(a) || isZero(b)) return num(0);
        if (isNum(a, 1)) return b;
        if (isNum(b, 1)) return a;
        if (a.t === 'num' && b.t === 'num') return num(a.v * b.v);
        if (isNum(b) && a.t !== 'num') return { t: 'mul', a: b, b: a }; // 系数放前面
        if (eq(a, b)) return { t: 'pow', a: a, b: num(2) };

        // 展平乘法链，合并系数，x 放到前面
        const list = [];
        (function go(n) { if (n.t === 'mul') { go(n.a); go(n.b); } else list.push(n); })({ t: 'mul', a: a, b: b });
        const nums = list.filter(function (f) { return f.t === 'num'; });
        let rest = list.filter(function (f) { return f.t !== 'num'; });
        let coeff = null;
        if (nums.length >= 2) {
          const p = nums.reduce(function (s, f) { return s * f.v; }, 1);
          if (p !== 1) coeff = num(p);
        } else if (nums.length === 1) {
          coeff = nums[0];
        }
        if (isNum(coeff, 1)) coeff = null;

        // 同底幂合并：x·x → x²，x·x² → x³
        const groups = [];
        for (const f of rest) {
          let base = f, exp = num(1);
          if (f.t === 'pow' && isNum(f.b)) { base = f.a; exp = f.b; }
          const g = groups.find(function (g) { return isNum(g.exp) && eq(g.base, base); });
          if (g) g.exp = num(g.exp.v + exp.v);
          else groups.push({ base: base, exp: exp });
        }
        rest = [];
        for (const g of groups) {
          if (g.exp.v === 0) continue;
          rest.push(g.exp.v === 1 ? g.base : pow(g.base, g.exp));
        }

        rest.sort(function (x, y) { return mulClass(x) - mulClass(y); }); // 稳定排序
        const finalList = coeff ? [coeff].concat(rest) : rest.slice();
        if (finalList.length === 1) return finalList[0];
        const origKey = JSON.stringify(list);
        const newKey = JSON.stringify(finalList);
        if (newKey === origKey && finalList.length === 2) {
          return rebuild(node, { a: a, b: b });
        }
        return finalList.reduce(mulNode);
      }

      case 'div': {
        const a = simplifyPass(node.a), b = simplifyPass(node.b);
        if (a.t === 'neg') return { t: 'neg', a: simplifyPass({ t: 'div', a: a.a, b: b }) };
        if (b.t === 'neg') return { t: 'neg', a: simplifyPass({ t: 'div', a: a, b: b.a }) };
        if (isZero(a)) return num(0);
        if (isNum(b, 1)) return a;
        if (a.t === 'num' && b.t === 'num' && b.v !== 0) {
          const q = a.v / b.v;
          if (isCleanNumber(q)) return num(q);
          // 整洁不了就约分：3/9 → 1/3（展示成最简分数）
          if (Number.isInteger(a.v) && Number.isInteger(b.v)) {
            const g = gcd(Math.abs(a.v), Math.abs(b.v));
            if (g > 1) return { t: 'div', a: num(a.v / g), b: num(b.v / g) };
          }
        }
        // (k·u)/m → (k/m)·u（整洁的系数，如 16x/64 → x/4）
        if (isNum(b) && a.t === 'mul' && isNum(a.a) && b.v !== 0 && isCleanNumber(a.a.v / b.v)) {
          const k = a.a.v / b.v;
          return k === 1 ? a.b : { t: 'mul', a: num(k), b: a.b };
        }
        if (eq(a, b)) return num(1);
        return rebuild(node, { a: a, b: b });
      }

      case 'pow': {
        const a = simplifyPass(node.a), b = simplifyPass(node.b);
        if (isNum(b, 0)) return num(1);
        if (isNum(b, 1)) return a;
        if (isNum(b, 0.5)) return call('sqrt', a);
        if (isNum(a, 1)) return num(1);
        // (u^m)^n → u^(m·n)（整数指数）
        if (a.t === 'pow' && isNum(a.b) && isNum(b) &&
            Number.isInteger(a.b.v) && Number.isInteger(b.v) &&
            a.b.v * b.v !== 0 && Math.abs(a.b.v * b.v) <= 64) {
          return simplifyPass(pow(a.a, num(a.b.v * b.v)));
        }
        if (isNum(b) && Number.isInteger(b.v) && b.v < 0) {
          // u^(-n) → 1/u^n
          return { t: 'div', a: num(1), b: simplifyPass(pow(a, num(-b.v))) };
        }
        if (a.t === 'num' && b.t === 'num' && Number.isInteger(b.v) && b.v >= 0 && isCleanNumber(Math.pow(a.v, b.v))) {
          return num(Math.pow(a.v, b.v));
        }
        // e^(2x) 一类的写法统一成 exp
        if (a.t === 'call' && a.fn === 'exp' && b.t === 'num') {
          return call('exp', simplifyPass(mul(b, a.a)));
        }
        return rebuild(node, { a: a, b: b });
      }

      case 'call': {
        const a = simplifyPass(node.a);
        if (a.t === 'num') {
          const folded = tryFoldCall(node.fn, a.v);
          if (folded !== null) return num(folded);
        }
        if (node.fn === 'ln' && a.t === 'const' && a.name === 'e') return num(1);
        if (node.fn === 'exp' && isNum(a, 0)) return num(1);
        if (node.fn === 'exp' && isNum(a, 1)) return { t: 'const', name: 'e' };
        return rebuild(node, { a: a });
      }
    }
    return node;
  }

  function mulClass(f) {
    if (f.t === 'num') return -1;
    if (f.t === 'var') return 0;
    if (f.t === 'pow' && f.a.t === 'var') return 0;
    return 1;
  }

  function rebuild(node, parts) {
    for (const k in parts) {
      if (parts[k] !== node[k]) {
        const out = Object.assign({}, node);
        for (const k2 in parts) out[k2] = parts[k2];
        return out;
      }
    }
    return node;
  }

  // 只折叠结果为整数的基本函数值，1/3 这类保持分数形式
  function tryFoldCall(fn, x) {
    if (!isFinite(x)) return null;
    const f = EVAL_FUNCS[fn];
    if (!f) return null;
    const r = f(x);
    if (!isFinite(r) || Math.abs(r) > 1e15) return null;
    if (Number.isInteger(r)) return r;
    return null;
  }

  function simplify(node) {
    for (let i = 0; i < 60; i++) {
      const r = simplifyPass(node);
      if (r === node) break;
      node = r;
    }
    return node;
  }

  /* ---------------- 排版渲染（HTML，数学式） ---------------- */

  const PREC = { add: 1, sub: 1, mul: 2, div: 2, neg: 2.5, pow: 3 };
  const MINUS = '−';

  function paren(html) { return '<span class="paren">(</span>' + html + '<span class="paren">)</span>'; }

  function toHTML(node) {
    switch (node.t) {
      case 'num': {
        const s = fmtNum(node.v).replace(/-/g, MINUS);
        return { s: '<span class="num">' + s + '</span>', p: 4 };
      }
      case 'var': return { s: '<i class="v">x</i>', p: 4 };
      case 'const': return { s: '<span class="num">' + (node.name === 'e' ? 'e' : 'π') + '</span>', p: 4 };
      case 'd': {
        return { s: '<span class="ddx"><i>d</i>/<i>dx</i></span><span class="paren">[</span>' + toHTML(node.a).s + '<span class="paren">]</span>', p: 4 };
      }
      case 'neg': {
        const c = toHTML(node.a);
        const s = '<span class="op">' + MINUS + '</span>' + (c.p < 2 ? paren(c.s) : c.s);
        return { s: s, p: 2.5 };
      }
      case 'add': {
        const a = toHTML(node.a), b = toHTML(node.b);
        const bs = (b.p <= 1 || node.b.t === 'neg') ? paren(b.s) : b.s;
        return { s: a.s + '<span class="op"> + </span>' + bs, p: 1 };
      }
      case 'sub': {
        const a = toHTML(node.a), b = toHTML(node.b);
        const bs = (b.p <= 1 || node.b.t === 'neg') ? paren(b.s) : b.s;
        return { s: a.s + '<span class="op"> ' + MINUS + ' </span>' + bs, p: 1 };
      }
      case 'mul': {
        const a = toHTML(node.a), b = toHTML(node.b);
        const as = a.p < 2 ? paren(a.s) : a.s;
        const bs = b.p < 2 ? paren(b.s) : b.s;
        const juxtapose = isNum(node.a) && startsLetterish(node.b);
        const op = juxtapose ? '<span class="gap"></span>' : '<span class="op"> · </span>';
        return { s: as + op + bs, p: 2 };
      }
      case 'div': {
        const a = toHTML(node.a), b = toHTML(node.b);
        return {
          s: '<span class="frac"><span class="fnum">' + a.s + '</span><span class="fden">' + b.s + '</span></span>',
          p: 2
        };
      }
      case 'pow': {
        // f²(x) 特例
        if (node.a.t === 'call' && isNum(node.b) && Number.isInteger(node.b.v) && node.b.v >= 2) {
          const inner = toHTML(node.a.a);
          return { s: '<span class="fn">' + node.a.fn + '</span><sup>' + node.b.v + '</sup>' + paren(inner.s), p: 4 };
        }
        const a = toHTML(node.a);
        const as = a.p < 4 ? paren(a.s) : a.s;
        const bs = toHTML(node.b).s;
        return { s: as + '<sup>' + bs + '</sup>', p: 3 };
      }
      case 'call': {
        const inner = toHTML(node.a);
        if (node.fn === 'sqrt') {
          return { s: '<span class="rad">√<span class="rad-body">' + inner.s + '</span></span>', p: 4 };
        }
        if (node.fn === 'abs') {
          return { s: '<span class="paren">|</span>' + inner.s + '<span class="paren">|</span>', p: 4 };
        }
        if (node.fn === 'exp') {
          return { s: '<span class="num">e</span><sup>' + inner.s + '</sup>', p: 3 };
        }
        return { s: '<span class="fn">' + node.fn + '</span>' + paren(inner.s), p: 4 };
      }
    }
    return { s: '?', p: 4 };
  }

  function startsLetterish(node) {
    switch (node.t) {
      case 'var': case 'const': return true;
      case 'call': return node.fn !== 'exp';
      case 'pow': return startsLetterish(node.a);
      case 'mul': return startsLetterish(node.a);
      default: return false;
    }
  }

  /* ---------------- 纯文本渲染（复制用） ---------------- */

  function toText(node) {
    switch (node.t) {
      case 'num': return fmtNum(node.v);
      case 'var': return 'x';
      case 'const': return node.name;
      case 'd': return 'd/dx[' + toText(node.a) + ']';
      case 'neg': {
        const c = toText(node.a);
        return '-' + (precOf(node.a) < 2 ? '(' + c + ')' : c);
      }
      case 'add': return toText(node.a) + ' + ' + (precOf(node.b) <= 1 || node.b.t === 'neg' ? '(' + toText(node.b) + ')' : toText(node.b));
      case 'sub': return toText(node.a) + ' - ' + (precOf(node.b) <= 1 || node.b.t === 'neg' ? '(' + toText(node.b) + ')' : toText(node.b));
      case 'mul': {
        const as = precOf(node.a) < 2 ? '(' + toText(node.a) + ')' : toText(node.a);
        const bs = precOf(node.b) < 2 ? '(' + toText(node.b) + ')' : toText(node.b);
        return as + (isNum(node.a) && startsLetterish(node.b) ? '' : '*') + bs;
      }
      case 'div': {
        const as = precOf(node.a) < 2 ? '(' + toText(node.a) + ')' : toText(node.a);
        const bs = precOf(node.b) < 3 ? '(' + toText(node.b) + ')' : toText(node.b);
        return as + '/' + bs;
      }
      case 'pow': {
        const as = precOf(node.a) < 4 ? '(' + toText(node.a) + ')' : toText(node.a);
        const b = node.b;
        const bs = (precOf(b) < 3 || b.t === 'pow') ? '(' + toText(b) + ')' : toText(b);
        return as + '^' + bs;
      }
      case 'call': {
        if (node.fn === 'sqrt') return 'sqrt(' + toText(node.a) + ')';
        if (node.fn === 'abs') return 'abs(' + toText(node.a) + ')';
        return node.fn + '(' + toText(node.a) + ')';
      }
    }
    return '?';
  }

  function precOf(node) {
    if (node.t === 'call') return node.fn === 'exp' ? 3 : 4;
    return PREC[node.t] !== undefined ? PREC[node.t] : 4;
  }

  /* ---------------- 求一串导数（高阶） ---------------- */

  // 返回 { order, result, steps, chain: [f', f'', ...] }，steps 是最后一次求导的步骤
  function derivativeOf(src, order) {
    order = Math.max(1, Math.min(8, order | 0));
    let cur = parse(src);
    const chain = [{ ast: cur, text: 'f(x)' }];
    let steps = [];
    for (let k = 1; k <= order; k++) {
      steps = [];
      let d = differentiate(cur, k === order ? steps : null);
      d = simplify(d);
      cur = d;
      chain.push({ ast: cur });
    }
    return { order: order, result: cur, steps: steps, chain: chain };
  }

  const API = {
    parse: parse,
    differentiate: differentiate,
    diffTemplate: diffTemplate,
    simplify: simplify,
    evaluate: evaluate,
    toHTML: toHTML,
    toText: toText,
    derivativeOf: derivativeOf,
    hasX: hasX,
    ruleName: ruleName
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    globalThis.DerivEngine = API;
  }
})();
