import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { AiInsightsService } from '@/lib/analysis/ai-insights-service';

const storage = getStorage();
const svc = new AiInsightsService();

// GET /api/apps/[id]/ai-insights
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const apps = await storage.getApps();
    const app = apps.find(a => a.id === id);
    if (!app) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });

    const url = new URL(request.url);
    const max = parseInt(url.searchParams.get('max') || '500');
    const data = await svc.buildInsights(id, { maxSamples: Math.max(100, Math.min(1000, max)) });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error('ai-insights failed:', e);
    return NextResponse.json({ success: false, error: '生成失败' }, { status: 500 });
  }
}

