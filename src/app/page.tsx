import type { Metadata } from 'next';
import AppReviewHome from '@/components/app-review/home-client';
import { getCachedAppSummaries } from '@/lib/appstore/cache';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '乔木App评价洞察 - App Store用户评价分析与DeepSeek信息挖掘',
  description: '搜索任意 iOS App，生成可缓存、可分享、SEO 友好的评价洞察页面，用 DeepSeek flash 从 App Store 评论中提炼痛点、机会、版本风险和用户需求。',
  keywords: [
    '乔木App评价洞察',
    'App评价分析',
    'App Store评论分析',
    '用户反馈挖掘',
    'DeepSeek flash',
    'GEO',
    'SEO',
    '产品需求分析',
  ],
  alternates: {
    canonical: 'https://appreview.qiaomu.ai/',
  },
  openGraph: {
    title: '乔木App评价洞察',
    description: '把 App Store 用户评价生成可缓存的 SEO 洞察页面，快速发现产品痛点、机会和版本风险。',
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

  return <AppReviewHome featuredApps={featuredApps} initialCachePage={initialCachePage} />;
}
