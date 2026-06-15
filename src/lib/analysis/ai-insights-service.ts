import { getStorage } from '@/lib/storage';
import { KimiClient, IssueItem, SuggestionItem } from './kimi-client';

export interface AiInsights {
  quickInsights: string[];
  issueTaxonomy: Array<{ category: string; items: Array<{ title: string; summary: string; examples: Array<{ id: string; snippet: string }> }> }>;
  topSuggestions: Array<{ title: string; summary: string; examples: Array<{ id: string; snippet: string }> }>;
}

export class AiInsightsService {
  private storage = getStorage();
  private kimiClient: KimiClient | null = null;

  private getKimi(): KimiClient {
    if (!this.kimiClient) {
      this.kimiClient = new KimiClient();
    }
    return this.kimiClient;
  }

  async buildInsights(appId: string, options?: { maxSamples?: number; chunkSize?: number }): Promise<AiInsights> {
    const { maxSamples = 500, chunkSize = 60 } = options || {};

    const [reviews] = await Promise.all([
      this.storage.getReviews(appId)
    ]);

    const sorted = reviews.slice().sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
    const sample = sorted.slice(0, maxSamples);

    const chunks: Array<{ issues: IssueItem[]; suggestions: SuggestionItem[] }> = [];
    for (let i = 0; i < sample.length; i += chunkSize) {
      const batch = sample.slice(i, i + chunkSize).map(r => ({ id: r.id, title: r.title, content: r.content, rating: r.rating }));
      const out = await this.getKimi().summarizeIssuesSuggestionsMap(batch, 10);
      chunks.push(out);
      await new Promise(r => setTimeout(r, 300));
    }

    // Reduce：按 category+title 归并
    const norm = (s: string) => s.replace(/\s+/g, '').replace(/[“”"'!！。·…]/g, '').toLowerCase();
    const tax = new Map<string, { category: string; title: string; summary: string; examples: Array<{ id: string; snippet: string }>; count: number }>();
    const sugg = new Map<string, { title: string; summary: string; examples: Array<{ id: string; snippet: string }>; count: number }>();

    for (const ch of chunks) {
      for (const it of ch.issues) {
        const key = `${it.category}|${norm(it.title)}`;
        if (!key) continue;
        if (!tax.has(key)) tax.set(key, { category: it.category || '其他', title: it.title, summary: it.summary, examples: it.examples.slice(0,2), count: 1 });
        else {
          const cur = tax.get(key)!; cur.count++;
          const seen = new Set(cur.examples.map(e => e.id));
          for (const e of it.examples) if (!seen.has(e.id) && cur.examples.length < 2) cur.examples.push(e);
        }
      }
      for (const it of ch.suggestions) {
        const key = norm(it.title);
        if (!key) continue;
        if (!sugg.has(key)) sugg.set(key, { title: it.title, summary: it.summary, examples: it.examples.slice(0,2), count: 1 });
        else {
          const cur = sugg.get(key)!; cur.count++;
          const seen = new Set(cur.examples.map(e => e.id));
          for (const e of it.examples) if (!seen.has(e.id) && cur.examples.length < 2) cur.examples.push(e);
        }
      }
    }

    const issueTaxonomy = Array.from(tax.values())
      .sort((a, b) => b.count - a.count)
      .reduce((acc: any[], cur) => {
        let cat = acc.find(x => x.category === cur.category);
        if (!cat) { cat = { category: cur.category, items: [] }; acc.push(cat); }
        cat.items.push({ title: cur.title, summary: cur.summary, examples: cur.examples });
        return acc;
      }, [])
      .map(cat => ({ ...cat, items: cat.items.slice(0, 5) }))
      .slice(0, 7);

    const topSuggestions = Array.from(sugg.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(x => ({ title: x.title, summary: x.summary, examples: x.examples }));

    // 快速洞察由趋势要点+结构计数简单组合（趋势 API 已有，这里仅留占位，前端已展示趋势卡）
    const quickInsights: string[] = [];

    return { quickInsights, issueTaxonomy, topSuggestions };
  }
}
