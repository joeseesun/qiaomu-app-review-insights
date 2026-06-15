'use client';

import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface VersionSentimentProps {
  data: Array<{
    version: string;
    reviewCount: number;
    sentimentDistribution: { positive: number; negative: number; neutral: number };
  }>;
}

export function VersionSentiment({ data }: VersionSentimentProps) {
  const chartData = (data || []).map(item => ({
    version: item.version,
    positiveRate: item.reviewCount > 0 ? (item.sentimentDistribution.positive / item.reviewCount) * 100 : 0,
    negativeRate: item.reviewCount > 0 ? (item.sentimentDistribution.negative / item.reviewCount) * 100 : 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>版本情感分布</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="version" />
              <YAxis />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = { positiveRate: '正面比例', negativeRate: '负面比例' };
                  return [`${(value as number).toFixed(1)}%`, labels[name] || name];
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
  );
}

