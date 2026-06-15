'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { App, AppStoreReview, AnalysisResult } from '@/types';
import { ReviewList } from '@/components/reviews/review-list';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Download, BarChart3 } from 'lucide-react';
import { getCountryFlag } from '@/lib/utils';

export default function ReviewsPage() {
  const params = useParams();
  const router = useRouter();
  const appId = params.id as string;

  const [app, setApp] = useState<App | null>(null);
  const [reviews, setReviews] = useState<AppStoreReview[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);

  useEffect(() => {
    if (appId) {
      loadData();
    }
  }, [appId, page, limit]);

  const loadData = async () => {
    try {
      setLoading(true);

      // 并行加载应用信息和评论数据
      const [appResponse, reviewsResponse] = await Promise.all([
        fetch(`/api/apps/${appId}`),
        fetch(`/api/apps/${appId}/reviews?page=${page}&limit=${limit}`),
      ]);

      if (appResponse.ok) {
        const appData = await appResponse.json();
        setApp(appData.data);
      }

      if (reviewsResponse.ok) {
        const reviewsData = await reviewsResponse.json();
        setReviews(reviewsData.data.reviews);
        setAnalysisResults(reviewsData.data.analysisResults);
        setPagination(reviewsData.data.pagination);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 下载CSV文件
  const downloadCSV = () => {
    if (reviews.length === 0) {
      alert('没有评论数据可以下载');
      return;
    }

    // CSV 头部
    const headers = ['标题', '内容', '评分', '版本', '作者', '时间'];

    // 转换数据为CSV格式
    const csvData = reviews.map(review => [
      `"${(review.title || '').replace(/"/g, '""')}"`, // 转义双引号
      `"${(review.content || '').replace(/"/g, '""')}"`,
      review.rating || '',
      `"${(review.version || '').replace(/"/g, '""')}"`,
      `"${(review.authorName || '').replace(/"/g, '""')}"`,
      review.updated || ''
    ]);

    // 组合CSV内容
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    // 创建并下载文件
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // 添加BOM以支持中文
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${app?.name || 'app'}-评论数据-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            加载中...
          </div>
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">应用不存在</h2>
            <Button onClick={() => router.push('/')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回首页
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => router.push('/')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                返回
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  {getCountryFlag(app.country)}
                  {app.name} 评论列表
                </h1>
                <p className="text-gray-600 mt-1">
                  应用ID: {app.id}
                  {pagination ? ` • 第 ${pagination.page}/${pagination.totalPages} 页 • 每页 ${pagination.limit} 条 • 共 ${pagination.total} 条` : ` • 共 ${reviews.length} 条`}
                  {analysisResults.length > 0 && ` • ${analysisResults.length} 条已分析`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {analysisResults.length > 0 && (
                <Button
                  onClick={() => router.push(`/analysis/${appId}`)}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  查看分析
                </Button>
              )}
              <Button
                onClick={downloadCSV}
                variant="outline"
                disabled={reviews.length === 0}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                下载CSV
              </Button>
              <Button onClick={loadData} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="container mx-auto px-4 py-8">
        {reviews.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">该应用还没有评论数据</p>
            <Button onClick={() => router.push('/')} variant="outline">
              返回首页抓取评论
            </Button>
          </div>
        ) : (
          <ReviewList
            reviews={reviews}
            analysisResults={analysisResults}
            showAnalysis={analysisResults.length > 0}
            serverPagination={pagination ? { ...pagination, onPageChange: setPage } : undefined}
          />
        )}
      </div>
    </div>
  );
}
