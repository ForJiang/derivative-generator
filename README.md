# 函数图像生成器

在线绘制任意函数图像的工具：多函数同图对比、符号求导、生成切线方程。**纯静态、零依赖、纯前端计算，输入不会上传到任何服务器。**

**在线使用：https://forjiang.github.io/function-grapher/**

![Pages 在线](https://img.shields.io/badge/Pages-%E5%9C%A8%E7%BA%BF-3ddc97)
![tests](https://img.shields.io/badge/tests-238%20passing-3ddc97)
![no build](https://img.shields.io/badge/no--build-%E9%9B%B6%E4%BE%9D%E8%B5%96-3ddc97)
![license](https://img.shields.io/badge/license-MIT-3ddc97)

## 功能

| | |
| --- | --- |
| 🖊️ **多函数同图** | 最多 6 条曲线，独立颜色、独立显隐、随时增删，输入即画 |
| 🧮 **符号求导** | 1–8 阶任意切换，幂法则 / 乘积 / 商 / 链式法则逐层展开，带完整求导步骤 |
| ➖ **切线方程** | 切点支持表达式（如 `pi/2`），画出切线并给出解析方程 |
| 🔍 **顺手的画布** | 滚轮缩放、拖拽平移、双击复位、悬停读出所有函数值；y 轴自适应，渐近线与跳变点自动断笔 |
| 📚 **函数库** | 20+ 常用函数一键添加：幂 / 三角 / 反三角 / 指数对数 / 双曲 / 阶梯（floor、sign、sinc） |
| 🖥️ **计算日志** | 终端风格实时记录每一步操作（解析、求导、切线、视图），像处理流水线一样透明 |
| 🧩 **友好的输入** | 隐式乘法（`2x`、`xsin(x)`）、Unicode 写法（`π`、`√`、`x²`）自动识别，错误定位到第几个字符 |

## 设计语言

玻璃面板与控件语言对齐姊妹站 [image-metadata-cleaner](https://forjiang.github.io/image-metadata-cleaner/)：深色单一主题
（`#0a0a0c`）、`rgba(13,14,18,.62)` 半透明玻璃面板（白色 9% 描边、22px 圆角卡片）、近白主 CTA。背景是自研 WebGL
fragment shader 绘制的 RGB 正弦波场（`assets/js/wave-bg.js`，三条正弦波分别驱动 R/G/B 通道、按到屏幕中心的距离扭曲，
无第三方依赖），终端风格计算日志沿用 IMC 同款 `log.js`（环形缓冲 + `✓/✗` 分级配色），卡片入场是 `data-reveal`
淡入上移。移动端做了三处适配：画布高度用 CSS 固定值 + 阴影降级、窄屏面板模糊从 18px 降到 8px、
`prefers-reduced-motion` 下动画静止。站点图标由 `tools/make_icons.py` 纯标准库光栅化生成（圆角矩形 SDF +
贝塞尔曲线距离场，不依赖 PIL），主图标 base64 内联规避浏览器 favicon 缓存。

## 它是怎么工作的

```
浏览器（纯静态站点，GitHub Pages）
 ├─ assets/js/engine.js   表达式 → AST → 求导规则 → 化简 → 数学排版渲染
 ├─ assets/js/plot.js     逐点采样求值，Canvas 绘制；箱线图胡须法自适应 y 范围
 ├─ assets/js/main.js     函数列表 / 分析面板 / 画布交互 / 日志接线
 ├─ assets/js/log.js      终端计算日志（与 image-metadata-cleaner 同款）
 ├─ assets/js/wave-bg.js  WebGL RGB 正弦波背景
 └─ assets/js/reveal.js   卡片入场动画（不依赖 IntersectionObserver）
```

## 测试

```bash
node tests/engine.test.cjs    # 238 项：符号导数 vs 中心差分交叉验证、解析往返、报错定位
```

每个内置函数的导数都与数值差分交叉验证过，测试还覆盖了复合函数（专门抓链式因子遗漏）、
同底幂合并、分数约分等化简路径。

## License

MIT
