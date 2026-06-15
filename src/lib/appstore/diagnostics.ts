import { AppStoreReview } from '@/types';

export type DiagnosticTone = 'rose' | 'amber' | 'emerald' | 'sky' | 'zinc';

export interface VersionTrendPoint {
  version: string;
  reviewCount: number;
  averageRating: number;
  negativeShare: number;
  positiveShare: number;
  negativeCount: number;
  neutralCount: number;
  positiveCount: number;
}

export interface IssueTheme {
  key: string;
  label: string;
  description: string;
}

export interface IssueHeatmapCell {
  version: string;
  themeKey: string;
  themeLabel: string;
  versionIndex: number;
  themeIndex: number;
  value: number;
  count: number;
  total: number;
}

export interface SentimentTimelinePoint {
  date: string;
  label: string;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  averageRating: number;
}

export interface DiagnosticInsight {
  label: string;
  value: string;
  description: string;
  tone: DiagnosticTone;
}

export interface ReviewDiagnostics {
  versionTrend: VersionTrendPoint[];
  issueThemes: IssueTheme[];
  issueHeatmap: IssueHeatmapCell[];
  sentimentTimeline: SentimentTimelinePoint[];
  insights: DiagnosticInsight[];
  sampleSize: number;
}

interface VersionBucket {
  version: string;
  reviewCount: number;
  ratingSum: number;
  negativeCount: number;
  neutralCount: number;
  positiveCount: number;
  latestTime: number;
  issueCounts: Record<string, number>;
}

interface TimelineBucket {
  date: string;
  ratingSum: number;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}

interface IssueThemeDefinition extends IssueTheme {
  keywords: string[];
}

const ISSUE_THEME_DEFINITIONS: IssueThemeDefinition[] = [
  {
    key: 'stability',
    label: '性能稳定',
    description: '慢、卡顿、崩溃、加载失败和响应不稳定。',
    keywords: ['slow', 'sluggish', 'lag', 'bug', 'bugs', 'crash', 'freeze', 'stuck', 'loading', 'timeout', '卡', '慢', '崩', '闪退', '无响应'],
  },
  {
    key: 'function',
    label: '功能体验',
    description: '更新后功能退化、交互不顺、上传/编辑流程失败。',
    keywords: ['update', 'feature', 'camera', 'photo', 'image', 'upload', 'edit', 'keyboard', 'memory', 'version', '功能', '更新', '图片', '照片', '上传', '键盘', '交互', '记忆'],
  },
  {
    key: 'pricing',
    label: '价格限制',
    description: '订阅、付费、额度限制、退款和收费感知。',
    keywords: ['pay', 'paid', 'plus', 'subscription', 'limit', 'limited', 'money', 'charge', 'billing', 'refund', 'free', '订阅', '付费', '收费', '限制', '免费', '退款'],
  },
  {
    key: 'quality',
    label: '准确质量',
    description: '回答错误、理解失败、生成质量低和结果不可信。',
    keywords: ['wrong', 'inaccurate', 'stupid', 'dumb', 'hallucination', 'answer', 'quality', 'accurate', 'follow instructions', '错误', '准确', '质量', '理解', '回答', '生成'],
  },
  {
    key: 'account',
    label: '账号权限',
    description: '登录、账号、权限、隐私和数据访问问题。',
    keywords: ['login', 'account', 'password', 'permission', 'privacy', 'data', '账号', '账户', '登录', '权限', '隐私', '数据'],
  },
  {
    key: 'trust',
    label: '服务信任',
    description: '客服、欺骗感、品牌信任、情绪安全和长期满意度。',
    keywords: ['support', 'service', 'scam', 'rip off', 'trust', 'unsafe', 'sensitive', 'frustrated', '客服', '服务', '欺骗', '信任', '安全', '失望'],
  },
];

