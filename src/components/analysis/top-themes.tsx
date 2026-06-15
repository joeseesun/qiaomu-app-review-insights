'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ThemeItem { title: string; summary: string; examples: Array<{ id: string; snippet: string }>; }

export function TopThemes({ title, items, appId }: { title: string; items: ThemeItem[]; appId: string }) {
  if (!items || items.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.slice(0,5).map((it, i) => (
            <ThemeCard key={i} item={it} appId={appId} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ThemeCard({ item, appId }: { item: ThemeItem; appId: string }) {
  const [open, setOpen] = React.useState(false);
  const first = item.examples?.[0];
  const rest = (item.examples || []).slice(1);
  return (
    <div className="p-3 rounded border bg-white/50">
      <div className="font-medium mb-1">{item.title}</div>
      <div className="text-sm text-gray-700 mb-2">{item.summary}</div>
      {first && (
        <div className="text-xs text-gray-500">
          示例：{first.snippet}
          <a className="ml-2 text-blue-600 hover:underline"
             href={`/reviews/${appId}?q=${encodeURIComponent(first.snippet.slice(0, 20))}&highlight=${encodeURIComponent(first.id || '')}`}
             title="查看原评论">查看原评论</a>
        </div>
      )}
      {rest.length > 0 && (
        <button className="text-xs text-blue-600 mt-1" onClick={() => setOpen(!open)}>
          {open ? '收起更多示例' : '展开更多示例'}
        </button>
      )}
      {open && rest.length > 0 && (
        <ul className="mt-1 space-y-1 text-xs text-gray-500 list-disc ml-5">
              {rest.map((e, idx) => (
                <li key={idx}>
                  {e.snippet}
                  <a className="ml-2 text-blue-600 hover:underline"
                 href={`/reviews/${appId}?q=${encodeURIComponent(e.snippet.slice(0, 20))}&highlight=${encodeURIComponent(e.id || '')}`}
                 title="查看原评论">查看</a>
                </li>
              ))}
        </ul>
      )}
    </div>
  );
}
