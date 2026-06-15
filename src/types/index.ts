// 应用信息类型
export interface App {
  id: string;
  name: string;
  country: string;
  lastFetched?: string;
}

export type AppReviewSource = 'apple-rss' | 'app-store-html';

// AppStore 评论原始数据类型
export interface AppStoreReview {
  id: string;
  updated: string;
  rating: string;
  version: string;
  title: string;
  content: string;
  contentType: string;
  authorName: string;
  authorUri: string;
  voteCount: string;
  voteSum: string;
  link: string;
  contentTypeLabel: string;
  appId: string;
  country: string;
  source?: AppReviewSource;
  sourceCountry?: string;
}

// 分析结果类型
export interface AnalysisResult {
  id: string;
  reviewId: string;
  appId: string;  // 添加 appId 字段用于过滤
  sentiment: 'positive' | 'negative' | 'neutral';
  issues: string[];
  suggestions: string[];
  versionRefs: string[];
  analyzedAt: string;
}

// 聚合分析结果类型
export interface AggregatedAnalysis {
  appId: string;
  totalReviews: number;
  sentimentDistribution: {
    positive: number;
    negative: number;
    neutral: number;
  };
  commonIssues: Array<{
    issue: string;
    count: number;
    examples: string[];
  }>;
  clusteredIssues?: Array<{
    category: string;
    issues: Array<{
      issue: string;
      count: number;
      examples: string[];
    }>;
    totalCount: number;
  }>;
  suggestions: Array<{
    suggestion: string;
    count: number;
    examples: string[];
  }>;
  versionAnalysis: Array<{
    version: string;
    reviewCount: number;
    averageRating: number;
    sentimentDistribution: {
      positive: number;
      negative: number;
      neutral: number;
    };
  }>;
  generatedAt: string;
}

// Prompt 模板类型
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  content: string; // 统一的 prompt 内容
  version: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  // 兼容旧格式
  systemPrompt?: string;
  userPromptTemplate?: string;
}

// 数据存储接口
export interface DataStorage {
  // 应用管理
  getApps(): Promise<App[]>;
  saveApps(apps: App[]): Promise<void>;
  
  // 评论管理
  getReviews(appId?: string): Promise<AppStoreReview[]>;
  // 分页读取评论（用于分页分析）
  getReviewsPage(appId: string, offset: number, limit: number): Promise<AppStoreReview[]>;
  saveReviews(reviews: AppStoreReview[]): Promise<void>;
  
  // 分析结果管理
  getAnalysisResults(appId?: string): Promise<AnalysisResult[]>;
  saveAnalysisResults(results: AnalysisResult[]): Promise<void>;
  
  // Prompt 模板管理
  getPromptTemplates(): Promise<PromptTemplate[]>;
  savePromptTemplates(templates: PromptTemplate[]): Promise<void>;
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 抓取配置类型
export interface FetchConfig {
  appId: string;
  country: string;
  incremental: boolean;
  lastFetched?: string;
  maxPages?: number;
  maxReviews?: number;
}

// 分析配置类型
export interface AnalysisConfig {
  appId?: string;
  promptTemplateId?: string;
  batchSize: number;
  includeAnalyzed: boolean;
}
