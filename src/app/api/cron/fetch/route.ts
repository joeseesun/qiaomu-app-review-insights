import { NextRequest, NextResponse } from 'next/server';
import { AppStoreService } from '@/lib/appstore/service';

const appStoreService = new AppStoreService();

// POST /api/cron/fetch - 定时抓取任务
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 验证 cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Starting scheduled fetch task');

    const result = await appStoreService.fetchAllAppsReviews(true);
    
    console.log(`Scheduled fetch completed: ${result.totalReviews} total reviews`);

    return NextResponse.json({
      success: true,
      message: `定时抓取完成，共获取 ${result.totalReviews} 条评论`,
      data: result,
    });
  } catch (error) {
    console.error('Scheduled fetch failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '定时抓取失败',
      },
      { status: 500 }
    );
  }
}

// GET /api/cron/fetch - 健康检查
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    message: 'Cron fetch endpoint is healthy',
    timestamp: new Date().toISOString(),
  });
}
