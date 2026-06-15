'use client';

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, HeatmapChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent, VisualMapComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';
import { Activity, CalendarDays, Flame, GitBranch, Layers3 } from 'lucide-react';
import { ReviewDiagnostics } from '@/lib/appstore/diagnostics';

echarts.use([BarChart, HeatmapChart, LineChart, GridComponent, LegendComponent, TooltipComponent, VisualMapComponent, CanvasRenderer]);

type ChartOption = EChartsCoreOption;

type TooltipParam = {
  data?: unknown;
  marker?: string;
  seriesName?: string;
  value?: unknown;
};

const toneStyles = {
  rose: 'border-rose-200 bg-rose-50/70 text-rose-700',
  amber: 'border-amber-200 bg-amber-50/70 text-amber-700',
  emerald: 'border-emerald-200 bg-emerald-50/70 text-emerald-700',
  sky: 'border-sky-200 bg-sky-50/70 text-sky-700',
  zinc: 'border-zinc-200 bg-white text-zinc-700',
} as const;

function compactLabel(value: string, max = 14) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function asTooltipParam(value: unknown): TooltipParam | null {
  if (Array.isArray(value)) return asTooltipParam(value[0]);
  if (value && typeof value === 'object') return value as TooltipParam;
  return null;
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map((item) => Number(item)).filter((item) => Number.isFinite(item))
    : [];
}

function EChartView({
  option,
  label,
  height = 320,
}: {
  option: ChartOption;
  label: string;
  height?: number;
}) {
  const chartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current, undefined, { renderer: 'canvas' });
    chart.setOption(option, true);

    const resize = () => chart.resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(chartRef.current);
    window.addEventListener('resize', resize);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      chart.dispose();
    };
  }, [option]);

  return <div ref={chartRef} role="img" aria-label={label} style={{ height }} className="w-full" />;
}

function ChartShell({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-zinc-950 text-white">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function formatHeatmapTooltip(params: unknown, diagnostics: ReviewDiagnostics) {
  const param = asTooltipParam(params);
  const values = asNumberArray(param?.data);
  const [versionIndex, themeIndex] = values;
  const cell = diagnostics.issueHeatmap.find(
    (item) => item.versionIndex === versionIndex && item.themeIndex === themeIndex
  );

  if (!cell) return '';
  return [
    `<strong>${cell.version}</strong>`,
    `${cell.themeLabel}: ${cell.count} 条`,
    `痛点密度: ${cell.value}%`,
    `版本样本: ${cell.total} 条`,
  ].join('<br/>');
}

function useTrendOption(diagnostics: ReviewDiagnostics): ChartOption {
  return useMemo(() => {
    const versions = diagnostics.versionTrend.map((item) => compactLabel(item.version));

    return {
      color: ['#27272a', '#0f766e', '#e11d48'],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      legend: {
        top: 0,
        icon: 'roundRect',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: '#52525b', fontSize: 12 },
      },
      grid: { left: 38, right: 76, top: 54, bottom: 46 },
      xAxis: {
        type: 'category',
        data: versions,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e4e4e7' } },
        axisLabel: { color: '#71717a', interval: 0, rotate: versions.length > 4 ? 18 : 0 },
      },
      yAxis: [
        {
          type: 'value',
          name: '评论',
          minInterval: 1,
          axisLabel: { color: '#71717a' },
          splitLine: { lineStyle: { color: '#f4f4f5' } },
        },
        {
          type: 'value',
          name: '评分',
          min: 0,
          max: 5,
          position: 'right',
          axisLabel: { color: '#0f766e' },
          splitLine: { show: false },
        },
        {
          type: 'value',
          name: '差评',
          min: 0,
          max: 100,
          position: 'right',
          offset: 42,
          axisLabel: { color: '#e11d48', formatter: '{value}%' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '评论数',
          type: 'bar',
          barMaxWidth: 30,
          data: diagnostics.versionTrend.map((item) => item.reviewCount),
          itemStyle: { borderRadius: [5, 5, 0, 0] },
        },
        {
          name: '平均评分',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbolSize: 8,
          data: diagnostics.versionTrend.map((item) => item.averageRating),
        },
        {
          name: '差评占比',
          type: 'line',
          yAxisIndex: 2,
          smooth: true,
          symbolSize: 8,
          data: diagnostics.versionTrend.map((item) => item.negativeShare),
          lineStyle: { width: 2 },
        },
      ],
    };
  }, [diagnostics]);
}

function useHeatmapOption(diagnostics: ReviewDiagnostics): ChartOption {
  return useMemo(() => {
    const versions = diagnostics.versionTrend.map((item) => compactLabel(item.version));
    const themeLabels = diagnostics.issueThemes.map((theme) => theme.label);
    const maxValue = Math.max(1, ...diagnostics.issueHeatmap.map((cell) => cell.value));

    return {
      tooltip: {
        formatter: (params: unknown) => formatHeatmapTooltip(params, diagnostics),
      },
      grid: { left: 72, right: 18, top: 18, bottom: 52 },
      xAxis: {
        type: 'category',
        data: versions,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e4e4e7' } },
        axisLabel: { color: '#71717a', interval: 0, rotate: versions.length > 4 ? 18 : 0 },
      },
      yAxis: {
        type: 'category',
        data: themeLabels,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: '#52525b', fontWeight: 600 },
      },
      visualMap: {
        min: 0,
        max: maxValue,
        show: false,
        inRange: { color: ['#fff7ed', '#fed7aa', '#fb923c', '#ea580c'] },
      },
      series: [
        {
          name: '痛点密度',
          type: 'heatmap',
          data: diagnostics.issueHeatmap.map((cell) => [cell.versionIndex, cell.themeIndex, cell.value]),
          label: {
            show: true,
            color: '#7c2d12',
            formatter: ({ value }: { value?: unknown }) => {
              const values = asNumberArray(value);
              return values[2] ? `${values[2]}%` : '';
            },
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(234, 88, 12, 0.25)',
            },
          },
        },
      ],
    };
  }, [diagnostics]);
}

