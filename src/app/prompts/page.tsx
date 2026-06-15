'use client';

import { useState, useEffect } from 'react';
import { PromptTemplate } from '@/types';
import { PromptEditor } from '@/components/prompts/prompt-editor';
import { PromptList } from '@/components/prompts/prompt-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, Settings } from 'lucide-react';

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/prompts');
      if (response.ok) {
        const data = await response.json();
        setPrompts(data.data.prompts);
        
        // 如果没有选中的 prompt，选择当前激活的
        if (!selectedPrompt) {
          const activePrompt = data.data.prompts.find((p: PromptTemplate) => p.isActive);
          if (activePrompt) {
            setSelectedPrompt(activePrompt);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load prompts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    const newPrompt: PromptTemplate = {
      id: '',
      name: '新的 Prompt 模板',
      description: '',
      content: `请分析以下用户评论，提取关键信息：

评论内容：{review_content}
评分：{rating}
版本：{version}

请按以下格式返回分析结果：
{
  "sentiment": "positive|negative|neutral",
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "version_mentioned": "版本号或null"
}`,
      version: '1.0.0',
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    setSelectedPrompt(newPrompt);
    setIsEditing(true);
  };

  const handleEdit = (prompt: PromptTemplate) => {
    setSelectedPrompt(prompt);
    setIsEditing(true);
  };

  const handleSave = async (prompt: PromptTemplate) => {
    try {
      const isNew = !prompt.id;
      const url = isNew ? '/api/prompts' : `/api/prompts/${prompt.id}`;
      const method = isNew ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(prompt),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedPrompt(data.data);
        setIsEditing(false);
        await loadPrompts();
      } else {
        const error = await response.json();
        alert(error.error || '保存失败');
      }
    } catch (error) {
      console.error('Failed to save prompt:', error);
      alert('保存失败');
    }
  };

  const handleDelete = async (promptId: string) => {
    if (!confirm('确定要删除这个 Prompt 模板吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/prompts/${promptId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadPrompts();
        if (selectedPrompt?.id === promptId) {
          setSelectedPrompt(null);
          setIsEditing(false);
        }
      } else {
        const error = await response.json();
        alert(error.error || '删除失败');
      }
    } catch (error) {
      console.error('Failed to delete prompt:', error);
      alert('删除失败');
    }
  };

  const handleActivate = async (promptId: string) => {
    try {
      const response = await fetch(`/api/prompts/${promptId}/activate`, {
        method: 'POST',
      });

      if (response.ok) {
        await loadPrompts();
      } else {
        const error = await response.json();
        alert(error.error || '激活失败');
      }
    } catch (error) {
      console.error('Failed to activate prompt:', error);
      alert('激活失败');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (!selectedPrompt?.id) {
      setSelectedPrompt(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            加载中...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Settings className="h-6 w-6" />
                Prompt 配置管理
              </h1>
              <p className="text-gray-600 mt-1">
                管理分析用的 Prompt 模板，支持版本控制和切换
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={loadPrompts} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
              <Button onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                新建模板
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：Prompt 列表 */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  模板列表
                  <Badge variant="secondary">{prompts.length} 个模板</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PromptList
                  prompts={prompts}
                  selectedPrompt={selectedPrompt}
                  onSelect={setSelectedPrompt}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onActivate={handleActivate}
                />
              </CardContent>
            </Card>
          </div>

          {/* 右侧：Prompt 编辑器 */}
          <div className="lg:col-span-2">
            {selectedPrompt ? (
              <PromptEditor
                prompt={selectedPrompt}
                isEditing={isEditing}
                onSave={handleSave}
                onCancel={handleCancel}
                onEdit={() => setIsEditing(true)}
              />
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    选择一个 Prompt 模板
                  </h3>
                  <p className="text-gray-500 mb-4">
                    从左侧列表中选择一个模板进行查看或编辑
                  </p>
                  <Button onClick={handleCreateNew}>
                    <Plus className="h-4 w-4 mr-2" />
                    创建新模板
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
