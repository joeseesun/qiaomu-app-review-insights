import OpenAI from 'openai';
import { PromptTemplate } from '@/types';

export interface AnalysisRequest {
  title: string;
  content: string;
  rating: string;
  version: string;
  authorName?: string; // 可选，用于分析用户类型
  updated?: string;    // 可选，用于时间分析
}

export interface AnalysisResponse {
  sentiment: 'positive' | 'negative' | 'neutral';
  issues: string[];
  suggestions: string[];
  versionRefs: string[];
}

export interface ThemeItem {
  title: string; // 中文短标题（≤16字）
  summary: string; // 2-3句中文解读
  examples: Array<{ id: string; snippet: string }>; // 证据句，来自原评论
}

export interface IssueItem { title: string; summary: string; category: string; examples: Array<{ id: string; snippet: string }>; }
export interface SuggestionItem { title: string; summary: string; examples: Array<{ id: string; snippet: string }>; }

export interface ReviewMiningRequest {
  appName: string;
  country: string;
  stats: {
    totalReviews: number;
    averageRating: number;
    negativeShare: number;
    positiveShare: number;
    ratingDistribution: Record<string, number>;
    versionDistribution: Array<{ version: string; count: number; averageRating: number }>;
  };
  reviews: Array<{
    id: string;
    title: string;
    content: string;
    rating: string;
    version: string;
    updated: string;
  }>;
}

export interface ReviewMiningItem {
  title: string;
  summary: string;
  evidence?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface ReviewMiningResponse {
  executiveSummary: string;
  painPoints: ReviewMiningItem[];
  opportunities: ReviewMiningItem[];
  positiveSignals: ReviewMiningItem[];
  userSegments: ReviewMiningItem[];
  versionRisks: ReviewMiningItem[];
  actionPlan: ReviewMiningItem[];
  queryAngles: string[];
  model: string;
  generatedAt: string;
}

export class KimiClient {
  private client: OpenAI;
  private model: string;
  private providerName: string;

  constructor() {
    const qiaomuApiKey = process.env.QIAOMU_LLM_API_KEY || process.env.DEEPSEEK_API_KEY;
    const moonshotApiKey = process.env.MOONSHOT_API_KEY;
    const apiKey = qiaomuApiKey || moonshotApiKey;
    const useDeepSeek = Boolean(qiaomuApiKey);
    const baseURL = process.env.QIAOMU_LLM_BASE_URL ||
      process.env.DEEPSEEK_BASE_URL ||
      (useDeepSeek ? 'https://api.deepseek.com/v1' : process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1');

    if (!apiKey) {
      throw new Error('QIAOMU_LLM_API_KEY or DEEPSEEK_API_KEY environment variable is required');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
    });

    this.model = process.env.QIAOMU_LLM_MODEL ||
      process.env.DEEPSEEK_MODEL ||
      (useDeepSeek ? 'deepseek-v4-flash' : process.env.MOONSHOT_MODEL || 'kimi-k2-0905-preview');
    this.providerName = useDeepSeek ? 'DeepSeek' : 'Moonshot';
  }

  /**
   * 分析单个评论
   */
  async analyzeReview(
    request: AnalysisRequest,
    promptTemplate: PromptTemplate
  ): Promise<AnalysisResponse> {
    try {
      // 使用新的统一 content 字段，如果不存在则回退到旧格式
      const promptContent = promptTemplate.content ||
        `${promptTemplate.systemPrompt || ''}\n\n${promptTemplate.userPromptTemplate || ''}`;

      const formattedPrompt = this.formatPrompt(request, promptContent);

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: '你是严谨的中文产品分析师。你会基于用户评论输出准确、可验证、可行动的结构化判断。',
          },
          {
            role: 'user',
            content: formattedPrompt,
          },
        ],
        // 降低随机性，强调结构化输出
        temperature: 0.2,
        max_tokens: 1000,
        // 强制 JSON 模式（若后端不支持会忽略）
        response_format: { type: 'json_object' },
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error(`Empty response from ${this.providerName} API`);
      }