function useTimelineOption(diagnostics: ReviewDiagnostics): ChartOption {
  return useMemo(() => {
    const dates = diagnostics.sentimentTimeline.map((item) => item.label);

    return {
      color: ['#059669', '#f59e0b', '#e11d48'],
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: {
        top: 0,
        icon: 'roundRect',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: '#52525b', fontSize: 12 },
      },
      grid: { left: 34, right: 18, top: 48, bottom: 42 },
      xAxis: {
        type: 'category',
        data: dates,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e4e4e7' } },
        axisLabel: { color: '#71717a', interval: dates.length > 10 ? 1 : 0 },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: '#71717a' },
        splitLine: { lineStyle: { color: '#f4f4f5' } },
      },
      series: [
        {
          name: '好评',
          type: 'bar',
          stack: 'sentiment',
          data: diagnostics.sentimentTimeline.map((item) => item.positive),
          itemStyle: { borderRadius: [4, 4, 0, 0] },
        },
        {
          name: '中评',
          type: 'bar',
          stack: 'sentiment',
          data: diagnostics.sentimentTimeline.map((item) => item.neutral),
        },
        {
          name: '差评',
          type: 'bar',
          stack: 'sentiment',
          data: diagnostics.sentimentTimeline.map((item) => item.negative),
        },
      ],
    };
  }, [diagnostics]);
}

export function VersionDiagnosticsPanel({
  diagnostics,
  appName,
}: {
  diagnostics: ReviewDiagnostics;
  appName: string;
}) {
  const trendOption = useTrendOption(diagnostics);
  const heatmapOption = useHeatmapOption(diagnostics);
  const timelineOption = useTimelineOption(diagnostics);
  const hasChartData = diagnostics.versionTrend.length > 0 && diagnostics.sentimentTimeline.length > 0;

  if (!hasChartData) {
    return null;
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">
            <Layers3 className="h-4 w-4" />
            Version Diagnosis
          </div>
          <h2 className="mt-2 text-xl font-semibold text-zinc-950">{appName} 版本与口碑诊断</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            版本变化、差评密度和日期峰值合在一起看，更容易定位产品更新后的真实用户阻力。
          </p>
        </div>
        <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500">
          {diagnostics.sampleSize} 条样本
        </span>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {diagnostics.insights.map((item) => (
          <div key={item.label} className={`rounded-lg border p-4 shadow-sm ${toneStyles[item.tone]}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-75">{item.label}</p>
            <p className="mt-2 break-words text-xl font-semibold text-zinc-950">{item.value}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4">
        <ChartShell
          icon={<GitBranch className="h-4 w-4" />}
          title="版本口碑趋势"
          subtitle="评论数、平均评分和差评占比放在同一时间轴，先定位异常版本。"
        >
          <EChartView option={trendOption} label={`${appName} 版本口碑趋势图`} height={340} />
        </ChartShell>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartShell
            icon={<Flame className="h-4 w-4" />}
            title="版本痛点热力图"
            subtitle="颜色越深，说明该版本中相关差评密度越高。"
          >
            <EChartView option={heatmapOption} label={`${appName} 版本痛点热力图`} height={320} />
          </ChartShell>

          <ChartShell
            icon={<CalendarDays className="h-4 w-4" />}
            title="评论情绪时间线"
            subtitle="按日期拆分好评、中评和差评，识别突发波动。"
          >
            <EChartView option={timelineOption} label={`${appName} 评论情绪时间线`} height={320} />
          </ChartShell>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-teal-700" />
          <h2 className="text-base font-semibold text-zinc-950">需求挖掘线索</h2>
        </div>
        <div className="mt-3 grid gap-3 text-sm leading-6 text-zinc-600 md:grid-cols-3">
          <p>差评占比最高的版本适合进入版本复盘，优先回看更新日志、灰度策略和功能下线记录。</p>
          <p>热力图最深的主题可以直接转成需求池候选，结合评论证据判断修复收益。</p>
          <p>时间线上的差评峰值适合追查服务故障、价格策略、模型质量或运营活动影响。</p>
        </div>
      </div>
    </section>
  );
}
