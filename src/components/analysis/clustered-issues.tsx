'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface ClusteredIssuesProps {
  data: Array<{
    category: string;
    issues: Array<{
      issue: string;
      count: number;
      examples: string[];
    }>;
    totalCount: number;
  }>;
  title?: string;
}

export function ClusteredIssues({ data, title = "问题分类分析" }: ClusteredIssuesProps) {
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    const newOpenCategories = new Set(openCategories);
    if (newOpenCategories.has(category)) {
      newOpenCategories.delete(category);
    } else {
      newOpenCategories.add(category);
    }
    setOpenCategories(newOpenCategories);
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-gray-500">
            暂无问题数据
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
          <Badge variant="secondary" className="bg-red-50 text-red-700">
            {data.length} 个类别
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((category, index) => {
            const isOpen = openCategories.has(category.category);
            
            return (
              <Collapsible key={index} open={isOpen} onOpenChange={() => toggleCategory(category.category)}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      )}
                      <span className="font-medium text-left">{category.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-red-100 text-red-700">
                        {category.totalCount} 次提及
                      </Badge>
                      <Badge variant="outline">
                        {category.issues.length} 个问题
                      </Badge>
                    </div>
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="mt-2 ml-7 space-y-2">
                    {category.issues.map((issue, issueIndex) => (
                      <div key={issueIndex} className="flex items-start justify-between p-3 bg-white border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-900">{issue.issue}</div>
                          {issue.examples.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <div className="text-xs text-gray-500">相关评论示例:</div>
                              {issue.examples.slice(0, 2).map((example, exampleIndex) => (
                                <div key={exampleIndex} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                  "{example}"
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <Badge variant="secondary" className="ml-3 bg-red-50 text-red-700">
                          {issue.count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
