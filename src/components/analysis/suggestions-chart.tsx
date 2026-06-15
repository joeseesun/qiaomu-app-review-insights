'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { truncateText } from '@/lib/utils';

interface SuggestionsChartProps {
  data: Array<{
    suggestion: string;
    count: number;
    examples: string[];
  }>;
  title?: string;
  maxItems?: number;
}

export function SuggestionsChart({ data, title = "改进建议", maxItems = 10 }: SuggestionsChartProps) {
  const chartData = data
    .slice(0, maxItems)
    .map(item => ({
      ...item,
      shortSuggestion: truncateText(item.suggestion, 20),
    }));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            暂无建议数据
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {title}
          <Badge variant="secondary" className="bg-blue-50 text-blue-700">
            {data.length} 个建议
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="shortSuggestion" 
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={12}
              />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => [value, '提及次数']}
                labelFormatter={(label) => {
                  const item = chartData.find(d => d.shortSuggestion === label);
                  return item ? item.suggestion : label;
                }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-3 border rounded-lg shadow-lg max-w-xs">
                        <p className="font-medium">{data.suggestion}</p>
                        <p className="text-sm text-gray-600">提及次数: {data.count}</p>
                        {data.examples.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-500 mb-1">示例:</p>
                            {data.examples.slice(0, 2).map((example: string, index: number) => (
                              <p key={index} className="text-xs text-gray-700 truncate">
                                • {example}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 详细列表 */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {data.slice(0, 5).map((item, index) => (
            <div key={index} className="flex items-start justify-between p-2 bg-blue-50 rounded">
              <div className="flex-1">
                <div className="font-medium text-sm">{item.suggestion}</div>
                {item.examples.length > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    示例: {truncateText(item.examples[0], 50)}
                  </div>
                )}
              </div>
              <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">
                {item.count}
              </Badge>
            </div>
          ))}
          
          {data.length > 5 && (
            <div className="text-center text-sm text-gray-500 pt-2">
              还有 {data.length - 5} 个建议...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
