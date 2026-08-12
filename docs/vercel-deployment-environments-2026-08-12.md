# Vercel 测试与生产环境发布方案

## 目标

- `main` 每次推送并通过单元测试、类型检查和构建后，自动部署到 Vercel Preview 测试环境。
- 任意 Git Tag 只有在对应提交属于 `main` 时，才自动部署到 Vercel Production。
- 测试环境关闭 GA 及后续遥测能力，生产环境显式开启遥测总开关。
- 避免 Vercel Git 集成把 `main` 推送直接发布到生产环境。

## 部署链路

### 测试环境

1. 推送提交到 `main`。
2. `.github/workflows/ci.yml` 执行单元测试、类型检查和全量构建。
3. 质量门禁通过后，通过 Vercel CLI 上传源码，由 Vercel 使用 Preview 环境变量构建并部署 Preview。
4. 部署携带 `main` 分支和提交 SHA 元数据，便于在 Vercel 中识别和追踪。
5. 部署成功后，通过 Vercel Alias API 将固定测试域名 `rain-id-print-test.vercel.app` 指向最新的 Preview Deployment。

### 生产环境

1. 在需要发布的 `main` 提交上创建并推送 Git Tag。
2. `.github/workflows/deploy-production.yml` 验证 Tag 对应提交属于远端 `main`。
3. 工作流重新执行单元测试和类型检查。
4. 通过 Vercel CLI 上传源码，由 Vercel 使用 Production 环境变量构建并通过 `vercel deploy --prod` 发布生产环境。

## 必需的远端配置

在 GitHub 仓库 `Settings → Secrets and variables → Actions` 中添加：

| Secret | 来源 | 用途 |
| --- | --- | --- |
| `VERCEL_TOKEN` | Vercel Account Settings 中创建的 Access Token | GitHub Actions 调用 Vercel CLI |
| `VERCEL_ORG_ID` | 本地执行 `vercel link` 后 `.vercel/project.json` 的 `orgId` | 定位 Vercel 账号或团队 |
| `VERCEL_PROJECT_ID` | 同一文件中的 `projectId` | 定位目标 Vercel Project |

在 Vercel 项目的 Production 环境中配置：

```text
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

不要在 Preview 环境配置该变量。即使被误配，测试工作流仍会把 `VITE_TELEMETRY_ENABLED` 固定为 `false`，应用也会继续校验正式域名，避免测试流量进入 GA。

## 发布命令

```bash
git tag v1.0.0
git push origin v1.0.0
```

工作流接受所有 Tag；建议统一使用 `v<major>.<minor>.<patch>` 格式，便于版本追踪。

## 回滚

优先在 Vercel Deployments 页面选择上一份正常的 Production Deployment 并执行 Rollback。需要重新构建旧版本时，可在对应的 `main` 历史提交上创建新的修复版本 Tag；不要移动或覆盖已经发布的 Tag。

## 安全边界

- `vercel.json` 中的 `git.deploymentEnabled=false` 是防止 `main` 被 Vercel Git 集成直接发布的关键约束。
- Production 工作流使用 GitHub `Production` Environment，可在 GitHub 中继续增加审批人或部署保护规则。
- Preview 和 Production 部署分别由 Vercel 注入对应环境的变量，工作流通过 `--build-env` 将遥测总开关固定为 Preview 关闭、Production 开启；禁止把生产密钥配置到 Preview。
- 工作流采用源码部署，避免最小权限项目 Token 因 `vercel pull` 读取团队级项目列表而失败。
- 两个部署工作流均设置 `VERCEL_TELEMETRY_DISABLED=1`，关闭 Vercel CLI 自身的使用遥测。
- 所有新增遥测能力都必须受 `VITE_TELEMETRY_ENABLED` 总开关约束，并保持测试环境关闭。
