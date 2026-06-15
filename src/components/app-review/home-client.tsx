'use client';

import { FormEvent, useMemo, useState } from 'react';
import {
  AlertCircle,
  Apple,
  ArrowUpRight,
  CheckCircle2,
  ChevronsUpDown,
  Lightbulb,
  Loader2,
  Search,
  Star,
  TrendingDown,
  X,
} from 'lucide-react';
import { InsightGrid } from '@/components/app-review/insight-cards';
import { BrandMark, RewardSupportDialog, SiteAffordances, SiteFooter } from '@/components/app-review/site-footer';
import {
  ReviewSourceBreakdown,
  ReviewSourceBreakdownPanel,
  reviewSourceLabel,
} from '@/components/app-review/source-breakdown';
import { TopChartsSection } from '@/components/app-review/top-charts-section';
import { AppStoreReview } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Priority = 'high' | 'medium' | 'low';

interface AppStoreLookupResult {
  id: string;
  name: string;
  country: string;
  artistName: string;
  artworkUrl: string;
  trackViewUrl: string;
  averageUserRating?: number;
  userRatingCount?: number;
  primaryGenreName?: string;
  version?: string;
  currentVersionReleaseDate?: string;
}

interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<string, number>;
  versionDistribution: Array<{ version: string; count: number; averageRating: number }>;
  latestReviewDate?: string;
  oldestReviewDate?: string;
  negativeShare: number;
  positiveShare: number;
}

interface ReviewMiningItem {
  title: string;
  summary: string;
  evidence?: string;
  priority?: Priority;
}

interface ReviewMiningResponse {
  executiveSummary: string;
  painPoints: ReviewMiningItem[];
  opportunities: ReviewMiningItem[];
  positiveSignals: ReviewMiningItem[];
  userSegments: ReviewMiningItem[];
  versionRisks: ReviewMiningItem[];
  actionPlan: ReviewMiningItem[];
  queryAngles: string[];
  model: string;
  generatedAt: string;
}

interface ResearchData {
  app: AppStoreLookupResult;
  candidates: AppStoreLookupResult[];
  source: 'url' | 'id' | 'search';
  stats: ReviewStats;
  reviews: AppStoreReview[];
  sourceBreakdown?: ReviewSourceBreakdown;
  insights: ReviewMiningResponse | null;
  aiError?: string;
  pageUrl: string;
  updatedAt: string;
  cached: boolean;
  generation?: {
    status: 'cached' | 'generated' | 'deduped' | 'queued';
    message?: string;
    limit?: {
      limit: number;
      used: number;
      remaining: number;
      resetAt: string;
    };
  };
  model?: {
    provider: string;
    model: string;
  };
}

interface FeaturedAppSummary {
  id: string;
  name: string;
  country: string;
  artistName: string;
  artworkUrl: string;
  pagePath: string;
  updatedAt: string;
  averageRating: number;
  totalReviews: number;
  negativeShare: number;
  positiveShare: number;
  primaryGenreName?: string;
}

interface TopChartCountry {
  value: string;
  label: string;
}

interface TopChartCategory {
  value: string;
  label: string;
  genre?: string;
}

