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
  lastFetched?: string;
}

// GET /api/apps/stats - 批量获取所有应用的统计信息
export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<Record<string, AppStats>>>> {
  try {
    // 获取所有应用
    const apps = await storage.getApps();
    
    if (apps.length === 0) {
      return NextResponse.json({
        success: true,
        data: {},
      });
    }

    // 并行获取所有评论和分析结果
    const allReviews = await storage.getReviews(); // 获取所有评论

    // 暂时跳过分析结果查询，因为数据库表结构问题
    let allAnalysisResults: any[] = [];
    try {
      allAnalysisResults = await storage.getAnalysisResults();
    } catch (error) {
      console.warn('Analysis results query failed (expected if table structure not updated):', error);
      allAnalysisResults = [];
    }

    // 按应用 ID 分组数据
    const reviewsByApp: Record<string, any[]> = {};
    const analysisByApp: Record<string, any[]> = {};

    // 分组评论
    allReviews.forEach(review => {
      const appId = review.appId;
      if (!reviewsByApp[appId]) {
        reviewsByApp[appId] = [];
      }
      reviewsByApp[appId].push(review);
    });

    // 分组分析结果
    allAnalysisResults.forEach(analysis => {
      const appId = analysis.appId;
      if (!analysisByApp[appId]) {
        analysisByApp[appId] = [];
      }
      analysisByApp[appId].push(analysis);
    });

    // 计算每个应用的统计信息
    const stats: Record<string, AppStats> = {};

    apps.forEach(app => {
      const appId = app.id;
      const reviews = reviewsByApp[appId] || [];
      const analysisResults = analysisByApp[appId] || [];

      const totalReviews = reviews.length;
      let averageRating = 0;
      const ratingDistribution: Record<string, number> = {};

      if (totalReviews > 0) {
        let totalRating = 0;
        
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

      // 最后分析时间
      const lastAnalyzed = analysisResults.length > 0 
        ? analysisResults.reduce((latest, current) => 
            new Date(current.analyzedAt) > new Date(latest.analyzedAt) ? current : latest
          ).analyzedAt
        : undefined;

      stats[appId] = {
        totalReviews,
        averageRating: Math.round(averageRating * 10) / 10,
        ratingDistribution,
        lastAnalyzed,
        analysisProgress: Math.round(analysisProgress),
        lastFetched: app.lastFetched,
      };
    });

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Failed to get apps stats:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '获取应用统计信息失败',
      },
      { status: 500 }
    );
  }
}
