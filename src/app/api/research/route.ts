import { NextRequest, NextResponse } from 'next/server';
import { ReviewMiningResponse } from '@/lib/analysis/kimi-client';
import {
  CachedAppReviewPage,
  ReviewSourceBreakdown,
  generateCachedReviewPage,
  readCachedReviewPage,
  resolveAppForCache,
} from '@/lib/appstore/cache';
import { ReviewDiagnostics } from '@/lib/appstore/diagnostics';
import {
  GenerationLimitInfo,
  appGenerationKey,
  hasInFlightGeneration,
  isFreshCachedPage,
  publicCacheFreshDays,
  queuePublicGeneration,
  reservePublicGeneration,
  runDedupedGeneration,
} from '@/lib/appstore/generation-guard';
import { normalizeCountry, AppStoreLookupResult } from '@/lib/appstore/discovery';
import { ReviewStats } from '@/lib/appstore/review-summary';
import { ApiResponse, AppStoreReview } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ResearchRequest {
  query?: string;
  country?: string;
  maxReviews?: number;
  analyze?: boolean;
  force?: boolean;
}

interface ResearchResponse {
  app: AppStoreLookupResult;
  candidates: AppStoreLookupResult[];
  source: 'url' | 'id' | 'search';
  stats: ReviewStats;
  reviews: AppStoreReview[];
  sourceBreakdown?: ReviewSourceBreakdown;
  diagnostics?: ReviewDiagnostics;
  insights: ReviewMiningResponse | null;
  aiError?: string;
  pageUrl: string;
  updatedAt: string;
  cached: boolean;
  generation?: {
    status: 'cached' | 'generated' | 'deduped' | 'queued';
    message?: string;
    limit?: GenerationLimitInfo;
  };
  model?: {
    provider: string;
    model: string;
  };
}

function clampReviewLimit(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return 160;
  return Math.min(Math.max(parsed, 20), 400);
}

function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return '未知错误';
  if (/api[_-]?key|authorization|secret|token/i.test(error.message)) {
    return 'AI 服务密钥未配置或不可用';
  }
  return error.message;
}

function shouldGeneratePage(page: CachedAppReviewPage | null, options: {
  force: boolean;
  freshDays: number;
}) {
  if (!page) return true;
  if (options.force) return true;
  if (isFreshCachedPage(page, options.freshDays)) return false;
  return true;
}

function researchResponse(
  page: CachedAppReviewPage,
  cached: boolean,
  generation?: ResearchResponse['generation']
): ResearchResponse {
  return {
    app: page.app,
    candidates: page.candidates,
    source: page.source,
    stats: page.stats,
    reviews: page.reviews,
    sourceBreakdown: page.sourceBreakdown,
    diagnostics: page.diagnostics,
    insights: page.insights,
    aiError: page.aiError,
    pageUrl: page.pagePath,
    updatedAt: page.updatedAt,
    cached,
    generation,
    model: page.model,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<ResearchResponse>>> {
  try {
    const body = await request.json() as ResearchRequest;
    const query = String(body.query || '').trim();
    const country = normalizeCountry(body.country);
    const maxReviews = clampReviewLimit(body.maxReviews);
    const shouldAnalyze = body.analyze !== false;
    const publicForceEnabled = process.env.APP_REVIEW_ALLOW_PUBLIC_FORCE === 'true';
    const force = publicForceEnabled && body.force === true;
    const freshDays = publicCacheFreshDays();
    const resolution = await resolveAppForCache({ query, country });
    const resolvedCountry = normalizeCountry(resolution.app.country);
    const existing = await readCachedReviewPage(resolvedCountry, resolution.app.id);

    if (!shouldGeneratePage(existing, { force, freshDays })) {
      return NextResponse.json({
        success: true,
        data: researchResponse(existing!, true, {
          status: 'cached',
        }),
      });
    }

    const appKey = appGenerationKey(resolvedCountry, resolution.app.id);
    const alreadyInFlight = hasInFlightGeneration(appKey);

    if (!alreadyInFlight) {
      const reservation = await reservePublicGeneration(request, appKey);

      if (!reservation.allowed) {
        const limit = await queuePublicGeneration(request, {
          appKey,
          appId: resolution.app.id,
          appName: resolution.app.name,
          country: resolvedCountry,
          query,
          reason: 'rate-limited',
        });
        const message = existing
          ? '今天的新 App 生成次数已用完，已记录这个 App。你可以先查看已有洞察页，稍后再回来更新。'
          : '今天的新 App 生成次数已用完，已记录这个 App，稍后会进入后台生成队列。';

        if (existing) {
          return NextResponse.json({
            success: true,
            data: researchResponse(existing, true, {
              status: 'queued',
              message,
              limit,
            }),
          });
        }

        return NextResponse.json(
          {
            success: false,
            error: message,
          },
          { status: 429 }
        );
      }
    }

    const { result, deduped } = await runDedupedGeneration(appKey, () => generateCachedReviewPage({
      query,
      country: resolvedCountry,
      maxReviews,
      analyze: shouldAnalyze,
      force: force || Boolean(existing && !isFreshCachedPage(existing, freshDays)),
      resolution,
    }));
    const { page, cached } = result;

    return NextResponse.json({
      success: true,
      data: researchResponse(page, cached, {
        status: cached ? 'cached' : deduped ? 'deduped' : 'generated',
      }),
    });
  } catch (error) {
    console.error('Research request failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: safeErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
