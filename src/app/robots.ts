import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/settings', '/prompts'],
    },
    sitemap: 'https://appreview.qiaomu.ai/sitemap.xml',
  };
}
