'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getRatingStars } from '@/lib/utils';

interface VersionAnalysisProps {
  data: Array<{
    version: string;
    reviewCount: number;
    averageRating: number;
    sentimentDistribution: {
      positive: number;
      negative: number;
      neutral: number;
    };
  }>;
}

export function VersionAnalysis({ data }: VersionAnalysisProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>版本分析</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            暂无版本数据
          </div>
        </CardContent>
      </Card>
    );
  }

  // 准备图表数据
  const chartData = data.map(item => ({
    ...item,
    positiveRate: item.reviewCount > 0 ? (item.sentimentDistribution.positive / item.reviewCount) * 100 : 0,
    negativeRate: item.reviewCount > 0 ? (item.sentimentDistribution.negative / item.reviewCount) * 100 : 0,
  }));

  return (
    <div className="space-y-6">
      {/* 版本评分趋势 */}
      <Card>
        <CardHeader>
          <CardTitle>版本评分趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="version" />
                <YAxis domain={[0, 5]} />
                <Tooltip 
                  formatter={(value: number) => [value.toFixed(1), '平均评分']}
                  labelFormatter={(label) => `版本 ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="averageRating" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 版本情感分布 */}
      <Card>
        <CardHeader>
          <CardTitle>版本情感分布</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="version" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      positiveRate: '正面比例',
                      negativeRate: '负面比例',
                    };
                    return [`${value.toFixed(1)}%`, labels[name] || name];
                  }}
                  labelFormatter={(label) => `版本 ${label}`}
                />
                <Bar dataKey="positiveRate" stackId="a" fill="#10b981" name="正面比例" />
                <Bar dataKey="negativeRate" stackId="a" fill="#ef4444" name="负面比例" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 版本详细信息 */}
      <Card>
        <CardHeader>
          <CardTitle>版本详细信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.map((version, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg">版本 {version.version}</h3>
                    <Badge variant="secondary">{version.reviewCount} 条评论</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getRatingStars(Math.round(version.averageRating))}</span>
                    <span className="text-sm text-gray-500">
                      {version.averageRating.toFixed(1)}/5
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-green-50 rounded">
                    <div className="text-2xl font-bold text-green-600">
                      {version.sentimentDistribution.positive}
                    </div>
                    <div className="text-sm text-gray-600">正面评论</div>
                    <div className="text-xs text-gray-500">
                      {version.reviewCount > 0 
                        ? ((version.sentimentDistribution.positive / version.reviewCount) * 100).toFixed(1)
                        : 0}%
                    </div>
                  </div>

                  <div className="text-center p-3 bg-red-50 rounded">
                    <div className="text-2xl font-bold text-red-600">
                      {version.sentimentDistribution.negative}
                    </div>
                    <div className="text-sm text-gray-600">负面评论</div>
                    <div className="text-xs text-gray-500">
                      {version.reviewCount > 0 
                        ? ((version.sentimentDistribution.negative / version.reviewCount) * 100).toFixed(1)
                        : 0}%
                    </div>
                  </div>

                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold text-gray-600">
                      {version.sentimentDistribution.neutral}
                    </div>
                    <div className="text-sm text-gray-600">中性评论</div>
                    <div className="text-xs text-gray-500">
                      {version.reviewCount > 0 
                        ? ((version.sentimentDistribution.neutral / version.reviewCount) * 100).toFixed(1)
                        : 0}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
