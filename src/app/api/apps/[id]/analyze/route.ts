import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { AnalysisService } from '@/lib/analysis/service';
import { ApiResponse } from '@/types';

const storage = getStorage();
const analysisService = new AnalysisService();

interface AnalyzeResult {
  analyzedCount: number;
  message: string;
}

// POST /api/apps/[id]/analyze - 分析指定应用的评论
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<AnalyzeResult>>> {
  try {
    const { id } = params;
    
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

    // 检查是否有评论数据
    const reviews = await storage.getReviews(id);
    if (reviews.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '该应用还没有评论数据，请先抓取评论',
        },
        { status: 400 }
      );
    }

    console.log(`Starting to analyze reviews for app: ${app.name} (${app.id})`);

    // 分析评论
    const analysisResults = await analysisService.analyzeAppReviews(id, {
      batchSize: 3, // 减小批次大小避免API限流
      includeAnalyzed: false, // 只分析未分析的评论
    });
    
    const result: AnalyzeResult = {
      analyzedCount: analysisResults.length,
      message: `成功分析 ${analysisResults.length} 条评论`,
    };

    console.log(`Analysis completed for app: ${app.name}, analyzed ${analysisResults.length} reviews`);

    return NextResponse.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error) {
    console.error('Failed to analyze reviews:', error);
    
    const errorMessage = error instanceof Error ? error.message : '分析评论失败';
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
