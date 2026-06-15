'use client';

import { useState } from 'react';
import { AggregatedAnalysis, App } from '@/types';
import { ReportGenerator } from '@/lib/report/generator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, FileText, Globe, MessageSquare } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';

interface ReportPreviewProps {
  app: App;
  analysis: AggregatedAnalysis;
}

type ReportFormat = 'markdown' | 'html' | 'summary';

export function ReportPreview({ app, analysis }: ReportPreviewProps) {
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>('markdown');
  const [previewContent, setPreviewContent] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  const formats = [
    { key: 'markdown' as ReportFormat, label: 'Markdown', icon: FileText, description: '完整的分析报告，适合技术文档' },
    { key: 'html' as ReportFormat, label: 'HTML', icon: Globe, description: '网页格式，适合在线查看和分享' },
    { key: 'summary' as ReportFormat, label: '摘要', icon: MessageSquare, description: '简化版本，适合快速了解' },
  ];

  const generatePreview = () => {
    let content: string;
    
    switch (selectedFormat) {
      case 'html':
        content = ReportGenerator.generateHtmlReport(app, analysis);
        break;
      case 'summary':
        content = ReportGenerator.generateSummaryReport(app, analysis);
        break;
      case 'markdown':
      default:
        content = ReportGenerator.generateMarkdownReport(app, analysis);
        break;
    }
    
    setPreviewContent(content);
    setShowPreview(true);
  };

  const downloadReport = async (format: ReportFormat) => {
    try {
      const response = await fetch(`/api/apps/${app.id}/export-report?format=${format}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // 从响应头获取文件名
        const contentDisposition = response.headers.get('content-disposition');
        const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
        const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : `${app.name}-报告.${format}`;
        
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const error = await response.json();
        alert(error.error || '下载失败');
      }
    } catch (error) {
      console.error('Failed to download report:', error);
      alert('下载失败');
    }
  };

  const copyToClipboardHandler = async () => {
    if (previewContent) {
      const success = await copyToClipboard(previewContent);
      if (success) {
        alert('内容已复制到剪贴板');
      } else {
        alert('复制失败');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* 格式选择 */}
      <Card>
        <CardHeader>
          <CardTitle>报告格式</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {formats.map((format) => {
              const Icon = format.icon;
              return (
                <div
                  key={format.key}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedFormat === format.key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedFormat(format.key)}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{format.label}</span>
                    {selectedFormat === format.key && (
                      <Badge variant="secondary">已选择</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{format.description}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <div className="flex gap-4">
        <Button onClick={generatePreview} className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          预览报告
        </Button>
        <Button 
          variant="outline" 
          onClick={() => downloadReport(selectedFormat)}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          下载 {formats.find(f => f.key === selectedFormat)?.label}
        </Button>
      </div>

      {/* 预览内容 */}
      {showPreview && previewContent && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>报告预览 - {formats.find(f => f.key === selectedFormat)?.label}</CardTitle>
              <Button variant="outline" size="sm" onClick={copyToClipboardHandler}>
                复制内容
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto">
              {selectedFormat === 'html' ? (
                <div 
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewContent }}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded border">
                  {previewContent}
                </pre>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 报告统计 */}
      <Card>
        <CardHeader>
          <CardTitle>报告统计</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{analysis.totalReviews}</div>
              <div className="text-sm text-gray-500">分析评论数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{analysis.commonIssues.length}</div>
              <div className="text-sm text-gray-500">识别问题数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{analysis.suggestions.length}</div>
              <div className="text-sm text-gray-500">改进建议数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{analysis.versionAnalysis.length}</div>
              <div className="text-sm text-gray-500">版本覆盖数</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
