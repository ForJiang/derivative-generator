/*
 * 函数图像生成器 - 界面逻辑（多函数绘图 + 求导分析 + 切线）
 */
(function () {
  'use strict';
  const E = window.DerivEngine;
  const Plot = window.DerivPlot;
  const T = window.I18N;

  // 引擎规则名 → i18n key（供求导步骤翻译）
  const RULE_KEYS = {
    '和差法则（导数的线性性）': 'rule.sum',
    '导数的线性性 (−u)′ = −u′': 'rule.linear',
    '乘积法则 (uv)′ = u′v + uv′': 'rule.product',
    '商法则 (u/v)′ = (u′v − uv′) / v²': 'rule.quotient',
    '幂函数法则 (uⁿ)′ = n·uⁿ⁻¹·u′': 'rule.power',
    '指数函数法则 (cᵘ)′ = cᵘ·ln c·u′': 'rule.expo',
    '幂指函数求导（对数求导法）': 'rule.powexpo',
    '基本导数公式 + 链式法则': 'rule.chain'
  };

  // 引擎报错 → 当前语言文案（message 恒为中文，en 下用 code 查译文）
  function errorText(e) {
    if (e && e.code && T.getLang() === 'en') {
      const pos = e.pos !== undefined ? T.t('err.posPrefix', { pos: e.pos + 1 }) : '';
      return pos + T.t('err.' + e.code, e.vars || {});
    }
    return (e && e.message) || String(e);
  }

  const $ = function (id) { return document.getElementById(id); };

  /* ---------- 常量 ---------- */

  const PALETTE = ['#4cc2ff', '#ffb454', '#b18cff', '#3ddc97', '#ff7a93', '#ffd166'];
  const SUBSCRIPTS = ['₁', '₂', '₃', '₄', '₅', '₆'];
  const MAX_FNS = 6;

  const els = {
    fnList: $('fnList'), fnEmpty: $('fnEmpty'), fnCount: $('fnCount'),
    addFn: $('addFn'), lib: $('library'),
    plot: $('plot'), tooltip: $('tooltip'), legend: $('legend'),
    zoomIn: $('zoomIn'), zoomOut: $('zoomOut'), zoomReset: $('zoomReset'),
    anTitle: $('anTitle'), orderVal: $('orderVal'), orderMinus: $('orderMinus'), orderPlus: $('orderPlus'),
    resultLabel: $('resultLabel'), resultMath: $('resultMath'), resultHint: $('resultHint'),
    copyBtn: $('copyBtn'), stepsCard: $('stepsCard'), stepsList: $('stepsList'),
    derivToggle: $('derivToggle'),
    tangentX: $('tangentX'), tangentBtn: $('tangentBtn'), tangentClear: $('tangentClear'), tangentInfo: $('tangentInfo'),
    toasts: $('toasts'),
    logBody: $('logBody'), logCount: $('logCount'), logClear: $('logClear'), logToggle: $('logToggle')
  };

  /* ---------- 状态 ---------- */

  const state = {
    fns: [],            // {id, src, ast, err, visible, color, el}
    selectedId: null,
    order: 1,
    view: { xmin: -6, xmax: 6 },
    defaultView: { xmin: -6, xmax: 6 },
    hover: null,        // {x}
    tangent: null,      // {a, k, b, y0}
    dragging: false,
    showDeriv: false,
    nextId: 1
  };

  const dragLast = { x: 0 };

  /* ---------- 工具 ---------- */

  function fmtVal(v) {
    if (!isFinite(v)) return T.t('val.undef');
    if (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-4 && v !== 0)) return v.toExponential(3);
    return String(parseFloat(v.toFixed(4)));
  }

  function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    els.toasts.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  function selectedFn() {
    for (const f of state.fns) if (f.id === state.selectedId) return f;
    return null;
  }

  function visibleFns() {
    return state.fns.filter(function (f) { return f.visible && f.ast; });
  }

  /* ---------- 函数列表 ---------- */

  function logParseResult(f, action) {
    const key = action === '解析' ? 'log.ok.parse' : 'log.ok.parseSave';
    if (f.err) log('err', T.t(key, { label: fnLabel(f) }), errorText(f.err));
    else log('ok', T.t(key, { label: fnLabel(f) }), f.src || T.t('fn.emptySrc'));
  }

  function addFunction(src, skipSelect) {
    if (state.fns.length >= MAX_FNS) {
      showToast(T.t('toast.maxFns', { n: MAX_FNS }));
      log('warn', T.t('log.warn.addFail'), T.t('toast.maxFnsLog', { n: MAX_FNS }));
      return null;
    }
    const idx = state.fns.length;
    const f = {
      id: state.nextId++,
      src: src || '',
      ast: null,
      err: null,
      visible: true,
      color: PALETTE[idx % PALETTE.length],
      el: null
    };
    state.fns.push(f);
    buildFnRow(f);
    log('cmd', T.t('log.cmd.add', { label: 'f' + SUBSCRIPTS[idx] }), src || T.t('fn.emptySrc'));
    if (!src) setTimeout(function () { f.el.querySelector('.fn-input').focus(); }, 0);
    tryParseFn(f, true);
    if (!skipSelect) selectFn(f.id);
    renderEmpty();
    return f;
  }

  function removeFn(id) {
    const i = state.fns.findIndex(function (f) { return f.id === id; });
    if (i < 0) return;
    const f = state.fns[i];
    log('cmd', T.t('log.cmd.del'), fnLabel(f) + ' · ' + (f.src || T.t('fn.emptySrc')));
    state.fns.splice(i, 1);
    for (let k = 0; k < state.fns.length; k++) state.fns[k].el.style.setProperty('--fn-color', PALETTE[k % PALETTE.length]);
    if (state.tangent && state.selectedId === id) { state.tangent = null; els.tangentInfo.textContent = ''; }
    if (state.selectedId === id) selectFn(state.fns.length ? state.fns[0].id : null);
    renderEmpty();
    renderPlot();
  }

  function selectFn(id) {
    state.selectedId = id;
    for (const f of state.fns) f.el.classList.toggle('selected', f.id === id);
    const sf = selectedFn();
    if (sf) log('info', T.t('log.info.select', { label: fnLabel(sf) }), sf.src || T.t('fn.emptySrc'));
    computeAnalysis();
  }

  function tryParseFn(f, initial) {
    const src = f.src.trim();
    if (!src) { f.ast = null; f.err = null; f.errEl.textContent = ''; renderPlot(); return true; }
    try {
      f.ast = E.parse(src);
      f.err = null;
      f.errEl.textContent = '';
      f.lastErrMsg = null;
      if (initial) logParseResult(f, '解析');
    } catch (e) {
      f.ast = null;
      f.err = e; // 存错误对象：code/vars 留给 errorText 做多语言
      f.errEl.textContent = errorText(e);
      if (initial) logParseResult(f, '解析');
      else {
        const msg = errorText(e);
        if (msg !== f.lastErrMsg) {
          log('warn', T.t('log.warn.badInput', { label: fnLabel(f) }), msg);
          f.lastErrMsg = msg;
        }
      }
    }
    renderPlot();
    if (f.id === state.selectedId) computeAnalysis();
    return !f.err;
  }

  function buildFnRow(f) {
    const li = document.createElement('li');
    li.className = 'fn-row selected';
    li.style.setProperty('--fn-color', f.color);

    const id = document.createElement('span');
    id.className = 'fn-id';
    const dot = document.createElement('i');
    dot.className = 'fn-dot';
    const label = document.createElement('span');
    label.className = 'fn-label';
    label.textContent = 'f' + SUBSCRIPTS[state.fns.indexOf(f)];
    id.appendChild(dot);
    id.appendChild(label);

    const main = document.createElement('span');
    main.className = 'fn-main';
    const input = document.createElement('input');
    input.className = 'fn-input';
    input.type = 'text';
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.placeholder = T.t('fn.placeholder');
    input.value = f.src;
    const errEl = document.createElement('span');
    errEl.className = 'fn-err';
    errEl.hidden = true;
    main.appendChild(input);
    main.appendChild(errEl);

    const side = document.createElement('span');
    side.className = 'fn-side';
    const actions = document.createElement('span');
    actions.className = 'fn-actions';

    const eyeBtn = document.createElement('button');
    eyeBtn.type = 'button';
    eyeBtn.className = 'btn-icon active';
    eyeBtn.title = '显示 / 隐藏这条曲线';
    eyeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/></svg>';
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-icon';
    delBtn.title = '删除这条函数';
    delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    actions.appendChild(eyeBtn);
    actions.appendChild(delBtn);
    side.appendChild(actions);

    li.appendChild(id);
    li.appendChild(main);
    li.appendChild(side);

    input.addEventListener('input', function () {
      f.src = input.value;
      if (f.src.trim()) {
        const ok = tryParseFn(f);
        errEl.hidden = !f.err;
        if (ok) errEl.hidden = true;
      } else {
        f.ast = null; f.err = null; errEl.hidden = true; renderPlot();
      }
    });
    input.addEventListener('keydown', function (e) {
      // 回车 = 失焦，保存日志由 blur 统一记一次
      if (e.key === 'Enter') input.blur();
    });
    input.addEventListener('blur', function () {
      if (f.src.trim() && !f.err) logParseResult(f, '保存');
    });
    input.addEventListener('click', function (e) { e.stopPropagation(); selectFn(f.id); });

    eyeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      f.visible = !f.visible;
      li.classList.toggle('dim', !f.visible);
      eyeBtn.classList.toggle('active', f.visible);
      log('info', T.t(f.visible ? 'log.info.show' : 'log.info.hide', { label: fnLabel(f) }), f.src || T.t('fn.emptySrc'));
      renderPlot();
    });
    delBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      li.remove();
      removeFn(f.id);
    });

    li.addEventListener('click', function () { selectFn(f.id); });

    f.el = li;
    f.errEl = errEl;
    els.fnList.appendChild(li);
  }

  function renderEmpty() {
    els.fnEmpty.hidden = state.fns.length > 0;
    els.addFn.disabled = state.fns.length >= MAX_FNS;
    els.fnCount.textContent = state.fns.length + ' / ' + MAX_FNS + ' 条';
  }

  /* ---------- 计算日志（终端窗口，与 image-metadata-cleaner 同形态） ---------- */

  const logBus = window.createLogBus ? window.createLogBus() : null;
  const fmtLog = window.formatLogLine;

  function log(level, text, detail) {
    if (!logBus) return;
    logBus[level](text, detail);
  }

  if (logBus) {
    logBus.subscribe(function (line) {
      const empty = els.logBody.querySelector('.log-empty');
      if (empty) empty.remove();
      if (!line) return;
      const div = document.createElement('div');
      div.className = 'log-line log-lv-' + line.level;
      div.textContent = fmtLog(line);
      els.logBody.appendChild(div);
      els.logBody.scrollTop = els.logBody.scrollHeight;
      // 与 IMC 一致：环形缓冲满时丢弃最旧行（bus 已截断，这里同步 DOM）
      while (els.logBody.children.length > 500) els.logBody.firstChild.remove();
      els.logCount.textContent = String(logBus.getLines().length);
    });
  }

  els.logClear.addEventListener('click', function () {
    if (!logBus) return;
    logBus.clear();
    els.logBody.innerHTML = '';
    els.logCount.textContent = '0';
    const p = document.createElement('p');
    p.className = 'log-empty';
    p.textContent = T.t('log.empty');
    els.logBody.appendChild(p);
  });

  els.logToggle.addEventListener('click', function () {
    const collapsed = els.logBody.hasAttribute('hidden');
    if (collapsed) {
      els.logBody.removeAttribute('hidden');
      els.logToggle.setAttribute('aria-expanded', 'true');
    } else {
      els.logBody.setAttribute('hidden', '');
      els.logToggle.setAttribute('aria-expanded', 'false');
    }
    updateLogToggleLabel();
  });

  function fnLabel(f) {
    return 'f' + SUBSCRIPTS[state.fns.indexOf(f)];
  }

  /* ---------- 绘图 ---------- */

  function plotFns() {
    const list = visibleFns().map(function (f, i) {
      return {
        fn: function (x) { return E.evaluate(f.ast, x); },
        color: f.color,
        width: 2.2
      };
    });
    // 选中函数的导函数叠加（虚线，同色）
    if (state.showDeriv) {
      const sf = selectedFn();
      if (sf && sf.ast) {
        try {
          const d = E.derivativeOf(sf.src, state.order);
          list.push({
            fn: function (x) { return E.evaluate(d.result, x); },
            color: sf.color,
            width: 1.7,
            dash: [7, 5]
          });
        } catch (e) { /* 不可导就跳过 */ }
      }
    }
    return list;
  }

  function renderPlot() {
    const fns = plotFns();
    // 图例
    els.legend.innerHTML = '';
    visibleFns().forEach(function (f, i) {
      const l = document.createElement('span');
      l.className = 'legend';
      const iEl = document.createElement('i');
      iEl.style.background = f.color;
      const label = 'f' + SUBSCRIPTS[state.fns.indexOf(f)];
      l.appendChild(iEl);
      l.appendChild(document.createTextNode(label));
      els.legend.appendChild(l);
    });
    if (state.showDeriv && selectedFn()) {
      const l = document.createElement('span');
      l.className = 'legend';
      const iEl = document.createElement('i');
      iEl.style.color = selectedFn().color;
      iEl.className = 'dash';
      l.appendChild(iEl);
      l.appendChild(document.createTextNode(T.t('legend.curDeriv')));
      els.legend.appendChild(l);
    }
    if (state.tangent) {
      const l = document.createElement('span');
      l.className = 'legend';
      const iEl = document.createElement('i');
      iEl.style.color = 'var(--text-3)';
      iEl.className = 'dash';
      l.appendChild(iEl);
      l.appendChild(document.createTextNode(T.t('legend.tangent')));
      els.legend.appendChild(l);
    }
    Plot.render(els.plot, {
      fns: fns,
      view: state.view,
      tangent: state.tangent,
      hover: state.hover
    });
  }

  function hoverInfo(x) {
    const fns = visibleFns();
    if (!fns.length) { els.tooltip.classList.remove('show'); return; }
    let rows = '<span class="tt-x">x = ' + fmtVal(x) + '</span>';
    for (const f of fns) {
      const y = E.evaluate(f.ast, x);
      rows += '<span class="tt-row"><i style="background:' + f.color + '"></i><span>f' +
        SUBSCRIPTS[state.fns.indexOf(f)] + ' = <b>' + fmtVal(y) + '</b></span></span>';
    }
    els.tooltip.innerHTML = rows;
    els.tooltip.classList.add('show');
    const w = els.plot.parentElement.clientWidth;
    const ratio = (x - state.view.xmin) / (state.view.xmax - state.view.xmin);
    const tw = els.tooltip.offsetWidth || 150;
    const left = Math.min(Math.max(ratio * w - tw / 2, 6), w - tw - 6);
    els.tooltip.style.left = left + 'px';
  }

  function hoverClear() {
    state.hover = null;
    els.tooltip.classList.remove('show');
    renderPlot();
  }

  /* ---------- 分析（求导 / 切线） ---------- */

  function computeAnalysis() {
    const sf = selectedFn();
    els.derivToggle.classList.toggle('active', state.showDeriv);
    els.derivToggle.disabled = !sf || !sf.ast;
    els.tangentBtn.disabled = !sf || !sf.ast;
    if (!sf) {
      els.anTitle.textContent = T.t('analyze.default');
      els.resultLabel.textContent = "f'n(x)";
      els.resultMath.innerHTML = '';
      els.resultHint.textContent = T.t('analyze.noFn');
      els.resultHint.hidden = false;
      els.stepsCard.hidden = true;
      els.resultLabel.style.color = 'var(--text-2)';
      state.tangent = null;
      els.tangentInfo.textContent = '';
      renderPlot();
      return;
    }
    const label = 'f' + SUBSCRIPTS[state.fns.indexOf(sf)];
    els.anTitle.textContent = T.t('analyze.title', { label: label, src: sf.src });
    const sub = SUBSCRIPTS[state.fns.indexOf(sf)];
    const prime = state.order === 1 ? '′' : state.order === 2 ? '″' : state.order === 3 ? '‴' : '⁽' + state.order + '⁾';
    els.resultLabel.textContent = 'f' + sub + prime + '(x)';
    els.resultLabel.style.color = sf.color;
    els.resultHint.hidden = true;

    if (!sf.ast) {
      els.resultMath.innerHTML = '';
      els.resultHint.textContent = T.t('analyze.badFn');
      els.resultHint.hidden = false;
      els.stepsCard.hidden = true;
      return;
    }

    let r;
    try {
      r = E.derivativeOf(sf.src, state.order);
    } catch (e) {
      els.resultMath.innerHTML = '';
      els.resultHint.textContent = errorText(e);
      els.resultHint.hidden = false;
      els.stepsCard.hidden = true;
      log('warn', T.t('log.warn.derivFail', { label: label }), errorText(e));
      return;
    }
    els.resultMath.innerHTML = '= ' + E.toHTML(r.result).s;
    log('ok', T.t('log.ok.deriv', { label: label }), T.t('d.order', { n: r.order }) + ' → ' + E.toText(r.result));
    renderSteps(r.steps);
    // 切线可画性检查
    if (state.tangent) applyTangent(state.tangent.a);
    renderPlot();
  }

  function renderSteps(steps) {
    els.stepsList.innerHTML = '';
    if (!steps || !steps.length) { els.stepsCard.hidden = true; return; }
    els.stepsCard.hidden = false;
    const frag = document.createDocumentFragment();
    const max = 30;
    steps.slice(0, max).forEach(function (s, i) {
      const li = document.createElement('li');
      const rule = document.createElement('span');
      rule.className = 'step-rule';
      rule.textContent = (i + 1) + '. ' + (RULE_KEYS[s.rule] ? T.t(RULE_KEYS[s.rule]) : s.rule);
      const eq = document.createElement('div');
      eq.className = 'step-eq';
      eq.innerHTML = '<span class="ddx"><i>d</i>/<i>dx</i></span><span class="paren">[</span>' +
        E.toHTML(s.src).s + '<span class="paren">]</span><span class="op"> = </span>' + E.toHTML(s.tpl).s;
      li.appendChild(rule);
      li.appendChild(eq);
      frag.appendChild(li);
    });
    els.stepsList.appendChild(frag);
    if (steps.length > max) {
      const li = document.createElement('li');
      li.className = 'step-more';
      li.textContent = T.t('steps.more', { n: steps.length - max });
      els.stepsList.appendChild(li);
    }
  }

  function applyTangent(aRaw) {
    const sf = selectedFn();
    if (!sf || !sf.ast) return;
    let a;
    try { a = E.evaluate(E.parse(String(aRaw)), 0); } catch (e) {
      els.tangentInfo.textContent = '切点 x = "' + aRaw + '" 不是有效的表达式';
      state.tangent = null;
      return;
    }
    if (!isFinite(a)) { els.tangentInfo.textContent = '切点 x 必须是一个确定的数'; state.tangent = null; return; }
    let k;
    try { k = E.evaluate(E.derivativeOf(sf.src, 1).result, a); } catch (e) {
      log('warn', T.t('log.warn.tangentFail', { label: fnLabel(sf) }), errorText(e));
      els.tangentInfo.textContent = e.message; state.tangent = null; renderPlot(); return;
    }
    const y0 = E.evaluate(sf.ast, a);
    if (!isFinite(y0) || !isFinite(k)) {
      log('warn', T.t('log.warn.tangentFail', { label: fnLabel(sf) }), T.t('log.warn.tangentPoint', { a: fmtVal(a) }));
      els.tangentInfo.textContent = '函数在 x = ' + fmtVal(a) + ' 处没有定义，无法作切线';
      state.tangent = null;
      renderPlot();
      return;
    }
    const b = y0 - k * a;
    state.tangent = { a: a, k: k, b: b, y0: y0 };
    let eqText;
    if (Math.abs(k) < 1e-12) eqText = 'y = ' + fmtVal(b);
    else {
      eqText = 'y = ' + (Math.abs(1 - k) < 1e-12 ? '' : (Math.abs(-1 - k) < 1e-12 ? '−' : fmtVal(k))) + 'x';
      if (Math.abs(b) > 1e-12) eqText += (b > 0 ? ' + ' : ' − ') + fmtVal(Math.abs(b));
    }
    log('ok', T.t('log.ok.tangent', { label: fnLabel(sf) }), 'x₀ = ' + fmtVal(a) + ' → ' + eqText);
    els.tangentInfo.innerHTML = T.t('tangent.result', {
      a: fmtVal(a), y0: fmtVal(y0), k: fmtVal(k), eq: eqText
    });
    renderPlot();
  }

  /* ---------- 视图交互 ---------- */

  let lastViewLog = 0;

  function logViewChange() {
    const now = Date.now();
    if (now - lastViewLog < 400) return; // 缩放/平移是连续动作，节流避免刷屏
    lastViewLog = now;
    const v = state.view;
    log('info', T.t('log.info.view'), 'x∈[' + parseFloat(v.xmin.toFixed(2)) + ', ' + parseFloat(v.xmax.toFixed(2)) + ']');
  }

  function zoom(factor, cx) {
    const v = state.view;
    const span = v.xmax - v.xmin;
    const center = cx === undefined ? (v.xmin + v.xmax) / 2 : cx;
    let ns = span * factor;
    ns = Math.min(Math.max(ns, 1e-3), 1e7);
    const ratio = (center - v.xmin) / span;
    v.xmin = center - ns * ratio;
    v.xmax = center + ns * (1 - ratio);
    logViewChange();
    renderPlot();
  }

  function resetView() {
    state.view = { xmin: state.defaultView.xmin, xmax: state.defaultView.xmax };
    log('cmd', T.t('log.cmd.viewReset'), 'x∈[' + parseFloat(state.view.xmin.toFixed(2)) + ', ' + parseFloat(state.view.xmax.toFixed(2)) + ']');
    renderPlot();
  }

  /* ---------- 事件绑定 ---------- */

  els.addFn.addEventListener('click', function () { addFunction(''); });

  els.lib.addEventListener('click', function (e) {
    const chip = e.target.closest('[data-expr]');
    if (!chip) return;
    addFunction(chip.getAttribute('data-expr'));
  });

  els.orderMinus.addEventListener('click', function () { setOrder(state.order - 1); });
  els.orderPlus.addEventListener('click', function () { setOrder(state.order + 1); });

  function setOrder(n) {
    state.order = Math.max(1, Math.min(8, n));
    els.orderVal.textContent = state.order;
    log('cmd', T.t('log.cmd.order'), T.t('d.order', { n: state.order }));
    computeAnalysis();
  }

  els.copyBtn.addEventListener('click', function () {
    const sf = selectedFn();
    if (!sf || !sf.ast) return;
    let text;
    try { text = E.toText(E.derivativeOf(sf.src, state.order).result); } catch (e) { showToast('当前函数不可导'); return; }
    const done = function () { showToast(T.t('d.copyDone', { text: text })); log('cmd', T.t('log.cmd.copy'), text); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { showToast(T.t('d.copyFail')); });
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { showToast(T.t('d.copyFail')); }
      document.body.removeChild(ta);
    }
  });

  els.derivToggle.addEventListener('click', function () {
    state.showDeriv = !state.showDeriv;
    els.derivToggle.classList.toggle('active', state.showDeriv);
    log('cmd', T.t('log.cmd.overlay'), T.t(state.showDeriv ? 'state.on' : 'state.off'));
    renderPlot();
  });

  els.zoomIn.addEventListener('click', function () { zoom(1 / 1.25); });
  els.zoomOut.addEventListener('click', function () { zoom(1.25); });
  els.zoomReset.addEventListener('click', resetView);
  els.plot.addEventListener('dblclick', resetView);

  els.plot.addEventListener('wheel', function (e) {
    e.preventDefault();
    const rect = els.plot.getBoundingClientRect();
    const x = state.view.xmin + ((e.clientX - rect.left) / rect.width) * (state.view.xmax - state.view.xmin);
    zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, x);
  }, { passive: false });

  els.plot.addEventListener('pointerdown', function (e) {
    state.dragging = true;
    els.plot.setPointerCapture(e.pointerId);
  });
  els.plot.addEventListener('pointermove', function (e) {
    const rect = els.plot.getBoundingClientRect();
    const x = state.view.xmin + ((e.clientX - rect.left) / rect.width) * (state.view.xmax - state.view.xmin);
    if (state.dragging) {
      const v = state.view;
      const span = v.xmax - v.xmin;
      v.xmin -= ((e.clientX - dragLast.x) / rect.width) * span;
      v.xmax -= ((e.clientX - dragLast.x) / rect.width) * span;
      dragLast.x = e.clientX;
      logViewChange();
    } else {
      dragLast.x = e.clientX;
    }
    state.hover = { x: x };
    hoverInfo(x);
    renderPlot();
  });
  els.plot.addEventListener('pointerup', function () { state.dragging = false; });
  els.plot.addEventListener('pointercancel', function () { state.dragging = false; });
  els.plot.addEventListener('pointerleave', function () { if (!state.dragging) hoverClear(); });

  els.tangentBtn.addEventListener('click', function () {
    const raw = els.tangentX.value.trim();
    if (!raw) { state.tangent = null; els.tangentInfo.textContent = ''; renderPlot(); return; }
    applyTangent(raw);
  });
  els.tangentClear.addEventListener('click', function () {
    state.tangent = null;
    els.tangentInfo.textContent = '';
    log('cmd', T.t('log.cmd.tangentClear'), '');
    renderPlot();
  });
  els.tangentX.addEventListener('keydown', function (e) { if (e.key === 'Enter') els.tangentBtn.click(); });

  if ('ResizeObserver' in window) {
    new ResizeObserver(function () { renderPlot(); }).observe(els.plot);
  }
  window.addEventListener('resize', renderPlot);

  /* ---------- 语言切换 ---------- */

  function updateLogToggleLabel() {
    els.logToggle.textContent = els.logBody.hasAttribute('hidden') ? T.t('log.expand') : T.t('log.collapse');
  }

  function rerenderDynamic() {
    for (const f of state.fns) {
      if (f.el) f.el.querySelector('.fn-input').placeholder = T.t('fn.placeholder');
    }
    updateLogToggleLabel();
    computeAnalysis();
    renderPlot();
  }

  T.onLangChange(rerenderDynamic);

  $('langBtn').addEventListener('click', function () {
    T.setLang(T.getLang() === 'zh' ? 'en' : 'zh');
    T.applyI18n();
    updateLogToggleLabel();
  });

  /* ---------- 启动 ---------- */

  T.setLang(T.detectLang());
  T.applyI18n();
  log('cmd', T.t('log.cmd.open'), T.t('log.cmd.openDetail', { n: 3 }));
  addFunction('sin(x)', true);
  addFunction('x^2/8 - 1.5', true);
  addFunction('e^(-x^2)', true);
  selectFn(state.fns[0].id);
  renderEmpty();

  if (window.revealAll) window.revealAll();
})();