function ratingOf(review: AppStoreReview) {
  return Number.parseInt(review.rating, 10) || 0;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizedReviewText(review: AppStoreReview) {
  return `${review.title || ''} ${review.content || ''}`.toLowerCase();
}

function getReviewTime(review: AppStoreReview) {
  const time = new Date(review.updated).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getReviewDay(review: AppStoreReview) {
  const time = getReviewTime(review);
  if (!time) return '未知日期';
  return new Date(time).toISOString().slice(0, 10);
}

function formatDayLabel(day: string) {
  if (day === '未知日期') return day;
  const [, month, date] = day.split('-');
  return `${Number(month)}/${Number(date)}`;
}

function matchedIssueKeys(review: AppStoreReview) {
  const rating = ratingOf(review);
  if (rating > 3) return [];

  const text = normalizedReviewText(review);
  const keys = ISSUE_THEME_DEFINITIONS
    .filter((theme) => theme.keywords.some((keyword) => text.includes(keyword)))
    .map((theme) => theme.key);

  return keys.length > 0 ? keys : ['function'];
}

function makeVersionBucket(version: string): VersionBucket {
  return {
    version,
    reviewCount: 0,
    ratingSum: 0,
    negativeCount: 0,
    neutralCount: 0,
    positiveCount: 0,
    latestTime: 0,
    issueCounts: Object.fromEntries(ISSUE_THEME_DEFINITIONS.map((theme) => [theme.key, 0])),
  };
}

function makeTimelineBucket(date: string): TimelineBucket {
  return {
    date,
    ratingSum: 0,
    positive: 0,
    neutral: 0,
    negative: 0,
    total: 0,
  };
}

function buildVersionTrend(buckets: VersionBucket[]) {
  return buckets.map((bucket) => ({
    version: bucket.version,
    reviewCount: bucket.reviewCount,
    averageRating: bucket.reviewCount ? round(bucket.ratingSum / bucket.reviewCount, 2) : 0,
    negativeShare: bucket.reviewCount ? round((bucket.negativeCount / bucket.reviewCount) * 100, 1) : 0,
    positiveShare: bucket.reviewCount ? round((bucket.positiveCount / bucket.reviewCount) * 100, 1) : 0,
    negativeCount: bucket.negativeCount,
    neutralCount: bucket.neutralCount,
    positiveCount: bucket.positiveCount,
  }));
}

function buildInsights(
  versionTrend: VersionTrendPoint[],
  heatmap: IssueHeatmapCell[],
  timeline: SentimentTimelinePoint[],
  sampleSize: number
): DiagnosticInsight[] {
  const enoughVersions = versionTrend.filter((item) => item.reviewCount >= 2);
  const riskyVersion = [...enoughVersions].sort((a, b) => b.negativeShare - a.negativeShare || b.reviewCount - a.reviewCount)[0];
  const strongestVersion = [...enoughVersions].sort((a, b) => b.averageRating - a.averageRating || b.reviewCount - a.reviewCount)[0];
  const hottestTheme = [...heatmap].sort((a, b) => b.count - a.count || b.value - a.value)[0];
  const spikeDay = [...timeline].sort((a, b) => b.negative - a.negative || b.total - a.total)[0];

  return [
    {
      label: '样本覆盖',
      value: `${sampleSize} 条`,
      description: `基于当前缓存评论生成版本趋势、痛点密度和时间线。`,
      tone: 'zinc',
    },
    riskyVersion ? {
      label: '高风险版本',
      value: riskyVersion.version,
      description: `${riskyVersion.reviewCount} 条评论中差评占比 ${riskyVersion.negativeShare}%，适合作为版本复盘入口。`,
      tone: 'rose',
    } : {
      label: '高风险版本',
      value: '样本不足',
      description: '版本样本过少，暂不判断单一版本风险。',
      tone: 'zinc',
    },
    hottestTheme && hottestTheme.count > 0 ? {
      label: '主导痛点',
      value: hottestTheme.themeLabel,
      description: `${hottestTheme.version} 版本中出现 ${hottestTheme.count} 条相关差评，密度 ${hottestTheme.value}%。`,
      tone: 'amber',
    } : {
      label: '主导痛点',
      value: '暂无集中主题',
      description: '当前差评主题分散，建议继续扩大样本或更新洞察。',
      tone: 'zinc',
    },
    spikeDay && spikeDay.negative > 0 ? {
      label: '差评峰值',
      value: spikeDay.label,
      description: `${spikeDay.date} 出现 ${spikeDay.negative} 条差评，可回看当天更新、故障或策略变化。`,
      tone: 'sky',
    } : strongestVersion ? {
      label: '正向版本',
      value: strongestVersion.version,
      description: `${strongestVersion.version} 平均评分 ${strongestVersion.averageRating}，可反查该版本保留的体验优势。`,
      tone: 'emerald',
    } : {
      label: '差评峰值',
      value: '暂无峰值',
      description: '时间线没有明显差评峰值。',
      tone: 'zinc',
    },
  ];
}

export function buildReviewDiagnostics(reviews: AppStoreReview[]): ReviewDiagnostics {
  const versionBuckets = new Map<string, VersionBucket>();
  const timelineBuckets = new Map<string, TimelineBucket>();

  for (const review of reviews) {
    const rating = ratingOf(review);
    const version = review.version || 'Unknown';
    const versionBucket = versionBuckets.get(version) || makeVersionBucket(version);
    const reviewTime = getReviewTime(review);

    versionBucket.reviewCount += 1;
    versionBucket.ratingSum += rating;
    versionBucket.latestTime = Math.max(versionBucket.latestTime, reviewTime);

    if (rating <= 2) versionBucket.negativeCount += 1;
    else if (rating >= 4) versionBucket.positiveCount += 1;
    else versionBucket.neutralCount += 1;

    for (const key of matchedIssueKeys(review)) {
      versionBucket.issueCounts[key] = (versionBucket.issueCounts[key] || 0) + 1;
    }

    versionBuckets.set(version, versionBucket);

    const date = getReviewDay(review);
    const timelineBucket = timelineBuckets.get(date) || makeTimelineBucket(date);
    timelineBucket.total += 1;
    timelineBucket.ratingSum += rating;
    if (rating <= 2) timelineBucket.negative += 1;
    else if (rating >= 4) timelineBucket.positive += 1;
    else timelineBucket.neutral += 1;
    timelineBuckets.set(date, timelineBucket);
  }

  const selectedVersionBuckets = [...versionBuckets.values()]
    .sort((a, b) => b.latestTime - a.latestTime || b.reviewCount - a.reviewCount)
    .slice(0, 8)
    .sort((a, b) => a.latestTime - b.latestTime || a.version.localeCompare(b.version));

  const versionTrend = buildVersionTrend(selectedVersionBuckets);
  const issueThemes = ISSUE_THEME_DEFINITIONS.map(({ key, label, description }) => ({ key, label, description }));
  const issueHeatmap = selectedVersionBuckets.flatMap((bucket, versionIndex) =>
    issueThemes.map((theme, themeIndex) => {
      const count = bucket.issueCounts[theme.key] || 0;
      return {
        version: bucket.version,
        themeKey: theme.key,
        themeLabel: theme.label,
        versionIndex,
        themeIndex,
        value: bucket.reviewCount ? round((count / bucket.reviewCount) * 100, 1) : 0,
        count,
        total: bucket.reviewCount,
      };
    })
  );

  const sentimentTimeline = [...timelineBuckets.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-21)
    .map((bucket) => ({
      date: bucket.date,
      label: formatDayLabel(bucket.date),
      positive: bucket.positive,
      neutral: bucket.neutral,
      negative: bucket.negative,
      total: bucket.total,
      averageRating: bucket.total ? round(bucket.ratingSum / bucket.total, 2) : 0,
    }));

  return {
    versionTrend,
    issueThemes,
    issueHeatmap,
    sentimentTimeline,
    insights: buildInsights(versionTrend, issueHeatmap, sentimentTimeline, reviews.length),
    sampleSize: reviews.length,
  };
}
