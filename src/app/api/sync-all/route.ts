import { NextRequest, NextResponse } from 'next/server';
import { AppStoreService } from '@/lib/appstore/service';
import { AnalysisService } from '@/lib/analysis/service';
import { getStorage } from '@/lib/storage';

interface AppSyncResult {
  appId: string;
  appName: string;
  success: boolean;
  fetchResult?: {
    reviewCount: number;
    message: string;
  };
  analysisResult?: {
    analyzedCount: number;
    message: string;
  };
  error?: string;
  processingTime: number;
}

interface GlobalSyncResult {
  totalApps: number;
  successfulApps: number;
  failedApps: number;
  totalNewReviews: number;
  totalAnalyzedReviews: number;
  appResults: AppSyncResult[];
  totalTime: number;
}

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    console.log('Starting global sync for all apps');
    
    const storage = getStorage();
    const appStoreService = new AppStoreService();
    const analysisService = new AnalysisService();
    
    // 获取配置
    const body = await request.json().catch(() => ({}));
    const {
      promptTemplateId = 'default',
      analyzeAll = false,
      maxConcurrentApps = 2 // 限制并发处理的应用数量
    } = body;
    
    // 获取所有应用
    const apps = await storage.getApps();
    
    if (apps.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalApps: 0,
          successfulApps: 0,
          failedApps: 0,
          totalNewReviews: 0,
          totalAnalyzedReviews: 0,
          appResults: [],
          totalTime: 0
        },
        message: '没有找到应用'
      });
    }
    
    console.log(`Found ${apps.length} apps to sync`);
    
    const appResults: AppSyncResult[] = [];
    let totalNewReviews = 0;
    let totalAnalyzedReviews = 0;
    let successfulApps = 0;
    let failedApps = 0;
    
    // 分批处理应用，控制并发数
    for (let i = 0; i < apps.length; i += maxConcurrentApps) {
      const appBatch = apps.slice(i, i + maxConcurrentApps);
      
      console.log(`Processing app batch ${Math.floor(i / maxConcurrentApps) + 1}/${Math.ceil(apps.length / maxConcurrentApps)}`);
      
      const batchPromises = appBatch.map(async (app) => {
        const appStartTime = Date.now();
        
        try {
          console.log(`Syncing app: ${app.name} (${app.id})`);
          
          // 抓取评论
          const reviews = await appStoreService.fetchAppReviews(app.id, true);
          const fetchResult = {
            reviewCount: reviews.length,
            message: `成功抓取 ${reviews.length} 条新评论`
          };
          
          // 分析评论
          const analysisResults = await analysisService.analyzeAppReviews(app.id, {
            promptTemplateId,
            includeAnalyzed: analyzeAll,
          });
          
          const analysisResult = {
            analyzedCount: analysisResults.length,
            message: `成功分析 ${analysisResults.length} 条评论`
          };
          
          const processingTime = Date.now() - appStartTime;
          
          console.log(`Completed sync for ${app.name}: ${fetchResult.reviewCount} new reviews, ${analysisResult.analyzedCount} analyzed`);
          
          return {
            appId: app.id,
            appName: app.name,
            success: true,
            fetchResult,
            analysisResult,
            processingTime: Math.round(processingTime / 1000)
          } as AppSyncResult;
          
        } catch (error) {
          const processingTime = Date.now() - appStartTime;
          
          console.error(`Failed to sync app ${app.name}:`, error);
          
          return {
            appId: app.id,
            appName: app.name,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            processingTime: Math.round(processingTime / 1000)
          } as AppSyncResult;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      appResults.push(...batchResults);
      
      // 统计结果
      for (const result of batchResults) {
        if (result.success) {
          successfulApps++;
          totalNewReviews += result.fetchResult?.reviewCount || 0;
          totalAnalyzedReviews += result.analysisResult?.analyzedCount || 0;
        } else {
          failedApps++;
        }
      }
      
      // 批次间添加延迟
      if (i + maxConcurrentApps < apps.length) {
        console.log('Waiting between app batches...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    const result: GlobalSyncResult = {
      totalApps: apps.length,
      successfulApps,
      failedApps,
      totalNewReviews,
      totalAnalyzedReviews,
      appResults,
      totalTime: Math.round(totalTime / 1000)
    };
    
    console.log(`Global sync completed in ${result.totalTime}s:`, {
      totalApps: result.totalApps,
      successful: result.successfulApps,
      failed: result.failedApps,
      newReviews: result.totalNewReviews,
      analyzedReviews: result.totalAnalyzedReviews
    });
    
    return NextResponse.json({
      success: true,
      data: result,
      message: `全局同步完成：${result.successfulApps}/${result.totalApps} 个应用成功，抓取 ${result.totalNewReviews} 条新评论，分析 ${result.totalAnalyzedReviews} 条评论`
    });
    
  } catch (error) {
    console.error('Failed to perform global sync:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
