import { NextRequest, NextResponse } from 'next/server';
import { KimiClient } from '@/lib/analysis/kimi-client';
import { createClient } from '@supabase/supabase-js';

// POST /api/translate - 批量翻译标题与内容为中文
// body: { items: Array<{ id: string; title: string; content: string }>, targetLang?: 'zh' }
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json({ success: true, data: {} });
    }

    const kimi = new KimiClient();
    const results: Record<string, { titleZh: string; contentZh: string }> = {};

    // 若配置了 Supabase，则优先从 DB 读取已有翻译
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const useSupabase = !!(supabaseUrl && supabaseKey);
    const toTranslate: typeof items = [];

    let supabase: ReturnType<typeof createClient> | null = null;
    let tableAvailable = false;
    if (useSupabase) {
      supabase = createClient(supabaseUrl!, supabaseKey!);
      try {
        // 探测表是否存在并可访问
        const probe = await supabase
          .from('review_translations')
          .select('review_id')
          .limit(1);
        if (!probe.error) tableAvailable = true;
        
        if (tableAvailable) {
          const ids = items.map((i: any) => i.id);
          const { data, error } = await supabase
            .from('review_translations')
            .select('review_id, title_zh, content_zh')
            .in('review_id', ids);
          if (error) throw error;
          (data || []).forEach((row: any) => {
            results[row.review_id] = {
              titleZh: row.title_zh || '',
              contentZh: row.content_zh || '',
            };
          });
        }
      } catch (e) {
        console.warn('Read translations from Supabase failed, will translate all:', e);
      }
    }

    // 仅翻译缺失的项
    for (const item of items) {
      if (!results[item.id]) toTranslate.push(item);
    }

    // 逐条翻译缺失部分，并尝试回写 Supabase
    for (const item of toTranslate) {
      const prompt = `请将下面的评论标题与内容翻译成简体中文，保持意思准确，口吻自然。不添加任何多余解释，仅输出 JSON：\n` +
        `{"titleZh":"...","contentZh":"..."}\n` +
        `标题: ${item.title || ''}\n` +
        `内容: ${item.content || ''}`;

      const completion = await kimi['client'].chat.completions.create({
        model: (kimi as any).model || 'kimi-k2-0905-preview',
        messages: [
          { role: 'system', content: '你是一个专业的中英互译助手。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 400,
      });

      const content = completion.choices?.[0]?.message?.content || '';
      let titleZh = '';
      let contentZh = '';
      try {
        const parsed = JSON.parse(content);
        titleZh = parsed.titleZh || '';
        contentZh = parsed.contentZh || '';
      } catch (_e) {
        // 回退：若不是合法JSON，直接当作纯文本塞进 contentZh/titleZh
        contentZh = content.trim();
      }

      results[item.id] = { titleZh, contentZh };

      // 写入 Supabase（忽略失败，不阻塞）
      if (useSupabase && supabase && tableAvailable) {
        try {
          const { error } = await supabase
            .from('review_translations')
            .upsert({
              review_id: item.id,
              title_zh: titleZh,
              content_zh: contentZh,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'review_id' });
          if (error) console.warn('Upsert translation failed:', error.message);
        } catch (e) {
          console.warn('Upsert translation to Supabase threw:', e);
        }
      }

      // 轻微延迟以避免限流
      await new Promise(r => setTimeout(r, 150));
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error('Translate API failed:', error);
    return NextResponse.json({ success: false, error: '翻译失败' }, { status: 500 });
  }
}
