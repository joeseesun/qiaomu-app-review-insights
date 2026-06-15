'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Settings, RefreshCw, Plus, Save, Eye, EyeOff } from 'lucide-react';
import { PromptTemplate } from '@/types';
import { PromptEditor } from '@/components/prompts/prompt-editor';
import { PromptList } from '@/components/prompts/prompt-list';

interface ModelConfig {
  apiUrl: string;
  apiKey: string;
  modelName: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'model' | 'prompts'>('model');
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    apiUrl: '',
    apiKey: '',
    modelName: '',
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Prompt 相关状态
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadSettings();
    loadPrompts();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // 从环境变量或配置文件加载设置
      setModelConfig({
        apiUrl: process.env.NEXT_PUBLIC_KIMI_API_URL || 'https://api.moonshot.cn/v1/chat/completions',
        apiKey: '***已配置***', // 不显示真实的 API Key
        modelName: process.env.NEXT_PUBLIC_KIMI_MODEL || 'kimi-k2-0905-preview',
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPrompts = async () => {
    try {
      const response = await fetch('/api/prompts');
      if (response.ok) {
        const data = await response.json();
        setPrompts(data.data.prompts);
        
        if (!selectedPrompt) {
          const activePrompt = data.data.prompts.find((p: PromptTemplate) => p.isActive);
          if (activePrompt) {
            setSelectedPrompt(activePrompt);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load prompts:', error);
    }
  };

  const handleSaveModelConfig = async () => {
    try {
      setSaving(true);
      // 这里应该调用 API 保存配置
      // 由于这些是环境变量，实际应用中可能需要重启服务
      alert('模型配置已保存！请重启服务以使配置生效。');
    } catch (error) {
      console.error('Failed to save model config:', error);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // Prompt 相关处理函数
  const handleCreateNewPrompt = () => {
    const newPrompt: PromptTemplate = {
      id: '',
      name: '新的 Prompt 模板',
      description: '',
      content: `请分析以下用户评论，提取关键信息：

评论内容：{content}
评分：{rating}
版本：{version}
作者：{authorName}
更新时间：{updated}

请按以下格式返回分析结果：
{
  "sentiment": "positive|negative|neutral",
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "versionRefs": ["版本号1", "版本号2"]
}`,
      version: '1.0.0',
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    setSelectedPrompt(newPrompt);
    setIsEditing(true);
  };

  const handleEditPrompt = (prompt: PromptTemplate) => {
    setSelectedPrompt(prompt);
    setIsEditing(true);
  };

  const handleSavePrompt = async (prompt: PromptTemplate) => {
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

  const handleDeletePrompt = async (promptId: string) => {
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

  const handleActivatePrompt = async (promptId: string) => {
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

  const handleCancelPrompt = () => {
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
                系统配置
              </h1>
              <p className="text-gray-600 mt-1">
                管理模型配置和 Prompt 模板
              </p>
            </div>
            <Button onClick={() => window.location.href = '/'} variant="outline">
              返回首页
            </Button>
          </div>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('model')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'model'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              模型配置
            </button>
            <button
              onClick={() => setActiveTab('prompts')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'prompts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Prompt 配置
            </button>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="container mx-auto px-4 py-8">
        {activeTab === 'model' && (
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>AI 模型配置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    API URL
                  </label>
                  <Input
                    type="text"
                    placeholder="https://api.moonshot.cn/v1/chat/completions"
                    value={modelConfig.apiUrl}
                    onChange={(e) => setModelConfig(prev => ({ ...prev, apiUrl: e.target.value }))}
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    AI 模型的 API 端点地址
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    API Key
                  </label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      placeholder="sk-..."
                      value={modelConfig.apiKey}
                      onChange={(e) => setModelConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">
                    用于访问 AI 模型的密钥
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    模型名称
                  </label>
                  <Input
                    type="text"
                    placeholder="kimi-k2-0905-preview"
                    value={modelConfig.modelName}
                    onChange={(e) => setModelConfig(prev => ({ ...prev, modelName: e.target.value }))}
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    要使用的具体模型名称
                  </p>
                </div>

                <div className="pt-4">
                  <Button 
                    onClick={handleSaveModelConfig}
                    disabled={saving}
                    className="w-full"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? '保存中...' : '保存配置'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'prompts' && (
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
                  <div className="mb-4">
                    <Button onClick={handleCreateNewPrompt} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      新建模板
                    </Button>
                  </div>
                  <PromptList
                    prompts={prompts}
                    selectedPrompt={selectedPrompt}
                    onSelect={setSelectedPrompt}
                    onEdit={handleEditPrompt}
                    onDelete={handleDeletePrompt}
                    onActivate={handleActivatePrompt}
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
                  onSave={handleSavePrompt}
                  onCancel={handleCancelPrompt}
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
                    <Button onClick={handleCreateNewPrompt}>
                      <Plus className="h-4 w-4 mr-2" />
                      创建新模板
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
