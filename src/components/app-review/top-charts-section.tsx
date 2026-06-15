'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, Bot, ChevronsUpDown, Loader2, RefreshCw, Trophy } from 'lucide-react';
import { RewardSupportDialog } from '@/components/app-review/site-footer';
import { Button } from '@/components/ui/button';

type TopChartType = 'free' | 'paid';

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
  chart: TopChartType;
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

interface TopChartsSectionProps {
  countries: TopChartCountry[];
  categories: TopChartCategory[];
  initialApps: TopChartApp[];
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function chartLabel(chart: TopChartType) {
  return chart === 'paid' ? '付费榜' : '免费榜';
}

function optionLabel<T extends { value: string; label: string }>(options: T[], value: string) {
  return options.find((option) => option.value === value)?.label || value.toUpperCase();
}

export function TopChartsSection({ countries, categories, initialApps }: TopChartsSectionProps) {
  const [country, setCountry] = useState('cn');
  const [category, setCategory] = useState('all');
  const [chart, setChart] = useState<TopChartType>('free');
  const [apps, setApps] = useState<TopChartApp[]>(initialApps);
  const [loading, setLoading] = useState(false);
  const [generatingId, setGeneratingId] = useState('');
  const [error, setError] = useState('');
  const [rewardOpen, setRewardOpen] = useState(false);

  const title = useMemo(
    () => `${optionLabel(countries, country)} · ${optionLabel(categories, category)} · ${chartLabel(chart)} Top 10`,
    [categories, category, chart, countries, country]
  );

  const fetchChart = async (next = { country, category, chart }) => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        country: next.country,
        category: next.category,
        chart: next.chart,
      });
      const response = await fetch(`/api/top-charts?${params.toString()}`);
      const payload = await response.json() as ApiResponse<TopChartApp[]>;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || '榜单获取失败');
      }

      setApps(payload.data);
    } catch (chartError) {
      setError(chartError instanceof Error ? chartError.message : '榜单获取失败');
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = async (next: Partial<{ country: string; category: string; chart: TopChartType }>) => {
    const merged = {
      country: next.country || country,
      category: next.category || category,
      chart: next.chart || chart,
    };
    if (next.country) setCountry(next.country);
    if (next.category) setCategory(next.category);
    if (next.chart) setChart(next.chart);
    await fetchChart(merged);
  };

  const generateInsight = async (app: TopChartApp) => {
    setGeneratingId(app.id);
    setError('');

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: app.id,
          country: app.country,
          maxReviews: 160,
          analyze: true,
        }),
      });
      const payload = await response.json() as ApiResponse<{
        pageUrl: string;
        updatedAt: string;
        stats: {
          totalReviews: number;
          averageRating: number;
          negativeShare: number;
        };
        insights: unknown;
        generation?: {
          status: 'cached' | 'generated' | 'deduped' | 'queued';
          message?: string;
        };
      }>;

      if (!response.ok || !payload.success || !payload.data) {
        if (response.status === 429) {
          setRewardOpen(true);
        }
        throw new Error(payload.error || '生成洞察失败');
      }
      if (payload.data.generation?.status === 'queued') {
        setRewardOpen(true);
      }

      setApps((items) => items.map((item) => item.id === app.id ? {
        ...item,
        cached: {
          pagePath: payload.data!.pageUrl,
          updatedAt: payload.data!.updatedAt,
          totalReviews: payload.data!.stats.totalReviews,
          averageRating: payload.data!.stats.averageRating,
          negativeShare: payload.data!.stats.negativeShare,
          hasInsights: Boolean(payload.data!.insights),
        },
      } : item));
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : '生成洞察失败');
    } finally {
      setGeneratingId('');
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">
              <Trophy className="h-4 w-4" />
              App Store Top Charts
            </div>
            <h2 className="mt-2 text-xl font-semibold text-zinc-950">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
              从 Apple 榜单选出基础 App 池，已生成的直接查看洞察，未生成的可以单独生成洞察页。
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[150px_minmax(0,1fr)_130px_44px]">
          <div className="relative">
            <select
              value={country}
              onChange={(event) => updateFilter({ country: event.target.value })}
              className="h-10 w-full appearance-none rounded-md border border-zinc-200 bg-zinc-50 px-3 pr-8 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              aria-label="Top chart country"
            >
              {countries.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </div>
          <div className="relative">
            <select
              value={category}
              onChange={(event) => updateFilter({ category: event.target.value })}
              className="h-10 w-full appearance-none rounded-md border border-zinc-200 bg-zinc-50 px-3 pr-8 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              aria-label="Top chart category"
            >
              {categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </div>
          <div className="relative">
            <select
              value={chart}
              onChange={(event) => updateFilter({ chart: event.target.value as TopChartType })}
              className="h-10 w-full appearance-none rounded-md border border-zinc-200 bg-zinc-50 px-3 pr-8 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              aria-label="Top chart type"
            >
              <option value="free">免费榜</option>
              <option value="paid">付费榜</option>
            </select>
            <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </div>
          <Button type="button" size="icon" onClick={() => fetchChart()} disabled={loading} className="h-10 w-full rounded-md bg-zinc-950 hover:bg-zinc-800 md:w-10">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        {error ? (
          <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-100">
          {apps.map((app) => (
            <div key={`${app.country}-${app.chart}-${app.category}-${app.id}`} className="grid gap-3 bg-white p-3 md:grid-cols-[42px_minmax(0,1fr)_220px] md:items-center">
              <div className="text-center text-lg font-semibold text-zinc-400">#{app.rank}</div>
              <div className="flex min-w-0 gap-3">
                {app.artworkUrl ? (
                  <img src={app.artworkUrl} alt={`${app.name} icon`} className="h-12 w-12 shrink-0 rounded-lg border border-zinc-200 bg-white object-cover" />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded-lg bg-zinc-100" />
                )}
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-zinc-950">{app.name}</h3>
                  <p className="mt-1 truncate text-xs text-zinc-500">{app.artistName}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5">{app.country.toUpperCase()}</span>
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5">{app.categoryName || optionLabel(categories, app.category)}</span>
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5">{chartLabel(app.chart)}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                {app.cached ? (
                  <>
                    <span className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">{app.cached.averageRating || 0} 星</span>
                    <span className="rounded-md bg-zinc-50 px-2 py-1 text-xs text-zinc-600">{app.cached.totalReviews} 条</span>
                    <span className="rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700">{formatPercent(app.cached.negativeShare)}</span>
                    <a href={app.cached.pagePath} className="inline-flex items-center gap-1 rounded-md bg-zinc-950 px-3 py-2 text-sm text-white transition hover:bg-zinc-800">
                      查看洞察
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => generateInsight(app)}
                    disabled={Boolean(generatingId)}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {generatingId === app.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                    生成洞察
                  </button>
                )}
                {app.appStoreUrl ? (
                  <a href={app.appStoreUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950">
                    App Store
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      <RewardSupportDialog open={rewardOpen} onOpenChange={setRewardOpen} />
    </section>
  );
}
