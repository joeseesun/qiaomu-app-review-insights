import { NextRequest, NextResponse } from 'next/server';
import { AppStoreService } from '@/lib/appstore/service';
import { AnalysisService } from '@/lib/analysis/service';
import { getStorage } from '@/lib/storage';

interface SyncResult {
  fetchResult: {
    reviewCount: number;
    message: string;
  };
  analysisResult: {
    analyzedCount: number;
    message: string;
    stats?: {
      totalReviews: number;
      alreadyAnalyzed: number;
      newlyAnalyzed: number;
      processingTime: number;
    };
  };
  totalTime: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const startTime = Date.now();
    
    console.log(`Starting sync for app: ${id}`);
    
    const storage = getStorage();
    const appStoreService = new AppStoreService();
    const analysisService = new AnalysisService();
    
    // 检查应用是否存在
    const apps = await storage.getApps();
    const app = apps.find(a => a.id === id);
    
    if (!app) {
      return NextResponse.json(
        { success: false, error: '应用不存在' },
        { status: 404 }
      );
    }

    console.log(`Starting sync for app: ${app.name} (${app.id})`);

    // 第一步：增量抓取评论
    console.log('Step 1: Fetching new reviews...');
    const fetchStartTime = Date.now();
    
    const reviews = await appStoreService.fetchAppReviews(id, true); // 增量抓取
    
    const fetchTime = Date.now() - fetchStartTime;
    console.log(`Fetch completed in ${fetchTime}ms, got ${reviews.length} new reviews`);
    
    const fetchResult = {
      reviewCount: reviews.length,
      message: `成功抓取 ${reviews.length} 条新评论`,
    };

    // 第二步：分析新评论
    console.log('Step 2: Analyzing reviews...');
    const analysisStartTime = Date.now();
    
    // 获取分析配置
    const body = await request.json().catch(() => ({}));
    const {
      promptTemplateId = 'default',
      analyzeAll = false // 是否分析所有评论（包括已分析的）
    } = body;
    
    const analysisResults = await analysisService.analyzeAppReviews(id, {
      promptTemplateId,
      includeAnalyzed: analyzeAll,
    });
    
    const analysisTime = Date.now() - analysisStartTime;
    
    // 获取统计信息
    const allReviews = await storage.getReviews(id);
    const allAnalysis = await storage.getAnalysisResults(id);
    
    const analysisResult = {
      analyzedCount: analysisResults.length,
      message: `成功分析 ${analysisResults.length} 条评论`,
      stats: {
        totalReviews: allReviews.length,
        alreadyAnalyzed: allAnalysis.length - analysisResults.length,
        newlyAnalyzed: analysisResults.length,
        processingTime: Math.round(analysisTime / 1000)
      }
    };
    
    const totalTime = Date.now() - startTime;
    
    const result: SyncResult = {
      fetchResult,
      analysisResult,
      totalTime: Math.round(totalTime / 1000)
    };
    
    console.log(`Sync completed for app ${id} in ${result.totalTime}s:`, {
      newReviews: fetchResult.reviewCount,
      analyzedReviews: analysisResult.analyzedCount,
      totalReviews: analysisResult.stats?.totalReviews
    });
    
    return NextResponse.json({
      success: true,
      data: result,
      message: `同步完成：抓取 ${fetchResult.reviewCount} 条新评论，分析 ${analysisResult.analyzedCount} 条评论`,
    });
    
  } catch (error) {
    console.error('Failed to sync app:', error);
    
    let errorMessage = '同步失败';
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
