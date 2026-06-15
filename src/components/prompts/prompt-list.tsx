'use client';

import { PromptTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Edit, Trash2, CheckCircle, Circle } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

interface PromptListProps {
  prompts: PromptTemplate[];
  selectedPrompt: PromptTemplate | null;
  onSelect: (prompt: PromptTemplate) => void;
  onEdit: (prompt: PromptTemplate) => void;
  onDelete: (promptId: string) => void;
  onActivate: (promptId: string) => void;
}

export function PromptList({
  prompts,
  selectedPrompt,
  onSelect,
  onEdit,
  onDelete,
  onActivate,
}: PromptListProps) {
  if (prompts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>暂无 Prompt 模板</p>
        <p className="text-sm mt-1">点击"新建模板"创建第一个模板</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {prompts.map((prompt) => (
        <Card
          key={prompt.id}
          className={`cursor-pointer transition-colors ${
            selectedPrompt?.id === prompt.id
              ? 'border-blue-500 bg-blue-50'
              : 'hover:border-gray-300'
          }`}
          onClick={() => onSelect(prompt)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-sm">{prompt.name}</h3>
                  {prompt.isActive && (
                    <Badge variant="default" className="text-xs">
                      当前使用
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">
                  {prompt.description || '无描述'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
              <span>版本 {prompt.version}</span>
              <span>{formatRelativeTime(prompt.updatedAt)}</span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(prompt);
                }}
                className="h-7 px-2"
              >
                <Edit className="h-3 w-3" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onActivate(prompt.id);
                }}
                className="h-7 px-2"
                disabled={prompt.isActive}
              >
                {prompt.isActive ? (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(prompt.id);
                }}
                className="h-7 px-2 text-red-600 hover:text-red-700"
                disabled={prompt.isActive}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
