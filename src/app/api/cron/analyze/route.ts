import { NextRequest, NextResponse } from 'next/server';
import { AnalysisService } from '@/lib/analysis/service';

const analysisService = new AnalysisService();

// POST /api/cron/analyze - 定时分析任务
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

    console.log('Starting scheduled analysis task');

    const result = await analysisService.analyzeAllAppsReviews({
      batchSize: 3,
      includeAnalyzed: false,
    });
    
    console.log(`Scheduled analysis completed: ${result.totalAnalyzed} total analyzed`);

    return NextResponse.json({
      success: true,
      message: `定时分析完成，共分析 ${result.totalAnalyzed} 条评论`,
      data: result,
    });
  } catch (error) {
    console.error('Scheduled analysis failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '定时分析失败',
      },
      { status: 500 }
    );
  }
}

// GET /api/cron/analyze - 健康检查
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    message: 'Cron analyze endpoint is healthy',
    timestamp: new Date().toISOString(),
  });
}
