import { getStorage } from '@/lib/storage';
import { AppStoreFetcher } from './fetcher';
import { App, AppStoreReview, FetchConfig } from '@/types';

export class AppStoreService {
  private storage = getStorage();

  /**
   * 抓取指定应用的评论
   */
  async fetchAppReviews(appId: string, incremental = true): Promise<AppStoreReview[]> {
    const apps = await this.storage.getApps();
    const app = apps.find(a => a.id === appId);
    
    if (!app) {
      throw new Error(`App with ID ${appId} not found`);
    }

    const config: FetchConfig = {
      appId: app.id,
      country: app.country,
      incremental,
      lastFetched: app.lastFetched,
    };

    if (!AppStoreFetcher.validateConfig(config)) {
      throw new Error(`Invalid configuration for app ${appId}`);
    }

    const reviews = await AppStoreFetcher.fetchReviews(config);

    if (reviews.length > 0) {
      // 保存评论数据
      await this.storage.saveReviews(reviews);
      
      // 更新应用的最后抓取时间为这次抓取到的评论中最新的时间，避免跳过后续新评论
      const latestUpdated = reviews
        .map(r => new Date(r.updated))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime())[0];

      if (latestUpdated) {
        await this.updateAppLastFetched(appId, latestUpdated.toISOString());
      }
    }

    return reviews;
  }

  /**
   * 抓取所有应用的评论
   */
  async fetchAllAppsReviews(incremental = true): Promise<{
    totalReviews: number;
    appResults: Array<{
      appId: string;
      appName: string;
      reviewCount: number;
      error?: string;
    }>;
  }> {
    const apps = await this.storage.getApps();
    const results = [];
    let totalReviews = 0;

    for (const app of apps) {
      try {
        console.log(`Fetching reviews for ${app.name} (${app.id})...`);
        
        const reviews = await this.fetchAppReviews(app.id, incremental);
        
        results.push({
          appId: app.id,
          appName: app.name,
          reviewCount: reviews.length,
        });
        
        totalReviews += reviews.length;
        
        console.log(`Fetched ${reviews.length} reviews for ${app.name}`);
        
        // 添加延迟避免请求过于频繁
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to fetch reviews for ${app.name}:`, error);
        
        results.push({
          appId: app.id,
          appName: app.name,
          reviewCount: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      totalReviews,
      appResults: results,
    };
  }

  /**
   * 获取应用的评论统计信息
   */
  async getAppReviewStats(appId: string): Promise<{
    totalReviews: number;
    averageRating: number;
    ratingDistribution: Record<string, number>;
    latestReview?: AppStoreReview;
    oldestReview?: AppStoreReview;
  }> {
    const reviews = await this.storage.getReviews(appId);
    
    if (reviews.length === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: {},
      };
    }

    // 计算评分分布
    const ratingDistribution: Record<string, number> = {};
    let totalRating = 0;

    reviews.forEach(review => {
      const rating = review.rating;
      ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
      totalRating += parseInt(rating) || 0;
    });

    // 按时间排序
    const sortedReviews = reviews.sort((a, b) => 
      new Date(b.updated).getTime() - new Date(a.updated).getTime()
    );

    return {
      totalReviews: reviews.length,
      averageRating: totalRating / reviews.length,
      ratingDistribution,
      latestReview: sortedReviews[0],
      oldestReview: sortedReviews[sortedReviews.length - 1],
    };
  }

  /**
   * 获取所有应用的评论统计信息
   */
  async getAllAppsStats(): Promise<Array<{
    app: App;
    stats: Awaited<ReturnType<typeof this.getAppReviewStats>>;
  }>> {
    const apps = await this.storage.getApps();
    const results = [];

    for (const app of apps) {
      const stats = await this.getAppReviewStats(app.id);
      results.push({ app, stats });
    }

    return results;
  }

  /**
   * 更新应用的最后抓取时间
   */
  private async updateAppLastFetched(appId: string, lastFetchedAt: string): Promise<void> {
    const apps = await this.storage.getApps();
    const updatedApps = apps.map(app =>
      app.id === appId
        ? { ...app, lastFetched: lastFetchedAt }
        : app
    );

    await this.storage.saveApps(updatedApps);
  }

  /**
   * 清理旧评论数据（可选功能）
   */
  async cleanupOldReviews(daysToKeep = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const allReviews = await this.storage.getReviews();
    const recentReviews = allReviews.filter(review => 
      new Date(review.updated) > cutoffDate
    );

    const removedCount = allReviews.length - recentReviews.length;
    
    if (removedCount > 0) {
      // 注意：这里需要重新实现存储逻辑来支持删除
      console.log(`Would remove ${removedCount} old reviews (feature not implemented)`);
    }

    return removedCount;
  }

  /**
   * 验证应用配置
   */
  async validateApp(app: Partial<App>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!app.id || !/^\d+$/.test(app.id)) {
      errors.push('应用ID必须是数字');
    }

    if (!app.name || app.name.trim().length === 0) {
      errors.push('应用名称不能为空');
    }

    if (!app.country || !/^[a-z]{2}$/.test(app.country)) {
      errors.push('国家代码必须是两位小写字母');
    }

    // 检查是否已存在相同的应用
    if (app.id) {
      const existingApps = await this.storage.getApps();
      const duplicate = existingApps.find(existingApp => existingApp.id === app.id);
      if (duplicate) {
        errors.push('该应用ID已存在');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
