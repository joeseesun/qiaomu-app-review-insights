import { NextRequest, NextResponse } from 'next/server';
import { AnalysisService } from '@/lib/analysis/service';

interface AnalyzeResult {
  analyzedCount: number;
  message: string;
  stats?: {
    totalReviews: number;
    alreadyAnalyzed: number;
    newlyAnalyzed: number;
    processingTime: number;
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const startTime = Date.now();
    
    console.log(`Starting massive analysis for app: ${id}`);
    
    const analysisService = new AnalysisService();
    
    // 获取分析配置
    const body = await request.json().catch(() => ({}));
    const {
      promptTemplateId = 'default',
      includeAnalyzed = false,
      forceReanalyze = false
    } = body;
    
    // 执行分析
    const analysisResults = await analysisService.analyzeAppReviews(id, {
      promptTemplateId,
      includeAnalyzed: forceReanalyze ? true : includeAnalyzed,
    });
    
    const processingTime = Date.now() - startTime;
    
    // 获取统计信息
    const storage = analysisService['storage']; // 访问私有属性
    const allReviews = await storage.getReviews(id);
    const allAnalysis = await storage.getAnalysisResults(id);
    
    const result: AnalyzeResult = {
      analyzedCount: analysisResults.length,
      message: `成功分析 ${analysisResults.length} 条评论`,
      stats: {
        totalReviews: allReviews.length,
        alreadyAnalyzed: allAnalysis.length - analysisResults.length,
        newlyAnalyzed: analysisResults.length,
        processingTime: Math.round(processingTime / 1000) // 转换为秒
      }
    };
    
    console.log(`Massive analysis completed for app ${id}:`, result.stats);
    
    return NextResponse.json({
      success: true,
      data: result,
      message: result.message,
    });
    
  } catch (error) {
    console.error('Failed to analyze reviews:', error);
    
    let errorMessage = '分析评论失败';
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
