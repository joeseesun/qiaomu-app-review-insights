import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertCircle, Apple, ArrowLeft, ArrowUpRight, Lightbulb, Star, Target, TrendingDown } from 'lucide-react';
import { InsightGrid } from '@/components/app-review/insight-cards';
import { RegenerateButton } from '@/components/app-review/regenerate-button';
import { BrandMark, SiteFooter } from '@/components/app-review/site-footer';
import { ReviewSourceBreakdownPanel, reviewSourceLabel } from '@/components/app-review/source-breakdown';
import { VersionDiagnosticsPanel } from '@/components/app-review/version-diagnostics';
import {
  CachedAppReviewPage,
  buildAppPagePath,
  buildCanonicalUrl,
  generateCachedReviewPage,
  hasMeaningfulInsights,
  readCachedReviewPage,
} from '@/lib/appstore/cache';
import { buildReviewDiagnostics } from '@/lib/appstore/diagnostics';
import { normalizeCountry } from '@/lib/appstore/discovery';

export const runtime = 'nodejs';
export const revalidate = 3600;

type PageProps = {
  params: Promise<{
    country: string;
    appId: string;
    slug?: string[];
  }>;
};

function formatDate(value?: string) {
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

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function ratingCount(page: CachedAppReviewPage, rating: number) {
  return page.stats.ratingDistribution[String(rating)] || 0;
}

function maxRatingBucket(page: CachedAppReviewPage) {
  return Math.max(1, ...[1, 2, 3, 4, 5].map((rating) => ratingCount(page, rating)));
}

async function getPage(country: string, appId: string) {
  const normalizedCountry = normalizeCountry(country);
  const cached = await readCachedReviewPage(normalizedCountry, appId);
  if (cached) return cached;

  const generated = await generateCachedReviewPage({
    appId,
    country: normalizedCountry,
    maxReviews: 160,
    analyze: true,
  });

  return generated.page;
}

function metadataDescription(page: CachedAppReviewPage) {
  return `基于 ${page.stats.totalReviews} 条 ${page.app.name} App Store 用户评价，提炼评分趋势、差评痛点、产品机会、版本风险和关键摘要。更新时间：${formatDate(page.updatedAt)}。`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { country, appId } = await params;
  const normalizedCountry = normalizeCountry(country);
  const cached = await readCachedReviewPage(normalizedCountry, appId);

  if (!cached) {
    return {
      title: `App ${appId} 评价洞察`,
      description: 'App Store 用户评价分析页面，生成后可查看评价洞察页。',
      alternates: {
        canonical: buildCanonicalUrl(`/apps/${normalizedCountry}/${appId}`),
      },
    };
  }

  const canonicalPath = buildAppPagePath(cached.app);

  return {
    title: `${cached.app.name}评价分析 - App Store用户评论洞察`,
    description: metadataDescription(cached),
    keywords: [
      cached.app.name,
      `${cached.app.name}评价`,
      `${cached.app.name}评论`,
      'App Store评论分析',
      '用户反馈挖掘',
      'DeepSeek flash',
      '产品需求分析',
    ],
    alternates: {
      canonical: buildCanonicalUrl(canonicalPath),
    },
    openGraph: {
      title: `${cached.app.name}评价分析`,
      description: metadataDescription(cached),
      url: buildCanonicalUrl(canonicalPath),
      siteName: '乔木App评价洞察',
      images: cached.app.artworkUrl ? [{ url: cached.app.artworkUrl, alt: `${cached.app.name} icon` }] : undefined,
      type: 'article',
    },
  };
}

export default async function AppInsightPage({ params }: PageProps) {
  const { country, appId } = await params;
  const page = await getPage(country, appId);
  const insights = hasMeaningfulInsights(page.insights) ? page.insights : null;
  const diagnostics = page.diagnostics || buildReviewDiagnostics(page.reviews);
  const maxBucket = maxRatingBucket(page);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${page.app.name}评价分析`,
    description: metadataDescription(page),
    datePublished: page.generatedAt,
    dateModified: page.updatedAt,
    author: {
      '@type': 'Person',
      name: '向阳乔木',
      url: 'https://qiaomu.ai',
    },
    publisher: {
      '@type': 'Organization',
      name: '乔木App评价洞察',
      url: 'https://appreview.qiaomu.ai',
      logo: {
        '@type': 'ImageObject',
        url: 'https://appreview.qiaomu.ai/logo.svg',
      },
    },
    mainEntity: {
      '@type': 'SoftwareApplication',
      name: page.app.name,
      applicationCategory: page.app.primaryGenreName || 'iOS App',
      operatingSystem: 'iOS',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: page.stats.averageRating || page.app.averageUserRating || 0,
        reviewCount: page.stats.totalReviews,
      },
    },
  };

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-zinc-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="border-b border-zinc-200 bg-white/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark compact />
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950">
            <ArrowLeft className="h-4 w-4" />
            返回搜索
          </Link>
        </div>
      </header>

      <section className="border-b border-zinc-200 bg-[#fdfdfb]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
          <div className="min-w-0">
            <div className="flex min-w-0 gap-4">
              {page.app.artworkUrl ? (
                <img
                  src={page.app.artworkUrl}
                  alt={`${page.app.name} icon`}
                  className="h-20 w-20 shrink-0 rounded-2xl border border-zinc-200 bg-white object-cover shadow-sm"
                />
              ) : (
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-zinc-950 text-white">
                  <Apple className="h-9 w-9" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs text-teal-700">
                    {page.app.country.toUpperCase()} 区
                  </span>
                  {page.app.primaryGenreName ? (
                    <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-500">
                      {page.app.primaryGenreName}
                    </span>
                  ) : null}
                </div>
                <h1 className="mt-3 break-words text-3xl font-semibold leading-tight text-zinc-950 sm:text-4xl">
                  {page.app.name}评价分析
                </h1>
                <p className="mt-2 text-sm text-zinc-500">{page.app.artistName || 'App Store'} · 更新于 {formatDate(page.updatedAt)}</p>
                <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-700">
                  本页基于 App Store 用户评价生成，面向产品分析和竞品研究，保留评论证据、来源构成和样本边界，并用 DeepSeek flash 提炼可行动信号。
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {page.app.trackViewUrl ? (
                <a
                  href={page.app.trackViewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950"
                >
                  App Store
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              ) : null}
              <RegenerateButton appId={page.app.id} country={page.app.country} />
            </div>
          </div>

          <aside className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-500">样本均分</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-semibold text-zinc-950">{page.stats.averageRating || '0.00'}</span>
              <span className="pb-1 text-sm text-zinc-500">/ 5</span>
            </div>
            <div className="mt-4 space-y-2">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = ratingCount(page, rating);
                const width = `${Math.max(3, Math.round((count / maxBucket) * 100))}%`;
                return (
                  <div key={rating} className="grid grid-cols-[28px_minmax(0,1fr)_42px] items-center gap-2 text-xs text-zinc-500">
                    <span>{rating}星</span>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-amber-400" style={{ width }} />
                    </div>
                    <span className="text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">评论样本</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">{page.stats.totalReviews}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">差评占比</p>
          <p className="mt-2 text-2xl font-semibold text-rose-600">{formatPercent(page.stats.negativeShare)}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">好评占比</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">{formatPercent(page.stats.positiveShare)}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">模型</p>
          <p className="mt-2 truncate text-lg font-semibold text-zinc-950">{page.model?.model || '评论统计'}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
        <ReviewSourceBreakdownPanel breakdown={page.sourceBreakdown} />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-950">摘要</h2>
          {insights ? (
            <p className="mt-3 text-base leading-8 text-zinc-700">{insights.executiveSummary}</p>
          ) : (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{page.aiError || 'AI 洞察暂未生成或需要更新；页面仍保留评分、版本和评论证据。'}</span>
            </div>
          )}
        </div>
      </section>

      <VersionDiagnosticsPanel diagnostics={diagnostics} appName={page.app.name} />

      {insights ? (
        <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
          <InsightGrid insights={insights} />
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-950">版本样本</h2>
            <div className="mt-4 space-y-3">
              {page.stats.versionDistribution.length === 0 ? (
                <p className="text-sm text-zinc-500">暂无版本样本。</p>
              ) : page.stats.versionDistribution.map((version) => (
                <div key={version.version} className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
                  <p className="truncate text-sm font-semibold text-zinc-900">{version.version}</p>
                  <p className="mt-2 text-xs text-zinc-500">{version.count} 条 · {version.averageRating} 星</p>
                </div>
              ))}
            </div>
          </aside>

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-zinc-950">评论证据</h2>
              <span className="text-sm text-zinc-500">{page.reviews.length} 条精选样本</span>
            </div>
            <div className="space-y-3">
              {page.reviews.map((review) => (
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
        </div>
      </section>

      <section className="border-t border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div>
            <TrendingDown className="h-5 w-5 text-rose-600" />
            <h2 className="mt-3 text-base font-semibold text-zinc-950">这个页面适合团队怎么用？</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">同一个链接里保留摘要、更新时间和评论证据，方便产品、运营和研发对齐同一版结论。</p>
          </div>
          <div>
            <Lightbulb className="h-5 w-5 text-amber-600" />
            <h2 className="mt-3 text-base font-semibold text-zinc-950">这些结论可靠吗？</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">页面保留摘要、证据、痛点和行动项，每个判断都尽量回到原始评论样本。</p>
          </div>
          <div>
            <Target className="h-5 w-5 text-teal-600" />
            <h2 className="mt-3 text-base font-semibold text-zinc-950">数据如何更新？</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">页面记录更新时间，可点击更新洞察，抓取最新评论并更新当前页面。</p>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
