'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Lightbulb } from 'lucide-react';

interface SuggestionsListProps {
  data: Array<{
    suggestion: string;
    count: number;
    examples: string[];
  }>;
  title?: string;
  maxItems?: number;
}

export function SuggestionsList({ data, title = "改进建议", maxItems = 10 }: SuggestionsListProps) {
  const displayData = data.slice(0, maxItems);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-blue-500" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-gray-500">
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
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-blue-500" />
            {title}
          </div>
          <Badge variant="secondary" className="bg-blue-50 text-blue-700">
            {data.length} 个建议
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayData.map((item, index) => (
            <div key={index} className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex-shrink-0 mt-0.5">
                <CheckCircle className="h-4 w-4 text-blue-500" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm leading-relaxed">
                      {item.suggestion}
                    </div>
                    
                    {item.examples.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs text-gray-500 mb-1">相关评论示例:</div>
                        <div className="space-y-1">
                          {item.examples.slice(0, 2).map((example, exampleIndex) => (
                            <div key={exampleIndex} className="text-xs text-gray-600 bg-white p-2 rounded border">
                              "{example}"
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-shrink-0">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      {item.count} 次提及
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {data.length > maxItems && (
            <div className="text-center text-sm text-gray-500 pt-2 border-t">
              还有 {data.length - maxItems} 个建议未显示
            </div>
          )}
        </div>
        
        {data.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500 text-center">
              💡 建议按提及频次排序，频次越高说明用户反馈越强烈
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
