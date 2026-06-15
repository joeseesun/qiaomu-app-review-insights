import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { AnalysisService } from '@/lib/analysis/service';
import { ApiResponse, AggregatedAnalysis } from '@/types';

const storage = getStorage();
const analysisService = new AnalysisService();

// GET /api/apps/[id]/analysis - 获取聚合分析结果
// Note: `params` is provided synchronously by Next.js route handlers
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ analysis: AggregatedAnalysis | null }>>> {
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

    // 尝试生成聚合分析
    try {
      const analysis = await analysisService.generateAggregatedAnalysis(id);
      
      return NextResponse.json({
        success: true,
        data: { analysis },
      });
    } catch (error) {
      // 如果没有分析数据，返回 null
      console.log(`No analysis data available for app ${id}:`, error);
      
      return NextResponse.json({
        success: true,
        data: { analysis: null },
      });
    }
  } catch (error) {
    console.error('Failed to get analysis:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '获取分析结果失败',
      },
      { status: 500 }
    );
  }
}
