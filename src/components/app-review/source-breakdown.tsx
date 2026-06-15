import { Database, Globe2, Rss } from 'lucide-react';

export interface ReviewSourceCountryBreakdown {
  country: string;
  count: number;
  rssCount: number;
  htmlCount: number;
}

export interface ReviewSourceBreakdown {
  total: number;
  rssCount: number;
  htmlCount: number;
  unknownCount: number;
  countryCount: number;
  countries: ReviewSourceCountryBreakdown[];
  note: string;
  trackedReviewCount?: number;
  statsTotal?: number;
  estimated?: boolean;
}

interface ReviewSourceBreakdownPanelProps {
  breakdown?: ReviewSourceBreakdown;
  className?: string;
}

function formatCountry(country: string) {
  if (country === 'multi') return '多区';
  return country.toUpperCase();
}

function countrySummary(countries: ReviewSourceCountryBreakdown[]) {
  if (countries.length === 0) return '暂无国家/地区样本';
  return countries
    .slice(0, 6)
    .map((item) => `${formatCountry(item.country)} ${item.count}`)
    .join(' · ');
}

export function reviewSourceLabel(source?: string, country?: string) {
  const sourceText = source === 'app-store-html'
    ? '页面补样本'
    : source === 'apple-rss'
      ? 'RSS 最近评论'
      : '来源待识别';
  const countryText = country ? ` · ${formatCountry(country)}` : '';
  return `${sourceText}${countryText}`;
}

export function ReviewSourceBreakdownPanel({ breakdown, className = '' }: ReviewSourceBreakdownPanelProps) {
  if (!breakdown || breakdown.total === 0) return null;
  const hasPartialTracking = Boolean(
    breakdown.trackedReviewCount && breakdown.trackedReviewCount < breakdown.total
  );

  return (
    <section className={`rounded-lg border border-zinc-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">数据来源</h2>
          <p className="mt-1 text-sm text-zinc-500">展示本页评论样本的抓取构成和边界。</p>
        </div>
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-500">
          {hasPartialTracking
            ? `${breakdown.trackedReviewCount} 条可追踪 / ${breakdown.total} 条统计`
            : `${breakdown.total} 条样本`}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Rss className="h-4 w-4 text-sky-600" />
            RSS 最近评论
          </div>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">{breakdown.rssCount}</p>
          <p className="mt-1 text-xs text-zinc-500">通常包含版本号和较新的评论时间。</p>
        </div>
        <div className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Database className="h-4 w-4 text-teal-600" />
            页面补样本
          </div>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">{breakdown.htmlCount}</p>
          <p className="mt-1 text-xs text-zinc-500">来自 App Store 页面服务端渲染的评论块。</p>
        </div>
        <div className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Globe2 className="h-4 w-4 text-amber-600" />
            Storefront
          </div>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">{breakdown.countryCount}</p>
          <p className="mt-1 truncate text-xs text-zinc-500" title={countrySummary(breakdown.countries)}>
            {countrySummary(breakdown.countries)}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-zinc-500">
        {breakdown.estimated ? '旧缓存估算。' : ''}
        {breakdown.note}
        {breakdown.unknownCount > 0 ? ` 另有 ${breakdown.unknownCount} 条旧缓存评论来源无法识别。` : ''}
      </p>
    </section>
  );
}
