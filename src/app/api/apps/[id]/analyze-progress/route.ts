import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

const storage = getStorage();

// GET /api/apps/[id]/analyze-progress
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const apps = await storage.getApps();
    const app = apps.find(a => a.id === id);
    if (!app) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });

    const [reviews, analysis] = await Promise.all([
      storage.getReviews(id),
      storage.getAnalysisResults(id)
    ]);
    const total = reviews.length;
    const analyzed = analysis.length;
    const coverage = total > 0 ? Math.round((analyzed / total) * 100) : 0;
    const lastAnalyzed = analysis.length > 0 ? analysis[0].analyzedAt : undefined;

    return NextResponse.json({ success: true, data: { total, analyzed, coverage, lastAnalyzed } });
  } catch (e) {
    console.error('analyze-progress failed:', e);
    return NextResponse.json({ success: false, error: '进度获取失败' }, { status: 500 });
  }
}

