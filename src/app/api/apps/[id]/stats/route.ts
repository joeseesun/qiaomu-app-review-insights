import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { ApiResponse } from '@/types';

const storage = getStorage();

interface AppStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<string, number>;
  lastAnalyzed?: string;
  analysisProgress: number;
}

// GET /api/apps/[id]/stats - 获取应用统计信息
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<AppStats>>> {
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

    // 并行获取数据以提高性能
    const [reviews, analysisResults] = await Promise.all([
      storage.getReviews(id),
      storage.getAnalysisResults(id)
    ]);

    // 计算统计信息
    const totalReviews = reviews.length;
    let averageRating = 0;
    const ratingDistribution: Record<string, number> = {};

    if (totalReviews > 0) {
      let totalRating = 0;

      // 优化：使用 for 循环而不是 forEach，性能更好
      for (let i = 0; i < reviews.length; i++) {
        const rating = reviews[i].rating;
        ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
        totalRating += parseInt(rating) || 0;
      }

      averageRating = totalRating / totalReviews;
    }

    // 分析进度
    const analysisProgress = totalReviews > 0
      ? (analysisResults.length / totalReviews) * 100
      : 0;

    // 最后分析时间 - 优化：如果没有分析结果就不排序
    const lastAnalyzed = analysisResults.length > 0
      ? analysisResults.reduce((latest, current) =>
          new Date(current.analyzedAt) > new Date(latest.analyzedAt) ? current : latest
        ).analyzedAt
      : undefined;

    const stats: AppStats = {
      totalReviews,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution,
      lastAnalyzed,
      analysisProgress: Math.round(analysisProgress),
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Failed to get app stats:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '获取应用统计信息失败',
      },
      { status: 500 }
    );
  }
}
