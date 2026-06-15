'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface RegenerateButtonProps {
  appId: string;
  country: string;
}

interface RegenerateResponse {
  success: boolean;
  data?: {
    pageUrl: string;
    updatedAt: string;
    cached: boolean;
    incremental: boolean;
  };
  error?: string;
}

export function RegenerateButton({ appId, country }: RegenerateButtonProps) {
  const [loadingMode, setLoadingMode] = useState<'incremental' | 'full' | null>(null);
  const [error, setError] = useState('');

  const regenerate = async (incremental: boolean) => {
    setLoadingMode(incremental ? 'incremental' : 'full');
    setError('');

    try {
      const response = await fetch('/api/research/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, country, maxReviews: 400, analyze: true, incremental }),
      });
      const payload = await response.json() as RegenerateResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || '重新生成失败');
      }

      window.location.href = `${payload.data.pageUrl}?updated=${Date.now()}`;
    } catch (regenerateError) {
      setError(regenerateError instanceof Error ? regenerateError.message : '重新生成失败');
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => regenerate(true)}
          disabled={Boolean(loadingMode)}
          className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loadingMode === 'incremental' ? 'animate-spin' : ''}`} />
          增量更新
        </button>
        <button
          type="button"
          onClick={() => regenerate(false)}
          disabled={Boolean(loadingMode)}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loadingMode === 'full' ? 'animate-spin' : ''}`} />
          重新生成
        </button>
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
