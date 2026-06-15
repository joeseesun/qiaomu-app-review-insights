import { BaseStorage } from './base';
import { App, AppStoreReview, AnalysisResult, PromptTemplate } from '@/types';

// Supabase 存储实现
export class SupabaseStorage extends BaseStorage {
  private supabase: any;
  // Cache detected schema features to gracefully handle older DBs
  private schemaFeatures: { analysisHasAppId?: boolean; analysisHasVersionRefs?: boolean } = {};

  constructor() {
    super();
    this.initSupabase();
  }

  private async initSupabase() {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials not found');
      }
      
      this.supabase = createClient(supabaseUrl, supabaseKey);
    } catch (error) {
      console.warn('Supabase not available, falling back to local storage');
      throw new Error('Supabase not available');
    }
  }

  private async ensureSupabase() {
    if (!this.supabase) {
      await this.initSupabase();
    }
  }

  // Detect presence of columns on first use to stay compatible with older DBs
  private async detectAnalysisSchema(): Promise<void> {
    if (this.schemaFeatures.analysisHasAppId !== undefined && this.schemaFeatures.analysisHasVersionRefs !== undefined) {
      return;
    }

    try {
      // Try selecting specific columns; PostgREST will error with 42703 if column doesn't exist
      const { error } = await this.supabase
        .from('analysis_results')
        .select('app_id, version_refs')
        .limit(1);

      if (error) {
        const msg = (error as any)?.message || String(error);
        const hasAppId = !msg.includes('app_id does not exist');
        const hasVersionRefs = !msg.includes('version_refs does not exist');
        this.schemaFeatures.analysisHasAppId = hasAppId;
        this.schemaFeatures.analysisHasVersionRefs = hasVersionRefs;
      } else {
        this.schemaFeatures.analysisHasAppId = true;
        this.schemaFeatures.analysisHasVersionRefs = true;
      }
    } catch (e) {
      // Fallback: assume legacy schema
      this.schemaFeatures.analysisHasAppId = false;
      this.schemaFeatures.analysisHasVersionRefs = false;
    }
  }

  async getApps(): Promise<App[]> {
    await this.ensureSupabase();
    const { data, error } = await this.supabase
      .from('apps')
      .select('*')
      .order('name');

    if (error) throw error;

    // 将数据库字段映射为 TypeScript 字段
    return (data || []).map(app => {
      const { last_fetched, ...rest } = app;
      return {
        ...rest,
        lastFetched: last_fetched || undefined, // 如果字段不存在，设为 undefined
      };
    });
  }

  async saveApps(apps: App[]): Promise<void> {
    await this.ensureSupabase();

    // 将 TypeScript 字段映射为数据库字段
    const mappedApps = apps.map(app => {
      const { lastFetched, ...rest } = app;
      const mappedApp: any = { ...rest };

      // 只有当 lastFetched 存在且数据库支持该字段时才添加
      if (lastFetched) {
        mappedApp.last_fetched = lastFetched;
      }

      return mappedApp;
    });

    // 读取现有应用 ID，用于计算需要删除的条目
    const { data: existingRows, error: existingError } = await this.supabase
      .from('apps')
      .select('id');
    if (existingError) throw existingError;

    const existingIds = new Set((existingRows || []).map((r: any) => r.id));
    const newIds = new Set(apps.map(a => a.id));

    // 仅删除不在新列表中的应用，避免误删导致级联删除评论/分析结果
    const toDelete: string[] = Array.from(existingIds).filter(id => !newIds.has(id));
    if (toDelete.length > 0) {
      const { error: delError } = await this.supabase.from('apps').delete().in('id', toDelete);
      if (delError) throw delError;
    }

    // 对存在/新增的应用执行 upsert，避免全表删除带来的级联影响
    if (mappedApps.length > 0) {
      const { error: upsertError } = await this.supabase
        .from('apps')
        .upsert(mappedApps, { onConflict: 'id' });
      if (upsertError) throw upsertError;
    }
  }

  async getReviews(appId?: string): Promise<AppStoreReview[]> {
    await this.ensureSupabase();

    let query = this.supabase
      .from('reviews')
      .select('*')
      .order('updated', { ascending: false });

    if (appId) {
      query = query.eq('app_id', appId);
    }

    // 移除默认的1000条限制，获取所有数据
    // Supabase 默认限制是1000条，我们需要分页获取所有数据
    const allData: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const pageQuery = query.range(from, from + pageSize - 1);
      const { data: pageData, error: pageError } = await pageQuery;

      if (pageError) throw pageError;
      if (!pageData || pageData.length === 0) break;

      allData.push(...pageData);

      // 如果返回的数据少于页面大小，说明已经是最后一页
      if (pageData.length < pageSize) break;

      from += pageSize;
    }

    const data = allData;

    // 将数据库字段映射回 TypeScript 字段
    return (data || []).map(review => {
      const { app_id, author, ...rest } = review;
      return {
        ...rest,
        appId: app_id,
        authorName: author,
        // 设置默认值给缺失的字段
        contentType: 'text',
        authorUri: '',
        voteCount: '0',
        voteSum: '0',
        link: '',
        contentTypeLabel: '',
        country: 'us',
      };
    });
  }

  async getReviewsPage(appId: string, offset: number, limit: number): Promise<AppStoreReview[]> {
    await this.ensureSupabase();
    const { data, error } = await this.supabase
      .from('reviews')
      .select('*')
      .eq('app_id', appId)
      .order('updated', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return (data || []).map(review => {
      const { app_id, author, ...rest } = review;
      return {
        ...rest,
        appId: app_id,
        authorName: author,
        contentType: 'text',
        authorUri: '',
        voteCount: '0',
        voteSum: '0',
        link: '',
        contentTypeLabel: '',
        country: 'us',
      };
    });
  }

  async saveReviews(reviews: AppStoreReview[]): Promise<void> {
    await this.ensureSupabase();

    if (reviews.length === 0) return;

    // 将 TypeScript 字段映射为数据库字段
    const mappedReviews = reviews.map(review => {
      const {
        appId,
        authorName,
        contentType,
        authorUri,
        voteCount,
        voteSum,
        link,
        contentTypeLabel,
        country,
        ...rest
      } = review;
      return {
        ...rest,
        app_id: appId,
        author: authorName,
        // 其他字段暂时不存储到数据库，只保留核心字段
      };
    });

    // 使用 upsert 来处理重复数据
    const { error } = await this.supabase
      .from('reviews')
      .upsert(mappedReviews, { onConflict: 'id' });

    if (error) throw error;
  }

  async getAnalysisResults(appId?: string): Promise<AnalysisResult[]> {
    await this.ensureSupabase();
    await this.detectAnalysisSchema();

    let data: any[] | null = null;
    let error: any = null;

    try {
      if (appId && this.schemaFeatures.analysisHasAppId) {
        const res = await this.supabase
          .from('analysis_results')
          .select('*')
          .eq('app_id', appId)
          .order('analyzed_at', { ascending: false });
        data = res.data; error = res.error;
      } else if (appId && !this.schemaFeatures.analysisHasAppId) {
        // Legacy schema: filter by review_id belonging to this app
        const { data: reviewRows, error: reviewErr } = await this.supabase
          .from('reviews')
          .select('id')
          .eq('app_id', appId);
        if (reviewErr) throw reviewErr;
        const reviewIds = (reviewRows || []).map((r: any) => r.id);
        if (reviewIds.length === 0) {
          data = [];
        } else {
          // Supabase in() has a limit on URL length; chunk if needed
          const chunkSize = 1000;
          const chunks: string[][] = [];
          for (let i = 0; i < reviewIds.length; i += chunkSize) {
            chunks.push(reviewIds.slice(i, i + chunkSize));
          }
          const all: any[] = [];
          for (const ids of chunks) {
            const res = await this.supabase
              .from('analysis_results')
              .select('*')
              .in('review_id', ids)
              .order('analyzed_at', { ascending: false });
            if (res.error) throw res.error;
            all.push(...(res.data || []));
          }
          data = all;
        }
      } else {
        const res = await this.supabase
          .from('analysis_results')
          .select('*')
          .order('analyzed_at', { ascending: false });
        data = res.data; error = res.error;
      }
    } catch (e) {
      error = e;
    }

    if (error) throw error;

    // 将数据库字段映射为 TypeScript 类型字段
    return (data || []).map(result => {
      const { review_id, app_id, analyzed_at, version_refs, ...rest } = result as any;
      return {
        ...rest,
        reviewId: review_id,
        appId: app_id, // may be undefined on legacy schema
        analyzedAt: analyzed_at,
        versionRefs: (this.schemaFeatures.analysisHasVersionRefs ? (version_refs || []) : []),
      };
    });
  }

  async saveAnalysisResults(results: AnalysisResult[]): Promise<void> {
    await this.ensureSupabase();
    await this.detectAnalysisSchema();

    if (results.length === 0) return;

    // 将 TypeScript 字段映射为数据库字段
    const mappedResults = results.map(result => {
      const { reviewId, appId, analyzedAt, versionRefs, ...rest } = result as any;
      const row: any = {
        ...rest,
        review_id: reviewId,
        analyzed_at: analyzedAt,
      };
      if (this.schemaFeatures.analysisHasAppId) row.app_id = appId;
      if (this.schemaFeatures.analysisHasVersionRefs) row.version_refs = versionRefs || [];
      return row;
    });

    const { error } = await this.supabase
      .from('analysis_results')
      .upsert(mappedResults, { onConflict: 'id' });

    if (error) throw error;
  }

  async getPromptTemplates(): Promise<PromptTemplate[]> {
    await this.ensureSupabase();

    const { data, error } = await this.supabase
      .from('prompt_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      // 创建默认模板
      const defaultTemplate: PromptTemplate = {
        id: 'default',
        name: '默认分析模板',
        description: '严格JSON输出，短语化、去噪、可聚合',
        content: `你是一名资深产品分析师。请阅读一条应用商店评论，只输出严格 JSON，不输出任何其他文字或代码块标记，且所有短语与内容一律使用中文。

输入：
title: {title}
content: {content}
rating: {rating}
version: {version}
author: {authorName}
updated: {updated}

请输出：
{
  "sentiment": "positive|negative|neutral",
  "issues": ["中文短语，≤16字"],
  "suggestions": ["仅当评论中明确提出希望/建议/需要/增加/修复等，才给出中文短语，≤16字"],
  "versionRefs": ["如 1.2.3 或 iOS 17"]
}

规则：
- 只返回 JSON；
- 去除口水词、表情，如“amazing/棒棒/👍🏻”；不要把赞美当建议；不得输出英文短语；
- 短语必须可行动（actionable），避免含糊；
- issues/suggestions 为空数组是允许的；
- versionRefs 仅在文本出现版本/系统信息时给出。`,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        isActive: true
      };

      await this.savePromptTemplates([defaultTemplate]);
      return [defaultTemplate];
    }

    // 映射数据库字段到 TypeScript 接口
    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      systemPrompt: item.system_prompt,
      userPromptTemplate: item.user_prompt_template,
      content: item.content || `${item.system_prompt || ''}\n\n${item.user_prompt_template || ''}`,
      version: item.version,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      isActive: item.is_active
    }));
  }

  async savePromptTemplates(templates: PromptTemplate[]): Promise<void> {
    await this.ensureSupabase();

    if (templates.length === 0) return;

    // 映射 TypeScript 接口字段到数据库字段
    const mappedTemplates = templates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      system_prompt: template.systemPrompt,
      user_prompt_template: template.userPromptTemplate,
      content: template.content,
      version: template.version,
      created_at: template.createdAt,
      updated_at: template.updatedAt,
      is_active: template.isActive
    }));

    const { error } = await this.supabase
      .from('prompt_templates')
      .upsert(mappedTemplates, { onConflict: 'id' });

    if (error) throw error;
  }

  // 初始化默认应用数据
  async initializeDefaultApps(): Promise<void> {
    const apps = await this.getApps();
    if (apps.length === 0) {
      const defaultApps = [
        { id: '6448311069', name: 'ChatGPT', country: 'us' },
        { id: '6477489729', name: 'Gemini', country: 'us' },
        { id: '6459478672', name: '豆包', country: 'cn' },
        { id: '6737597349', name: 'Deepseek', country: 'us' },
        { id: '6474233312', name: 'Kimi', country: 'cn' },
        { id: '6466733523', name: '通义', country: 'cn' },
        { id: '6446882473', name: '文小言', country: 'cn' },
        { id: '6480446430', name: '元宝', country: 'cn' },
        { id: '6503676563', name: '即梦', country: 'cn' },
      ];
      await this.saveApps(defaultApps);
    }
  }
}
