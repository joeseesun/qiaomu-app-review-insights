import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { AnalysisService } from '@/lib/analysis/service';

const storage = getStorage();
const analysis = new AnalysisService();

// POST /api/apps/[id]/analyze-page?offset=0&limit=50
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
    const force = ['1', 'true', 'yes'].includes((url.searchParams.get('force') || '').toLowerCase());

    const apps = await storage.getApps();
    const app = apps.find(a => a.id === id);
    if (!app) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });

    // 可选：强制重算本页（先清噪声，再由服务按未分析过滤；若需完全覆盖，可结合 cleanup + includeAnalyzed 版本）
    const results = await analysis.analyzeAppReviewsPage(id, offset, limit);

    // 计算进度
    const [allReviews, allAnalysis] = await Promise.all([
      storage.getReviews(id),
      storage.getAnalysisResults(id)
    ]);

    const total = allReviews.length;
    const analyzed = allAnalysis.length;
    const coverage = total > 0 ? Math.round((analyzed / total) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: { analyzedInPage: results.length, analyzed, total, coverage }
    });
  } catch (e) {
    console.error('analyze-page failed:', e);
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : '分析失败' }, { status: 500 });
  }
}
