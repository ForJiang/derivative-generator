/**
 * 中英双语文案（与 image-metadata-cleaner 同一模式）。
 * 静态文本用 data-i18n="key" 标注，data-i18n-html="key" 用于含 <code> 等行内标记的文本，
 * 动态文本用 t('key', vars) 获取；{name} / {n} 占位符会被 vars 替换。
 */
(function () {
  'use strict';

  const DICT = {
    zh: {
      'brand.name': '函数图像生成器',
      'brand.tag': '绘图 · 求导 · 切线',
      'hero.title': '输入表达式，立刻画出函数图像',
      'hero.sub': '多项式、三角、指数、对数、阶梯函数都能画——最多 6 条曲线同图对比，选中任意一条即可符号求导、生成切线方程。全部计算在浏览器里完成，不注册，不上传。',
      'panel.fns': '函数',
      'panel.graph': '函数图像',
      'panel.analyze': '分析',
      'panel.lib': '函数库',
      'panel.log': '计算日志',
      'fn.empty': '还没有函数——从下面的函数库里挑一个，或点上方按钮添加。',
      'fn.add': '+ 添加函数',
      'fn.hint': '点击选中一行，即可对它求导、作切线',
      'fn.placeholder': '输入表达式，例如 sin(x)·x 或 x^x',
      'fn.count': '{n} / {m} 条',
      'graph.hint': '滚轮缩放 · 拖拽平移 · 双击复位 · 悬停查看数值 · 曲线在函数没有定义的地方自动断开',
      'legend.curDeriv': '当前阶导数',
      'legend.tangent': '切线',
      'analyze.default': '点击上方任一函数，对它求导、作切线',
      'analyze.title': '分析 {label}(x) = {src}',
      'analyze.noFn': '还没有选中函数。',
      'analyze.badFn': '这个函数还解析不出来，先修正输入。',
      'd.head': '求导',
      'd.order': '第 {n} 阶',
      'd.orderPrefix': '第',
      'd.orderSuffix': '阶',
      'd.copy': '复制',
      'd.copyDone': '已复制：{text}',
      'd.copyFail': '复制失败，手动选一下吧',
      'd.showOnGraph': '在图中显示导函数',
      'd.steps': '求导过程',
      'tangent.head': '切线',
      'tangent.point': '切点 x₀ =',
      'tangent.draw': '作切线',
      'tangent.clear': '清除',
      'tangent.default': '输入切点的横坐标，画出切线并给出方程；这里也支持表达式，比如 pi/2。',
      'tangent.result': '切点 (x₀, y₀) = ({a}, {y0})，斜率 k = f′({a}) = {k}<br>切线方程：<span class="math-inline strong">{eq}</span>',
      'log.clear': '清空',
      'log.collapse': '收起',
      'log.expand': '展开',
      'log.empty': '还没有处理记录，添加函数后这里会实时显示执行过程。',
      'log.hint': '全部在浏览器内执行，输入不会离开本机。',
      'lib.sub': '点一下即以新曲线的形式加入上方列表',
      'lib.cat.basic': '基础',
      'lib.cat.trig': '三角',
      'lib.cat.exp': '指数 对数',
      'lib.cat.adv': '进阶',
      'lib.syntax': '还能写哪些表达式？点开看语法支持',
      'lib.syntax.body': '运算 <code>+ - * / ^</code>，乘号可以省略：<code>2x</code>、<code>2sin(x)</code>、<code>x(x+1)</code> 都合法。函数支持 <code>sin cos tan cot sec csc</code>、<code>asin acos atan</code>、<code>sinh cosh tanh</code>、<code>ln log lg log2</code>、<code>exp sqrt cbrt abs</code>、<code>floor ceil round sign sinc</code>；常量有 <code>e</code> 和 <code>pi</code>（或 <code>π</code>）。也可以直接粘贴 <code>√(x²+1)</code>、<code>π·x²</code>、<code>e^(-x²)</code> 这类写法，会自动转换。目前只支持变量 <code>x</code>；<code>log(x)</code> 是以 10 为底，<code>ln(x)</code> 是自然对数。',
      'faq.title': '常见问题',
      'faq.q1': '图像是怎么画出来的？',
      'faq.a1': '浏览器把表达式解析成语法树，在屏幕宽度上逐点采样求值，用 Canvas 连成曲线。缩放和平移只是改变采样窗口，所以每一次操作都会重新计算，而不是拉伸旧图像。',
      'faq.q2': '为什么曲线在某些地方断开了？',
      'faq.a2': '因为函数在那里没有定义：tan 的渐近线、1/x 在 x=0、floor 的整数跳变。断开恰恰说明画对了。函数值发散到无穷大的地方也会断开。',
      'faq.q3': '求导是精确的吗？',
      'faq.a3': '是符号推导——求和差法则、乘积法则、商法则、链式法则逐层展开，不是数值近似。结果经过 238 项自动化测试与数值差分交叉验证。化简程度有限，形式可能和教科书略有差异，但数值等价。',
      'faq.q4': '我的输入会被上传吗？',
      'faq.a4': '不会。这个站点没有后端，所有解析、求导、绘图都发生在你的浏览器里；关闭页面后什么都不会留下。',
      'faq.q5': '为什么 floor、sign 画不出导数？',
      'faq.a5': '它们是阶梯/分段函数，除跳变点外导数恒为 0，属于「几乎处处不可导」，符号求导没有教学意义——图像仍然可以正常绘制和缩放。',
      'footer.privacy': '无服务器 · 无日志 · 无追踪',
      'footer.copy': '© 2026 ForJiang',
      'lang.btn': 'EN',
      'lang.title': 'Switch to English',
      'toast.maxFns': '最多同时画 {n} 个函数',
      'toast.maxFnsLog': '已达上限 {n} 条',
      'fn.toggleTitle': '显示 / 隐藏这条曲线',
      'fn.delTitle': '删除这条函数',
      'd.copyNonDiff': '当前函数不可导',
      'tangent.badPoint': '切点 x = "{raw}" 不是有效的表达式',
      'tangent.badNumber': '切点 x 必须是一个确定的数',
      'tangent.undef': '函数在 x = {a} 处没有定义，无法作切线',
      'log.cmd.open': '打开页面',
      'log.cmd.openDetail': '载入 {n} 条示例函数 · 全部计算在本地完成',
      'log.cmd.add': '添加函数 {label}',
      'log.cmd.del': '删除函数',
      'log.cmd.order': '切换导数阶数',
      'log.cmd.overlay': '导函数叠加',
      'log.cmd.copy': '复制导数',
      'log.cmd.viewReset': '重置视图',
      'log.cmd.tangentClear': '清除切线',
      'log.ok.parse': '解析 {label}',
      'log.ok.parseSave': '保存 {label}',
      'log.ok.deriv': '求导 {label}',
      'log.ok.tangent': '切线 {label}',
      'log.info.select': '选中 {label}',
      'log.info.show': '显示 {label}',
      'log.info.hide': '隐藏 {label}',
      'log.info.view': '移动视图',
      'log.warn.badInput': '输入有误 {label}',
      'log.warn.derivFail': '求导失败 {label}',
      'log.warn.tangentFail': '切线失败 {label}',
      'log.warn.tangentPoint': '函数在 x = {a} 处没有定义',
      'log.warn.addFail': '添加函数失败',
      'rule.product': '乘积法则 (uv)′ = u′v + uv′',
      'rule.quotient': '商法则 (u/v)′ = (u′v − uv′) / v²',
      'rule.power': '幂函数法则 (uⁿ)′ = n·uⁿ⁻¹·u′',
      'rule.expo': '指数函数法则 (cᵘ)′ = cᵘ·ln c·u′',
      'rule.powexpo': '幂指函数求导（对数求导法）',
      'rule.linear': '导数的线性性 (−u)′ = −u′',
      'rule.chain': '基本导数公式 + 链式法则',
      'rule.sum': '和差法则（导数的线性性）',
      'err.empty': '请先输入一个函数，例如 x^2 或 sin(x)',
      'err.expect': '这里应该是 "{ch}"',
      'err.num': '数字格式不对："{str}"',
      'err.unknownLetter': '不认识的符号 "{ch}"（目前只支持变量 x，常量 e 和 pi）',
      'err.unknownChar': '不认识的字符 "{ch}"',
      'err.needParen': '函数 {fn} 后面要加括号，例如 {fn}(x)',
      'err.multiArg': '不支持多参数函数',
      'err.incomplete': '表达式不完整',
      'err.missingOperand': '"{ch}" 前面缺少内容',
      'err.unexpected': '这里出现了意外的 "{ch}"',
      'err.trailing': '这里多了内容',
      'err.trailingOp': '出现了多余的 "{ch}"',
      'err.nonDiff': '{fn} 是阶梯/分段函数，几乎处处不可导，不支持符号求导（图像仍可正常绘制）',
      'val.undef': '未定义',
      'steps.more': '……其余 {n} 步从略',
      'state.on': '开',
      'state.off': '关',
      'fn.emptySrc': '(空)',
      'err.posPrefix': '第 {pos} 个字符附近：'
    },
    en: {
      'brand.name': 'Function Grapher',
      'brand.tag': 'Plot · Derivative · Tangent',
      'hero.title': 'Type an expression, get the graph instantly',
      'hero.sub': 'Polynomials, trig, exponentials, logarithms, even step functions — up to 6 curves at once. Select any curve to get symbolic derivatives and tangent lines. Everything runs in your browser; no sign-up, no upload.',
      'panel.fns': 'Functions',
      'panel.graph': 'Graph',
      'panel.analyze': 'Analyze',
      'panel.lib': 'Library',
      'panel.log': 'Compute log',
      'fn.empty': 'No functions yet — pick one from the library below, or use the button above.',
      'fn.add': '+ Add function',
      'fn.hint': 'Click a row to select it for derivatives and tangents',
      'fn.placeholder': 'Enter an expression, e.g. sin(x)·x or x^x',
      'fn.count': '{n} / {m}',
      'graph.hint': 'Scroll to zoom · drag to pan · double-click to reset · hover for values · curves break where the function is undefined',
      'legend.curDeriv': 'Current derivative',
      'legend.tangent': 'Tangent',
      'analyze.default': 'Select a function above to differentiate it or draw a tangent',
      'analyze.title': 'Analyze {label}(x) = {src}',
      'analyze.noFn': 'No function selected.',
      'analyze.badFn': 'This function does not parse yet — fix the input first.',
      'd.head': 'Derivative',
      'd.order': 'Order {n}',
      'd.orderPrefix': 'Order',
      'd.orderSuffix': '',
      'd.copy': 'Copy',
      'd.copyDone': 'Copied: {text}',
      'd.copyFail': 'Copy failed — please select manually',
      'd.showOnGraph': 'Show derivative on graph',
      'd.steps': 'Steps',
      'tangent.head': 'Tangent',
      'tangent.point': 'Point x₀ =',
      'tangent.draw': 'Draw',
      'tangent.clear': 'Clear',
      'tangent.default': 'Enter the x-coordinate of the tangency point to draw the tangent and its equation. Expressions like pi/2 work here too.',
      'tangent.result': 'Point (x₀, y₀) = ({a}, {y0}), slope k = f′({a}) = {k}<br>Tangent: <span class="math-inline strong">{eq}</span>',
      'log.clear': 'Clear',
      'log.collapse': 'Collapse',
      'log.expand': 'Expand',
      'log.empty': 'No activity yet — add a function and the steps show up here live.',
      'log.hint': 'Runs entirely in your browser; your input never leaves this device.',
      'lib.sub': 'Click to add as a new curve',
      'lib.cat.basic': 'Basic',
      'lib.cat.trig': 'Trigonometric',
      'lib.cat.exp': 'Exponential & log',
      'lib.cat.adv': 'Advanced',
      'lib.syntax': 'Which expressions are supported? Open for the syntax',
      'lib.syntax.body': 'Operators <code>+ - * / ^</code>, and × may be omitted: <code>2x</code>, <code>2sin(x)</code>, <code>x(x+1)</code> are all valid. Functions: <code>sin cos tan cot sec csc</code>, <code>asin acos atan</code>, <code>sinh cosh tanh</code>, <code>ln log lg log2</code>, <code>exp sqrt cbrt abs</code>, <code>floor ceil round sign sinc</code>. Constants: <code>e</code> and <code>pi</code> (or <code>π</code>). Unicode input like <code>√(x²+1)</code>, <code>π·x²</code>, <code>e^(-x²)</code> is converted automatically. Only the variable <code>x</code> is supported; <code>log(x)</code> is base 10 and <code>ln(x)</code> is natural log.',
      'faq.title': 'FAQ',
      'faq.q1': 'How are the graphs drawn?',
      'faq.a1': 'The browser parses the expression into a syntax tree, samples it point by point across the canvas width, and connects the points with Canvas. Zooming and panning just change the sampling window — every gesture recomputes rather than stretching an old image.',
      'faq.q2': 'Why do curves break in places?',
      'faq.a2': 'Because the function is undefined there: tan’s asymptotes, 1/x at x=0, floor’s integer jumps. A break means it is drawn correctly. Points where values blow up to infinity also break.',
      'faq.q3': 'Is the differentiation exact?',
      'faq.a3': 'Yes — it is symbolic: sum, product, quotient and chain rules applied layer by layer, not a numerical approximation. Results are cross-checked against numerical differences by 238 automated tests. Simplification is limited, so a result may look different from a textbook but is numerically identical.',
      'faq.q4': 'Is my input uploaded anywhere?',
      'faq.a4': 'No. The site has no backend: parsing, differentiation and plotting all happen in your browser, and closing the page leaves nothing behind.',
      'faq.q5': 'Why can’t floor or sign be differentiated?',
      'faq.a5': 'They are step/piecewise functions: the derivative is 0 everywhere except at jumps, i.e. 「nowhere differentiable」 in the pedagogical sense. Their graphs still plot and zoom perfectly.',
      'footer.privacy': 'No server · No logs · No tracking',
      'footer.copy': '© 2026 ForJiang',
      'lang.btn': '中文',
      'lang.title': '切换到中文',
      'toast.maxFns': 'Up to {n} functions at once',
      'toast.maxFnsLog': 'Limit of {n} reached',
      'fn.toggleTitle': 'Show / hide this curve',
      'fn.delTitle': 'Remove this function',
      'd.copyNonDiff': 'This function is not differentiable',
      'tangent.badPoint': 'Tangency point x = "{raw}" is not a valid expression',
      'tangent.badNumber': 'Tangency point x must be a finite number',
      'tangent.undef': 'The function is undefined at x = {a}; no tangent can be drawn',
      'log.cmd.open': 'Open page',
      'log.cmd.openDetail': 'Loaded {n} sample functions · all local',
      'log.cmd.add': 'Add function {label}',
      'log.cmd.del': 'Delete function',
      'log.cmd.order': 'Switch derivative order',
      'log.cmd.overlay': 'Derivative overlay',
      'log.cmd.copy': 'Copy derivative',
      'log.cmd.viewReset': 'Reset view',
      'log.cmd.tangentClear': 'Clear tangent',
      'log.ok.parse': 'Parse {label}',
      'log.ok.parseSave': 'Save {label}',
      'log.ok.deriv': 'Differentiate {label}',
      'log.ok.tangent': 'Tangent {label}',
      'log.info.select': 'Select {label}',
      'log.info.show': 'Show {label}',
      'log.info.hide': 'Hide {label}',
      'log.info.view': 'Pan / zoom view',
      'log.warn.badInput': 'Bad input {label}',
      'log.warn.derivFail': 'Derivative failed {label}',
      'log.warn.tangentFail': 'Tangent failed {label}',
      'log.warn.tangentPoint': 'Undefined at x = {a}',
      'log.warn.addFail': 'Add function failed',
      'rule.product': 'Product rule (uv)′ = u′v + uv′',
      'rule.quotient': 'Quotient rule (u/v)′ = (u′v − uv′) / v²',
      'rule.power': 'Power rule (uⁿ)′ = n·uⁿ⁻¹·u′',
      'rule.expo': 'Exponential rule (cᵘ)′ = cᵘ·ln c·u′',
      'rule.powexpo': 'Power-exponential rule (logarithmic differentiation)',
      'rule.linear': 'Linearity (−u)′ = −u′',
      'rule.chain': 'Basic formula + chain rule',
      'rule.sum': 'Sum rule (linearity of the derivative)',
      'err.empty': 'Enter a function first, e.g. x^2 or sin(x)',
      'err.expect': 'Expected "{ch}" here',
      'err.num': 'Malformed number: "{str}"',
      'err.unknownLetter': 'Unknown symbol "{ch}" (only the variable x, plus constants e and pi)',
      'err.unknownChar': 'Unknown character "{ch}"',
      'err.needParen': 'Function {fn} needs parentheses, e.g. {fn}(x)',
      'err.multiArg': 'Multi-argument functions are not supported',
      'err.incomplete': 'The expression is incomplete',
      'err.missingOperand': 'Missing operand before "{ch}"',
      'err.unexpected': 'Unexpected "{ch}" here',
      'err.trailing': 'Extra content at the end',
      'err.trailingOp': 'Extra "{ch}"',
      'err.nonDiff': '{fn} is a step/piecewise function — nowhere differentiable, so symbolic differentiation is not supported (its graph still works)',
      'val.undef': 'undefined',
      'steps.more': '……{n} more steps omitted',
      'state.on': 'on',
      'state.off': 'off',
      'fn.emptySrc': '(empty)',
      'err.posPrefix': 'Near character {pos}: '
    }
  };

  const LANG_KEY = 'fg-lang';
  let lang = 'zh';
  const listeners = new Set();

  function detectLang() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === 'zh' || saved === 'en') return saved;
    } catch { /* 隐私模式下 localStorage 不可用 */ }
    return (navigator.language || 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }

  function getLang() { return lang; }

  function setLang(next) {
    lang = next === 'en' ? 'en' : 'zh';
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
    for (const fn of listeners) {
      try { fn(lang); } catch { /* 订阅者异常不影响切换 */ }
    }
    return lang;
  }

  /** 取文案；{name} / {n} 占位符会被 vars 替换 */
  function t(key, vars) {
    let s = (DICT[lang] && DICT[lang][key]) || DICT.zh[key] || key;
    if (vars) {
      for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
    }
    return s;
  }

  /** 把文档里所有 data-i18n / data-i18n-html 元素刷成当前语言 */
  function applyI18n(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      const v = t(el.getAttribute('data-i18n'));
      if (v && !v.startsWith('data-i18n')) el.textContent = v;
    });
    root.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      const v = t(el.getAttribute('data-i18n-html'));
      if (v) el.innerHTML = v;
    });
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    const btn = document.getElementById('langBtn');
    if (btn) {
      btn.textContent = t('lang.btn');
      btn.title = t('lang.title');
    }
  }

  /** 语言变化订阅；返回取消函数 */
  function onLangChange(fn) {
    listeners.add(fn);
    return function () { listeners.delete(fn); };
  }

  const API = { t: t, applyI18n: applyI18n, getLang: getLang, setLang: setLang, detectLang: detectLang, onLangChange: onLangChange };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else window.I18N = API;
})();
