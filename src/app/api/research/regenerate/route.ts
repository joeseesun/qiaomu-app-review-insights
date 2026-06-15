import { NextRequest, NextResponse } from 'next/server';
import { generateCachedReviewPage } from '@/lib/appstore/cache';
import { normalizeCountry } from '@/lib/appstore/discovery';
import { ApiResponse } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RegenerateRequest {
  appId?: string;
  country?: string;
  maxReviews?: number;
  analyze?: boolean;
}

interface RegenerateResponse {
  pageUrl: string;
  updatedAt: string;
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

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<RegenerateResponse>>> {
  try {
    const body = await request.json() as RegenerateRequest;
    const appId = String(body.appId || '').trim();

    if (!/^\d+$/.test(appId)) {
      return NextResponse.json({ success: false, error: '缺少有效 App ID' }, { status: 400 });
    }

    const { page } = await generateCachedReviewPage({
      appId,
      country: normalizeCountry(body.country),
      maxReviews: clampReviewLimit(body.maxReviews),
      analyze: body.analyze !== false,
      force: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        pageUrl: page.pagePath,
        updatedAt: page.updatedAt,
      },
    });
  } catch (error) {
    console.error('Regenerate request failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: safeErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
