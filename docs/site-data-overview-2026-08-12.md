# IDPrint 站点数据汇总（2026-08-12）

## 结论摘要

- GA4 已正常开始采集数据。当前标准报告覆盖截至 2026-08-11 的已处理数据：3 个活跃用户、3 个新用户、3 次会话、6 次浏览、19 个事件。
- 现有流量全部来自 Direct（2 次会话）和 `vercel.com / referral`（1 次会话），暂时没有自然搜索流量。
- 已采集到 1 次 `photo_import`，没有采集到 `photo_export`；当前关键事件数为 0。
- Google Search Console 已验证站点，`/sitemap.xml` 于 2026-08-11 提交并读取成功，发现 1 个网页；效果与索引报告仍在处理。
- Bing Webmaster Tools 已验证站点，`/sitemap.xml` 于 2026-08-11 提交并抓取成功，发现 1 个 URL，0 个错误、0 个警告；搜索效果报告仍在处理，平台提示最长约 48 小时。
- 百度搜索资源平台已验证站点，但 2026-08-11 的索引量为 0，点击量和展现量均为 0；Sitemap 页面显示暂无提交记录，因此百度侧目前只完成了站点验证，尚未形成 Sitemap 提交闭环。
- 接入仅发生一天，当前样本极小，且很可能包含开发者自己的验证访问，不能据此判断真实获客或转化表现。

## GA4 数据

统计口径：GA4 标准事件报告显示的可用数据，日期范围截至 2026-08-11。由于 2026-08-12 当天标准报告尚未完成处理，本表不代表当天实时累计值；检查时过去 30 分钟活跃用户为 0。

| 指标 | 当前值 |
| --- | ---: |
| 活跃用户 | 3 |
| 新用户 | 3 |
| 会话数 | 3 |
| 浏览次数 | 6 |
| 事件数 | 19 |
| 关键事件数 | 0 |
| 过去 30 分钟活跃用户 | 0 |

### 来源与地域

| 维度 | 数量 |
| --- | ---: |
| Direct 会话 | 2 |
| `vercel.com / referral` 会话 | 1 |
| 中国活跃用户 | 2 |
| 美国活跃用户 | 1 |

当前没有 Organic Search 会话。`vercel.com / referral` 更像部署或预览链路产生的访问，不应视为自然获客。

### 事件

| 事件 | 次数 | 用户数 |
| --- | ---: | ---: |
| `page_view` | 6 | 3 |
| `scroll` | 4 | 2 |
| `first_visit` | 3 | 3 |
| `session_start` | 3 | 3 |
| `user_engagement` | 2 | 2 |
| `photo_import` | 1 | 1 |
| `photo_export` | 0 | 0 |

当前漏斗只能确认：至少 1 位用户导入过照片，但没有完成导出。样本只有 3 位用户，暂不计算转化率趋势。

## 搜索引擎收录状态

| 平台 | 验证 | Sitemap | 已发现/索引 | 搜索表现 | 当前判断 |
| --- | --- | --- | ---: | --- | --- |
| Google Search Console | 已完成 | 成功，2026-08-11 已读取 | 发现 1 页 | 正在处理 | 接入正常，继续等待数据 |
| Bing Webmaster Tools | 已完成 | 成功，2026-08-11 已抓取 | 发现 1 个 URL | 正在处理，平台提示最长约 48 小时 | 接入正常，继续等待数据 |
| 百度搜索资源平台 | 已完成 | 暂无提交记录 | 2026-08-11 索引量 0 | 0 点击、0 展现 | 需补齐 Sitemap 或主动推送 |

Google 官方说明：新接入的 Search Console 站点最多可能需要一周才开始生成数据，常规效果数据通常有 2–3 天延迟。因此今天看不到 Google 搜索效果属于正常现象：<https://support.google.com/webmasters/answer/96568>

百度后台说明：索引量最快每天更新一次、最迟一周更新一次。百度普通收录页还明确提示，提交资源只会缩短发现时间，并不保证收录或展现。

## 聚合平台建议

### 推荐方案：自有轻量看板 + 每日摘要

对当前单站点、低数据量阶段，不建议立即购买重型 SEO SaaS。最合适的是：

1. 用 Looker Studio 免费聚合 GA4 与 Google Search Console；两者都有官方连接器。
2. 用 Bing Webmaster API 拉取排名、流量、关键词和抓取统计；微软官方 API 支持这些数据。
3. 百度暂时保留后台读取或定期导出，因为其站长数据开放能力和第三方平台覆盖明显弱于 Google/Bing。
4. 在仓库内维护一份日快照，由 Codex 汇总成 Markdown 周报；数据量起来后再升级成 Web Dashboard。

参考资料：

- Looker Studio 连接器：<https://docs.cloud.google.com/looker/docs/studio/connector>
- Looker Studio 连接 GA4：<https://cloud.google.com/looker/docs/studio/connect-to-google-analytics>
- Bing Webmaster API：<https://learn.microsoft.com/en-us/bingwebmaster/>

### 可选现成平台

| 方案 | 覆盖范围 | 适合场景 | 注意点 |
| --- | --- | --- | --- |
| Looker Studio | GA4、Google Search Console 原生 | 免费、自定义图表、单站点 | Bing 和百度需额外数据源 |
| AgencyAnalytics | GA4、Google Search Console、Bing Webmaster Tools | 多站点、客户报告、少开发 | 付费；百度仍需单独处理 |
| SEO Analytics Dashboard / GA Lite | 宣称支持 GA4、Google Search Console、Bing | 想快速试用统一面板 | 属于第三方新服务，授权前需评估隐私、OAuth 权限与持续运营能力 |
| Dragon Metrics | Google 数据整合、百度关键词/排名分析能力较强 | 重点做中国 SEO 与竞品排名 | 更偏 SEO 排名平台，不等同于完整聚合百度站长后台数据 |

当前不建议为了只有 3 个用户的样本立刻把 GA、GSC 和 Bing 的账号授权给陌生聚合服务。先用官方连接器或自有脚本更稳妥。

## 接下来 7 天的观察清单

每天只看以下核心信号，避免被小时级波动误导：

1. GA4：活跃用户、会话、自然搜索会话、`photo_import`、`photo_export`、导出错误。
2. Google：已编入索引页数、展现、点击、查询词、平均排名。
3. Bing：已发现/已索引 URL、展现、点击、查询词、抓取错误、AI Performance 引用。
4. 百度：索引量、展现、点击、关键词、抓取异常、资源提交结果。
5. 产品漏斗：访问 → 导入照片 → 成功导出；至少积累 50–100 个有效用户后再判断漏斗转化。

建议在 2026-08-14 再做第一次复查，2026-08-18 做首份 7 天周报。如果 Google 一周后仍无数据，优先检查资源类型、规范 URL 和 URL 检查结果；如果百度仍为 0，先补 Sitemap/主动推送，再检查抓取诊断。

## 本次操作边界

本次仅通过已登录后台进行只读检查，没有修改任何 GA4、Google Search Console、Bing Webmaster Tools 或百度搜索资源平台配置，也没有使用或持久化任何后台密钥，喵~
