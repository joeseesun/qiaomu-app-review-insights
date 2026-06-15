'use client';

import { useState, useEffect, useRef } from 'react';
import { AggregatedAnalysis, App } from '@/types';
import { SentimentChart } from './sentiment-chart';
import { ClusteredIssues } from './clustered-issues';
import { SuggestionsList } from './suggestions-list';
import { VersionAnalysis } from './version-analysis';
import { VersionSentiment } from './version-sentiment';
import { TopThemes } from './top-themes';
import { TopTrends } from './top-trends';
import { ReportPreview } from '@/components/report/report-preview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Download, BarChart3, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { formatRelativeTime } from '@/lib/utils';

interface AnalysisDashboardProps {
  app: App;
}

export function AnalysisDashboard({ app }: AnalysisDashboardProps) {
  const { isAdmin } = useAuth();
  const [analysis, setAnalysis] = useState<AggregatedAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showReportPreview, setShowReportPreview] = useState(false);
  const [progress, setProgress] = useState<{ total: number; analyzed: number; coverage: number; lastAnalyzed?: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const analyzeAbort = useRef({ stop: false });
  const PAGE_SIZE = 50;
  const COVERAGE_TARGET = 85;
  const [themes, setThemes] = useState<{ positive: any[]; negative: any[] } | null>(null);
  const [trends, setTrends] = useState<string[] | null>(null);
  const [aiInsights, setAiInsights] = useState<{ issueTaxonomy: any[]; topSuggestions: any[]; quickInsights: string[] } | null>(null);

  useEffect(() => {
    loadAnalysis();
    loadProgress();
    loadThemes();
    loadTrends();
    loadAiInsights();
  }, [app.id]);

  const loadAnalysis = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/apps/${app.id}/analysis`);
      if (response.ok) {
        const data = await response.json();
        console.log('Analysis API response:', data); // 调试日志
        // 修复数据路径：data.data.analysis
        setAnalysis(data.data?.analysis || null);
      } else {
        console.error('Analysis API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to load analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAnalysis = async () => {
    try {
      setGenerating(true);
      const response = await fetch(`/api/apps/${app.id}/generate-analysis`, {
        method: 'POST',
      });

      if (response.ok) {
        await Promise.all([loadAnalysis(), loadProgress()]);
        // 重新拉取AI聚合模块
        await Promise.all([loadThemes(), loadTrends(), loadAiInsights()]);
      } else {
        const error = await response.json();
        alert(error.error || '生成分析失败');
      }
    } catch (error) {
      console.error('Failed to generate analysis:', error);
      alert('生成分析失败');
    } finally {
      setGenerating(false);
    }
  };

  const exportReport = async () => {
    try {
      const response = await fetch(`/api/apps/${app.id}/export-report`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${app.name}-分析报告-${new Date().toISOString().split('T')[0]}.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const error = await response.json();
        alert(error.error || '导出报告失败');
      }
    } catch (error) {
      console.error('Failed to export report:', error);
      alert('导出报告失败');
    }
  };

  // 导出 CSV（与评论列表一致）
  const exportCSV = async () => {
    try {
      const res = await fetch(`/api/apps/${app.id}/reviews?limit=10000`);
      if (!res.ok) throw new Error('获取评论失败');
      const data = await res.json();
      const reviews = data.data?.reviews || [];
      if (!reviews.length) { alert('没有评论数据可以下载'); return; }
      const headers = ['标题', '内容', '评分', '版本', '作者', '时间'];
      const rows = reviews.map((r: any) => [
        `"${(r.title || '').replace(/\"/g, '""')}"`,
        `"${(r.content || '').replace(/\"/g, '""')}"`,
        r.rating || '',
        `"${(r.version || '').replace(/\"/g, '""')}"`,
        `"${(r.authorName || '').replace(/\"/g, '""')}"`,
        r.updated || ''
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${app.name}-评论数据-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : '导出失败');
    }
  };

  const loadProgress = async () => {
    try {
      const res = await fetch(`/api/apps/${app.id}/analyze-progress`);
      if (res.ok) {
        const data = await res.json();
        setProgress(data.data);
      }
    } catch {}
  };

  const loadThemes = async () => {
    try {
      const res = await fetch(`/api/apps/${app.id}/ai-themes?max=300`);
      if (res.ok) {
        const data = await res.json();
        setThemes(data.data);
        // 若仍为空，使用更大样本且强制重算
        if ((!data.data?.positive?.length) && (!data.data?.negative?.length)) {
          const res2 = await fetch(`/api/apps/${app.id}/ai-themes?max=600&fresh=1`);
          if (res2.ok) {
            const d2 = await res2.json();
            setThemes(d2.data);
          }
        }
      }
    } catch {}
  };

  const loadTrends = async () => {
    try {
      const res = await fetch(`/api/apps/${app.id}/ai-trends`);
      if (res.ok) {
        const data = await res.json();
        setTrends(data.data?.bullets || []);
      }
    } catch {}
  };

  const loadAiInsights = async () => {
    try {
      const res = await fetch(`/api/apps/${app.id}/ai-insights?max=500`);
      if (res.ok) {
        const data = await res.json();
        setAiInsights(data.data);
        // 若为空，尝试一次更大样本重算
        if ((!data.data?.topSuggestions?.length && !data.data?.issueTaxonomy?.length)) {
          const res2 = await fetch(`/api/apps/${app.id}/ai-insights?max=800`);
          if (res2.ok) {
            const d2 = await res2.json();
            setAiInsights(d2.data);
          }
        }
      }
    } catch {}
  };

  // 简单兜底：当 AI 结果为空时，用结构化聚合作为占位，避免空白
  const aiFallback = (() => {
    if (aiInsights && (aiInsights.topSuggestions?.length || aiInsights.issueTaxonomy?.length || aiInsights.quickInsights?.length)) return aiInsights;
    if (!analysis) return null;
    const issueTaxonomy = (analysis.clusteredIssues || []).map(cat => ({
      category: cat.category,
      items: (cat.issues || []).slice(0,5).map(it => ({ title: it.issue, summary: `用户反馈：${it.issue}（${it.count} 次）`, examples: [{ snippet: it.examples?.[0] || '' }] }))
    })).slice(0,7);
    const topSuggestions = (analysis.suggestions || []).slice(0,10).map(it => ({ title: it.suggestion, summary: `较多用户提出：${it.suggestion}`, examples: [{ snippet: it.examples?.[0] || '' }] }));
    const quickInsights: string[] = (trends || []);
    return { issueTaxonomy, topSuggestions, quickInsights };
  })();

  const analyzeOnePage = async (offset: number) => {
    const res = await fetch(`/api/apps/${app.id}/analyze-page?offset=${offset}&limit=${PAGE_SIZE}`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || '分页分析失败');
    }
    const data = await res.json();
    setProgress(data.data);
    return data.data as { analyzedInPage: number; analyzed: number; total: number; coverage: number };
  };

  const continueAnalyzeUntilTarget = async () => {
    try {
      setAnalyzing(true);
      analyzeAbort.current.stop = false;
      await loadProgress();
      let cursor = 0;
      let guard = 0; // 防止无限循环
      while (!analyzeAbort.current.stop) {
        const cov = progress?.coverage || 0;
        const total = progress?.total || 0;
        if (total === 0 || cov >= COVERAGE_TARGET || guard > 200) break;
        await analyzeOnePage(cursor);
        await Promise.all([loadProgress(), loadAnalysis()]);
        cursor += PAGE_SIZE;
        if (cursor >= (progress?.total || 0)) cursor = 0;
        guard++;
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '继续分析失败');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        加载分析数据中...
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">暂无分析数据</h3>
        <p className="text-gray-500 mb-4">
          请先抓取评论并进行分析，然后生成聚合分析报告
        </p>
        <Button onClick={generateAnalysis} disabled={generating}>
          {generating ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              生成中...
            </>
          ) : (
            <>
              <BarChart3 className="h-4 w-4 mr-2" />
              生成分析报告
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 顶部锚点导航（简版） */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-2 text-sm text-gray-600 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="#charts" className="hover:text-gray-900">情感与版本</a>
            <a href="#themes" className="hover:text-gray-900">Top 好评/差评</a>
            <a href="#trends" className="hover:text-gray-900">时间趋势</a>
          </div>
          <div className="flex items-center gap-3">
            <a href={`/reviews/${app.id}`} className="text-blue-600 hover:underline">查看所有评论</a>
            {isAdmin && (
              <>
                {progress && progress.coverage < COVERAGE_TARGET ? (
                  <Button variant="outline" size="sm" onClick={analyzing ? () => { analyzeAbort.current.stop = true; } : continueAnalyzeUntilTarget}>
                    {analyzing ? '停止分析' : `继续分析至${COVERAGE_TARGET}%`}
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" onClick={exportReport}>导出MD</Button>
                <Button variant="outline" size="sm" onClick={exportCSV}>下载评论</Button>
              </>
            )}
          </div>
        </div>
      </div>
      {/* 头部信息 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{app.name} 分析报告</h2>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span>总评论数: {analysis.totalReviews}</span>
            <span>生成时间: {formatRelativeTime(analysis.generatedAt)}</span>
            {progress && (
              <span>覆盖率: {progress.coverage}%（已分析 {progress.analyzed}/{progress.total}）</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Button variant="outline" onClick={loadAnalysis}>
                <RefreshCw className="h-4 w-4 mr-2" />刷新
              </Button>
              <Button variant="outline" onClick={loadThemes}>
                <RefreshCw className="h-4 w-4 mr-2" />重试主题
              </Button>
              {progress && progress.coverage < COVERAGE_TARGET && (
                <Button variant="outline" onClick={analyzing ? () => { analyzeAbort.current.stop = true; } : continueAnalyzeUntilTarget}>
                  {analyzing ? (<><RefreshCw className="h-4 w-4 animate-spin mr-2" />停止分析</>) : (<><BarChart3 className="h-4 w-4 mr-2" />继续分析至{COVERAGE_TARGET}%</>)}
                </Button>
              )}
              <Button variant="outline" onClick={generateAnalysis} disabled={generating}>
                {generating ? (<RefreshCw className="h-4 w-4 animate-spin mr-2" />) : (<BarChart3 className="h-4 w-4 mr-2" />)}
                重新生成
              </Button>
              <Button variant="outline" onClick={() => setShowReportPreview(!showReportPreview)}>
                <FileText className="h-4 w-4 mr-2" />{showReportPreview ? '隐藏' : '显示'}报告预览
              </Button>
            </>
          )}
          <Button onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />下载所有评论
          </Button>
          <Button variant="outline" onClick={exportReport}>
            <FileText className="h-4 w-4 mr-2" />下载Markdown报告
          </Button>
        </div>
      </div>

      {progress && (
        <div className="w-full bg-gray-100 rounded h-2 overflow-hidden">
          <div className="h-2 bg-blue-500" style={{ width: `${Math.min(100, progress.coverage)}%` }} />
        </div>
      )}

      {/* 左：概览卡片 + 情感分布饼图；右：版本情感分布 */}
      <div id="charts" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold">{analysis.totalReviews}</div>
                <p className="text-xs text-muted-foreground">总评论数</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold text-green-600">
                  {analysis.sentimentDistribution.positive}
                </div>
                <p className="text-xs text-muted-foreground">正面评论</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold text-red-600">
                  {analysis.sentimentDistribution.negative}
                </div>
                <p className="text-xs text-muted-foreground">负面评论</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold text-gray-600">
                  {analysis.sentimentDistribution.neutral}
                </div>
                <p className="text-xs text-muted-foreground">中性评论</p>
              </CardContent>
            </Card>
          </div>
          <SentimentChart data={analysis.sentimentDistribution} />
        </div>

        {analysis.versionAnalysis.length > 0 ? (
          <VersionSentiment data={analysis.versionAnalysis} />
        ) : (
          <div className="p-6 text-sm text-gray-500 border rounded">暂无版本分析数据</div>
        )}
      </div>

      {/* Top 好评/差评 放在图表下方 */}
      <div id="themes" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopThemes appId={app.id} title={`${app.name} 的最大好评 (Top 5 Positive Reviews)`} items={themes?.positive || []} />
        <TopThemes appId={app.id} title={`${app.name} 的最差评价 (Top 5 Negative Reviews)`} items={themes?.negative || []} />
      </div>

      {/* AI 时间趋势洞察 */}
      <div id="trends">
        <TopTrends bullets={trends || []} />
      </div>

      {/* 版本详细信息已与情感分布并排展示 */}

      {/* 报告预览 */}
      {showReportPreview && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4">报告预览与导出</h3>
          <ReportPreview app={app} analysis={analysis} />
        </div>
      )}
    </div>
  );
}
