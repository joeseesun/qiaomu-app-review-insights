import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { ThemesService } from '@/lib/analysis/themes-service';

const storage = getStorage();
const svc = new ThemesService();

// GET /api/apps/[id]/ai-themes
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const apps = await storage.getApps();
    const app = apps.find(a => a.id === id);
    if (!app) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });

    const url = new URL(request.url);
    const max = parseInt(url.searchParams.get('max') || '300');
    const fresh = ['1', 'true', 'yes'].includes((url.searchParams.get('fresh') || '').toLowerCase());
    const { positive, negative } = await svc.getTopThemes(id, { maxSamples: Math.max(50, Math.min(1000, max)), fresh });

    return NextResponse.json({ success: true, data: { positive, negative } });
  } catch (e) {
    console.error('ai-themes failed:', e);
    return NextResponse.json({ success: false, error: '生成失败' }, { status: 500 });
  }
}
