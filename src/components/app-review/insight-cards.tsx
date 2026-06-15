import type { ReactNode } from 'react';
import { AlertCircle, Lightbulb, Star, Target, TrendingDown, Users } from 'lucide-react';

export type ReviewInsightItem = {
  title: string;
  summary: string;
  evidence?: string;
  priority?: 'high' | 'medium' | 'low';
};

export type ReviewInsights = {
  painPoints: ReviewInsightItem[];
  opportunities: ReviewInsightItem[];
  positiveSignals: ReviewInsightItem[];
  userSegments: ReviewInsightItem[];
  versionRisks: ReviewInsightItem[];
  actionPlan: ReviewInsightItem[];
};

type InsightKind = 'pain' | 'opportunity' | 'positive' | 'segment' | 'risk' | 'action';

const priorityLabel = {
  high: '高',
  medium: '中',
  low: '低',
} as const;

const priorityStyle = {
  high: 'border-rose-200 bg-rose-50 text-rose-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  low: 'border-emerald-200 bg-emerald-50 text-emerald-700',
} as const;

const insightStyles: Record<InsightKind, {
  label: string;
  icon: ReactNode;
  card: string;
  iconBox: string;
  eyebrow: string;
  marker: string;
}> = {
  pain: {
    label: 'Problem',
    icon: <TrendingDown className="h-4 w-4" />,
    card: 'border-rose-200 bg-rose-50/45',
    iconBox: 'bg-rose-100 text-rose-700',
    eyebrow: 'text-rose-700',
    marker: 'bg-rose-500',
  },
  opportunity: {
    label: 'Opportunity',
    icon: <Lightbulb className="h-4 w-4" />,
    card: 'border-amber-200 bg-amber-50/45',
    iconBox: 'bg-amber-100 text-amber-700',
    eyebrow: 'text-amber-700',
    marker: 'bg-amber-500',
  },
  positive: {
    label: 'Strength',
    icon: <Star className="h-4 w-4" />,
    card: 'border-emerald-200 bg-emerald-50/45',
    iconBox: 'bg-emerald-100 text-emerald-700',
    eyebrow: 'text-emerald-700',
    marker: 'bg-emerald-500',
  },
  segment: {
    label: 'Audience',
    icon: <Users className="h-4 w-4" />,
    card: 'border-sky-200 bg-sky-50/45',
    iconBox: 'bg-sky-100 text-sky-700',
    eyebrow: 'text-sky-700',
    marker: 'bg-sky-500',
  },
  risk: {
    label: 'Risk',
    icon: <AlertCircle className="h-4 w-4" />,
    card: 'border-fuchsia-200 bg-fuchsia-50/35',
    iconBox: 'bg-fuchsia-100 text-fuchsia-700',
    eyebrow: 'text-fuchsia-700',
    marker: 'bg-fuchsia-500',
  },
  action: {
    label: 'Action',
    icon: <Target className="h-4 w-4" />,
    card: 'border-teal-200 bg-teal-50/45',
    iconBox: 'bg-teal-100 text-teal-700',
    eyebrow: 'text-teal-700',
    marker: 'bg-teal-500',
  },
};

export function InsightCard({
  kind,
  title,
  items,
}: {
  kind: InsightKind;
  title: string;
  items: ReviewInsightItem[];
}) {
  const style = insightStyles[kind];

  return (
    <section className={`relative overflow-hidden rounded-lg border p-4 shadow-sm ${style.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${style.iconBox}`}>
            {style.icon}
          </span>
          <div className="min-w-0">
            <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${style.eyebrow}`}>
              {style.label}
            </p>
            <h2 className="mt-1 text-base font-semibold text-zinc-950">{title}</h2>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-white/80 bg-white/80 px-2.5 py-1 text-xs text-zinc-500">
          {items.length || 0} 条
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="rounded-md border border-white/80 bg-white/70 px-3 py-2 text-sm text-zinc-500">
            暂无明显信号。
          </p>
        ) : items.map((item, index) => {
          const priority = item.priority || 'medium';

          return (
            <article key={`${item.title}-${index}`} className="rounded-md border border-white/80 bg-white/90 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${style.marker}`} />
                    <h3 className="break-words text-sm font-semibold leading-6 text-zinc-950">{item.title}</h3>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-zinc-700">{item.summary}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${priorityStyle[priority]}`}>
                  {priorityLabel[priority]}
                </span>
              </div>
              {item.evidence ? (
                <p className="mt-2 border-l-2 border-zinc-200 pl-3 text-xs leading-5 text-zinc-500">
                  {item.evidence}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function InsightGrid({ insights }: { insights: ReviewInsights }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <InsightCard kind="pain" title="核心痛点" items={insights.painPoints} />
      <InsightCard kind="opportunity" title="产品机会" items={insights.opportunities} />
      <InsightCard kind="positive" title="正向信号" items={insights.positiveSignals} />
      <InsightCard kind="segment" title="用户分层" items={insights.userSegments} />
      <InsightCard kind="risk" title="版本风险" items={insights.versionRisks} />
      <InsightCard kind="action" title="行动建议" items={insights.actionPlan} />
    </div>
  );
}
