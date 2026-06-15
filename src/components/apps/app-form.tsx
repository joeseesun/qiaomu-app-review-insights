'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { App } from '@/types';
import { getCountryFlag, getCountryName } from '@/lib/utils';
import { parseAppStoreUrl, validateAppStoreUrl, validateAppId, EXAMPLE_URLS } from '@/lib/app-store-parser';
import { Link, Sparkles } from 'lucide-react';

interface AppFormProps {
  app?: App;
  onSubmit: (app: Omit<App, 'lastFetched'>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const COUNTRY_OPTIONS = [
  { code: 'us', name: '美国' },
  { code: 'cn', name: '中国' },
  { code: 'jp', name: '日本' },
  { code: 'kr', name: '韩国' },
  { code: 'gb', name: '英国' },
  { code: 'de', name: '德国' },
  { code: 'fr', name: '法国' },
  { code: 'it', name: '意大利' },
  { code: 'es', name: '西班牙' },
  { code: 'br', name: '巴西' },
  { code: 'in', name: '印度' },
  { code: 'au', name: '澳大利亚' },
  { code: 'ca', name: '加拿大' },
];

export function AppForm({ app, onSubmit, onCancel, isLoading }: AppFormProps) {
  const [inputMode, setInputMode] = useState<'manual' | 'url'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [formData, setFormData] = useState({
    id: app?.id || '',
    name: app?.name || '',
    country: app?.country || 'us',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (inputMode === 'url') {
      if (!urlInput.trim()) {
        newErrors.url = 'App Store URL 不能为空';
      } else if (!validateAppStoreUrl(urlInput)) {
        newErrors.url = '请输入有效的 App Store URL';
      }
    } else {
      if (!formData.id.trim()) {
        newErrors.id = '应用ID不能为空';
      } else if (!validateAppId(formData.id)) {
        newErrors.id = '应用ID必须是数字';
      }

      if (!formData.name.trim()) {
        newErrors.name = '应用名称不能为空';
      }

      if (!formData.country) {
        newErrors.country = '请选择国家/地区';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleParseUrl = () => {
    if (!urlInput.trim()) {
      setErrors({ url: 'URL 不能为空' });
      return;
    }

    const parsed = parseAppStoreUrl(urlInput);
    if (parsed) {
      setFormData({
        id: parsed.id,
        name: parsed.name,
        country: parsed.country,
      });
      setErrors({});
      setInputMode('manual');
    } else {
      setErrors({ url: '无法解析 URL，请检查格式是否正确' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (inputMode === 'url') {
      handleParseUrl();
      return;
    }

    if (validateForm()) {
      onSubmit({
        id: formData.id.trim(),
        name: formData.name.trim(),
        country: formData.country,
      });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // 清除对应字段的错误
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{app ? '编辑应用' : '添加应用'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 输入模式切换 */}
          {!app && (
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
              <button
                type="button"
                onClick={() => setInputMode('url')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  inputMode === 'url'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Link className="h-4 w-4 inline mr-2" />
                URL 输入
              </button>
              <button
                type="button"
                onClick={() => setInputMode('manual')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  inputMode === 'manual'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                手动输入
              </button>
            </div>
          )}

          {/* URL 输入模式 */}
          {inputMode === 'url' && !app && (
            <div>
              <label htmlFor="appUrl" className="block text-sm font-medium mb-1">
                App Store URL
              </label>
              <Input
                id="appUrl"
                type="text"
                placeholder="粘贴 App Store 应用链接..."
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (errors.url) {
                    setErrors(prev => ({ ...prev, url: '' }));
                  }
                }}
                disabled={isLoading}
                className={errors.url ? 'border-red-500' : ''}
              />
              {errors.url && (
                <p className="text-red-500 text-xs mt-1">{errors.url}</p>
              )}
              <div className="mt-2">
                <p className="text-gray-500 text-xs mb-2">示例 URL：</p>
                <div className="space-y-1">
                  {EXAMPLE_URLS.slice(0, 2).map((exampleUrl, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setUrlInput(exampleUrl)}
                      className="block text-xs text-blue-600 hover:text-blue-800 truncate w-full text-left"
                    >
                      {exampleUrl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 手动输入模式 */}
          {inputMode === 'manual' && (
            <>
              <div>
                <label htmlFor="appId" className="block text-sm font-medium mb-1">
                  应用ID
                </label>
                <Input
                  id="appId"
                  type="text"
                  placeholder="例如: 6448311069"
                  value={formData.id}
                  onChange={(e) => handleInputChange('id', e.target.value)}
                  disabled={isLoading || !!app} // 编辑时不允许修改ID
                  className={errors.id ? 'border-red-500' : ''}
                />
                {errors.id && (
                  <p className="text-red-500 text-xs mt-1">{errors.id}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  可在 App Store 应用页面的 URL 中找到
                </p>
              </div>

              <div>
                <label htmlFor="appName" className="block text-sm font-medium mb-1">
                  应用名称
                </label>
                <Input
                  id="appName"
                  type="text"
                  placeholder="例如: ChatGPT"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  disabled={isLoading}
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="country" className="block text-sm font-medium mb-1">
                  国家/地区
                </label>
                <select
                  id="country"
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  disabled={isLoading}
                  className={`w-full h-10 px-3 py-2 text-sm border rounded-md bg-background ${
                    errors.country ? 'border-red-500' : 'border-input'
                  }`}
                >
                  {COUNTRY_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {getCountryFlag(option.code)} {option.name}
                    </option>
                  ))}
                </select>
                {errors.country && (
                  <p className="text-red-500 text-xs mt-1">{errors.country}</p>
                )}
              </div>
            </>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
            >
              {inputMode === 'url' && !app ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  解析 URL
                </>
              ) : (
                isLoading ? '保存中...' : (app ? '更新' : '添加')
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              取消
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
