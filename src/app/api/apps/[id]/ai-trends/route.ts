import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { AiTrendsService } from '@/lib/analysis/ai-trends-service';

const storage = getStorage();
const svc = new AiTrendsService();

// GET /api/apps/[id]/ai-trends
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const apps = await storage.getApps();
    const app = apps.find(a => a.id === id);
    if (!app) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });

    const bullets = await svc.getTrendsBullets(id);
    return NextResponse.json({ success: true, data: { bullets } });
  } catch (e) {
    console.error('ai-trends failed:', e);
    return NextResponse.json({ success: false, error: '生成失败' }, { status: 500 });
  }
}

