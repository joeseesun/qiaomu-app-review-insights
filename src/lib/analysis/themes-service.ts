import { getStorage } from '@/lib/storage';
import { KimiClient, ThemeItem } from './kimi-client';

async function createSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null as any;
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key);
}

export class ThemesService {
  private storage = getStorage();
  private kimiClient: KimiClient | null = null;

  private getKimi(): KimiClient {
    if (!this.kimiClient) {
      this.kimiClient = new KimiClient();
    }
    return this.kimiClient;
  }

  async getTopThemes(appId: string, options?: { maxSamples?: number; chunkSize?: number; fresh?: boolean }): Promise<{ positive: ThemeItem[]; negative: ThemeItem[] }> {
    const { maxSamples = 300, chunkSize = 60 } = options || {};
    const fresh = !!options?.fresh;

    // 读取缓存（若表存在且非 fresh）
    const supabase = await createSupabase();
    let tableAvailable = false;
    if (supabase && !fresh) {
      try {
        const probe = await supabase.from('ai_insights').select('payload').eq('app_id', appId).eq('kind', 'themes_both').limit(1);
        if (!probe.error) tableAvailable = true;
        if (tableAvailable && probe.data && probe.data[0]) {
          const payload = probe.data[0].payload || {};
          if (payload.positive && payload.negative) return payload as any;
        }
      } catch {}
    }
    const [reviews, analysis] = await Promise.all([
      this.storage.getReviews(appId),
      this.storage.getAnalysisResults(appId),
    ]);

    const sentimentMap = new Map(analysis.map(a => [a.reviewId, a.sentiment] as const));

    // 选样：优先最近的，限制样本量
    const sorted = reviews.slice().sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
    const positives = sorted.filter(r => (r.rating && parseInt(r.rating) >= 4) || sentimentMap.get(r.id) === 'positive').slice(0, maxSamples);
    const negatives = sorted.filter(r => (r.rating && parseInt(r.rating) <= 2) || sentimentMap.get(r.id) === 'negative').slice(0, maxSamples);

    const mapReduce = async (arr: typeof positives, polarity: 'positive'|'negative') => {
      const chunks: ThemeItem[][] = [];
      for (let i = 0; i < arr.length; i += chunkSize) {
        const batch = arr.slice(i, i + chunkSize).map(r => ({ id: r.id, title: r.title, content: r.content, rating: r.rating }));
        const themes = await this.getKimi().summarizeThemesMap(batch, polarity, 5);
        chunks.push(themes);
        await new Promise(r => setTimeout(r, 300));
      }
      // Reduce：按标题归一合并
      const norm = (s: string) => s.replace(/\s+/g, '').replace(/[“”"'!！。·…]/g, '').toLowerCase();
      const pool = new Map<string, ThemeItem & { count: number }>();
      for (const tList of chunks) {
        for (const t of tList) {
          const key = norm(t.title).slice(0, 40);
          if (!key) continue;
          if (!pool.has(key)) pool.set(key, { ...t, count: 1 });
          else {
            const cur = pool.get(key)!;
            cur.count += 1;
            // 合并 examples，去重
            const seen = new Set(cur.examples.map(e => e.id));
            for (const e of t.examples) if (!seen.has(e.id) && cur.examples.length < 2) cur.examples.push(e);
          }
        }
      }
      const arrOut = Array.from(pool.values()).sort((a, b) => b.count - a.count).slice(0, 5).map(({ count, ...rest }) => rest);
      return arrOut;
    };

    const [pos, neg] = await Promise.all([
      mapReduce(positives, 'positive'),
      mapReduce(negatives, 'negative')
    ]);
    const result = { positive: pos, negative: neg };

    // 写缓存
    if (supabase) {
      try {
        await supabase.from('ai_insights').upsert({ app_id: appId, kind: 'themes_both', payload: result, source: 'hybrid', model: 'kimi-k2-0905-preview' }, { onConflict: 'app_id,kind' });
      } catch {}
    }
    return result;
  }
}
