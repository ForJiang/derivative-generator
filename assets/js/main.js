/*
 * 导函数生成器 - 界面逻辑
 */
(function () {
  'use strict';
  const E = window.DerivEngine;
  const Plot = window.DerivPlot;

  const $ = function (id) { return document.getElementById(id); };
  const els = {
    fx: $('fx'), go: $('go'), examples: $('examples'), err: $('err'),
    orderVal: $('orderVal'), orderMinus: $('orderMinus'), orderPlus: $('orderPlus'),
    inputPretty: $('inputPretty'),
    resultLabel: $('resultLabel'), resultMath: $('resultMath'), copyBtn: $('copyBtn'),
    stepsCard: $('stepsCard'), stepsList: $('stepsList'),
    plot: $('plot'), zoomIn: $('zoomIn'), zoomOut: $('zoomOut'), zoomReset: $('zoomReset'),
    legendDf: $('legendDf'),
    tangentX: $('tangentX'), tangentBtn: $('tangentBtn'), tangentInfo: $('tangentInfo'),
    tooltip: $('tooltip'), plotWrap: $('plotWrap')
  };

  const COLOR_F = '#38bdf8';
  const COLOR_DF = '#fb923c';

  const state = {
    src: 'sin(x)·x^2',
    order: 1,
    view: { xmin: -6, xmax: 6 },
    defaultView: { xmin: -6, xmax: 6 },
    tangent: null,       // {a, k, b, y0}
    hover: null,         // {x}
    ast: null,           // 原函数 AST
    dast: null,          // 当前阶导函数 AST
    d1: null,            // 一阶导函数 AST
    dragging: false
  };

  const ORDER_LABELS = { 1: 'f′(x)', 2: 'f″(x)', 3: 'f‴(x)', 4: 'f⁽⁴⁾(x)', 5: 'f⁽⁵⁾(x)', 6: 'f⁽⁶⁾(x)', 7: 'f⁽⁷⁾(x)', 8: 'f⁽⁸⁾(x)' };

  function fmtVal(v) {
    if (!isFinite(v)) return '未定义';
    if (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-4 && v !== 0)) return v.toExponential(3);
    return String(parseFloat(v.toFixed(4)));
  }

  function showError(msg) {
    els.err.textContent = msg;
    els.err.classList.add('show');
  }
  function clearError() {
    els.err.textContent = '';
    els.err.classList.remove('show');
  }

  /* ---------- 主计算 ---------- */
  function compute(src, order) {
    clearError();
    let r;
    try {
      r = E.derivativeOf(src, order);
    } catch (e) {
      showError(e.message || '解析失败');
      return false;
    }
    state.src = src;
    state.ast = r.chain[0].ast;
    state.dast = r.result;
    state.d1 = r.chain[1].ast; // 一阶导，切线永远用它

    // 输入的排版
    els.inputPretty.innerHTML = 'f(x) = ' + E.toHTML(r.chain[0].ast).s;

    // 结果
    els.resultLabel.textContent = ORDER_LABELS[r.order] || "f'(x)";
    els.resultMath.innerHTML = '= ' + E.toHTML(r.result).s;
    els.legendDf.textContent = ORDER_LABELS[r.order] || 'f′(x)';

    // 步骤
    renderSteps(r.steps);

    // 绘图与切线（切线依赖新导函数，重算）
    if (state.tangent) applyTangent(state.tangent.a);
    renderPlot();
    return true;
  }

  function renderSteps(steps) {
    els.stepsList.innerHTML = '';
    if (!steps || !steps.length) {
      els.stepsCard.classList.add('hidden');
      return;
    }
    els.stepsCard.classList.remove('hidden');
    const frag = document.createDocumentFragment();
    const max = 30;
    steps.slice(0, max).forEach(function (s, i) {
      const li = document.createElement('li');
      const eq = document.createElement('div');
      eq.className = 'step-eq';
      eq.innerHTML = '<span class="ddx"><i>d</i>/<i>dx</i></span><span class="paren">[</span>' +
        E.toHTML(s.src).s + '<span class="paren">]</span><span class="op"> = </span>' + E.toHTML(s.tpl).s;
      const rule = document.createElement('span');
      rule.className = 'step-rule';
      rule.textContent = (i + 1) + '. ' + s.rule;
      li.appendChild(rule);
      li.appendChild(eq);
      frag.appendChild(li);
    });
    els.stepsList.appendChild(frag);
    if (steps.length > max) {
      const li = document.createElement('li');
      li.className = 'step-more';
      li.textContent = '……其余 ' + (steps.length - max) + ' 步从略';
      els.stepsList.appendChild(li);
    }
  }

  /* ---------- 绘图 ---------- */
  function renderPlot() {
    if (!state.ast) return;
    const f = function (x) { return E.evaluate(state.ast, x); };
    const df = function (x) { return E.evaluate(state.dast, x); };
    Plot.render(els.plot, {
      fns: [
        { fn: f, color: COLOR_F, width: 2.2 },
        { fn: df, color: COLOR_DF, width: 1.8 }
      ],
      view: state.view,
      tangent: state.tangent,
      hover: state.hover
    });
  }

  function hoverInfo(x) {
    if (!state.ast) return;
    const y = E.evaluate(state.ast, x);
    const dy = E.evaluate(state.dast, x);
    if (!isFinite(y) && !isFinite(dy)) { els.tooltip.classList.remove('show'); return; }
    els.tooltip.innerHTML =
      '<span class="tt-x">x = ' + fmtVal(x) + '</span>' +
      '<span><i style="background:' + COLOR_F + '"></i>f(x) = ' + fmtVal(y) + '</span>' +
      '<span><i style="background:' + COLOR_DF + '"></i>' + (ORDER_LABELS[state.order] || 'f′(x)') + ' = ' + fmtVal(dy) + '</span>';
    els.tooltip.classList.add('show');
    const w = els.plotWrap.clientWidth;
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

  /* ---------- 切线 ---------- */
  function applyTangent(aRaw) {
    let a;
    try {
      a = E.evaluate(E.parse(String(aRaw)), 0);
    } catch (e) {
      els.tangentInfo.textContent = '切点 x = "…": ' + (e.message || '无法解析');
      state.tangent = null;
      return;
    }
    if (!isFinite(a)) {
      els.tangentInfo.textContent = '切点 x 必须是一个确定的数';
      state.tangent = null;
      return;
    }
    const y0 = E.evaluate(state.ast, a);
    const k = E.evaluate(state.d1, a); // 切线斜率永远是一阶导
    if (!isFinite(y0) || !isFinite(k)) {
      els.tangentInfo.textContent = 'f(x) 在 x = ' + fmtVal(a) + ' 处没有定义，无法作切线';
      state.tangent = null;
      return;
    }
    const b = y0 - k * a;
    state.tangent = { a: a, k: k, b: b, y0: y0 };
    let eqText;
    if (Math.abs(k) < 1e-12) eqText = 'y = ' + fmtVal(b);
    else {
      eqText = 'y = ' + (Math.abs(k - 1) < 1e-12 ? '' : (Math.abs(k + 1) < 1e-12 ? '−' : fmtVal(k))) + 'x';
      if (k === 0) eqText = 'y = ' + fmtVal(b);
      if (Math.abs(b) > 1e-12) eqText += (b > 0 ? ' + ' : ' − ') + fmtVal(Math.abs(b));
    }
    els.tangentInfo.innerHTML =
      '切点 <span class="math-inline">(x₀, y₀) = (' + fmtVal(a) + ', ' + fmtVal(y0) + ')</span>，斜率 k = f′(' + fmtVal(a) + ') = ' + fmtVal(k) +
      '<br>切线方程：<span class="math-inline strong">' + eqText + '</span>';
  }

  /* ---------- 交互绑定 ---------- */
  let debounceTimer = null;
  function onInputChanged(immediate) {
    clearTimeout(debounceTimer);
    const run = function () {
      const src = els.fx.value.trim();
      if (!src) { clearError(); return; }
      compute(src, state.order);
    };
    if (immediate) run();
    else debounceTimer = setTimeout(run, 450);
  }

  els.fx.addEventListener('input', function () { onInputChanged(false); });
  els.fx.addEventListener('keydown', function (e) { if (e.key === 'Enter') onInputChanged(true); });
  els.go.addEventListener('click', function () { onInputChanged(true); els.fx.blur(); });

  els.examples.addEventListener('click', function (e) {
    const chip = e.target.closest('[data-expr]');
    if (!chip) return;
    els.fx.value = chip.getAttribute('data-expr');
    state.view = { xmin: -6, xmax: 6 };
    onInputChanged(true);
  });

  function setOrder(n) {
    state.order = Math.max(1, Math.min(8, n));
    els.orderVal.textContent = state.order;
    onInputChanged(true);
  }
  els.orderMinus.addEventListener('click', function () { setOrder(state.order - 1); });
  els.orderPlus.addEventListener('click', function () { setOrder(state.order + 1); });

  els.copyBtn.addEventListener('click', function () {
    if (!state.dast) return;
    const text = E.toText(state.dast);
    const done = function () {
      const tip = els.copyBtn;
      const old = tip.textContent;
      tip.textContent = '✓ 已复制';
      setTimeout(function () { tip.textContent = old; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  });
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
    document.body.removeChild(ta);
  }

  // 缩放 / 重置
  function zoom(factor, cx) {
    const v = state.view;
    const span = v.xmax - v.xmin;
    const center = cx === undefined ? (v.xmin + v.xmax) / 2 : cx;
    let ns = span * factor;
    ns = Math.min(Math.max(ns, 1e-3), 1e6);
    const ratio = (center - v.xmin) / span;
    v.xmin = center - ns * ratio;
    v.xmax = center + ns * (1 - ratio);
    renderPlot();
  }
  els.zoomIn.addEventListener('click', function () { zoom(0.7); });
  els.zoomOut.addEventListener('click', function () { zoom(1 / 0.7); });
  els.zoomReset.addEventListener('click', function () {
    state.view = { xmin: state.defaultView.xmin, xmax: state.defaultView.xmax };
    renderPlot();
  });
  els.plot.addEventListener('wheel', function (e) {
    e.preventDefault();
    const rect = els.plot.getBoundingClientRect();
    const x = state.view.xmin + ((e.clientX - rect.left) / rect.width) * (state.view.xmax - state.view.xmin);
    zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, x);
  }, { passive: false });
  els.plot.addEventListener('dblclick', function () {
    state.view = { xmin: state.defaultView.xmin, xmax: state.defaultView.xmax };
    renderPlot();
  });

  // 拖拽平移 + 悬停
  let dragLast = null;
  els.plot.addEventListener('pointerdown', function (e) {
    dragLast = e.clientX;
    state.dragging = true;
    els.plot.setPointerCapture(e.pointerId);
  });
  els.plot.addEventListener('pointermove', function (e) {
    const rect = els.plot.getBoundingClientRect();
    const x = state.view.xmin + ((e.clientX - rect.left) / rect.width) * (state.view.xmax - state.view.xmin);
    if (state.dragging && dragLast !== null) {
      const dx = ((e.clientX - dragLast) / rect.width) * (state.view.xmax - state.view.xmin);
      state.view.xmin -= dx;
      state.view.xmax -= dx;
      dragLast = e.clientX;
      state.hover = { x: x };
      hoverInfo(x);
      renderPlot();
      return;
    }
    state.hover = { x: x };
    hoverInfo(x);
    renderPlot();
  });
  els.plot.addEventListener('pointerup', function (e) {
    state.dragging = false;
    dragLast = null;
  });
  els.plot.addEventListener('pointerleave', function () {
    if (!state.dragging) hoverClear();
  });
  els.plot.addEventListener('pointercancel', function () {
    state.dragging = false;
    dragLast = null;
  });

  // 切线
  els.tangentBtn.addEventListener('click', function () {
    if (!state.ast) return;
    const raw = els.tangentX.value.trim();
    if (!raw) { state.tangent = null; els.tangentInfo.textContent = ''; renderPlot(); return; }
    applyTangent(raw);
    renderPlot();
  });
  els.tangentX.addEventListener('keydown', function (e) { if (e.key === 'Enter') els.tangentBtn.click(); });

  if ('ResizeObserver' in window) {
    new ResizeObserver(function () { renderPlot(); }).observe(els.plot);
  }
  window.addEventListener('resize', renderPlot);

  /* ---------- 启动 ---------- */
  setOrder(1);
  onInputChanged(true);
})();
