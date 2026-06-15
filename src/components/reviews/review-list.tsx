'use client';

import { useState, useMemo, useEffect } from 'react';
import { AppStoreReview, AnalysisResult } from '@/types';
import { ReviewCard } from './review-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, SortAsc, SortDesc } from 'lucide-react';

interface ReviewListProps {
  reviews: AppStoreReview[];
  analysisResults: AnalysisResult[];
  showAnalysis?: boolean;
  // 可选：服务端分页（传入则启用服务端分页，禁用本地分页切片）
  serverPagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
}

type SortOption = 'date' | 'rating' | 'sentiment';
type FilterOption = 'all' | '5' | '4' | '3' | '2' | '1';

export function ReviewList({ reviews, analysisResults, showAnalysis = true, serverPagination }: ReviewListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  
  const itemsPerPage = 10;
  const [translations, setTranslations] = useState<Record<string, { titleZh: string; contentZh: string }>>({});

  // 创建评论ID到分析结果的映射
  const analysisMap = useMemo(() => {
    const map = new Map<string, AnalysisResult>();
    analysisResults.forEach(analysis => {
      map.set(analysis.reviewId, analysis);
    });
    return map;
  }, [analysisResults]);

  // 过滤和排序评论
  const filteredAndSortedReviews = useMemo(() => {
    let filtered = reviews;

    // 搜索过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(review => 
        review.title.toLowerCase().includes(term) ||
        review.content.toLowerCase().includes(term) ||
        review.authorName.toLowerCase().includes(term)
      );
    }

    // 评分过滤
    if (filter !== 'all') {
      filtered = filtered.filter(review => review.rating.toString() === filter);
    }

    // 排序
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.updated).getTime() - new Date(b.updated).getTime();
          break;
        case 'rating':
          comparison = parseInt(a.rating) - parseInt(b.rating);
          break;
        case 'sentiment':
          const aAnalysis = analysisMap.get(a.id);
          const bAnalysis = analysisMap.get(b.id);
          const sentimentOrder = { positive: 3, neutral: 2, negative: 1 };
          comparison = (sentimentOrder[aAnalysis?.sentiment || 'neutral'] || 2) - 
                      (sentimentOrder[bAnalysis?.sentiment || 'neutral'] || 2);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [reviews, analysisMap, searchTerm, filter, sortBy, sortOrder]);

  // 分页（支持服务端/本地）
  const totalPages = serverPagination?.totalPages || Math.ceil(filteredAndSortedReviews.length / itemsPerPage);
  const current = serverPagination?.page || currentPage;
  const paginatedReviews = serverPagination
    ? filteredAndSortedReviews // 服务端已分页，这里不再切片
    : filteredAndSortedReviews.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // 批量请求翻译：仅针对非中国区评论，按分页请求，带 sessionStorage 缓存
  useEffect(() => {
    const needTranslate = paginatedReviews
      .filter(r => (r.country || '').toLowerCase() !== 'cn')
      .filter(r => !translations[r.id] && !sessionStorage.getItem(`rev_tr_${r.id}`));

    if (needTranslate.length === 0) return;

    const payload = {
      items: needTranslate.map(r => ({ id: r.id, title: r.title, content: r.content }))
    };

    (async () => {
      try {
        const res = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) return;
        const data = await res.json();
        const map = data?.data || {};
        const next = { ...translations };
        for (const id of Object.keys(map)) {
          next[id] = map[id];
          sessionStorage.setItem(`rev_tr_${id}`, JSON.stringify(map[id]));
        }
        setTranslations(next);
      } catch (_e) {
        // 静默失败，不影响原文显示
      }
    })();
  }, [paginatedReviews]);

  // 从URL初始化搜索（支持 ?q=）
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('q');
      if (q) setSearchTerm(q);
      const hi = new URLSearchParams(window.location.search).get('highlight');
      if (hi) setHighlightId(hi);
    } catch {}
  }, []);

  // 高亮滚动到目标
  useEffect(() => {
    if (!highlightId) return;
    const el = document.querySelector(`[data-review-id="${highlightId}"]`);
    if (el) {
      (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, paginatedReviews]);

  const handleSortChange = (newSortBy: SortOption) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  // 获取基于搜索过滤的评论统计（不包括情感和评分过滤）
  const getBaseFilteredReviews = () => {
    let filtered = reviews;

    // 只应用搜索过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(review =>
        review.title.toLowerCase().includes(term) ||
        review.content.toLowerCase().includes(term) ||
        review.authorName.toLowerCase().includes(term)
      );
    }

    return filtered;
  };

  // 情感统计：基于搜索过滤后的集合，统计正负中数量
  const sentimentStats = useMemo(() => {
    const base = getBaseFilteredReviews();
    const counts = { positive: 0, negative: 0, neutral: 0 } as Record<'positive'|'negative'|'neutral', number>;
    base.forEach(r => {
      const s = analysisMap.get(r.id)?.sentiment || 'neutral';
      if (s === 'positive' || s === 'negative' || s === 'neutral') counts[s]++;
    });
    return counts;
  }, [analysisMap, reviews, searchTerm]);



  return (
    <div className="space-y-6">
      {/* 搜索和过滤器 */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="搜索评论内容、标题或用户名..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            过滤器
          </Button>
        </div>

        {showFilters && (
          <div className="p-4 bg-gray-50 rounded-lg space-y-4">
            {/* 排序选项 */}
            <div>
              <label className="block text-sm font-medium mb-2">排序方式</label>
              <div className="flex gap-2">
                {[
                  { key: 'date', label: '时间' },
                  { key: 'rating', label: '评分' },
                  { key: 'sentiment', label: '情感' },
                ].map(option => (
                  <Button
                    key={option.key}
                    variant={sortBy === option.key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSortChange(option.key as SortOption)}
                    className="flex items-center gap-1"
                  >
                    {option.label}
                    {sortBy === option.key && (
                      sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                    )}
                  </Button>
                ))}
              </div>
            </div>

            {/* 过滤选项 */}
            <div>
              <label className="block text-sm font-medium mb-2">过滤条件</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  全部 ({getBaseFilteredReviews().length})
                </Button>
                


                {['5', '4', '3', '2', '1'].map(rating => {
                  const baseFiltered = getBaseFilteredReviews();
                  const ratingCount = baseFiltered.filter(review => review.rating.toString() === rating).length;

                  return (
                    <Button
                      key={rating}
                      variant={filter === rating ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilter(rating as FilterOption)}
                    >
                      {rating}星 ({ratingCount})
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 统计信息 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          显示 {paginatedReviews.length} / {serverPagination ? serverPagination.total : filteredAndSortedReviews.length} 条评论
        </div>
        {showAnalysis && (
          <div className="flex gap-2">
            <Badge
              variant="secondary"
              className={`cursor-pointer transition-colors ${
                filter === 'positive'
                  ? 'bg-green-200 text-green-800 border-green-300'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
              onClick={() => setFilter(filter === 'positive' ? 'all' : 'positive')}
            >
              正面 {sentimentStats.positive}
            </Badge>
            <Badge
              variant="secondary"
              className={`cursor-pointer transition-colors ${
                filter === 'negative'
                  ? 'bg-red-200 text-red-800 border-red-300'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
              onClick={() => setFilter(filter === 'negative' ? 'all' : 'negative')}
            >
              负面 {sentimentStats.negative}
            </Badge>
            <Badge
              variant="secondary"
              className={`cursor-pointer transition-colors ${
                filter === 'neutral'
                  ? 'bg-gray-200 text-gray-800 border-gray-300'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => setFilter(filter === 'neutral' ? 'all' : 'neutral')}
            >
              中性 {sentimentStats.neutral}
            </Badge>
          </div>
        )}
      </div>

      {/* 评论列表 */}
      <div className="space-y-4">
        {paginatedReviews.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchTerm || filter !== 'all' ? '没有找到匹配的评论' : '暂无评论数据'}
          </div>
        ) : (
          paginatedReviews.map(review => (
            <ReviewCard
              key={review.id}
              review={review}
              analysis={analysisMap.get(review.id)}
              showAnalysis={showAnalysis}
              highlight={highlightId === review.id}
            />
          ))
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 mt-4">
          <div className="text-xs text-gray-500">第 {current} / {totalPages} 页</div>

          <div className="flex items-center gap-1">
            {/* 第一页、上一页 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => (serverPagination ? serverPagination.onPageChange(1) : setCurrentPage(1))}
              disabled={current === 1}
            >
              « 首页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => (serverPagination ? serverPagination.onPageChange(Math.max(1, current - 1)) : setCurrentPage(Math.max(1, currentPage - 1)))}
              disabled={current === 1}
            >
              ‹ 上一页
            </Button>

            {/* 页码滑动窗口 */}
            <div className="flex items-center gap-1">
              {(() => {
                const windowSize = 7;
                let start = Math.max(1, current - Math.floor(windowSize / 2));
                let end = start + windowSize - 1;
                if (end > totalPages) {
                  end = totalPages;
                  start = Math.max(1, end - windowSize + 1);
                }

                const items: (number | 'ellipsis-left' | 'ellipsis-right')[] = [];
                if (start > 1) {
                  items.push(1);
                  if (start > 2) items.push('ellipsis-left');
                }
                for (let p = start; p <= end; p++) items.push(p);
                if (end < totalPages) {
                  if (end < totalPages - 1) items.push('ellipsis-right');
                  items.push(totalPages);
                }
                return items.map((it, idx) => {
                  if (typeof it !== 'number') {
                    return (
                      <span key={it + String(idx)} className="px-2 text-gray-400">…</span>
                    );
                  }
                  return (
                    <Button
                      key={it}
                      variant={current === it ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => (serverPagination ? serverPagination.onPageChange(it) : setCurrentPage(it))}
                    >
                      {it}
                    </Button>
                  );
                });
              })()}
            </div>

            {/* 下一页、末页 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => (serverPagination ? serverPagination.onPageChange(Math.min(totalPages, current + 1)) : setCurrentPage(Math.min(totalPages, currentPage + 1)))}
              disabled={current === totalPages}
            >
              下一页 ›
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => (serverPagination ? serverPagination.onPageChange(totalPages) : setCurrentPage(totalPages))}
              disabled={current === totalPages}
            >
              末页 »
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
