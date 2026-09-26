/*
 * 导函数生成器 - Canvas 函数绘图
 * 全局对象 window.DerivPlot.render(canvas, opts)
 * opts: { fns: [{fn, color, width}], view:{xmin,xmax}, tangent:{a,k,b}|null, hover:{x}|null }
 * 自适应 y 范围（分位数），自动处理间断/渐近线断笔。
 */
(function () {
  'use strict';

  const SAMPLES = 900;
  const BG = '#0d1524';
  const GRID = 'rgba(148, 163, 184, 0.13)';
  const GRID_STRONG = 'rgba(148, 163, 184, 0.28)';
  const TEXT = 'rgba(203, 213, 225, 0.75)';

  function niceStep(span, target) {
    const raw = span / target;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    let step;
    if (norm < 1.5) step = 1;
    else if (norm < 3.5) step = 2;
    else if (norm < 7.5) step = 5;
    else step = 10;
    return step * mag;
  }

  function fmtTick(v, step) {
    if (Math.abs(v) < 1e-12) v = 0;
    const digits = Math.max(0, -Math.floor(Math.log10(step)) + (step < 1 ? 0 : 0));
    let s = v.toFixed(Math.min(6, Math.max(0, digits)));
    s = parseFloat(s).toPrecision(10);
    s = String(parseFloat(s));
    return s;
  }

  // 采样并返回 {xs, ys}，间断处 y 为 NaN
  function sample(fn, xmin, xmax) {
    const xs = new Float64Array(SAMPLES + 1);
    const ys = new Float64Array(SAMPLES + 1);
    for (let i = 0; i <= SAMPLES; i++) {
      const x = xmin + ((xmax - xmin) * i) / SAMPLES;
      let y;
      try { y = fn(x); } catch (e) { y = NaN; }
      xs[i] = x;
      ys[i] = typeof y === 'number' && isFinite(y) ? y : NaN;
    }
    return { xs, ys };
  }

  function autoYRange(results) {
    const all = [];
    for (const r of results) {
      for (let i = 0; i < r.ys.length; i++) {
        const y = r.ys[i];
        if (isFinite(y)) all.push(y);
      }
    }
    if (!all.length) return { ymin: -5, ymax: 5 };
    all.sort(function (a, b) { return a - b; });
    // 箱线图胡须法：5%/95% 分位为四分位，1.5×IQR 内的最远点纳入范围，
    // 真实峰值不丢，渐近线附近的极端毛刺排除
    const q1 = all[Math.floor(all.length * 0.05)];
    const q3 = all[Math.ceil(all.length * 0.95) - 1];
    let iqr = q3 - q1;
    const med = all[Math.floor(all.length / 2)];
    if (!isFinite(iqr) || iqr < 1e-9) {
      const base = isFinite(med) ? med : 0;
      return { ymin: base - 1, ymax: base + 1 };
    }
    const hiBound = q3 + 1.5 * iqr;
    const loBound = q1 - 1.5 * iqr;
    let ymin = q1, ymax = q3;
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i] <= hiBound) { ymax = all[i]; break; }
    }
    for (let i = 0; i < all.length; i++) {
      if (all[i] >= loBound) { ymin = all[i]; break; }
    }
    if (!isFinite(ymin) || !isFinite(ymax) || ymax - ymin < 1e-9) {
      const base = isFinite(med) ? med : 0;
      ymin = base - 1; ymax = base + 1;
    }
    const pad = (ymax - ymin) * 0.12 + 1e-9;
    ymin -= pad; ymax += pad;
    const lim = 1e6;
    if (Math.abs(ymin) > lim) ymin = ymin > 0 ? lim : -lim;
    if (Math.abs(ymax) > lim) ymax = ymax > 0 ? lim : -lim;
    return { ymin, ymax };
  }

  function drawCurve(ctx, r, mapX, mapY, ymin, ymax, color, width, dash) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    let pen = false;
    let prevY = NaN;
    let prevPx = NaN, prevPy = NaN;
    const span = ymax - ymin;
    const cssH = ctx.canvas.height / (window.devicePixelRatio || 1);
    for (let i = 0; i < r.xs.length; i++) {
      const y = r.ys[i];
      if (!isFinite(y) || y < ymin - span * 2 || y > ymax + span * 2) { pen = false; prevY = y; prevPx = NaN; continue; }
      const px = mapX(r.xs[i]), py = mapY(y);
      if (pen && isFinite(prevY)) {
        // 渐近线：相邻两点跳变远超画面且异号；阶梯跳变：近乎竖直的突跳（floor/ceil/sign）
        const asymptote = Math.abs(y - prevY) > span * 1.5 && y * prevY < 0;
        const steepJump = Math.abs(py - prevPy) > cssH * 0.05 && Math.abs(py - prevPy) > 20 * Math.abs(px - prevPx) + 2;
        if (asymptote || steepJump) pen = false;
      }
      if (!pen) { ctx.moveTo(px, py); pen = true; }
      else ctx.lineTo(px, py);
      prevY = y; prevPx = px; prevPy = py;
    }
    ctx.stroke();
    if (dash) ctx.setLineDash([]);
  }

  function render(canvas, opts) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || canvas.parentElement.clientWidth || 640;
    const cssH = canvas.clientHeight || 320;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, cssW, cssH);

    const xmin = opts.view.xmin, xmax = opts.view.xmax;
    const results = opts.fns.map(function (f) {
      return sample(f.fn, xmin, xmax);
    });
    const range = autoYRange(results);
    const ymin = range.ymin, ymax = range.ymax;

    const mapX = function (x) { return ((x - xmin) / (xmax - xmin)) * cssW; };
    const mapY = function (y) { return cssH - ((y - ymin) / (ymax - ymin)) * cssH; };

    // 网格
    const stepX = niceStep(xmax - xmin, Math.max(4, Math.round(cssW / 90)));
    const stepY = niceStep(ymax - ymin, Math.max(3, Math.round(cssH / 70)));
    ctx.lineWidth = 1;
    ctx.font = '11px -apple-system, "PingFang SC", sans-serif';

    const x0 = Math.ceil(xmin / stepX) * stepX;
    ctx.strokeStyle = GRID;
    ctx.fillStyle = TEXT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const yAxisPx = mapY(0), xAxisPx = mapX(0);
    const yLabelsTop = yAxisPx < 12 || yAxisPx > cssH - 16;
    for (let x = x0, guard = 0; x <= xmax && guard < 200; x += stepX, guard++) {
      const px = mapX(x);
      ctx.beginPath();
      ctx.moveTo(px, 0); ctx.lineTo(px, cssH);
      ctx.stroke();
      if (Math.abs(x) > stepX / 2) ctx.fillText(fmtTick(x, stepX), px, yLabelsTop ? cssH - 16 : Math.min(Math.max(yAxisPx + 4, 2), cssH - 16));
    }
    const y0 = Math.ceil(ymin / stepY) * stepY;
    ctx.textAlign = xAxisPx < 14 || xAxisPx > cssW - 14 ? 'left' : 'left';
    for (let y = y0, guard = 0; y <= ymax && guard < 200; y += stepY, guard++) {
      const py = mapY(y);
      ctx.beginPath();
      ctx.moveTo(0, py); ctx.lineTo(cssW, py);
      ctx.stroke();
      if (Math.abs(y) > stepY / 2) {
        const lx = xAxisPx < 14 ? 4 : (xAxisPx > cssW - 40 ? cssW - 40 : xAxisPx + 4);
        ctx.fillText(fmtTick(y, stepY), lx, Math.min(Math.max(py - 6, 2), cssH - 16));
      }
    }

    // 坐标轴
    ctx.strokeStyle = GRID_STRONG;
    ctx.lineWidth = 1.2;
    if (ymin < 0 && ymax > 0) { ctx.beginPath(); ctx.moveTo(0, mapY(0)); ctx.lineTo(cssW, mapY(0)); ctx.stroke(); }
    if (xmin < 0 && xmax > 0) { ctx.beginPath(); ctx.moveTo(mapX(0), 0); ctx.lineTo(mapX(0), cssH); ctx.stroke(); }

    // 曲线
    opts.fns.forEach(function (f, i) {
      drawCurve(ctx, results[i], mapX, mapY, ymin, ymax, f.color, f.width || 2, f.dash);
    });

    // 切线
    if (opts.tangent && isFinite(opts.tangent.k)) {
      const t = opts.tangent;
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.9)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(mapX(xmin), mapY(t.k * xmin + t.b));
      ctx.lineTo(mapX(xmax), mapY(t.k * xmax + t.b));
      ctx.stroke();
      ctx.setLineDash([]);
      if (isFinite(t.y0)) {
        ctx.fillStyle = 'rgba(167, 139, 250, 1)';
        ctx.beginPath();
        ctx.arc(mapX(t.a), mapY(t.y0), 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0d1524';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // 悬停十字线
    if (opts.hover && isFinite(opts.hover.x) && opts.hover.x >= xmin && opts.hover.x <= xmax) {
      const hx = opts.hover.x;
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(mapX(hx), 0); ctx.lineTo(mapX(hx), cssH);
      ctx.stroke();
      ctx.setLineDash([]);
      opts.fns.forEach(function (f, i) {
        let y;
        try { y = f.fn(hx); } catch (e) { y = NaN; }
        if (isFinite(y) && y >= ymin && y <= ymax) {
          ctx.fillStyle = f.color;
          ctx.beginPath();
          ctx.arc(mapX(hx), mapY(y), 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    return { mapX: mapX, mapY: mapY, xmin: xmin, xmax: xmax };
  }

  window.DerivPlot = { render: render, sample: sample };
})();