      return this.parseAnalysisResponse(responseContent);
    } catch (error) {
      console.error(`Failed to analyze review with ${this.providerName}:`, error);
      throw error;
    }
  }

  /**
   * 批量分析评论
   */
  async analyzeReviewsBatch(
    requests: AnalysisRequest[],
    promptTemplate: PromptTemplate,
    batchSize = 5
  ): Promise<AnalysisResponse[]> {
    const results: AnalysisResponse[] = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      
      console.log(`Analyzing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(requests.length / batchSize)}`);
      
      const batchPromises = batch.map(request => 
        this.analyzeReview(request, promptTemplate)
          .catch(error => {
            console.error('Failed to analyze review:', error);
            return this.getDefaultAnalysisResponse();
          })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 添加延迟避免 API 限流
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * 格式化提示词
   */
  private formatPrompt(request: AnalysisRequest, template: string): string {
    return template
      .replace('{title}', request.title || '')
      .replace('{content}', request.content || '')
      .replace('{rating}', request.rating || '')
      .replace('{version}', request.version || '')
      .replace('{authorName}', request.authorName || '')
      .replace('{updated}', request.updated || '');
  }

  /**
   * 计算请求的 token 数量（估算）
   */
  private estimateTokens(request: AnalysisRequest, template: string): number {
    const text = this.formatPrompt(request, template);
    // 粗略估算：中文字符 * 1.5 + 英文单词数 * 1.3
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return Math.ceil(chineseChars * 1.5 + englishWords * 1.3);
  }

  /**
   * 超大规模批量分析 - 支持数千条评论的智能分批处理
   */
  async analyzeReviewsMassive(
    requests: AnalysisRequest[],
    promptTemplate: PromptTemplate,
    options: {
      maxTokensPerBatch?: number;
      maxConcurrentBatches?: number;
      progressCallback?: (processed: number, total: number) => void;
    } = {}
  ): Promise<AnalysisResponse[]> {
    const {
      maxTokensPerBatch = 8000, // 增加到 8000 tokens，充分利用 Kimi 的上下文
      maxConcurrentBatches = 3,  // 并发处理3个批次
      progressCallback
    } = options;

    console.log(`Starting massive analysis of ${requests.length} reviews`);
    console.log(`Batch size: ~${maxTokensPerBatch} tokens, Concurrency: ${maxConcurrentBatches}`);

    const batches = this.createOptimalBatches(requests, promptTemplate, maxTokensPerBatch);
    console.log(`Created ${batches.length} optimal batches`);

    const results: AnalysisResponse[] = [];
    let processedCount = 0;

    // 分组处理批次，控制并发数
    for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
      const batchGroup = batches.slice(i, i + maxConcurrentBatches);

      console.log(`Processing batch group ${Math.floor(i / maxConcurrentBatches) + 1}/${Math.ceil(batches.length / maxConcurrentBatches)}`);

      // 并发处理当前组的批次
      const groupPromises = batchGroup.map(async (batch, index) => {
        const batchIndex = i + index + 1;
        console.log(`Starting batch ${batchIndex}/${batches.length} with ${batch.length} reviews`);

        try {
          const batchResults = await this.processBatch(batch, promptTemplate);
          console.log(`Completed batch ${batchIndex}/${batches.length}`);
          return batchResults;
        } catch (error) {
          console.error(`Failed batch ${batchIndex}:`, error);
          // 返回默认结果而不是失败
          return batch.map(() => this.getDefaultAnalysisResponse());
        }
      });

      const groupResults = await Promise.all(groupPromises);

      // 合并结果
      for (const batchResults of groupResults) {
        results.push(...batchResults);
        processedCount += batchResults.length;

        // 调用进度回调
        if (progressCallback) {
          progressCallback(processedCount, requests.length);
        }
      }

      // 批次组之间添加延迟，避免 API 限流
      if (i + maxConcurrentBatches < batches.length) {
        console.log('Waiting between batch groups...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`Massive analysis completed: ${results.length} results`);
    return results;
  }

  /**
   * 优化批量分析 - 根据 token 限制动态调整批次大小
   */
  async analyzeReviewsBatchOptimized(
    requests: AnalysisRequest[],
    promptTemplate: PromptTemplate,
    maxTokensPerBatch = 3000 // Moonshot 单次请求建议不超过 4000 tokens
  ): Promise<AnalysisResponse[]> {
    const results: AnalysisResponse[] = [];
    let currentBatch: AnalysisRequest[] = [];
    let currentTokens = 0;

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      const requestTokens = this.estimateTokens(request, promptTemplate.content);

      // 如果添加当前请求会超过 token 限制，先处理当前批次
      if (currentTokens + requestTokens > maxTokensPerBatch && currentBatch.length > 0) {
        console.log(`Processing batch with ${currentBatch.length} reviews (~${currentTokens} tokens)`);

        const batchResults = await this.processBatch(currentBatch, promptTemplate);
        results.push(...batchResults);

        // 重置批次
        currentBatch = [];
        currentTokens = 0;

        // 添加延迟避免 API 限流
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      currentBatch.push(request);
      currentTokens += requestTokens;
    }

    // 处理最后一个批次
    if (currentBatch.length > 0) {
      console.log(`Processing final batch with ${currentBatch.length} reviews (~${currentTokens} tokens)`);
      const batchResults = await this.processBatch(currentBatch, promptTemplate);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 创建最优批次分组
   */
  private createOptimalBatches(
    requests: AnalysisRequest[],
    promptTemplate: PromptTemplate,
    maxTokensPerBatch: number
  ): AnalysisRequest[][] {
    const batches: AnalysisRequest[][] = [];
    let currentBatch: AnalysisRequest[] = [];
    let currentTokens = 0;

    for (const request of requests) {
      const requestTokens = this.estimateTokens(request, promptTemplate.content);

      // 如果添加当前请求会超过 token 限制，且当前批次不为空，则开始新批次
      if (currentTokens + requestTokens > maxTokensPerBatch && currentBatch.length > 0) {
        batches.push([...currentBatch]);
        currentBatch = [];
        currentTokens = 0;
      }

      currentBatch.push(request);
      currentTokens += requestTokens;
    }

    // 添加最后一个批次
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * 处理单个批次
   */
  private async processBatch(
    batch: AnalysisRequest[],
    promptTemplate: PromptTemplate
  ): Promise<AnalysisResponse[]> {
    const batchPromises = batch.map(request =>
      this.analyzeReview(request, promptTemplate)
        .catch(error => {
          console.error('Failed to analyze review:', error);
          return this.getDefaultAnalysisResponse();
        })
    );

    return Promise.all(batchPromises);
  }

  /**
   * 格式化用户提示词（向后兼容）
   */
  private formatUserPrompt(request: AnalysisRequest, template: string): string {
    return this.formatPrompt(request, template);
  }

  /**
   * 解析分析响应
   */
  private parseAnalysisResponse(responseContent: string): AnalysisResponse {
    try {
      // 尝试直接解析 JSON
      return this.analysisResponseFromRecord(this.asRecord(JSON.parse(responseContent)));
    } catch {
      // 回退：尝试从代码块/花括号中恢复 JSON
      const recovered = this.tryRecoverJson(responseContent);
      if (recovered) {
        return this.analysisResponseFromRecord(this.asRecord(recovered));
      }
      console.warn('Failed to parse JSON response; returning empty analysis');
      return this.getDefaultAnalysisResponse();
    }
  }

  /**
   * 从文本中提取分析结果
   */
  private extractFromText(text: string): AnalysisResponse {
    const result: AnalysisResponse = {
      sentiment: 'neutral',
      issues: [],
      suggestions: [],
      versionRefs: [],
    };

    // 提取情感倾向
    if (text.includes('positive') || text.includes('正面') || text.includes('积极')) {
      result.sentiment = 'positive';
    } else if (text.includes('negative') || text.includes('负面') || text.includes('消极')) {
      result.sentiment = 'negative';
    }

    // 为避免噪声，回退模式不再硬塞“检测到关键词”，保持 issues/suggestions 为空

    return result;
  }

  // 从回复文本中尽量恢复 JSON
  private tryRecoverJson(text: string): unknown | null {
    try {
      const code = text.match(/```(?:json)?\n([\s\S]*?)\n```/i);
      if (code && code[1]) {
        return JSON.parse(this.relaxJson(code[1]));
      }
      const brace = text.match(/\{[\s\S]*\}/);
      if (brace) {
        return JSON.parse(this.relaxJson(brace[0]));
      }
    } catch {}
    return null;
  }

  private analysisResponseFromRecord(record: Record<string, unknown>): AnalysisResponse {
    return {
      sentiment: this.normalizeSentiment(this.asString(record.sentiment, 'neutral')),
      issues: this.asStringArray(record.issues),
      suggestions: this.asStringArray(record.suggestions),
      versionRefs: this.asStringArray(record.versionRefs),
    };
  }

  private relaxJson(s: string): string {
    let t = s.trim();
    t = t.replace(/,\s*([}\]])/g, '$1');
    t = t.replace(/[“”]/g, '"');
    return t;
  }

  /**
   * 标准化情感倾向
   */
  private normalizeSentiment(sentiment: string): 'positive' | 'negative' | 'neutral' {
    const normalized = sentiment.toLowerCase();
    
    if (normalized.includes('positive') || normalized.includes('正面') || normalized.includes('积极')) {
      return 'positive';
    }
    
    if (normalized.includes('negative') || normalized.includes('负面') || normalized.includes('消极')) {
      return 'negative';
    }
    
    return 'neutral';
  }

  /**
   * 获取默认分析响应（用于错误情况）
   */
  private getDefaultAnalysisResponse(): AnalysisResponse {
    return {
      sentiment: 'neutral',
      issues: [],
      suggestions: [],
      versionRefs: [],
    };
  }

  async mineReviewCorpus(request: ReviewMiningRequest): Promise<ReviewMiningResponse> {
    const reviewPayload = request.reviews
      .slice(0, 100)
      .map((review) => ({
        id: review.id,
        title: String(review.title || '').slice(0, 120),
        content: String(review.content || '').slice(0, 700),
        rating: review.rating,
        version: review.version,
        updated: review.updated,
      }));

    const prompt = `你是一名资深 App 产品研究员。请基于 App Store 用户评价做信息挖掘，只输出严格 JSON，不要输出代码块或解释。

App：${request.appName}
国家/地区：${request.country.toUpperCase()}
统计：${JSON.stringify(request.stats)}
评论样本：${JSON.stringify(reviewPayload).slice(0, 36000)}

请输出 JSON，字段名必须完全一致：
{
  "executiveSummary": "3-5句中文总结，包含整体口碑、主要矛盾和产品机会",
  "painPoints": [{"title":"≤14字", "summary":"1句", "evidence":"原评论短证据≤60字", "priority":"high|medium|low"}],
  "opportunities": [{"title":"≤14字", "summary":"1句", "evidence":"原评论短证据≤60字", "priority":"high|medium|low"}],
  "positiveSignals": [{"title":"≤14字", "summary":"1句", "evidence":"原评论短证据≤60字", "priority":"high|medium|low"}],
  "userSegments": [{"title":"≤14字", "summary":"1句", "evidence":"原评论短证据≤60字", "priority":"high|medium|low"}],
  "versionRisks": [{"title":"≤14字", "summary":"1句", "evidence":"原评论短证据≤60字", "priority":"high|medium|low"}],
  "actionPlan": [{"title":"≤14字", "summary":"一句可执行动作", "evidence":"为什么要做≤60字", "priority":"high|medium|low"}],
  "queryAngles": ["后续深挖问题，每条≤18字"]
}

要求：
- 所有输出用中文；
- 每个数组 2-3 项，优先保留高频和高风险；
- 不要虚构评论里不存在的事实，证据必须来自评论标题或内容；
- 当前有 ${reviewPayload.length} 条评论样本，不要因为样本少而返回空洞察；
- 只有评论确实没有相关证据时，对应数组才可以为空。`;

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: '你是严谨的中文 App 评论研究员，只返回严格 JSON。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 5200,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '';
    return this.parseMiningResponse(content);
  }

  getModelInfo(): { provider: string; model: string } {
    return {
      provider: this.providerName,
      model: this.model,
    };
  }

  private parseMiningResponse(content: string): ReviewMiningResponse {
    let parsed: unknown = null;

    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = this.tryRecoverJson(content);
    }

    const record = this.asRecord(parsed);
    const response = {
      executiveSummary: this.asString(this.pick(record, ['executiveSummary', 'executive_summary', 'summary', '摘要']), '').slice(0, 900),
      painPoints: this.asMiningItems(this.pick(record, ['painPoints', 'pain_points', '痛点', '核心痛点'])),
      opportunities: this.asMiningItems(this.pick(record, ['opportunities', 'productOpportunities', 'opportunity', '产品机会', '机会'])),
      positiveSignals: this.asMiningItems(this.pick(record, ['positiveSignals', 'positive_signals', '正向信号', '正面信号'])),
      userSegments: this.asMiningItems(this.pick(record, ['userSegments', 'user_segments', '用户分层', '用户群体'])),
      versionRisks: this.asMiningItems(this.pick(record, ['versionRisks', 'version_risks', '版本风险', '风险'])),
      actionPlan: this.asMiningItems(this.pick(record, ['actionPlan', 'action_plan', '行动建议', '建议'])),
      queryAngles: this.asStringArray(this.pick(record, ['queryAngles', 'query_angles', '深挖问题'])).slice(0, 8),
      model: this.model,
      generatedAt: new Date().toISOString(),
    };

    const hasAnyInsight = [
      response.painPoints,
      response.opportunities,
      response.positiveSignals,
      response.userSegments,
      response.versionRisks,
      response.actionPlan,
    ].some((items) => items.length > 0);

    if (!response.executiveSummary || !hasAnyInsight) {
      throw new Error('AI 返回了空洞察或非预期 JSON 结构，请重新生成');
    }

    return response;
  }

  private asMiningItems(value: unknown): ReviewMiningItem[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => {
        const record = this.asRecord(item);
        const priority = this.asString(record.priority, 'medium');
        const normalizedPriority: ReviewMiningItem['priority'] =
          priority === 'high' || priority === 'medium' || priority === 'low' ? priority : 'medium';
        return {
          title: this.asString(record.title, '').slice(0, 30),
          summary: this.asString(record.summary, '').slice(0, 320),
          evidence: this.asString(record.evidence, '').slice(0, 220),
          priority: normalizedPriority,
        };
      })
      .filter((item) => item.title && item.summary)
      .slice(0, 5);
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private pick(record: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
      if (record[key] !== undefined) return record[key];
    }
    return undefined;
  }

  private asString(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  private asExamples(value: unknown): Array<{ id: string; snippet: string }> {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => {
        const record = this.asRecord(item);
        const id = this.asString(record.id, '');
        const snippet = this.asString(record.snippet, '');
        return id && snippet ? { id, snippet: snippet.slice(0, 200) } : null;
      })
      .filter((item): item is { id: string; snippet: string } => Boolean(item));
  }

  /**
   * 测试 API 连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: '请回复"连接成功"',
          },
        ],
        max_tokens: 10,
      });

      const response = completion.choices[0]?.message?.content;
      return response?.includes('连接成功') || response?.includes('成功') || !!response;
    } catch (error) {
      console.error('Kimi API connection test failed:', error);
      return false;
    }
  }

  /**
   * 获取 API 使用统计
   */
  async getUsageStats(): Promise<{
    model: string;
    available: boolean;
    lastTest?: Date;
  }> {
    const available = await this.testConnection();
    
    return {
      model: this.model,
      available,
      lastTest: new Date(),
    };
  }

  /**
   * 从一批评论中提取主题（好评/差评）— Map 阶段
   */
  async summarizeThemesMap(
    items: Array<{ id: string; title: string; content: string; rating?: string }>,
    polarity: 'positive' | 'negative',
    limit: number = 5
  ): Promise<ThemeItem[]> {
    const prompt = `你是一名资深产品分析师。请阅读一批用户评论（标题+内容），只输出严格 JSON，不要输出任何其他文字或代码块。\n` +
    `任务：提取${polarity === 'positive' ? '好评核心亮点' : '差评核心问题'}主题，给出中文短标题（≤16 字）与 2-3 句中文解读，并提供来自原文的一条证据句（含评论 id）。\n` +
    `严格要求：\n- 所有输出中文；\n- 不要使用“建议/问题/优化/改进”等口水词做标题；\n- 标题必须具备可理解的产品含义；\n- 证据句必须取自提供的原文内容或标题；\n- 最多返回${limit}个主题。\n\n` +
    `输入示例（多条）：[{"id":"r1","title":"...","content":"..."}, ...]\n` +
    `现在的输入：${JSON.stringify(items).slice(0, 12000)}\n\n` +
    `输出 JSON：{ "themes": [ { "title":"中文短标题", "summary":"2-3 句中文解读", "examples":[{"id":"评论 id","snippet":"证据句"}] } ] }`;

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: '你是严谨的中文产品分析师，只返回严格 JSON。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices?.[0]?.message?.content || '';
    try {
      const parsed = this.asRecord(JSON.parse(content));
      const arr = Array.isArray(parsed.themes) ? parsed.themes : [];
      return arr.map((item) => {
        const theme = this.asRecord(item);
        return {
          title: this.asString(theme.title, '').slice(0, 30),
          summary: this.asString(theme.summary, '').slice(0, 500),
          examples: this.asExamples(theme.examples),
        };
      }).filter((theme): theme is ThemeItem => Boolean(theme.title && theme.summary));
    } catch {
      return [];
    }
  }

  /**
   * 从一批评论中提取“问题分类分析 + 改进建议” — Map 阶段
   */
  async summarizeIssuesSuggestionsMap(
    items: Array<{ id: string; title: string; content: string; rating?: string }>,
    limit: number = 10
  ): Promise<{ issues: IssueItem[]; suggestions: SuggestionItem[] }> {
    const prompt = `你是一名资深产品分析师。请阅读一批用户评论（标题+内容），只返回严格 JSON。\n` +
    `任务：\n- 提取“问题分类分析”：用中文短标题（≤16 字）+ 1-2 句中文解读，按类别归属（性能/功能/体验/内容/账户/价格/其他），并提供来自原文的一条证据句（含评论 id）。\n` +
    `- 提取“改进建议”：仅当评论明确提出“希望/需要/增加/修复”等，给出中文短标题（≤16字）+ 1-2句中文解读，并提供证据句。\n` +
    `约束：\n- 所有输出中文；\n- 不要使用“建议/问题/优化/改进”等口水词做标题；\n- 标题必须可行动且具体；\n- 每项提供 1 条证据句，来自输入原文；\n- issues 与 suggestions 各最多返回 ${limit} 项。\n\n` +
    `输入 JSON（多条）：${JSON.stringify(items).slice(0, 12000)}\n\n` +
    `输出 JSON：{ "issues": [ {"title":"","summary":"","category":"性能|功能|体验|内容|账户|价格|其他","examples":[{"id":"","snippet":""}] } ], "suggestions": [ {"title":"","summary":"","examples":[{"id":"","snippet":""}] } ] }`;

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: '你是严谨的中文产品分析师，只返回严格 JSON。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices?.[0]?.message?.content || '';
    try {
      const parsed = this.asRecord(JSON.parse(content));
      const issues = (Array.isArray(parsed.issues) ? parsed.issues : []).map((item) => {
        const issue = this.asRecord(item);
        return {
          title: this.asString(issue.title, '').slice(0, 30),
          summary: this.asString(issue.summary, '').slice(0, 500),
          category: this.asString(issue.category, '其他'),
          examples: this.asExamples(issue.examples),
        };
      });
      const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : []).map((item) => {
        const suggestion = this.asRecord(item);
        return {
          title: this.asString(suggestion.title, '').slice(0, 30),
          summary: this.asString(suggestion.summary, '').slice(0, 500),
          examples: this.asExamples(suggestion.examples),
        };
      });
      return { issues, suggestions };
    } catch {
      return { issues: [], suggestions: [] };
    }
  }
}
