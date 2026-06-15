import { getStorage } from '@/lib/storage';
import { KimiClient, AnalysisRequest } from './kimi-client';
import { AppStoreReview, AnalysisResult, AnalysisConfig, AggregatedAnalysis } from '@/types';

export class AnalysisService {
  private storage = getStorage();
  private kimiClient: KimiClient | null = null; // Lazy init to avoid env errors on routes that don't need Kimi

  constructor() {
    // defer Kimi client creation until actually needed
  }

  private getKimi(): KimiClient {
    if (!this.kimiClient) {
      this.kimiClient = new KimiClient();
    }
    return this.kimiClient;
  }

  /**
   * 清理无效的分析结果（评论已不存在）
   */
  async cleanupAnalysisResults(appId: string): Promise<number> {
    const reviews = await this.storage.getReviews(appId);
    const analysisResults = await this.storage.getAnalysisResults(appId);

    const validReviewIds = new Set(reviews.map(r => r.id));
    const validAnalysisResults = analysisResults.filter(a => validReviewIds.has(a.reviewId));

    const removedCount = analysisResults.length - validAnalysisResults.length;

    if (removedCount > 0) {
      console.log(`Cleaning up ${removedCount} orphaned analysis results for app ${appId}`);
      await this.storage.saveAnalysisResults(validAnalysisResults);
    }

    return removedCount;
  }

