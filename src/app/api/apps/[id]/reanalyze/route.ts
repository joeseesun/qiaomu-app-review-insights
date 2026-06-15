import { NextRequest, NextResponse } from 'next/server';
import { AnalysisService } from '@/lib/analysis/service';
import { getStorage } from '@/lib/storage';

const storage = getStorage();
const service = new AnalysisService();

// POST /api/apps/[id]/reanalyze - 重新分析（包含已分析评论）
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const apps = await storage.getApps();
    const app = apps.find(a => a.id === id);
    if (!app) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });

    const reviews = await storage.getReviews(id);
    if (reviews.length === 0) {
      return NextResponse.json({ success: false, error: '无评论数据' }, { status: 400 });
    }

    const results = await service.analyzeAppReviews(id, { includeAnalyzed: true, batchSize: 3 });
    return NextResponse.json({ success: true, data: { reanalyzed: results.length } });
  } catch (e) {
    console.error('reanalyze failed:', e);
    return NextResponse.json({ success: false, error: '重新分析失败' }, { status: 500 });
  }
}

