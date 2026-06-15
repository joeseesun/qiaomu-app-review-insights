# 乔木App评价洞察

> App Store 评论里藏着真实需求、付费阻力和竞品机会，但它们通常散在几百条吐槽里。
> 乔木App评价洞察把这些评论变成产品经理、独立开发者和内容团队能直接使用的洞察页面。

[![Live Demo](https://img.shields.io/badge/Live%20Demo-appreview.qiaomu.ai-0f766e?style=for-the-badge)](https://appreview.qiaomu.ai)
[![Install Skill](https://img.shields.io/badge/Agent%20Skill-npx%20skills%20add-111827?style=for-the-badge)](#agent-skill)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/joeseesun/qiaomu-app-review-insights?style=social)](https://github.com/joeseesun/qiaomu-app-review-insights)

![乔木App评价洞察产品截图](docs/assets/product-screenshot.png)

## 它解决什么问题？

你不需要再手动翻 App Store 评论、复制到表格、再让 AI 猜用户想说什么。

输入 App Store 链接、App ID 或应用名称，系统会自动完成：

- 抓取 App Store 最新评论和评分分布
- 用 DeepSeek v4 flash 提炼摘要、核心痛点、产品机会、正向信号、用户分层、版本风险和行动建议
- 保留评论证据，避免只有空泛结论
- 生成可分享、可复盘的 App 洞察页
- 基于版本和评论信息生成可视化图表，帮助定位需求和版本风险
- 缓存每个 App 页面，记录更新时间，后续可更新洞察
- 预生成 Top Free / Top Paid 常用 App 页面，首页直接访问

线上示例：

- [ChatGPT 评价分析](https://appreview.qiaomu.ai/apps/us/6448311069/chatgpt)
- [乔木App评价洞察首页](https://appreview.qiaomu.ai)

## 适合谁？

| 角色 | 可以拿它做什么 |
| --- | --- |
| 产品经理 | 从真实差评里找需求、风险和优先级 |
| 独立开发者 | 快速研究竞品差评，找到小产品切入口 |
| 增长 / 内容团队 | 把 App 评价变成有证据、有结构的内容素材 |
| 投研 / 行研 | 批量观察热门 App 的用户口碑变化 |
| Agent 用户 | 安装 skill 后，用自然语言触发 App 评价洞察工作流 |

## 样例输出

一次生成会得到这些内容：

| 模块 | 输出价值 |
| --- | --- |
| 摘要 | 一段清晰的产品口碑概述 |
| 核心痛点 | 用户反复抱怨的问题，附证据句 |
| 产品机会 | 可以转成需求池或路线图的机会 |
| 正向信号 | 用户愿意给高分的关键价值点 |
| 用户分层 | 哪类用户在反馈，关注点有什么差异 |
| 版本风险 | 哪些差评和版本更新、性能、限制策略相关 |
| 行动建议 | 适合产品经理跟进的短期动作 |
| 可视化图表 | 版本口碑趋势、痛点热力图、评论情绪时间线 |

![乔木App评价洞察图表截图](docs/assets/diagnostics-screenshot.png)

## 快速开始

```bash
git clone https://github.com/joeseesun/qiaomu-app-review-insights.git
cd qiaomu-app-review-insights
npm install
cp .env.example .env.local
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

最小可用环境变量：

```env
QIAOMU_LLM_API_KEY=your_api_key
QIAOMU_LLM_BASE_URL=https://api.deepseek.com/v1
QIAOMU_LLM_MODEL=deepseek-v4-flash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
STORAGE_TYPE=local
```

> 不要把 `.env.local`、`.env.development` 或任何真实 API Key 提交到仓库。

公开部署时建议打开生成保护：

```env
APP_REVIEW_PUBLIC_DAILY_NEW_APP_LIMIT=5
APP_REVIEW_PUBLIC_CACHE_FRESH_DAYS=3
APP_REVIEW_GENERATION_LIMIT_DIR=/app/src/data/app-cache/.generation-guard
APP_REVIEW_HISTORY_DIR=/app/src/data/app-cache/.review-history
```

- `APP_REVIEW_PUBLIC_DAILY_NEW_APP_LIMIT`: 同一 IP 每天最多生成多少个新 App 页面，默认 5。
- `APP_REVIEW_PUBLIC_CACHE_FRESH_DAYS`: 已有页面在多少天内直接读取，不触发新生成，默认 3。
- `APP_REVIEW_GENERATION_LIMIT_DIR`: 限流记录和待生成队列的存储目录。
- `APP_REVIEW_HISTORY_DIR`: 历史评论仓库目录，会按 App 累积保存已经抓到过的评论样本。

## 预生成热门 App 页面

服务启动后，可以提前缓存 App Store 榜单页面：

```bash
node scripts/precache-top-apps.mjs \
  --base-url http://localhost:3000 \
  --countries us,cn \
  --charts free,paid \
  --limit 5 \
  --max-reviews 160
```

常用参数：

- `--force`: 覆盖已有缓存并重新抓取
- `--no-analyze`: 只抓取评论统计，不调用 LLM
- `--limit`: 每个榜单生成多少个 App 页面
- `--max-reviews`: 每个 App 最多抓取多少条评论

## Docker 部署

```bash
cp .env.example .env.production
npm run build
docker compose --env-file .env.production up -d --build
curl http://127.0.0.1:3095/api/health
```

生产环境推荐设置：

```env
NEXT_PUBLIC_SITE_URL=https://your-domain.example
APP_REVIEW_CACHE_DIR=/app/src/data/app-cache
```

默认 Docker 端口是 `3095`。如果要挂到 Nginx / Caddy / Cloudflare Tunnel，只需要把外部域名代理到这个端口。

## 核心 API

生成或读取缓存页：

```bash
curl -X POST http://localhost:3000/api/research \
  -H 'Content-Type: application/json' \
  -d '{"query":"ChatGPT","country":"us","maxReviews":160}'
```

更新洞察：

```bash
curl -X POST http://localhost:3000/api/research/regenerate \
  -H 'Content-Type: application/json' \
  -d '{"appId":"6448311069","country":"us","maxReviews":160}'
```

健康检查：

```bash
curl http://localhost:3000/api/health
```

## Agent Skill

如果你用 Codex、OpenCode、Cursor、Cline、Warp 等支持 Agent Skills 的工具，可以安装配套 skill：

```bash
npx skills add joeseesun/qiaomu-app-review-skill
```

安装后可以这样说：

- `分析 ChatGPT 的 App Store 用户评价，重点看版本风险和产品机会`
- `帮我找一个同类 App 的差评痛点，看看有没有独立开发机会`
- `把这个 App 的评论整理成产品洞察页结构`

Skill 会引导 Agent 使用本项目的公开站点、API、缓存和 DeepSeek flash 分析流程。

## 技术栈

- Next.js 15 + React 19 + TypeScript
- Tailwind CSS
- ECharts / Recharts
- Apple iTunes Lookup API / App Store RSS Reviews
- OpenAI-compatible SDK，默认接入 DeepSeek v4 flash
- 本地 JSON 缓存，可按需扩展到 KV、Supabase 或对象存储
- Docker Compose / standalone Next.js 部署

## 注意事项

- App Store RSS 评论接口有分页和地区差异，结果取决于国家区和抓取时间。
- DeepSeek / OpenAI-compatible 接口需要你自己的 API Key。
- 本地缓存适合 VPS / Docker 常驻服务；Serverless 平台需要额外配置持久化存储。
- AI 洞察不是事实裁决，页面会保留原始评论证据，建议结合证据判断。
- 如果你公开部署，请配置自己的 `NEXT_PUBLIC_SITE_URL`、统计 ID 和缓存目录。

## Troubleshooting

| 问题 | 解决方法 |
| --- | --- |
| `AI 服务密钥未配置或不可用` | 检查 `.env.local` 里的 `QIAOMU_LLM_API_KEY` 或 `DEEPSEEK_API_KEY` 是否存在，重启 dev server。 |
| 搜索到的 App 不对 | 带上国家区和 App Store 链接，例如 `https://apps.apple.com/us/app/chatgpt/id6448311069`。 |
| 详情页没有 AI 摘要 | 点击更新洞察，或确认当前服务能访问 LLM API。也可以先用 `--no-analyze` 只生成评论缓存。 |
| Docker 启动后无缓存 | 确认 `APP_REVIEW_CACHE_DIR` 指向容器内可写路径，并挂载 volume。 |
| 线上域名生成的页面链接不对 | 设置 `NEXT_PUBLIC_SITE_URL=https://你的域名` 后更新缓存页。 |

## 关于向阳乔木

这个项目来自向阳乔木的 AI 工作流实践：我更关心工具如何进入真实产品、内容和增长工作，而不只是停留在模型参数或产品发布本身。

- 个人站：[qiaomu.ai](https://qiaomu.ai)
- 博客：[blog.qiaomu.ai](https://blog.qiaomu.ai)
- 乔木推荐：[tuijian.qiaomu.ai](https://tuijian.qiaomu.ai)
- X：[@vista8](https://x.com/vista8)
- GitHub：[@joeseesun](https://github.com/joeseesun/)

## License

MIT
