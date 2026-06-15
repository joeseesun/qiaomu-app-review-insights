# 乔木App评价洞察

> 把 App Store 用户评价变成产品经理能直接使用的洞察页：痛点、机会、版本风险、证据和可分享页面。
> Turn App Store reviews into product research evidence: pain points, opportunities, version risks, and voice-of-customer signals.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-appreview.qiaomu.ai-0f766e?style=for-the-badge)](https://appreview.qiaomu.ai)
[![Agent Skill](https://img.shields.io/badge/Agent%20Skill-qiaomu--app--review-111827?style=for-the-badge)](#agent-skill)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/joeseesun/qiaomu-app-review-insights?style=social)](https://github.com/joeseesun/qiaomu-app-review-insights)

![乔木App评价洞察产品截图](docs/assets/product-screenshot.png)

**中文** | [English](#english)

## 为什么值得用

App Store 评论里藏着真实需求、付费阻力、版本事故和竞品机会，但它们通常散在几百条高噪声评论里。乔木App评价洞察会自动抓取评论，用 DeepSeek flash 提炼结构化洞察，并生成可缓存、可分享、可复盘的 App 评价洞察页面。

它适合：

- 产品经理：把真实用户抱怨转成需求池和版本风险清单
- 独立开发者：从竞品差评里发现小产品切入口
- 增长 / 内容团队：把用户评价转成有证据的内容素材
- 投研 / 行研：快速观察热门 App 的用户口碑变化
- Agent 用户：用自然语言触发 App 评价分析工作流

## 核心能力

| 能力 | 说明 |
| --- | --- |
| App 搜索 | 支持 App Store 链接、App ID、应用名称和国家区 |
| 评论抓取 | Apple RSS + App Store 页面补样本，保留来源边界 |
| DeepSeek 分析 | 默认使用 `deepseek-v4-flash` 提炼摘要、痛点、机会和行动建议 |
| 证据优先 | 每个结论尽量保留代表性评论，避免空泛总结 |
| 静态洞察页 | 每个 App 生成稳定 URL，记录更新时间，方便分享和复盘 |
| 榜单入口 | 首页展示多国家、多分类 Top Free / Top Paid App |
| 可视化诊断 | 版本口碑、差评主题、时间线和样本构成辅助判断 |
| 公开保护 | 3 天内缓存复用，公开生成限流，避免 token 被打穿 |

## 样例输出

一次生成会得到：

- 摘要：产品口碑和关键结论
- 核心痛点：用户反复抱怨的问题，附证据句
- 产品机会：可以转成路线图或独立产品想法的机会
- 正向信号：用户愿意给高分的原因
- 用户分层：不同用户群体的关注差异
- 版本风险：更新、性能、限制、付费策略带来的风险
- 行动建议：产品经理可以继续验证或排期的动作
- 可视化图表：版本趋势、痛点热力、评论情绪时间线

![乔木App评价洞察图表截图](docs/assets/diagnostics-screenshot.png)

线上示例：

- [ChatGPT 评价分析](https://appreview.qiaomu.ai/apps/us/6448311069/chatgpt)
- [乔木App评价洞察首页](https://appreview.qiaomu.ai)

## 快速开始

```bash
git clone https://github.com/joeseesun/qiaomu-app-review-insights.git
cd qiaomu-app-review-insights
npm install
cp .env.example .env.local
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

最小环境变量：

```env
QIAOMU_LLM_API_KEY=your_api_key
QIAOMU_LLM_BASE_URL=https://api.deepseek.com/v1
QIAOMU_LLM_MODEL=deepseek-v4-flash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
STORAGE_TYPE=local
```

不要把 `.env.local`、`.env.development` 或真实 API Key 提交到仓库。

公开部署建议打开生成保护：

```env
APP_REVIEW_PUBLIC_DAILY_NEW_APP_LIMIT=5
APP_REVIEW_PUBLIC_CACHE_FRESH_DAYS=3
APP_REVIEW_GENERATION_LIMIT_DIR=/app/src/data/app-cache/.generation-guard
APP_REVIEW_HISTORY_DIR=/app/src/data/app-cache/.review-history
```

## 预生成热门 App 页面

```bash
node scripts/precache-top-apps.mjs \
  --base-url http://localhost:3000 \
  --countries us,cn \
  --charts free,paid \
  --limit 5 \
  --max-reviews 160
```

常用参数：

- `--force`：覆盖已有缓存并重新抓取
- `--no-analyze`：只抓评论统计，不调用 LLM
- `--limit`：每个榜单生成多少个 App 页面
- `--max-reviews`：每个 App 最多抓取多少条评论

## Docker 部署

```bash
cp .env.example .env.production
npm run build
docker compose --env-file .env.production up -d --build
curl http://127.0.0.1:3095/api/health
```

生产环境推荐：

```env
NEXT_PUBLIC_SITE_URL=https://your-domain.example
APP_REVIEW_CACHE_DIR=/app/src/data/app-cache
```

默认 Docker 端口是 `3095`。挂到 Nginx、Caddy 或 Cloudflare Tunnel 时，把外部域名代理到该端口即可。

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

你可以这样说：

- `分析 ChatGPT 的 App Store 用户评价，重点看版本风险和产品机会`
- `帮我找一个同类 App 的差评痛点，看看有没有独立开发机会`
- `把这个 App 的评论整理成产品洞察页结构`

Skill 会引导 Agent 使用公开站点、API、缓存页面和 DeepSeek flash 分析流程。

## 技术栈

- Next.js 15 + React 19 + TypeScript
- Tailwind CSS
- ECharts / Recharts
- Apple iTunes Lookup API / App Store RSS Reviews
- OpenAI-compatible SDK，默认接入 DeepSeek v4 flash
- 本地 JSON 缓存，可扩展到 KV、Supabase 或对象存储
- Docker Compose / standalone Next.js 部署

## 限制与边界

- App Store RSS 评论接口有分页和地区差异，结果取决于国家区、抓取时间和 Apple 返回内容。
- AI 洞察不是事实裁决，页面会保留原始评论证据，建议结合证据判断。
- 公开生成会限流并复用缓存，避免无成本批量消耗 LLM token。
- Serverless 平台需要额外配置持久化存储，否则缓存和历史评论不会稳定保留。

## Troubleshooting

| 问题 | 解决方法 |
| --- | --- |
| `AI 服务密钥未配置或不可用` | 检查 `.env.local` 的 `QIAOMU_LLM_API_KEY` 或 `DEEPSEEK_API_KEY`，然后重启 dev server。 |
| 搜索到的 App 不对 | 带上国家区和 App Store 链接，例如 `https://apps.apple.com/us/app/chatgpt/id6448311069`。 |
| 详情页没有 AI 摘要 | 点击更新洞察，或确认服务能访问 LLM API。也可以先用 `--no-analyze` 只生成评论缓存。 |
| Docker 启动后无缓存 | 确认 `APP_REVIEW_CACHE_DIR` 指向容器内可写路径，并挂载 volume。 |
| 线上页面链接不对 | 设置 `NEXT_PUBLIC_SITE_URL=https://你的域名` 后更新缓存页。 |

## 关于向阳乔木

这个项目来自向阳乔木的 AI 工作流实践：我更关心工具如何进入真实产品、内容和增长工作，而不只是停留在模型参数或产品发布本身。

- 个人站：[qiaomu.ai](https://qiaomu.ai)
- 博客：[blog.qiaomu.ai](https://blog.qiaomu.ai)
- 乔木推荐：[tuijian.qiaomu.ai](https://tuijian.qiaomu.ai)
- X：[@vista8](https://x.com/vista8)
- GitHub：[@joeseesun](https://github.com/joeseesun/)

<a name="english"></a>

---

# Qiaomu App Review Insights

> Turn App Store reviews into product research evidence: pain points, opportunities, version risks, and voice-of-customer signals.

Qiaomu App Review Insights helps product managers, indie hackers, researchers, and content teams turn noisy App Store comments into structured insight pages: summaries, pain points, opportunities, positive signals, user segments, version risks, action plans, charts, and original review evidence.

## Why It Exists

App Store reviews contain product truth: why users churn, why they pay, which updates broke trust, and where competitors leave openings. Reading them manually is slow. This project fetches review samples, runs DeepSeek flash analysis, and generates durable pages that are easy to share, revisit, and cite.

## Highlights

- Search by App Store URL, App ID, or app name
- Fetch reviews from Apple RSS and App Store page samples
- Analyze reviews with an OpenAI-compatible LLM, defaulting to `deepseek-v4-flash`
- Preserve review evidence and source boundaries
- Generate cached, stable insight pages per app
- Show Top Free / Top Paid apps by country and category
- Visualize version sentiment, review sources, pain themes, and time ranges
- Protect public deployments with cache reuse, rate limits, and a generation queue

## Local Development

```bash
git clone https://github.com/joeseesun/qiaomu-app-review-insights.git
cd qiaomu-app-review-insights
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Minimum environment variables:

```env
QIAOMU_LLM_API_KEY=your_api_key
QIAOMU_LLM_BASE_URL=https://api.deepseek.com/v1
QIAOMU_LLM_MODEL=deepseek-v4-flash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
STORAGE_TYPE=local
```

## API

Generate or read a cached page:

```bash
curl -X POST http://localhost:3000/api/research \
  -H 'Content-Type: application/json' \
  -d '{"query":"ChatGPT","country":"us","maxReviews":160}'
```

Refresh insights:

```bash
curl -X POST http://localhost:3000/api/research/regenerate \
  -H 'Content-Type: application/json' \
  -d '{"appId":"6448311069","country":"us","maxReviews":160}'
```

Health check:

```bash
curl http://localhost:3000/api/health
```

## Agent Skill

Install the companion skill:

```bash
npx skills add joeseesun/qiaomu-app-review-skill
```

Example prompts:

- `Analyze ChatGPT App Store reviews and focus on version risks.`
- `Find product opportunities from a competitor's negative reviews.`
- `Turn this App Store page into a product insight report.`

## License

MIT
