import { DataStorage, App, AppStoreReview, AnalysisResult, PromptTemplate } from '@/types';

export abstract class BaseStorage implements DataStorage {
  abstract getApps(): Promise<App[]>;
  abstract saveApps(apps: App[]): Promise<void>;
  abstract getReviews(appId?: string): Promise<AppStoreReview[]>;
  abstract getReviewsPage(appId: string, offset: number, limit: number): Promise<AppStoreReview[]>;
  abstract saveReviews(reviews: AppStoreReview[]): Promise<void>;
  abstract getAnalysisResults(appId?: string): Promise<AnalysisResult[]>;
  abstract saveAnalysisResults(results: AnalysisResult[]): Promise<void>;
  abstract getPromptTemplates(): Promise<PromptTemplate[]>;
  abstract savePromptTemplates(templates: PromptTemplate[]): Promise<void>;

  // 通用工具方法
  protected filterByAppId<T extends { appId?: string }>(items: T[], appId?: string): T[] {
    if (!appId) return items;
    return items.filter(item => item.appId === appId);
  }

  protected mergeArrays<T extends { id: string }>(existing: T[], newItems: T[]): T[] {
    const existingIds = new Set(existing.map(item => item.id));
    const uniqueNewItems = newItems.filter(item => !existingIds.has(item.id));
    return [...existing, ...uniqueNewItems];
  }

  protected sortByDate<T extends { updated?: string; createdAt?: string; analyzedAt?: string }>(
    items: T[], 
    dateField: keyof T = 'updated' as keyof T
  ): T[] {
    return items.sort((a, b) => {
      const dateA = (a[dateField] as string) || '';
      const dateB = (b[dateField] as string) || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }
}
