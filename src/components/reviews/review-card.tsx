'use client';

import { AppStoreReview, AnalysisResult } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { 
  getRatingStars, 
  formatRelativeTime, 
  getSentimentColor, 
  getSentimentLabel,
  truncateText 
} from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, User } from 'lucide-react';

interface ReviewCardProps {
  review: AppStoreReview;
  analysis?: AnalysisResult;
  showAnalysis?: boolean;
  highlight?: boolean;
}

export function ReviewCard({ review, analysis, showAnalysis = true, highlight = false }: ReviewCardProps) {
  // 尝试从 sessionStorage 读取翻译，避免重复请求
  let translation: { titleZh?: string; contentZh?: string } | null = null;
  if (typeof window !== 'undefined') {
    const cached = sessionStorage.getItem(`rev_tr_${review.id}`);
    if (cached) {
      try { translation = JSON.parse(cached); } catch {}
    }
  }

  const isNonCN = (review.country || '').toLowerCase() !== 'cn';
  return (
    <Card className={`w-full ${highlight ? 'ring-2 ring-blue-400' : ''}`} data-review-id={review.id}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{getRatingStars(review.rating)}</span>
              <span className="text-sm text-gray-500">
                {review.rating}/5 星
              </span>
              {analysis && showAnalysis && (
                <Badge 
                  variant="secondary" 
                  className={getSentimentColor(analysis.sentiment)}
                >
                  {getSentimentLabel(analysis.sentiment)}
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-lg mb-1">
              {review.title}
              {isNonCN && translation?.titleZh && (
                <div className="text-sm text-gray-600 mt-1">{translation.titleZh}</div>
              )}
            </h3>
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {review.authorName}
              </div>
              <span>版本 {review.version}</span>
              <span>{formatRelativeTime(review.updated)}</span>
            </div>
          </div>
          {review.link && (
            <a
              href={review.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-600"
              title="查看原评论"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 评论内容 */}
        <div className="text-gray-700">
          <p className="whitespace-pre-wrap">{review.content}</p>
          {isNonCN && translation?.contentZh && (
            <p className="whitespace-pre-wrap mt-2 text-gray-700 bg-gray-50 p-3 rounded">{translation.contentZh}</p>
          )}
        </div>

        {/* 投票信息 */}
        {(review.voteCount !== '0' || review.voteSum !== '0') && (
          <div className="text-xs text-gray-500">
            {review.voteCount} 人投票，有用性评分: {review.voteSum}
          </div>
        )}

        {/* 分析结果 */}
        {analysis && showAnalysis && (
          <div className="border-t pt-4 space-y-3">
            <h4 className="font-medium text-sm text-gray-900">AI 分析结果</h4>
            
            {/* 问题列表 */}
            {analysis.issues.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-red-700 mb-1">发现的问题</h5>
                <div className="flex flex-wrap gap-1">
                  {analysis.issues.map((issue, index) => (
                    <Badge key={index} variant="destructive" className="text-xs">
                      {truncateText(issue, 30)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 建议列表 */}
            {analysis.suggestions.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-blue-700 mb-1">改进建议</h5>
                <div className="flex flex-wrap gap-1">
                  {analysis.suggestions.map((suggestion, index) => (
                    <Badge key={index} variant="secondary" className="text-xs bg-blue-50 text-blue-700">
                      {truncateText(suggestion, 30)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 版本相关信息 */}
            {analysis.versionRefs.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-purple-700 mb-1">版本相关</h5>
                <div className="flex flex-wrap gap-1">
                  {analysis.versionRefs.map((ref, index) => (
                    <Badge key={index} variant="secondary" className="text-xs bg-purple-50 text-purple-700">
                      {truncateText(ref, 30)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-gray-400">
              分析时间: {formatRelativeTime(analysis.analyzedAt)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
