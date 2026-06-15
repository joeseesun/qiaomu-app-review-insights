import { NextRequest, NextResponse } from 'next/server';
import { ReviewMiningResponse } from '@/lib/analysis/kimi-client';
import { ReviewSourceBreakdown, generateCachedReviewPage } from '@/lib/appstore/cache';
import { ReviewDiagnostics } from '@/lib/appstore/diagnostics';
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

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<ResearchResponse>>> {
  try {
    const body = await request.json() as ResearchRequest;
    const query = String(body.query || '').trim();
    const country = normalizeCountry(body.country);
    const maxReviews = clampReviewLimit(body.maxReviews);
    const shouldAnalyze = body.analyze !== false;
    const force = body.force === true;

    const { page, cached } = await generateCachedReviewPage({
      query,
      country,
      maxReviews,
      analyze: shouldAnalyze,
      force,
    });

    return NextResponse.json({
      success: true,
      data: {
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
        model: page.model,
      },
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