interface TopChartApp {
  rank: number;
  id: string;
  name: string;
  artistName: string;
  artworkUrl: string;
  categoryName?: string;
  appStoreUrl?: string;
  country: string;
  chart: 'free' | 'paid';
  category: string;
  cached?: {
    pagePath: string;
    updatedAt: string;
    totalReviews: number;
    averageRating: number;
    negativeShare: number;
    hasInsights: boolean;
  };
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const countryOptions = [
  { value: 'cn', label: '中国' },
  { value: 'us', label: '美国' },
  { value: 'jp', label: '日本' },
  { value: 'gb', label: '英国' },
  { value: 'de', label: '德国' },
  { value: 'fr', label: '法国' },
  { value: 'kr', label: '韩国' },
  { value: 'hk', label: '香港' },
  { value: 'tw', label: '台湾' },
];

const CACHED_APP_PAGE_SIZE = 12;

function formatDate(value?: string) {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知';
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(date);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatFullDate(value?: string) {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function ratingCount(stats: ReviewStats, rating: number) {
  return stats.ratingDistribution[String(rating)] || 0;
}

function maxRatingBucket(stats: ReviewStats) {
  return Math.max(1, ...[1, 2, 3, 4, 5].map((rating) => ratingCount(stats, rating)));
}

function hasMeaningfulClientInsights(insights: ReviewMiningResponse | null | undefined) {
  if (!insights) return false;
  const summary = String(insights.executiveSummary || '').trim();
  const hasDefaultSummary = /暂无足够评论|暂无明显信号|暂未生成/.test(summary);
  const hasItems = [
    insights.painPoints,
    insights.opportunities,
    insights.positiveSignals,
    insights.userSegments,
    insights.versionRisks,
    insights.actionPlan,
  ].some((items) => Array.isArray(items) && items.length > 0);

  return Boolean(summary && !hasDefaultSummary && hasItems);
}

function AppIcon({ app }: { app: AppStoreLookupResult }) {
  if (!app.artworkUrl) {
    return (
      <div className="grid h-16 w-16 place-items-center rounded-lg bg-zinc-900 text-white">
        <Apple className="h-8 w-8" />
      </div>
    );
  }

  return (
    <img
      src={app.artworkUrl}
      alt={`${app.name} icon`}
      className="h-16 w-16 rounded-lg border border-zinc-200 bg-white object-cover shadow-sm"
    />
  );
}

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

function pageHref(page: number) {
  return page <= 1 ? '/#cached-apps' : `/?cachePage=${page}#cached-apps`;
}

function FeaturedApps({ apps, currentPage }: { apps: FeaturedAppSummary[]; currentPage: number }) {
  if (apps.length === 0) return null;
  const totalPages = Math.ceil(apps.length / CACHED_APP_PAGE_SIZE);
  const page = clampPage(currentPage, totalPages);
  const pageApps = apps.slice((page - 1) * CACHED_APP_PAGE_SIZE, page * CACHED_APP_PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((item) => item === 1 || item === totalPages || Math.abs(item - page) <= 1);

  return (
    <section id="cached-apps" className="mx-auto max-w-7xl scroll-mt-6 px-4 pt-6 sm:px-6 lg:px-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">已生成的 App 洞察页</h2>
          <p className="mt-1 text-sm text-zinc-500">所有查询过的 App 都会出现在这里，按最近更新时间分页展示。</p>
        </div>
        <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-500">
          共 {apps.length} 个 · 第 {page}/{totalPages} 页
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pageApps.map((app) => (
          <a
            key={`${app.country}-${app.id}`}
            href={app.pagePath}
            className="group flex min-w-0 gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
          >
            {app.artworkUrl ? (
              <img
                src={app.artworkUrl}
                alt={`${app.name} icon`}
                className="h-12 w-12 shrink-0 rounded-lg border border-zinc-200 bg-white object-cover"
              />
            ) : (
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-zinc-950 text-white">
                <Apple className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="truncate text-sm font-semibold text-zinc-950 group-hover:text-teal-700">{app.name}</h3>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">
                  {app.country.toUpperCase()}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-zinc-500">{app.artistName || app.primaryGenreName || 'App Store'}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-700">{app.averageRating || 0} 星</span>
                <span className="rounded-md bg-zinc-50 px-2 py-1 text-zinc-600">{app.totalReviews} 条</span>
                <span className="rounded-md bg-rose-50 px-2 py-1 text-rose-700">{formatPercent(app.negativeShare)}</span>
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">更新 {formatDate(app.updatedAt)}</p>
            </div>
          </a>
        ))}
      </div>
      {totalPages > 1 ? (
        <nav className="mt-4 flex flex-wrap items-center justify-center gap-2" aria-label="App 分页">
          <a
            href={pageHref(page - 1)}
            className={`rounded-md border px-3 py-2 text-sm transition ${
              page <= 1
                ? 'pointer-events-none border-zinc-100 bg-zinc-50 text-zinc-300'
                : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950'
            }`}
          >
            上一页
          </a>
          {pageNumbers.map((item, index) => {
            const previous = pageNumbers[index - 1];
            return (
              <span key={item} className="inline-flex items-center gap-2">
                {previous && item - previous > 1 ? <span className="text-sm text-zinc-400">...</span> : null}
                <a
                  href={pageHref(item)}
                  aria-current={item === page ? 'page' : undefined}
                  className={`min-w-10 rounded-md border px-3 py-2 text-center text-sm transition ${
                    item === page
                      ? 'border-zinc-950 bg-zinc-950 text-white'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950'
                  }`}
                >
                  {item}
                </a>
              </span>
            );
          })}
          <a
            href={pageHref(page + 1)}
            className={`rounded-md border px-3 py-2 text-sm transition ${
              page >= totalPages
                ? 'pointer-events-none border-zinc-100 bg-zinc-50 text-zinc-300'
                : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950'
            }`}
          >
            下一页
          </a>
        </nav>
      ) : null}
    </section>
  );
}

export default function Home({
  featuredApps = [],
  initialCachePage = 1,
  topChartCountries = [],
  topChartCategories = [],
  initialTopChartApps = [],
}: {
  featuredApps?: FeaturedAppSummary[];
  initialCachePage?: number;
  topChartCountries?: TopChartCountry[];
  topChartCategories?: TopChartCategory[];
  initialTopChartApps?: TopChartApp[];
}) {
  const [query, setQuery] = useState('ChatGPT');
  const [country, setCountry] = useState('cn');
  const [maxReviews, setMaxReviews] = useState(160);
  const analyze = true;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ResearchData | null>(null);
  const [rewardOpen, setRewardOpen] = useState(false);

  const maxBucket = useMemo(() => result ? maxRatingBucket(result.stats) : 1, [result]);
  const visibleInsights = result?.insights && hasMeaningfulClientInsights(result.insights) ? result.insights : null;

  const runResearch = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, country, maxReviews, analyze }),
      });
      const payload = await response.json() as ApiResponse<ResearchData>;

      if (!response.ok || !payload.success || !payload.data) {
        if (response.status === 429) {
          setRewardOpen(true);
        }
        throw new Error(payload.error || '检索失败');
      }

      setResult(payload.data);
      if (payload.data.generation?.status === 'queued') {
        setRewardOpen(true);
      }
    } catch (researchError) {
      setError(researchError instanceof Error ? researchError.message : '检索失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <BrandMark compact />
          <div className="flex items-center gap-2">
            <SiteAffordances subtle />
          </div>
        </div>
      </header>

      <section className="border-b border-zinc-200 bg-[#fdfdfb]">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="max-w-3xl text-base leading-7 text-zinc-600">
              搜索 App Store 应用，生成用户评价洞察页，提炼痛点、机会、版本风险和关键摘要。
            </p>
            <form onSubmit={runResearch} className="mt-6 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_130px_118px_44px]">
                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="App Store 链接、App ID 或应用名称"
                    className="h-11 rounded-md border-zinc-200 bg-zinc-50 pl-9 pr-10 text-base focus-visible:ring-zinc-900"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        setError('');
                      }}
                      aria-label="清除搜索内容"
                      className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <div className="relative">
                  <select
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    className="h-11 w-full appearance-none rounded-md border border-zinc-200 bg-zinc-50 px-3 pr-8 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                    aria-label="App Store country"
                  >
                    {countryOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                </div>
                <div className="relative">
                  <select
                    value={maxReviews}
                    onChange={(event) => setMaxReviews(Number(event.target.value))}
                    className="h-11 w-full appearance-none rounded-md border border-zinc-200 bg-zinc-50 px-3 pr-8 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                    aria-label="Review limit"
                  >
                    <option value={80}>80 条</option>
                    <option value={160}>160 条</option>
                    <option value={260}>260 条</option>
                    <option value={400}>400 条</option>
                  </select>
                  <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                </div>
                <Button type="submit" size="icon" disabled={loading || !query.trim()} className="h-11 w-full rounded-md bg-zinc-950 hover:bg-zinc-800 lg:w-11">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </form>
            {error ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {result ? (
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="min-w-0 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-4">
                  <AppIcon app={result.app} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-2xl font-semibold leading-tight text-zinc-950">{result.app.name}</h2>
                      <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs text-zinc-500">
                        {result.app.country.toUpperCase()}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-zinc-500">{result.app.artistName || '未知开发者'}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                      {result.app.primaryGenreName ? <span className="rounded-md bg-zinc-100 px-2 py-1">{result.app.primaryGenreName}</span> : null}
                      {result.app.version ? <span className="rounded-md bg-zinc-100 px-2 py-1">v{result.app.version}</span> : null}
                      <span className="rounded-md bg-zinc-100 px-2 py-1">{result.source === 'search' ? '名称匹配' : result.source === 'url' ? '链接解析' : 'ID 查询'}</span>
                    </div>
                  </div>
                </div>
                {result.app.trackViewUrl ? (
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={result.pageUrl}
                      className="inline-flex items-center justify-center gap-1 rounded-md bg-zinc-950 px-3 py-2 text-sm text-white transition hover:bg-zinc-800"
                    >
                      查看洞察页
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                    <a
                      href={result.app.trackViewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950"
                    >
                      App Store
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ) : null}
              </div>
              <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-800">
                已{result.cached ? '找到已有' : '生成'}评价洞察页：<a href={result.pageUrl} className="font-semibold underline underline-offset-4">{result.pageUrl}</a>
                <span className="ml-2 text-teal-700">更新于 {formatFullDate(result.updatedAt)}</span>
              </div>
              {result.generation?.message ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                  {result.generation.message}
                </div>
              ) : null}
            </section>

            <section className="min-w-0 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-500">样本均分</p>
                  <p className="mt-1 text-3xl font-semibold text-zinc-950">{result.stats.averageRating || '0.00'}</p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-amber-50 text-amber-600">
                  <Star className="h-6 w-6 fill-current" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = ratingCount(result.stats, rating);
                  const width = `${Math.max(3, Math.round((count / maxBucket) * 100))}%`;
                  return (
                    <div key={rating} className="grid grid-cols-[24px_minmax(0,1fr)_40px] items-center gap-2 text-xs text-zinc-500">
                      <span>{rating}星</span>
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                        <div className="h-full rounded-full bg-amber-400" style={{ width }} />
                      </div>
                      <span className="text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-zinc-500">抓取评论</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">{result.stats.totalReviews}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-zinc-500">差评占比</p>
              <p className="mt-2 text-2xl font-semibold text-rose-600">{formatPercent(result.stats.negativeShare)}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-zinc-500">好评占比</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-600">{formatPercent(result.stats.positiveShare)}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-zinc-500">时间范围</p>
              <p className="mt-2 text-lg font-semibold text-zinc-950">{formatDate(result.stats.oldestReviewDate)} - {formatDate(result.stats.latestReviewDate)}</p>
            </div>
          </div>

          <ReviewSourceBreakdownPanel breakdown={result.sourceBreakdown} className="mt-4" />

          <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">DeepSeek 信息挖掘</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {result.model ? `${result.model.provider} · ${result.model.model}` : '评论证据优先'}
                </p>
              </div>
              {visibleInsights ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  已生成
                </span>
              ) : null}
            </div>

            {result.aiError ? (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {result.aiError}
              </div>
            ) : null}

            {visibleInsights ? (
              <>
                <p className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm leading-7 text-zinc-700">
                  {visibleInsights.executiveSummary}
                </p>
                <div className="mt-4">
                  <InsightGrid insights={visibleInsights} />
                </div>
                {visibleInsights.queryAngles.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {visibleInsights.queryAngles.map((angle) => (
                      <span key={angle} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-700">
                        {angle}
                      </span>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-lg bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                {result.stats.totalReviews > 0 ? 'AI 洞察暂未生成或需要更新。' : '暂无评论样本。'}
              </div>
            )}
          </section>

          {result.stats.versionDistribution.length > 0 ? (
            <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-950">版本样本</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {result.stats.versionDistribution.map((version) => (
                  <div key={version.version} className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
                    <p className="truncate text-sm font-semibold text-zinc-900">{version.version}</p>
                    <p className="mt-2 text-xs text-zinc-500">{version.count} 条 · {version.averageRating} 星</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-zinc-950">评论证据</h2>
              <span className="text-sm text-zinc-500">{result.reviews.length} 条</span>
            </div>
            <div className="space-y-3">
              {result.reviews.map((review) => (
                <article key={review.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-semibold leading-6 text-zinc-950">{review.title}</h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        {review.version || 'Unknown'} · {formatDate(review.updated)} · {review.authorName || '匿名'} · {reviewSourceLabel(review.source, review.sourceCountry || review.country)}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-white px-2 py-1 text-xs text-amber-700">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {review.rating}
                    </span>
                  </div>
                  <p className="mt-3 break-words text-sm leading-7 text-zinc-700">{review.content}</p>
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : (
        <>
          <TopChartsSection
            countries={topChartCountries}
            categories={topChartCategories}
            initialApps={initialTopChartApps}
          />
          <FeaturedApps apps={featuredApps} currentPage={initialCachePage} />
          <section className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-3 lg:px-8">
            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <TrendingDown className="h-5 w-5 text-rose-600" />
              <h2 className="mt-3 text-base font-semibold text-zinc-950">差评聚类</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">把抱怨压缩成可验证主题，保留原文证据。</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <Lightbulb className="h-5 w-5 text-amber-600" />
              <h2 className="mt-3 text-base font-semibold text-zinc-950">需求挖掘</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">从用户表达里提取机会、风险和行动项。</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <Star className="h-5 w-5 text-emerald-600" />
              <h2 className="mt-3 text-base font-semibold text-zinc-950">口碑信号</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">同时捕捉高分评论里的留存理由。</p>
            </div>
          </section>
        </>
      )}
      <SiteFooter />
      <RewardSupportDialog open={rewardOpen} onOpenChange={setRewardOpen} />
    </main>
  );
}
