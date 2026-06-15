import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { ApiResponse, AppStoreReview, AnalysisResult } from '@/types';

const storage = getStorage();

interface ReviewsResponse {
  reviews: AppStoreReview[];
  analysisResults: AnalysisResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// GET /api/apps/[id]/reviews - 获取应用的评论列表
// Note: `params` is provided synchronously by Next.js route handlers
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<ReviewsResponse>>> {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    // 分页参数
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    
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

    // 获取评论和分析结果
    console.log('Getting reviews for app:', id);
    const allReviews = await storage.getReviews(id);
    console.log('Found reviews:', allReviews.length);

    // 暂时跳过分析结果查询，因为数据库表结构问题
    let analysisResults: any[] = [];
    try {
      analysisResults = await storage.getAnalysisResults(id);
      console.log('Found analysis results:', analysisResults.length);
    } catch (error) {
      console.warn('Analysis results query failed (expected if table structure not updated):', error);
      analysisResults = [];
    }
    
    // 按时间排序（最新的在前）
    const sortedReviews = allReviews.sort((a, b) => 
      new Date(b.updated).getTime() - new Date(a.updated).getTime()
    );
    
    // 分页
    const paginatedReviews = sortedReviews.slice(offset, offset + limit);
    const totalPages = Math.ceil(allReviews.length / limit);

    const response: ReviewsResponse = {
      reviews: paginatedReviews,
      analysisResults,
      pagination: {
        page,
        limit,
        total: allReviews.length,
        totalPages,
      },
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Failed to get reviews:', error);
    console.error('Error details:', error instanceof Error ? error.message : error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');

    return NextResponse.json(
      {
        success: false,
        error: `获取评论列表失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
