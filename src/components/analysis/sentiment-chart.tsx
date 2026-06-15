'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SentimentChartProps {
  data: {
    positive: number;
    negative: number;
    neutral: number;
  };
}

const COLORS = {
  positive: '#10b981',
  negative: '#ef4444',
  neutral: '#6b7280',
};

const LABELS = {
  positive: '正面',
  negative: '负面',
  neutral: '中性',
};

export function SentimentChart({ data }: SentimentChartProps) {
  const chartData = [
    { name: LABELS.positive, value: data.positive, color: COLORS.positive },
    { name: LABELS.negative, value: data.negative, color: COLORS.negative },
    { name: LABELS.neutral, value: data.neutral, color: COLORS.neutral },
  ].filter(item => item.value > 0);

  const total = data.positive + data.negative + data.neutral;

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null; // 不显示小于5%的标签
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>情感分布</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            暂无分析数据
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>情感分布</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [value, '评论数']}
                labelFormatter={(label) => `${label}评论`}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* 统计数字 */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{data.positive}</div>
            <div className="text-sm text-gray-500">正面</div>
            <div className="text-xs text-gray-400">
              {total > 0 ? ((data.positive / total) * 100).toFixed(1) : 0}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{data.negative}</div>
            <div className="text-sm text-gray-500">负面</div>
            <div className="text-xs text-gray-400">
              {total > 0 ? ((data.negative / total) * 100).toFixed(1) : 0}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{data.neutral}</div>
            <div className="text-sm text-gray-500">中性</div>
            <div className="text-xs text-gray-400">
              {total > 0 ? ((data.neutral / total) * 100).toFixed(1) : 0}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
