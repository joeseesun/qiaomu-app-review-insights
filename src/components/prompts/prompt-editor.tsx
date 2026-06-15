'use client';

import { useState, useEffect } from 'react';
import { PromptTemplate } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Save, X, Edit, Eye, TestTube } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface PromptEditorProps {
  prompt: PromptTemplate;
  isEditing: boolean;
  onSave: (prompt: PromptTemplate) => void;
  onCancel: () => void;
  onEdit: () => void;
}

export function PromptEditor({
  prompt,
  isEditing,
  onSave,
  onCancel,
  onEdit,
}: PromptEditorProps) {
  const [editedPrompt, setEditedPrompt] = useState<PromptTemplate>(prompt);
  const [testResult, setTestResult] = useState<string>('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setEditedPrompt(prompt);
  }, [prompt]);

  const handleSave = () => {
    if (!editedPrompt.name.trim()) {
      alert('请输入模板名称');
      return;
    }
    
    if (!editedPrompt.content.trim()) {
      alert('请输入 Prompt 内容');
      return;
    }

    const updatedPrompt = {
      ...editedPrompt,
      updatedAt: new Date().toISOString(),
    };

    onSave(updatedPrompt);
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult('');

      const testReview = {
        content: '这个应用很好用，但是有时候会卡顿，希望能优化一下性能。界面设计也很漂亮。',
        rating: '4',
        version: '2.1.0',
      };

      const response = await fetch('/api/prompts/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: editedPrompt.content,
          testData: testReview,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTestResult(JSON.stringify(data.result, null, 2));
      } else {
        const error = await response.json();
        setTestResult(`测试失败: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to test prompt:', error);
      setTestResult(`测试失败: ${error}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {isEditing ? (
                <Input
                  value={editedPrompt.name}
                  onChange={(e) =>
                    setEditedPrompt({ ...editedPrompt, name: e.target.value })
                  }
                  className="text-lg font-semibold"
                  placeholder="模板名称"
                />
              ) : (
                <>
                  {prompt.name}
                  {prompt.isActive && (
                    <Badge variant="default">当前使用</Badge>
                  )}
                </>
              )}
            </CardTitle>
            {!isEditing && (
              <div className="text-sm text-gray-500 mt-1">
                版本 {prompt.version} • 创建于 {formatDate(prompt.createdAt)}
                {prompt.updatedAt !== prompt.createdAt && (
                  <> • 更新于 {formatDate(prompt.updatedAt)}</>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={onCancel}>
                  <X className="h-4 w-4 mr-2" />
                  取消
                </Button>
                <Button onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  保存
                </Button>
              </>
            ) : (
              <Button onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                编辑
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 描述 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            描述
          </label>
          {isEditing ? (
            <Input
              value={editedPrompt.description}
              onChange={(e) =>
                setEditedPrompt({ ...editedPrompt, description: e.target.value })
              }
              placeholder="简要描述这个模板的用途"
            />
          ) : (
            <p className="text-sm text-gray-600">
              {prompt.description || '无描述'}
            </p>
          )}
        </div>

        {/* 版本 */}
        {isEditing && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              版本
            </label>
            <Input
              value={editedPrompt.version}
              onChange={(e) =>
                setEditedPrompt({ ...editedPrompt, version: e.target.value })
              }
              placeholder="例如: 1.0.0"
            />
          </div>
        )}

        {/* Prompt 内容 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Prompt 内容
            </label>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                <TestTube className="h-4 w-4 mr-2" />
                {testing ? '测试中...' : '测试'}
              </Button>
            )}
          </div>
          {isEditing ? (
            <textarea
              value={editedPrompt.content}
              onChange={(e) =>
                setEditedPrompt({ ...editedPrompt, content: e.target.value })
              }
              className="w-full h-64 p-3 border border-gray-300 rounded-md font-mono text-sm"
              placeholder="输入 Prompt 内容..."
            />
          ) : (
            <pre className="bg-gray-50 p-4 rounded-md text-sm font-mono whitespace-pre-wrap border">
              {prompt.content}
            </pre>
          )}
        </div>

        {/* 测试结果 */}
        {testResult && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              测试结果
            </label>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-md text-sm font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
              {testResult}
            </pre>
          </div>
        )}

        {/* 使用说明 */}
        {!isEditing && (
          <div className="bg-blue-50 p-4 rounded-md">
            <h4 className="font-medium text-blue-900 mb-2">使用说明</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• 在 Prompt 中可以使用以下变量：</p>
              <p>• <code className="bg-blue-100 px-1 rounded">{'{review_content}'}</code> - 评论内容</p>
              <p>• <code className="bg-blue-100 px-1 rounded">{'{rating}'}</code> - 评分</p>
              <p>• <code className="bg-blue-100 px-1 rounded">{'{version}'}</code> - 应用版本</p>
              <p>• 返回结果应为有效的 JSON 格式</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
