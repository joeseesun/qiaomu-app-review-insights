import type { MetadataRoute } from 'next';
import { listCachedReviewPages } from '@/lib/appstore/cache';

const siteUrl = 'https://appreview.qiaomu.ai';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await listCachedReviewPages();

  return [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...pages.map((page) => ({
      url: `${siteUrl}${page.pagePath}`,
      lastModified: new Date(page.updatedAt),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];
}
