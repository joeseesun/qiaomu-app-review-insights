import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'appreview.qiaomu.ai',
    model: process.env.QIAOMU_LLM_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
    time: new Date().toISOString(),
  });
}
