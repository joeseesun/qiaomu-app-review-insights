import type { Metadata } from 'next';
import AppReviewHome from '@/components/app-review/home-client';
import { getCachedAppSummaries } from '@/lib/appstore/cache';
import {
  TOP_CHART_CATEGORIES,
  TOP_CHART_COUNTRIES,
  fetchTopChartApps,
} from '@/lib/appstore/top-charts';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '乔木App评价洞察 - App Store用户评价分析与DeepSeek信息挖掘',
  description: '搜索任意 iOS App，生成用户评价洞察页面，用 DeepSeek flash 从 App Store 评论中提炼痛点、机会、版本风险和用户需求。',
  keywords: [
    '乔木App评价洞察',
    'App评价分析',
    'App Store评论分析',
    '用户反馈挖掘',
    'DeepSeek flash',
    '产品需求分析',
  ],
  alternates: {
    canonical: 'https://appreview.qiaomu.ai/',
  },
  openGraph: {
    title: '乔木App评价洞察',
    description: '把 App Store 用户评价生成产品洞察页面，快速发现产品痛点、机会和版本风险。',
    url: 'https://appreview.qiaomu.ai/',
    siteName: '乔木App评价洞察',
    type: 'website',
  },
};

type PageProps = {
  searchParams?: Promise<{
    cachePage?: string;
  }>;
};

function parseCachePage(value?: string) {
  const parsed = Number.parseInt(String(value || '1'), 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, parsed);
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const featuredApps = await getCachedAppSummaries();
  const initialCachePage = parseCachePage(params?.cachePage);
  const initialTopChartApps = await fetchTopChartApps({
    country: 'cn',
    chart: 'free',
    category: 'all',
    limit: 10,
  }).catch((error) => {
    console.error('Failed to load initial top charts:', error);
    return [];
  });

  return (
    <AppReviewHome
      featuredApps={featuredApps}
      initialCachePage={initialCachePage}
      topChartCountries={TOP_CHART_COUNTRIES}
      topChartCategories={TOP_CHART_CATEGORIES}
      initialTopChartApps={initialTopChartApps}
    />
  );
}
