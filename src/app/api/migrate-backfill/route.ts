import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/migrate-backfill - 在完成 DDL 迁移后，回填 analysis_results.app_id 与 version_refs
export async function POST(): Promise<NextResponse> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Supabase 配置缺失' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 检查列是否存在
    const probe = await supabase.from('analysis_results').select('app_id, version_refs').limit(1);
    if (probe.error) {
      return NextResponse.json({ success: false, error: 'analysis_results 缺少 app_id/version_refs 列，请先执行 DDL 迁移' }, { status: 400 });
    }

    // 拉取需要回填的 analysis 结果（app_id 为 null 或空）
    const { data: missingAppId, error: missErr } = await supabase
      .from('analysis_results')
      .select('id, review_id, app_id, version_refs')
      .is('app_id', null)
      .limit(20000);

    if (missErr) throw missErr;

    let updated = 0;
    if (missingAppId && missingAppId.length > 0) {
      const reviewIds = missingAppId.map(r => r.review_id);
      const { data: reviewRows, error: reviewErr } = await supabase
        .from('reviews')
        .select('id, app_id')
        .in('id', reviewIds);
      if (reviewErr) throw reviewErr;
      const map = new Map<string, string>();
      (reviewRows || []).forEach(r => map.set(r.id, (r as any).app_id));

      // 构造 upsert 载荷（仅更新 id/app_id/version_refs）
      const payload = missingAppId.map(row => ({
        id: row.id,
        app_id: map.get(row.review_id) || null,
        // 确保 version_refs 至少为空数组
        version_refs: Array.isArray((row as any).version_refs) ? (row as any).version_refs : [],
      }));

      // 分批 upsert，避免 URL 过长
      const chunkSize = 1000;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { error: upErr } = await supabase.from('analysis_results').upsert(chunk, { onConflict: 'id' });
        if (upErr) throw upErr;
        updated += chunk.length;
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // 确保 version_refs 列为 null 的行被设置为空数组
    const { data: nullRefs, error: nullErr } = await supabase
      .from('analysis_results')
      .select('id')
      .is('version_refs', null)
      .limit(20000);
    if (nullErr) throw nullErr;
    if (nullRefs && nullRefs.length > 0) {
      const payload = nullRefs.map(row => ({ id: row.id, version_refs: [] }));
      const chunkSize = 1000;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { error: upErr } = await supabase.from('analysis_results').upsert(chunk, { onConflict: 'id' });
        if (upErr) throw upErr;
        await new Promise(r => setTimeout(r, 100));
      }
    }

    return NextResponse.json({ success: true, data: { updated } });
  } catch (error) {
    console.error('Backfill migration failed:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '回填失败' }, { status: 500 });
  }
}

