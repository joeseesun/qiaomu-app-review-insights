import { NextRequest, NextResponse } from 'next/server';
import { AnalysisService } from '@/lib/analysis/service';
import { getStorage } from '@/lib/storage';

const storage = getStorage();
const service = new AnalysisService();

// POST /api/apps/[id]/cleanup-analysis - 移除噪声占位项（"检测到关键词:"、"分析失败"）
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const apps = await storage.getApps();
    const app = apps.find(a => a.id === id);
    if (!app) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });

    const result = await service.cleanupNoisyAnalysis(id);
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    console.error('cleanup-analysis failed:', e);
    return NextResponse.json({ success: false, error: '清理失败' }, { status: 500 });
  }
}

