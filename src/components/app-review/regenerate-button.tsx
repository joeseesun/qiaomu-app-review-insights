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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const regenerate = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/research/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, country, maxReviews: 400, analyze: true, incremental: true }),
      });
      const payload = await response.json() as RegenerateResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || '更新失败');
      }

      window.location.href = `${payload.data.pageUrl}?updated=${Date.now()}`;
    } catch (regenerateError) {
      setError(regenerateError instanceof Error ? regenerateError.message : '更新失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={regenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          更新洞察
        </button>
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
