import 'server-only';

import { promises as fs } from 'fs';
import path from 'path';
import { KimiClient, ReviewMiningResponse } from '@/lib/analysis/kimi-client';
import { AppStoreFetcher } from '@/lib/appstore/fetcher';
import {
  AppResolution,
  AppStoreLookupResult,
  lookupAppById,
  normalizeCountry,
  resolveAppQuery,
} from '@/lib/appstore/discovery';
import { ReviewDiagnostics, buildReviewDiagnostics } from '@/lib/appstore/diagnostics';
import { ReviewStats, sortReviewsForAnalysis, summarizeReviews } from '@/lib/appstore/review-summary';
import { AppReviewSource, AppStoreReview } from '@/types';

export interface CachedModelInfo {
  provider: string;
  model: string;
}

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

export interface CachedAppReviewPage {
  cacheVersion: number;
  cacheKey: string;
  pagePath: string;
  canonicalUrl: string;
  app: AppStoreLookupResult;
  candidates: AppStoreLookupResult[];
  source: AppResolution['source'];
  stats: ReviewStats;
  reviews: AppStoreReview[];
  sourceBreakdown?: ReviewSourceBreakdown;
  diagnostics?: ReviewDiagnostics;
  insights: ReviewMiningResponse | null;
  aiError?: string;
  model?: CachedModelInfo;
  generatedAt: string;
  updatedAt: string;
  reviewSampleSize: number;
  maxReviews: number;
}

