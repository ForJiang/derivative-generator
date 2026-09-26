# 导函数生成器

一个纯前端的**符号求导**工具：输入任意初等函数 `f(x)`，即时生成 `f′(x)`，并展示求导步骤、绘制函数与导函数图像、一键生成切线方程。

**在线使用：https://forjiang.github.io/derivative-generator/**

## 功能

- **符号求导**（不是数值近似）：加减乘除、幂、乘积/商/链式法则完整实现
- **高阶导数**：1–8 阶，一键切换
- **求导过程**：逐步展示每一步用了什么法则（幂函数法则、乘积法则、链式法则……）
- **函数图像**：f(x) 与 f′(x) 同图对比，支持滚轮缩放、拖拽平移、悬停查值，自动识别渐近线断笔
- **切线方程**：输入切点 x₀（支持表达式如 `pi/2`），自动生成切线方程并画在图上
- **支持的函数**：sin/cos/tan/cot/sec/csc、asin/acos/atan、sinh/cosh/tanh、ln/log/lg/log2、exp/sqrt/cbrt/abs；常量 `e`、`pi`；支持隐式乘法（`2x`、`2sin(x)`、`x(x+1)`）与 Unicode 写法（`π`、`√`、`²`）

## 技术说明

- 零依赖、零构建：纯 HTML/CSS/JS，直接部署在 GitHub Pages
- 自研的递归下降解析器 → AST → 求导规则 → 化简器 → 数学排版渲染（分数、根号、上标）
- `tests/engine.test.cjs`：219 项测试，符号导数与中心差分数值交叉验证覆盖全部内置函数与高阶导数

```bash
node tests/engine.test.cjs   # 运行测试（任意 Node ≥ 18）
```

## License

MIT
