'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { App } from '@/types';
import { getCountryFlag, getCountryName, formatRelativeTime } from '@/lib/utils';
import { Download, Trash2, BarChart3, RefreshCw, Eye } from 'lucide-react';

interface AppCardProps {
  app: App;
  stats?: {
    totalReviews: number;
    averageRating: number;
    lastAnalyzed?: string;
  };
  onDelete: (app: App) => void;
  onFetch: (app: App) => void;
  onAnalyze: (app: App) => void;
  onViewReviews: (app: App) => void;
  onViewAnalysis?: (app: App) => void;
  isLoading?: {
    fetch?: boolean;
    analyze?: boolean;
  };
  isAdmin?: boolean; // 新增管理员权限标识
}

export function AppCard({
  app,
  stats,
  onDelete,
  onFetch,
  onAnalyze,
  onViewReviews,
  onViewAnalysis,
  isLoading = {},
  isAdmin = false,
}: AppCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = () => {
    onDelete(app);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {getCountryFlag(app.country)}
              {app.name}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              ID: {app.id} • {getCountryName(app.country)}
            </p>
          </div>
          {/* 只有管理员才能看到删除按钮 */}
          {isAdmin && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteDialog(true)}
                title="删除应用"
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 统计信息 */}
        {stats && (
          <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-500">评论数量</p>
              <p className="text-lg font-semibold">{stats.totalReviews}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">平均评分</p>
              <p className="text-lg font-semibold">
                {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '-'}
              </p>
            </div>
          </div>
        )}

        {/* 状态信息 - 只对管理员显示技术细节 */}
        {isAdmin && (
          <div className="text-xs text-gray-500">
            {stats?.totalReviews > 0 ? (
              <>已抓取 {stats.totalReviews} 条评论</>
            ) : (
              <>尚未抓取评论</>
            )}
            {app.lastFetched && (
              <> • 最后抓取: {formatRelativeTime(app.lastFetched)}</>
            )}
            {stats?.lastAnalyzed && (
              <> • 最后分析: {formatRelativeTime(stats.lastAnalyzed)}</>
            )}
          </div>
        )}

        {/* 操作按钮 - 只对管理员显示 */}
        {isAdmin && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onFetch(app)}
              disabled={isLoading.fetch}
              className="flex items-center gap-2"
            >
              {isLoading.fetch ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isLoading.fetch ? '抓取中...' : '立即抓取'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onAnalyze(app)}
              // 仅当明确为0条评论时才禁用；统计未就绪(undefined)时允许点击，由后端做校验
              disabled={isLoading.analyze || (stats?.totalReviews === 0)}
              className="flex items-center gap-2"
            >
              {isLoading.analyze ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <BarChart3 className="h-4 w-4" />
              )}
              {isLoading.analyze ? '分析中...' : '生成分析'}
            </Button>
          </div>
        )}

        {/* 查看按钮 - 所有用户都可以使用 */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onViewReviews(app)}
            disabled={false} // 普通用户也可以查看，即使没有评论也能看到空状态
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            查看评论 {stats?.totalReviews ? `(${stats.totalReviews})` : '(0)'}
          </Button>

          {onViewAnalysis && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onViewAnalysis(app)}
              disabled={false} // 普通用户也可以查看，即使没有分析也能看到空状态
              className="flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              查看分析
            </Button>
          )}
        </div>

        {/* 删除确认对话框 */}
        <ConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="确认删除应用"
          description={`确定要删除应用 "${app.name}" 吗？此操作将同时删除该应用的所有评论和分析数据，且无法恢复。`}
          confirmText="删除"
          cancelText="取消"
          onConfirm={handleDelete}
          variant="destructive"
        />
      </CardContent>
    </Card>
  );
}
