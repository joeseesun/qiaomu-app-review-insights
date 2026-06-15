import { getStorage } from '@/lib/storage';
import { KimiClient } from './kimi-client';

export class AiTrendsService {
  private storage = getStorage();
  private kimiClient: KimiClient | null = null;

  private getKimi(): KimiClient {
    if (!this.kimiClient) {
      this.kimiClient = new KimiClient();
    }
    return this.kimiClient;
  }

  async getTrendsBullets(appId: string): Promise<string[]> {
    const [reviews, analysis] = await Promise.all([
      this.storage.getReviews(appId),
      this.storage.getAnalysisResults(appId),
    ]);

    // 构造最近3个月的月度情感统计
    const byMonth = new Map<string, { total: number; pos: number; neg: number; neu: number }>();
    const now = new Date();
    const months: string[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push(key);
      byMonth.set(key, { total: 0, pos: 0, neg: 0, neu: 0 });
    }

    const aMap = new Map(analysis.map(a => [a.reviewId, a.sentiment] as const));
    reviews.forEach(r => {
      const d = new Date(r.updated);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth.has(key)) return;
      const s = aMap.get(r.id) || 'neutral';
      const bucket = byMonth.get(key)!;
      bucket.total++;
      (bucket as any)[s === 'positive' ? 'pos' : s === 'negative' ? 'neg' : 'neu']++;
    });

    const table = months.map(m => {
      const b = byMonth.get(m)!;
      const ratioPos = b.total ? +(b.pos / b.total * 100).toFixed(1) : 0;
      const ratioNeg = b.total ? +(b.neg / b.total * 100).toFixed(1) : 0;
      return { month: m, total: b.total, pos: b.pos, neg: b.neg, neu: b.neu, ratioPos, ratioNeg };
    });

    // 让 AI 用中文生成 3-5 条趋势要点
    const prompt = `你是资深产品分析师。下面是某应用最近三个月的月度情感统计（pos/neg/neu、人次以及比例），请用中文生成3-5条“时间趋势洞察”要点：\n` +
    `- 必须包含数字或百分比；\n- 指出上升/下降变化；\n- 简短清晰。\n` +
    `输入JSON: ${JSON.stringify(table)}\n` +
    `输出JSON: { "bullets": ["要点1","要点2",...] }`;

    const kimi = this.getKimi();
    const completion = await kimi['client'].chat.completions.create({
      model: (kimi as any).model || 'kimi-k2-0905-preview',
      messages: [ { role: 'system', content: '只返回严格JSON' }, { role: 'user', content: prompt } ],
      temperature: 0.2,
      max_tokens: 400,
      response_format: { type: 'json_object' } as any,
    });
    const content = completion.choices?.[0]?.message?.content || '';
    try {
      const parsed = JSON.parse(content);
      const arr = Array.isArray(parsed.bullets) ? parsed.bullets : [];
      return arr.map((s: any) => String(s)).filter(Boolean).slice(0, 5);
    } catch {
      return [];
    }
  }
}