export interface FeaturedAppSummary {
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

interface GenerateCachedReviewOptions {
  query?: string;
  appId?: string;
  country?: string;
  maxReviews?: number;
  analyze?: boolean;
  force?: boolean;
}

interface GenerateCachedReviewResult {
  page: CachedAppReviewPage;
  cached: boolean;
}

const CACHE_VERSION = 1;
const DEFAULT_SITE_URL = 'https://appreview.qiaomu.ai';

function cacheRoot() {
  return process.env.APP_REVIEW_CACHE_DIR || path.join(process.cwd(), 'src', 'data', 'app-cache');
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
}

function safeCacheKey(country: string, appId: string) {
  return `${normalizeCountry(country)}-${appId.replace(/\D/g, '')}`;
}

function cacheFilePath(country: string, appId: string) {
  return path.join(cacheRoot(), `${safeCacheKey(country, appId)}.json`);
}

export function slugifyAppName(name: string) {
  const slug = name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  return slug || 'app-review-insights';
}

export function buildAppPagePath(app: Pick<AppStoreLookupResult, 'id' | 'country' | 'name'>) {
  return `/apps/${normalizeCountry(app.country)}/${app.id}/${encodeURIComponent(slugifyAppName(app.name))}`;
}

export function buildCanonicalUrl(pagePath: string) {
  return `${siteUrl()}${pagePath}`;
}

export function hasMeaningfulInsights(insights: ReviewMiningResponse | null | undefined) {
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

function clampReviewLimit(value?: number) {
  if (!Number.isFinite(value)) return 160;
  return Math.min(Math.max(Math.trunc(value || 160), 20), 400);
}

function pageCountForLimit(limit: number) {
  return Math.min(Math.max(Math.ceil(limit / 50), 1), 8);
}

function inferReviewSource(review: AppStoreReview): AppReviewSource | 'unknown' {
  if (review.source === 'apple-rss' || review.source === 'app-store-html') {
    return review.source;
  }

  if (review.contentTypeLabel === 'Review' || review.link?.includes('apps.apple.com')) {
    return 'app-store-html';
  }

  if (review.link?.includes('itunes.apple.com') || (review.version && review.version !== 'Unknown')) {
    return 'apple-rss';
  }

  return 'unknown';
}

export function buildReviewSourceBreakdown(reviews: AppStoreReview[], primaryCountry: string): ReviewSourceBreakdown {
  const countryBuckets = new Map<string, ReviewSourceCountryBreakdown>();
  let rssCount = 0;
  let htmlCount = 0;
  let unknownCount = 0;

  for (const review of reviews) {
    const source = inferReviewSource(review);
    const country = normalizeCountry(review.sourceCountry || review.country || primaryCountry);
    const bucket = countryBuckets.get(country) || {
      country,
      count: 0,
      rssCount: 0,
      htmlCount: 0,
    };

    bucket.count += 1;

    if (source === 'apple-rss') {
      rssCount += 1;
      bucket.rssCount += 1;
    } else if (source === 'app-store-html') {
      htmlCount += 1;
      bucket.htmlCount += 1;
    } else {
      unknownCount += 1;
    }

    countryBuckets.set(country, bucket);
  }

  return {
    total: reviews.length,
    rssCount,
    htmlCount,
    unknownCount,
    countryCount: countryBuckets.size,
    countries: Array.from(countryBuckets.values()).sort((a, b) => b.count - a.count),
    note: 'RSS 提供所选国家/地区的最近评论；App Store 页面补样本来自 Apple 页面展示的精选/有帮助评论，多 storefront 去重后用于补充样本，不代表全量评论库。',
  };
}

function buildLegacyEstimatedSourceBreakdown(
  page: CachedAppReviewPage,
  trackedBreakdown: ReviewSourceBreakdown,
  primaryCountry: string
): ReviewSourceBreakdown {
  const statsTotal = page.reviewSampleSize || page.stats?.totalReviews || trackedBreakdown.total;

  if (statsTotal <= trackedBreakdown.total) {
    return trackedBreakdown;
  }

  const unknownVersionCount = page.stats?.versionDistribution
    ?.find((item) => item.version === 'Unknown')?.count || 0;

  if (unknownVersionCount <= trackedBreakdown.htmlCount) {
    return {
      ...trackedBreakdown,
      statsTotal,
      trackedReviewCount: trackedBreakdown.total,
      note: `${trackedBreakdown.note} 旧缓存只保存了 ${trackedBreakdown.total} 条评论证据，来源构成按可追踪证据展示。`,
    };
  }

  const htmlCount = unknownVersionCount;
  const rssCount = Math.max(0, statsTotal - htmlCount);
  const countries = [
    rssCount > 0 ? {
      country: normalizeCountry(primaryCountry),
      count: rssCount,
      rssCount,
      htmlCount: 0,
    } : null,
    htmlCount > 0 ? {
      country: 'multi',
      count: htmlCount,
      rssCount: 0,
      htmlCount,
    } : null,
  ].filter((item): item is ReviewSourceCountryBreakdown => Boolean(item));

  return {
    total: statsTotal,
    rssCount,
    htmlCount,
    unknownCount: 0,
    countryCount: countries.length,
    countries,
    note: '这是旧缓存的来源估算：RSS 数量按统计样本总数减去 Unknown 版本样本推断，页面补样本按 Unknown 版本桶推断；新生成缓存会写入精确来源国家/地区。',
    trackedReviewCount: trackedBreakdown.total,
    statsTotal,
    estimated: true,
  };
}

function hydrateReviewSource(review: AppStoreReview, primaryCountry: string): AppStoreReview {
  const source = inferReviewSource(review);
  return {
    ...review,
    source: source === 'unknown' ? review.source : source,
    sourceCountry: review.sourceCountry || review.country || primaryCountry,
  };
}

function hydrateCachedReviewPage(page: CachedAppReviewPage): CachedAppReviewPage {
  const primaryCountry = page.app?.country || 'us';
  const reviews = (page.reviews || []).map((review) => hydrateReviewSource(review, primaryCountry));

  if (page.sourceBreakdown) {
    return {
      ...page,
      reviews,
    };
  }

  return {
    ...page,
    reviews,
    sourceBreakdown: buildLegacyEstimatedSourceBreakdown(
      page,
      buildReviewSourceBreakdown(reviews, primaryCountry),
      primaryCountry
    ),
  };
}

function safeErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return '未知错误';
  if (/api[_-]?key|authorization|secret|token/i.test(error.message)) {
    return 'AI 服务密钥未配置或不可用';
  }
  return error.message;
}

async function ensureCacheDir() {
  await fs.mkdir(cacheRoot(), { recursive: true });
}

async function atomicWriteJson(filePath: string, data: unknown) {
  await ensureCacheDir();
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.rename(tmpPath, filePath);
}

async function resolveApp(options: GenerateCachedReviewOptions): Promise<AppResolution> {
  const country = normalizeCountry(options.country);

  if (options.appId) {
    const app = await lookupAppById(options.appId, country);
    if (!app) {
      throw new Error(`没有在 ${country.toUpperCase()} 区找到 App ID ${options.appId}`);
    }
    return { app, candidates: [app], source: 'id' };
  }

  return resolveAppQuery(String(options.query || ''), country);
}

export async function readCachedReviewPage(country: string, appId: string): Promise<CachedAppReviewPage | null> {
  try {
    const content = await fs.readFile(cacheFilePath(country, appId), 'utf8');
    return hydrateCachedReviewPage(JSON.parse(content) as CachedAppReviewPage);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function listCachedReviewPages(): Promise<CachedAppReviewPage[]> {
  try {
    const files = await fs.readdir(cacheRoot());
    const pages = await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map(async (file) => {
          try {
            const content = await fs.readFile(path.join(cacheRoot(), file), 'utf8');
            return hydrateCachedReviewPage(JSON.parse(content) as CachedAppReviewPage);
          } catch {
            return null;
          }
        })
    );

    return pages.filter((page): page is CachedAppReviewPage => Boolean(page?.app?.id));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export async function getFeaturedCachedApps(limit = 18): Promise<FeaturedAppSummary[]> {
  const pages = await listCachedReviewPages();
  return pages
    .sort((a, b) => {
      const ratingDelta = (b.app.userRatingCount || 0) - (a.app.userRatingCount || 0);
      if (ratingDelta !== 0) return ratingDelta;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, limit)
    .map((page) => ({
      id: page.app.id,
      name: page.app.name,
      country: page.app.country,
      artistName: page.app.artistName,
      artworkUrl: page.app.artworkUrl,
      pagePath: page.pagePath,
      updatedAt: page.updatedAt,
      averageRating: page.stats.averageRating,
      totalReviews: page.stats.totalReviews,
      negativeShare: page.stats.negativeShare,
      positiveShare: page.stats.positiveShare,
      primaryGenreName: page.app.primaryGenreName,
    }));
}

export async function generateCachedReviewPage(options: GenerateCachedReviewOptions): Promise<GenerateCachedReviewResult> {
  const resolution = await resolveApp(options);
  const country = normalizeCountry(resolution.app.country);
  const maxReviews = clampReviewLimit(options.maxReviews);
  const existing = await readCachedReviewPage(country, resolution.app.id);

  const needsMoreReviews = existing ? maxReviews > existing.maxReviews : false;
  const needsAnalysis = existing ? options.analyze !== false && (!hasMeaningfulInsights(existing.insights) || Boolean(existing.aiError)) : false;

  if (existing && !options.force && !needsMoreReviews && !needsAnalysis) {
    return { page: existing, cached: true };
  }

  const reviews = await AppStoreFetcher.fetchReviews({
    appId: resolution.app.id,
    country,
    incremental: false,
    maxPages: pageCountForLimit(maxReviews),
    maxReviews,
  });

  if (existing && existing.stats.totalReviews > 0 && reviews.length < existing.stats.totalReviews) {
    console.warn('Skipping cache overwrite because App Store returned fewer reviews for an existing cached page', {
      appId: resolution.app.id,
      country,
      existingReviews: existing.stats.totalReviews,
      fetchedReviews: reviews.length,
      existingUpdatedAt: existing.updatedAt,
    });
    return { page: existing, cached: true };
  }

  if (reviews.length === 0 && (resolution.app.userRatingCount || 0) > 0) {
    if (existing && existing.stats.totalReviews > 0) {
      console.warn('Skipping cache overwrite because App Store returned no reviews for an app with public ratings', {
        appId: resolution.app.id,
        country,
        userRatingCount: resolution.app.userRatingCount,
        existingReviews: existing.stats.totalReviews,
        existingUpdatedAt: existing.updatedAt,
      });
      return { page: existing, cached: true };
    }

    throw new Error(`App Store 暂时没有返回 ${resolution.app.name} 的评论正文，但该应用有 ${resolution.app.userRatingCount} 个评分。请稍后重新生成。`);
  }

  const sortedReviews = sortReviewsForAnalysis(reviews);
  const stats = summarizeReviews(reviews);
  const sourceBreakdown = buildReviewSourceBreakdown(reviews, country);
  let insights: ReviewMiningResponse | null = null;
  let aiError: string | undefined;
  let model: CachedModelInfo | undefined;

  if (options.analyze !== false && reviews.length > 0) {
    try {
      const llm = new KimiClient();
      model = llm.getModelInfo();
      insights = await llm.mineReviewCorpus({
        appName: resolution.app.name,
        country,
        stats,
        reviews: sortedReviews.slice(0, 120).map((review) => ({
          id: review.id,
          title: review.title,
          content: review.content,
          rating: review.rating,
          version: review.version,
          updated: review.updated,
        })),
      });
    } catch (error) {
      console.error('Review mining failed:', error);
      aiError = safeErrorMessage(error);
    }
  }

  const now = new Date().toISOString();
  const pagePath = buildAppPagePath(resolution.app);
  const page: CachedAppReviewPage = {
    cacheVersion: CACHE_VERSION,
    cacheKey: safeCacheKey(country, resolution.app.id),
    pagePath,
    canonicalUrl: buildCanonicalUrl(pagePath),
    app: { ...resolution.app, country },
    candidates: resolution.candidates,
    source: resolution.source,
    stats,
    reviews: sortedReviews.slice(0, Math.min(maxReviews, 80)),
    sourceBreakdown,
    diagnostics: buildReviewDiagnostics(reviews),
    insights,
    aiError,
    model,
    generatedAt: existing?.generatedAt || now,
    updatedAt: now,
    reviewSampleSize: reviews.length,
    maxReviews,
  };

  await atomicWriteJson(cacheFilePath(country, resolution.app.id), page);
  return { page, cached: false };
}
