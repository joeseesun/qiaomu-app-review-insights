import 'server-only';

import { readCachedReviewPage } from '@/lib/appstore/cache';
import { normalizeCountry } from '@/lib/appstore/discovery';

export type TopChartType = 'free' | 'paid';

export interface TopChartCountry {
  value: string;
  label: string;
}

export interface TopChartCategory {
  value: string;
  label: string;
  genre?: string;
}

export interface TopChartApp {
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

interface AppleTopChartEntry {
  id?: {
    label?: string;
    attributes?: {
      'im:id'?: string;
    };
  };
  'im:name'?: { label?: string };
  'im:artist'?: { label?: string };
  'im:image'?: Array<{ label?: string }>;
  category?: {
    attributes?: {
      label?: string;
    };
  };
  link?: AppleTopChartLink | AppleTopChartLink[];
}

interface AppleTopChartLink {
  attributes?: {
    href?: string;
    rel?: string;
    type?: string;
  };
}

function getEntryAppStoreUrl(entry: AppleTopChartEntry, country: string, id: string) {
  const links = Array.isArray(entry.link) ? entry.link : entry.link ? [entry.link] : [];
  const appStoreLink = links.find((link) => {
    const attributes = link.attributes;
    return attributes?.href && attributes.rel === 'alternate' && attributes.type === 'text/html';
  }) || links.find((link) => link.attributes?.href?.includes('/app/'));

  return appStoreLink?.attributes?.href || `https://apps.apple.com/${country}/app/id${id}`;
}

const CHART_FEEDS: Record<TopChartType, string> = {
  free: 'topfreeapplications',
  paid: 'toppaidapplications',
};

export const TOP_CHART_COUNTRIES: TopChartCountry[] = [
  { value: 'cn', label: '中国' },
  { value: 'us', label: '美国' },
  { value: 'jp', label: '日本' },
  { value: 'gb', label: '英国' },
  { value: 'de', label: '德国' },
  { value: 'fr', label: '法国' },
  { value: 'kr', label: '韩国' },
  { value: 'hk', label: '香港' },
  { value: 'tw', label: '台湾' },
  { value: 'sg', label: '新加坡' },
  { value: 'ca', label: '加拿大' },
  { value: 'au', label: '澳大利亚' },
];

export const TOP_CHART_CATEGORIES: TopChartCategory[] = [
  { value: 'all', label: '全部 App' },
  { value: 'games', label: '游戏', genre: '6014' },
  { value: 'productivity', label: '效率', genre: '6007' },
  { value: 'social-networking', label: '社交', genre: '6005' },
  { value: 'entertainment', label: '娱乐', genre: '6016' },
  { value: 'shopping', label: '购物', genre: '6024' },
  { value: 'photo-video', label: '摄影与录像', genre: '6008' },
  { value: 'finance', label: '财务', genre: '6015' },
  { value: 'lifestyle', label: '生活', genre: '6012' },
  { value: 'education', label: '教育', genre: '6017' },
  { value: 'utilities', label: '工具', genre: '6002' },
  { value: 'music', label: '音乐', genre: '6011' },
  { value: 'food-drink', label: '美食佳饮', genre: '6023' },
  { value: 'health-fitness', label: '健康健美', genre: '6013' },
  { value: 'travel', label: '旅游', genre: '6003' },
  { value: 'news', label: '新闻', genre: '6009' },
  { value: 'sports', label: '体育', genre: '6004' },
  { value: 'business', label: '商务', genre: '6000' },
  { value: 'weather', label: '天气', genre: '6001' },
  { value: 'navigation', label: '导航', genre: '6010' },
  { value: 'reference', label: '参考', genre: '6006' },
  { value: 'medical', label: '医疗', genre: '6020' },
  { value: 'books', label: '图书', genre: '6018' },
  { value: 'magazines', label: '报刊杂志', genre: '6021' },
  { value: 'graphics-design', label: '图形与设计', genre: '6027' },
  { value: 'developer-tools', label: '开发工具', genre: '6026' },
];

export function normalizeTopChartType(value?: string): TopChartType {
  return value === 'paid' ? 'paid' : 'free';
}

export function normalizeTopChartCategory(value?: string): TopChartCategory {
  return TOP_CHART_CATEGORIES.find((category) => category.value === value) || TOP_CHART_CATEGORIES[0];
}

function topChartUrl(country: string, chart: TopChartType, category: TopChartCategory, limit: number) {
  const feed = CHART_FEEDS[chart];
  const genrePart = category.genre ? `/genre=${category.genre}` : '';
  return `https://itunes.apple.com/${country}/rss/${feed}/limit=${limit}${genrePart}/json`;
}

function normalizeEntry(entry: AppleTopChartEntry, index: number, country: string, chart: TopChartType, category: string): TopChartApp | null {
  const id = entry.id?.attributes?.['im:id'];
  const name = entry['im:name']?.label;

  if (!id || !name) return null;

  return {
    rank: index + 1,
    id,
    name,
    artistName: entry['im:artist']?.label || 'App Store',
    artworkUrl: entry['im:image']?.at(-1)?.label || '',
    categoryName: entry.category?.attributes?.label,
    appStoreUrl: getEntryAppStoreUrl(entry, country, id),
    country,
    chart,
    category,
  };
}

export async function fetchTopChartApps(options: {
  country?: string;
  chart?: string;
  category?: string;
  limit?: number;
}): Promise<TopChartApp[]> {
  const country = normalizeCountry(options.country);
  const chart = normalizeTopChartType(options.chart);
  const category = normalizeTopChartCategory(options.category);
  const limit = Math.min(Math.max(Math.trunc(options.limit || 10), 1), 10);
  const response = await fetch(topChartUrl(country, chart, category, limit), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'QiaomuAppReviewTopCharts/1.0',
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Apple Top Charts ${country}/${chart}/${category.value} 返回 HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawEntries = data?.feed?.entry;
  const entries = Array.isArray(rawEntries) ? rawEntries : rawEntries ? [rawEntries] : [];
  const apps = entries
    .map((entry: AppleTopChartEntry, index: number) => normalizeEntry(entry, index, country, chart, category.value))
    .filter((app: TopChartApp | null): app is TopChartApp => Boolean(app));

  return Promise.all(
    apps.map(async (app) => {
      const cached = await readCachedReviewPage(app.country, app.id);
      if (!cached) return app;

      return {
        ...app,
        cached: {
          pagePath: cached.pagePath,
          updatedAt: cached.updatedAt,
          totalReviews: cached.stats.totalReviews,
          averageRating: cached.stats.averageRating,
          negativeShare: cached.stats.negativeShare,
          hasInsights: Boolean(cached.insights),
        },
      };
    })
  );
}
