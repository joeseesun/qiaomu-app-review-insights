import { NextRequest, NextResponse } from 'next/server';
import { AnalysisService } from '@/lib/analysis/service';
import { ApiResponse } from '@/types';

const analysisService = new AnalysisService();

interface AnalyzeAllResult {
  totalAnalyzed: number;
  appResults: Array<{
    appId: string;
    appName: string;
    analyzedCount: number;
    error?: string;
  }>;
}

// POST /api/analyze-all - 批量分析所有应用的评论
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<AnalyzeAllResult>>> {
  try {
    console.log('Starting batch analysis for all apps');

    const result = await analysisService.analyzeAllAppsReviews({
      batchSize: 3, // 减小批次大小避免API限流
      includeAnalyzed: false, // 只分析未分析的评论
    });
    
    console.log(`Batch analysis completed: ${result.totalAnalyzed} total analyzed`);

    return NextResponse.json({
      success: true,
      data: result,
      message: `批量分析完成，共分析 ${result.totalAnalyzed} 条评论`,
    });
  } catch (error) {
    console.error('Failed to analyze all reviews:', error);
    
    const errorMessage = error instanceof Error ? error.message : '批量分析失败';
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
