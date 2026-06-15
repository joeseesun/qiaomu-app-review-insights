import { NextRequest, NextResponse } from 'next/server';
import { AppStoreService } from '@/lib/appstore/service';
import { ApiResponse } from '@/types';

const appStoreService = new AppStoreService();

interface FetchAllResult {
  totalReviews: number;
  appResults: Array<{
    appId: string;
    appName: string;
    reviewCount: number;
    error?: string;
  }>;
}

// POST /api/fetch-all - 批量抓取所有应用的评论
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<FetchAllResult>>> {
  try {
    console.log('Starting batch fetch for all apps');

    const result = await appStoreService.fetchAllAppsReviews(true);
    
    console.log(`Batch fetch completed: ${result.totalReviews} total reviews`);

    return NextResponse.json({
      success: true,
      data: result,
      message: `批量抓取完成，共获取 ${result.totalReviews} 条评论`,
    });
  } catch (error) {
    console.error('Failed to fetch all reviews:', error);
    
    const errorMessage = error instanceof Error ? error.message : '批量抓取失败';
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
