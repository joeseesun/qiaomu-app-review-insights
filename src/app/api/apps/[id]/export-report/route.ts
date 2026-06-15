import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { AnalysisService } from '@/lib/analysis/service';
import { ReportGenerator } from '@/lib/report/generator';

const storage = getStorage();
const analysisService = new AnalysisService();

// GET /api/apps/[id]/export-report - 导出分析报告
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'markdown'; // markdown, html, summary
    
    // 检查应用是否存在
    const apps = await storage.getApps();
    const app = apps.find(a => a.id === id);
    
    if (!app) {
      return NextResponse.json(
        { error: '应用不存在' },
        { status: 404 }
      );
    }

    // 生成聚合分析
    const analysis = await analysisService.generateAggregatedAnalysis(id);
    
    let content: string;
    let contentType: string;
    let filename: string;
    
    switch (format) {
      case 'html':
        content = ReportGenerator.generateHtmlReport(app, analysis);
        contentType = 'text/html; charset=utf-8';
        filename = `${app.name}-分析报告-${new Date().toISOString().split('T')[0]}.html`;
        break;
        
      case 'summary':
        content = ReportGenerator.generateSummaryReport(app, analysis);
        contentType = 'text/plain; charset=utf-8';
        filename = `${app.name}-分析摘要-${new Date().toISOString().split('T')[0]}.txt`;
        break;
        
      case 'markdown':
      default:
        content = ReportGenerator.generateMarkdownReport(app, analysis);
        contentType = 'text/markdown; charset=utf-8';
        filename = `${app.name}-分析报告-${new Date().toISOString().split('T')[0]}.md`;
        break;
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Failed to export report:', error);
    
    const errorMessage = error instanceof Error ? error.message : '导出报告失败';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