  /**
   * 分析指定应用的评论（支持增量更新）
   */
  async analyzeAppReviews(
    appId: string,
    config: Partial<AnalysisConfig> = {}
  ): Promise<AnalysisResult[]> {
    const {
      promptTemplateId = 'default',
      batchSize = 5,
      includeAnalyzed = false,
    } = config;

    // 首先清理无效的分析结果
    const cleanedCount = await this.cleanupAnalysisResults(appId);
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} orphaned analysis results`);
    }

    // 获取评论数据
    const reviews = await this.storage.getReviews(appId);
    if (reviews.length === 0) {
      throw new Error(`No reviews found for app ${appId}`);
    }

    // 获取已分析的评论ID（清理后的）
    const existingAnalysis = await this.storage.getAnalysisResults(appId);
    const analyzedReviewIds = new Set(existingAnalysis.map(a => a.reviewId));

    // 过滤需要分析的评论
    const reviewsToAnalyze = includeAnalyzed 
      ? reviews 
      : reviews.filter(review => !analyzedReviewIds.has(review.id));

    if (reviewsToAnalyze.length === 0) {
      console.log(`All reviews for app ${appId} have already been analyzed`);
      return [];
    }

    console.log(`Analyzing ${reviewsToAnalyze.length} reviews for app ${appId}`);

    // 获取提示词模板
    const promptTemplates = await this.storage.getPromptTemplates();
    const promptTemplate = promptTemplates.find(t => t.id === promptTemplateId);
    
    if (!promptTemplate) {
      throw new Error(`Prompt template ${promptTemplateId} not found`);
    }

    // 准备分析请求 - 只发送关键信息给 AI
    const analysisRequests: AnalysisRequest[] = reviewsToAnalyze.map(review => ({
      title: review.title,
      content: review.content,
      rating: review.rating,
      version: review.version,
      authorName: review.authorName, // 用于分析用户类型
      updated: review.updated,       // 用于时间趋势分析
    }));

    console.log(`Prepared ${analysisRequests.length} analysis requests with optimized data`);

    // 根据评论数量选择分析策略
    let analysisResponses: any[];

    if (analysisRequests.length > 100) {
      // 大规模分析：使用并发批处理
      console.log(`Using massive analysis for ${analysisRequests.length} reviews`);
      analysisResponses = await this.getKimi().analyzeReviewsMassive(
        analysisRequests,
        promptTemplate,
        {
          maxTokensPerBatch: 8000,
          maxConcurrentBatches: 3,
          progressCallback: (processed, total) => {
            console.log(`Analysis progress: ${processed}/${total} (${Math.round(processed/total*100)}%)`);
          }
        }
      );
    } else {
      // 小规模分析：使用标准批处理
      console.log(`Using standard batch analysis for ${analysisRequests.length} reviews`);
      analysisResponses = await this.getKimi().analyzeReviewsBatchOptimized(
        analysisRequests,
        promptTemplate,
        6000 // 增加批次大小
      );
    }

    // 构建分析结果
    const analysisResults: AnalysisResult[] = reviewsToAnalyze.map((review, index) => ({
      id: `analysis_${review.id}_${Date.now()}`,
      reviewId: review.id,
      appId: appId, // 添加 appId 字段
      sentiment: analysisResponses[index]?.sentiment || 'neutral',
      issues: analysisResponses[index]?.issues || [],
      suggestions: analysisResponses[index]?.suggestions || [],
      versionRefs: analysisResponses[index]?.versionRefs || [],
      analyzedAt: new Date().toISOString(),
    }));

    // 保存分析结果
    await this.storage.saveAnalysisResults(analysisResults);

    return analysisResults;
  }

  /**
   * 分页分析：对指定 app 的一页评论执行 AI 分析，仅分析未分析的评论
   */
  async analyzeAppReviewsPage(appId: string, offset: number, limit: number): Promise<AnalysisResult[]> {
    // 获取该页评论
    const pageReviews = await this.storage.getReviewsPage(appId, offset, limit);
    if (pageReviews.length === 0) return [];

    // 过滤掉已分析
    const existing = await this.storage.getAnalysisResults(appId);
    const analyzedIds = new Set(existing.map(a => a.reviewId));
    const toAnalyze = pageReviews.filter(r => !analyzedIds.has(r.id));
    if (toAnalyze.length === 0) return [];

    // 模板
    const promptTemplates = await this.storage.getPromptTemplates();
    const tpl = promptTemplates.find(t => t.id === 'default');
    if (!tpl) throw new Error('Prompt template default not found');

    // 最多按 50 条一批（由 KimiClient 决定真实批量）
    const requests = toAnalyze.map(r => ({
      title: r.title, content: r.content, rating: r.rating, version: r.version, authorName: r.authorName, updated: r.updated,
    }));

    const responses = await this.getKimi().analyzeReviewsBatchOptimized(requests, tpl, 4000);

    const results: AnalysisResult[] = toAnalyze.map((review, i) => ({
      id: `analysis_${review.id}_${Date.now()}`,
      reviewId: review.id,
      appId,
      sentiment: responses[i]?.sentiment || 'neutral',
      issues: (responses[i]?.issues || []).map(s => this.normalizePhrase(s)).filter(Boolean) as string[],
      suggestions: (responses[i]?.suggestions || []).map(s => this.normalizeSuggestion(s)).filter(Boolean) as string[],
      versionRefs: (responses[i]?.versionRefs || []).map(s => this.normalizeVersionRef(s)).filter(Boolean) as string[],
      analyzedAt: new Date().toISOString(),
    }));

    await this.storage.saveAnalysisResults(results);
    return results;
  }

  /**
   * 清理噪声条目（移除 "检测到关键词:"、"分析失败" 之类的占位项），保留其他结构
   */
  async cleanupNoisyAnalysis(appId: string): Promise<{ cleaned: number }> {
    const results = await this.storage.getAnalysisResults(appId);
    let cleaned = 0;
    const filtered = results.map(r => {
      const beforeI = r.issues.length;
      const beforeS = r.suggestions.length;
      const issues = r.issues.filter(x => x && !/^检测到关键词/.test(x) && x !== '分析失败');
      const suggestions = r.suggestions.filter(x => x && !/^检测到关键词/.test(x) && x !== '分析失败');
      if (issues.length !== beforeI || suggestions.length !== beforeS) cleaned++;
      return { ...r, issues, suggestions } as AnalysisResult;
    });
    if (cleaned > 0) await this.storage.saveAnalysisResults(filtered);
    return { cleaned };
  }

  /** 标准化建议短语：去噪、裁剪、同义归一 */
  private normalizeSuggestion(s: string): string | null {
    if (!s && s !== 0 as any) return null;
    let t = this.normalizePhrase(s as any);
    if (!t) return null;
    // 停用词/口水词
    const stop = ['建议', '优化', '改进', '希望', '希望可以', '请', '谢谢', 'Amazing', 'Great', 'Nice'];
    if (stop.includes(t)) return null;
    // 同义归一
    const map: Record<string, string> = {
      '增加': '新增', '添加': '新增', '希望增加': '新增',
      '修复bug': '修复问题', '修复 BUG': '修复问题',
    };
    t = map[t] || t;
    return t;
  }

  /** 标准化通用短语：去表情/空白、限制长度、中文化引号 */
  private normalizePhrase(s: any): string | null {
    // 强制转字符串，避免 (s || '').replace 报错
    let t = String(s ?? '')
      .replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, '')
      .trim();
    t = t.replace(/[“”]/g, '"').replace(/[’]/g, "'");
    if (!t) return null;
    if (t.length > 16) t = t.slice(0, 16);
    return t;
  }

  private normalizeVersionRef(s: any): string | null {
    let t = String(s ?? '').trim();
    if (!t) return null;
    // 只保留形如 1.2.3 或 iOS 17 等
    if (/^\d+(\.\d+){0,2}$/.test(t)) return t;
    if (/^(iOS|Android)\s*\d+/.test(t)) return t;
    return null;
  }

  /**
   * 分析所有应用的评论
   */
  async analyzeAllAppsReviews(config: Partial<AnalysisConfig> = {}): Promise<{
    totalAnalyzed: number;
    appResults: Array<{
      appId: string;
      appName: string;
      analyzedCount: number;
      error?: string;
    }>;
  }> {
    const apps = await this.storage.getApps();
    const results = [];
    let totalAnalyzed = 0;

    for (const app of apps) {
      try {
        console.log(`Analyzing reviews for ${app.name} (${app.id})...`);
        
        const analysisResults = await this.analyzeAppReviews(app.id, config);
        
        results.push({
          appId: app.id,
          appName: app.name,
          analyzedCount: analysisResults.length,
        });
        
        totalAnalyzed += analysisResults.length;
        
        console.log(`Analyzed ${analysisResults.length} reviews for ${app.name}`);
        
        // 添加延迟避免API限流
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed to analyze reviews for ${app.name}:`, error);
        
        results.push({
          appId: app.id,
          appName: app.name,
          analyzedCount: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      totalAnalyzed,
      appResults: results,
    };
  }

  /**
   * 问题聚类：将相似的问题归类
   */
  private clusterIssues(issues: Array<{ issue: string; count: number; examples: string[] }>): Array<{
    category: string;
    issues: Array<{ issue: string; count: number; examples: string[] }>;
    totalCount: number
  }> {
    // 定义问题类别关键词
    const categories = {
      '性能问题': ['卡顿', '慢', '延迟', '等待', '响应', '加载', '速度', '崩溃', '闪退', '死机'],
      '功能限制': ['限制', '禁用', '不能', '无法', '不支持', '缺少', '没有', '付费', '会员', '订阅'],
      '用户体验': ['界面', 'UI', '操作', '使用', '体验', '设计', '布局', '交互', '导航'],
      '内容质量': ['准确', '错误', '质量', '内容', '回答', '结果', '信息', '数据'],
      '账户问题': ['登录', '注册', '账户', '密码', '验证', '绑定', '同步'],
      '技术故障': ['bug', '错误', '故障', '异常', '问题', '失败', '无响应'],
      '价格相关': ['价格', '费用', '收费', '付费', '免费', '订阅', '会员', '充值'],
      '其他问题': []
    };

    const clusteredIssues = new Map<string, Array<{ issue: string; count: number; examples: string[] }>>();

    // 初始化分类
    Object.keys(categories).forEach(category => {
      clusteredIssues.set(category, []);
    });

    // 对每个问题进行分类
    issues.forEach(issueItem => {
      let categorized = false;

      // 检查每个类别的关键词
      for (const [category, keywords] of Object.entries(categories)) {
        if (category === '其他问题') continue;

        const hasKeyword = keywords.some(keyword =>
          issueItem.issue.toLowerCase().includes(keyword.toLowerCase())
        );

        if (hasKeyword) {
          clusteredIssues.get(category)!.push(issueItem);
          categorized = true;
          break;
        }
      }

      // 如果没有匹配到任何类别，归入"其他问题"
      if (!categorized) {
        clusteredIssues.get('其他问题')!.push(issueItem);
      }
    });

    // 构建结果，只返回有问题的类别
    return Array.from(clusteredIssues.entries())
      .filter(([_, issues]) => issues.length > 0)
      .map(([category, issues]) => ({
        category,
        issues: issues.sort((a, b) => b.count - a.count),
        totalCount: issues.reduce((sum, issue) => sum + issue.count, 0)
      }))
      .sort((a, b) => b.totalCount - a.totalCount);
  }

  /**
   * 生成聚合分析报告
   */
  async generateAggregatedAnalysis(appId: string): Promise<AggregatedAnalysis> {
    const reviews = await this.storage.getReviews(appId);
    const analysisResults = await this.storage.getAnalysisResults(appId);

    if (reviews.length === 0) {
      throw new Error(`No reviews found for app ${appId}`);
    }

    // 创建评论ID到分析结果的映射
    const analysisMap = new Map(
      analysisResults.map(analysis => [analysis.reviewId, analysis])
    );

    // 情感分布统计
    const sentimentDistribution = {
      positive: 0,
      negative: 0,
      neutral: 0,
    };

    // 问题统计
    const issueCount = new Map<string, { count: number; examples: string[] }>();
    
    // 建议统计（对噪声进行归一与过滤）
    const suggestionCount = new Map<string, { count: number; examples: string[] }>();

    // 版本分析
    const versionStats = new Map<string, {
      reviewCount: number;
      totalRating: number;
      sentimentDistribution: { positive: number; negative: number; neutral: number };
    }>();

    // 遍历评论进行统计
    reviews.forEach(review => {
      const analysis = analysisMap.get(review.id);
      
      // 统计情感分布
      if (analysis) {
        sentimentDistribution[analysis.sentiment]++;
        
        // 统计问题
        analysis.issues.forEach(issue => {
          if (!issueCount.has(issue)) {
            issueCount.set(issue, { count: 0, examples: [] });
          }
          const issueData = issueCount.get(issue)!;
          issueData.count++;
          if (issueData.examples.length < 3) {
            issueData.examples.push(this.pickEvidence(issue, review));
          }
        });

        // 统计建议（过滤短语/口水词/表情/无意义词）
        analysis.suggestions.forEach(raw => {
          const norm = this.normalizeSuggestion(raw);
          if (!norm) return;
          if (!suggestionCount.has(norm)) {
            suggestionCount.set(norm, { count: 0, examples: [] });
          }
          const s = suggestionCount.get(norm)!;
          s.count++;
          if (s.examples.length < 3) s.examples.push(this.pickEvidence(norm, review));
        });
      }

      // 版本统计
      const version = review.version;
      if (!versionStats.has(version)) {
        versionStats.set(version, {
          reviewCount: 0,
          totalRating: 0,
          sentimentDistribution: { positive: 0, negative: 0, neutral: 0 },
        });
      }
      
      const versionData = versionStats.get(version)!;
      versionData.reviewCount++;
      versionData.totalRating += parseInt(review.rating) || 0;
      
      if (analysis) {
        versionData.sentimentDistribution[analysis.sentiment]++;
      }
    });

    // 获取原始问题列表
    const rawIssues = Array.from(issueCount.entries())
      .map(([issue, data]) => ({
        issue,
        count: data.count,
        examples: data.examples,
      }))
      .sort((a, b) => b.count - a.count);

    // 对问题进行聚类
    const clusteredIssues = this.clusterIssues(rawIssues);

    // 构建聚合结果
    const aggregatedAnalysis: AggregatedAnalysis = {
      appId,
      totalReviews: reviews.length,
      sentimentDistribution,
      commonIssues: rawIssues.slice(0, 10), // 保留原始问题列表用于兼容性
      clusteredIssues, // 新增聚类问题
      suggestions: Array.from(suggestionCount.entries())
        .map(([norm, data]) => ({
          suggestion: norm,
          count: data.count,
          examples: data.examples,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10), // 取前10个最常见建议
      versionAnalysis: Array.from(versionStats.entries())
        .map(([version, data]) => ({
          version,
          reviewCount: data.reviewCount,
          averageRating: data.totalRating / data.reviewCount,
          sentimentDistribution: data.sentimentDistribution,
        }))
        .sort((a, b) => this.compareVersions(a.version, b.version)),
      generatedAt: new Date().toISOString(),
    };

    return aggregatedAnalysis;
  }

  // 选取与短语最相关的证据句（从标题/内容中挑一句）
  private pickEvidence(phrase: string, review: { title: string; content: string }): string {
    const text = `${review.title}\n${review.content}`;
    const parts = text
      .split(/(?<=[。！？.!?\n])/)
      .map(s => s.trim())
      .filter(Boolean);
    const key = phrase.replace(/\s+/g, '').toLowerCase();
    let best: { s: string; score: number } = { s: review.title || parts[0] || '', score: -1 };
    for (const s of parts) {
      const plain = s.replace(/\s+/g, '').toLowerCase();
      let score = 0;
      if (plain.includes(key)) score += 5; // 直接包含短语
      // 若短语为多个词，分词包含也加分
      const toks = phrase.split(/\s+|，|。|,|·/).filter(Boolean);
      score += toks.reduce((acc, t) => acc + (plain.includes(t.toLowerCase()) ? 1 : 0), 0);
      // 长度惩罚（更短更精炼）
      score += Math.max(0, 3 - Math.floor(s.length / 40));
      if (score > best.score) best = { s, score };
    }
    return best.s || review.title || '';
  }

  /**
   * 智能版本号排序函数
   */
  private compareVersions(a: string, b: string): number {
    try {
      // 分割版本号并转换为数字数组
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);

      // 比较每个部分
      const maxLength = Math.max(aParts.length, bParts.length);
      for (let i = 0; i < maxLength; i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;

        if (aPart !== bPart) {
          return aPart - bPart;
        }
      }

      return 0;
    } catch (error) {
      // 如果解析失败，使用字符串比较
      return a.localeCompare(b);
    }
  }

  /**
   * 获取分析统计信息
   */
  async getAnalysisStats(appId?: string): Promise<{
    totalReviews: number;
    analyzedReviews: number;
    analysisProgress: number;
    lastAnalyzed?: string;
  }> {
    const reviews = await this.storage.getReviews(appId);
    const analysisResults = await this.storage.getAnalysisResults(appId);

    const totalReviews = reviews.length;
    const analyzedReviews = analysisResults.length;
    const analysisProgress = totalReviews > 0 ? (analyzedReviews / totalReviews) * 100 : 0;

    const lastAnalyzed = analysisResults.length > 0 
      ? analysisResults.sort((a, b) => 
          new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime()
        )[0].analyzedAt
      : undefined;

    return {
      totalReviews,
      analyzedReviews,
      analysisProgress,
      lastAnalyzed,
    };
  }

  /**
   * 测试分析服务
   */
  async testAnalysisService(): Promise<{
    kimiAvailable: boolean;
    promptTemplatesCount: number;
    error?: string;
  }> {
    try {
      const kimiAvailable = await this.kimiClient.testConnection();
      const promptTemplates = await this.storage.getPromptTemplates();
      
      return {
        kimiAvailable,
        promptTemplatesCount: promptTemplates.length,
      };
    } catch (error) {
      return {
        kimiAvailable: false,
        promptTemplatesCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
