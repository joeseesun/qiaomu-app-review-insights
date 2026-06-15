import { promises as fs } from 'fs';
import path from 'path';
import { BaseStorage } from './base';
import { App, AppStoreReview, AnalysisResult, PromptTemplate } from '@/types';

export class LocalStorage extends BaseStorage {
  private dataDir: string;

  constructor() {
    super();
    this.dataDir = path.join(process.cwd(), 'src/data');
    this.ensureDataDir();
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
    }
  }

  private async readJsonFile<T>(filename: string, defaultValue: T): Promise<T> {
    try {
      const filePath = path.join(this.dataDir, filename);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return defaultValue;
    }
  }

  private async writeJsonFile<T>(filename: string, data: T): Promise<void> {
    await this.ensureDataDir();
    const filePath = path.join(this.dataDir, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async getApps(): Promise<App[]> {
    return this.readJsonFile('apps.json', []);
  }

  async saveApps(apps: App[]): Promise<void> {
    await this.writeJsonFile('apps.json', apps);
  }

  async getReviews(appId?: string): Promise<AppStoreReview[]> {
    const allReviews = await this.readJsonFile<AppStoreReview[]>('reviews.json', []);
    return this.filterByAppId(allReviews, appId);
  }

  async getReviewsPage(appId: string, offset: number, limit: number): Promise<AppStoreReview[]> {
    const all = await this.getReviews(appId);
    const sorted = all.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
    return sorted.slice(offset, offset + limit);
  }

  async saveReviews(reviews: AppStoreReview[]): Promise<void> {
    const existingReviews = await this.readJsonFile<AppStoreReview[]>('reviews.json', []);
    const mergedReviews = this.mergeArrays(existingReviews, reviews);
    const sortedReviews = this.sortByDate(mergedReviews, 'updated');
    await this.writeJsonFile('reviews.json', sortedReviews);
  }

  async getAnalysisResults(appId?: string): Promise<AnalysisResult[]> {
    const allResults = await this.readJsonFile<AnalysisResult[]>('analysis.json', []);
    return this.filterByAppId(allResults, appId);
  }

  async saveAnalysisResults(results: AnalysisResult[]): Promise<void> {
    const existingResults = await this.readJsonFile<AnalysisResult[]>('analysis.json', []);
    const mergedResults = this.mergeArrays(existingResults, results);
    const sortedResults = this.sortByDate(mergedResults, 'analyzedAt');
    await this.writeJsonFile('analysis.json', sortedResults);
  }

  async getPromptTemplates(): Promise<PromptTemplate[]> {
    const defaultTemplates: PromptTemplate[] = [
      {
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
        updatedAt: new Date().toISOString(),
        isActive: true
      }
    ];

    const templates = await this.readJsonFile<PromptTemplate[]>('prompts.json', defaultTemplates);
    
    // 如果文件不存在或为空，保存默认模板
    if (templates.length === 0) {
      await this.writeJsonFile('prompts.json', defaultTemplates);
      return defaultTemplates;
    }

    return templates;
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

  async savePromptTemplates(templates: PromptTemplate[]): Promise<void> {
    await this.writeJsonFile('prompts.json', templates);
  }

  // 便利方法：保存单个 Prompt 模板
  async savePromptTemplate(template: PromptTemplate): Promise<void> {
    const templates = await this.getPromptTemplates();
    const existingIndex = templates.findIndex(t => t.id === template.id);

    if (existingIndex >= 0) {
      templates[existingIndex] = template;
    } else {
      templates.push(template);
    }

    await this.savePromptTemplates(templates);
  }

  // 便利方法：删除 Prompt 模板
  async deletePromptTemplate(templateId: string): Promise<void> {
    const templates = await this.getPromptTemplates();
    const filteredTemplates = templates.filter(t => t.id !== templateId);
    await this.savePromptTemplates(filteredTemplates);
  }
}
