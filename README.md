# 雨邻证照 · Rainnear Photo

基于 TypeScript 大仓实现的跨端证件照排版工具。目前包含平台无关核心、H5 平台适配层和 H5 MVP 应用。

正式访问地址：<https://idprint.rainnear.com>

## 工作区

- `packages/core`：规格、裁切和排版算法。
- `packages/plateform-h5`：H5 文件、抠图、Canvas 和导出能力。
- `packages/plateform-miniapp`：微信小程序平台接口占位。
- `packages/app-h5`：React + Vite H5 MVP。

## 启动

```bash
pnpm install
pnpm dev:h5
```

浏览器打开 `http://localhost:5173`，上传本地 JPEG、PNG 或 WebP 图片即可生成排版预览，并导出带 300 DPI 元数据的 JPEG。

## H5 MVP 能力

- 支持一寸、二寸、签证等常用证件照规格，以及 6R、A4 等纸张规格。
- 支持单规格批量排版和多规格混合排版。
- 支持保留原背景，或在浏览器本地完成抠图后替换白、蓝、红、灰背景。
- 支持在高级抠图设置中选择快速或高清模型，并记住当前浏览器的选择。
- 支持专业微调模式，实时调整边缘收缩/扩张、边缘硬度、羽化和去色溢出，并将同样效果用于最终导出。
- 支持间距、裁切线、纸张方向、份数和自定义张数配置。
- 图片和抠图过程均在浏览器本地完成，不上传服务器。

首次使用智能换背景时会下载浏览器端模型资源，加载耗时取决于网络环境。生产环境建议为页面配置以下响应头，以启用 WebAssembly 多线程能力：

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Vite 开发和预览服务已经内置这两个响应头。

## 赞赏

如果雨邻证照帮到了你，欢迎在在线页面顶部点击“赞赏”，选择微信、支付宝或 Buy Me a Coffee；也可以直接扫描下方二维码，支持项目继续维护和改进。

<img src="./packages/app-h5/src/assets/alipay-reward-code.jpg" alt="Buy Me a Coffee 赞赏码" width="280">
<img src="./packages/app-h5/src/assets/wechat-reward-code.jpg" alt="Buy Me a Coffee 赞赏码" width="280">
<img src="./packages/app-h5/src/assets/buy-me-a-coffee-reward-code.png" alt="Buy Me a Coffee 赞赏码" width="280">

## 验证

```bash
pnpm test
pnpm typecheck
pnpm build
```

## 部署

项目通过 GitHub Actions 自动执行测试、类型检查和构建，并由 Vercel 托管 H5 应用。

- 生产域名：<https://idprint.rainnear.com>
- Vercel 构建命令：`pnpm build:h5`
- Vercel 输出目录：`packages/app-h5/dist`

### Google Analytics 4

H5 应用通过官方 Google tag 采集页面访问和核心功能漏斗，只有生产构建运行在 `idprint.rainnear.com` 且配置了合法 Measurement ID 时才会启用。本地开发、Vercel Preview、测试环境和缺少配置的构建都不会发送数据。

在 Vercel 项目的 Production 环境中添加以下变量并重新部署：

```text
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

该 Measurement ID 会随 Vite 构建产物公开，不应将任何密钥或私密凭据放入 `VITE_*` 变量。完整事件字典、隐私边界、GA4 后台配置和验证流程见 [`docs/google-analytics-integration-2026-08-11.md`](./docs/google-analytics-integration-2026-08-11.md)。
