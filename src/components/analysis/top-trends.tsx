'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function TopTrends({ bullets }: { bullets: string[] }) {
  if (!bullets || bullets.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>时间趋势洞察（近三个月）</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="list-disc ml-5 space-y-2 text-sm text-gray-700">
          {bullets.slice(0,5).map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

