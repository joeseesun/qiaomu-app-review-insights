import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { AnalysisService } from '@/lib/analysis/service';
import { ApiResponse } from '@/types';

const storage = getStorage();
const analysisService = new AnalysisService();

interface OptimizeResult {
  reviewsCount: number;
  analysisCount: number;
  cleanedCount: number;
  tokenEstimate: number;
  recommendations: string[];
}

// POST /api/apps/[id]/optimize - 优化应用数据和分析
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<OptimizeResult>>> {
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

    console.log(`Starting optimization for app: ${app.name} (${app.id})`);

    // 获取当前数据统计
    const reviews = await storage.getReviews(id);
    const analysisResults = await storage.getAnalysisResults(id);
    
    // 清理无效的分析结果
    const cleanedCount = await analysisService.cleanupAnalysisResults(id);
    
    // 计算 token 估算
    const promptTemplates = await storage.getPromptTemplates();
    const defaultTemplate = promptTemplates.find(t => t.id === 'default');
    
    let tokenEstimate = 0;
    if (defaultTemplate) {
      // 估算未分析评论的 token 消耗
      const validAnalysisIds = new Set((await storage.getAnalysisResults(id)).map(a => a.reviewId));
      const unanalyzedReviews = reviews.filter(r => !validAnalysisIds.has(r.id));
      
      tokenEstimate = unanalyzedReviews.reduce((total, review) => {
        const text = `${review.title} ${review.content}`;
        const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
        return total + Math.ceil(chineseChars * 1.5 + englishWords * 1.3);
      }, 0);
    }
    
    // 生成优化建议
    const recommendations: string[] = [];
    
    if (cleanedCount > 0) {
      recommendations.push(`清理了 ${cleanedCount} 条无效的分析结果`);
    }
    
    const unanalyzedCount = reviews.length - (analysisResults.length - cleanedCount);
    if (unanalyzedCount > 0) {
      recommendations.push(`还有 ${unanalyzedCount} 条评论未分析`);
      
      if (tokenEstimate > 10000) {
        recommendations.push(`预计消耗 ${tokenEstimate} tokens，建议分批处理`);
      }
    }
    
    if (reviews.length > 100) {
      recommendations.push('评论数量较多，建议定期清理旧评论');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('数据状态良好，无需优化');
    }

    const result: OptimizeResult = {
      reviewsCount: reviews.length,
      analysisCount: analysisResults.length - cleanedCount,
      cleanedCount,
      tokenEstimate,
      recommendations,
    };

    console.log(`Optimization completed for app: ${app.name}`, result);

    return NextResponse.json({
      success: true,
      data: result,
      message: `应用 ${app.name} 数据优化完成`,
    });
  } catch (error) {
    console.error('Failed to optimize app data:', error);
    
    const errorMessage = error instanceof Error ? error.message : '数据优化失败';
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
