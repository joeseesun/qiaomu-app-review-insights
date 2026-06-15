import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { AnalysisService } from '@/lib/analysis/service';
import { ApiResponse, AggregatedAnalysis } from '@/types';

const storage = getStorage();
const analysisService = new AnalysisService();

// POST /api/apps/[id]/generate-analysis - 生成聚合分析报告
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ analysis: AggregatedAnalysis }>>> {
  try {
    const { id } = await params;
    
    // 检查应用是否存在
    const apps = await storage.getApps();
    const app = apps.find(a => a.id === id);
    
    if (!app) {
      return NextResponse.json(
        {
          success: false,
          error: '应用不存在',
        },
        { status: 404 }
      );
    }

    console.log(`Generating aggregated analysis for app: ${app.name} (${app.id})`);

    // 若还没有分析结果，先尝试执行评论分析
    const existingResults = await storage.getAnalysisResults(id);
    if (!existingResults || existingResults.length === 0) {
      const reviews = await storage.getReviews(id);
      if (!reviews || reviews.length === 0) {
        return NextResponse.json({
          success: false,
          error: '该应用还没有评论数据，请先抓取评论',
        }, { status: 400 });
      }

      try {
        console.log(`No existing analysis, running analyze for ${reviews.length} reviews...`);
        await analysisService.analyzeAppReviews(id, { batchSize: 3, includeAnalyzed: false });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const hint = msg.includes('MOONSHOT_API_KEY') ? '，请先在 .env.local 配置 MOONSHOT_API_KEY 并重启' : '';
        return NextResponse.json({
          success: false,
          error: `分析评论失败${hint}: ${msg}`,
        }, { status: 500 });
      }
    }

    // 生成聚合分析
    const analysis = await analysisService.generateAggregatedAnalysis(id);
    
    console.log(`Analysis generated for app: ${app.name}, ${analysis.totalReviews} reviews analyzed`);

    return NextResponse.json({
      success: true,
      data: { analysis },
      message: '分析报告生成成功',
    });
  } catch (error) {
    console.error('Failed to generate analysis:', error);
    
    const errorMessage = error instanceof Error ? error.message : '生成分析报告失败';
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
