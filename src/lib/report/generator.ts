import { AggregatedAnalysis, App } from '@/types';
import { formatDate } from '@/lib/utils';

export class ReportGenerator {
  /**
   * 生成 Markdown 格式的分析报告
   */
  static generateMarkdownReport(app: App, analysis: AggregatedAnalysis): string {
    const report = `# ${app.name} 用户评论分析报告

## 基本信息

- **应用名称**: ${app.name}
- **应用ID**: ${app.id}
- **国家/地区**: ${app.country.toUpperCase()}
- **报告生成时间**: ${formatDate(analysis.generatedAt)}
- **分析评论总数**: ${analysis.totalReviews}

## 执行摘要

本报告基于 ${analysis.totalReviews} 条用户评论的深度分析，通过AI智能分析技术，从情感倾向、用户问题和改进建议等多个维度，为产品优化提供数据支持。

### 关键发现

- **情感分布**: 正面评论 ${analysis.sentimentDistribution.positive} 条 (${((analysis.sentimentDistribution.positive / analysis.totalReviews) * 100).toFixed(1)}%)，负面评论 ${analysis.sentimentDistribution.negative} 条 (${((analysis.sentimentDistribution.negative / analysis.totalReviews) * 100).toFixed(1)}%)，中性评论 ${analysis.sentimentDistribution.neutral} 条 (${((analysis.sentimentDistribution.neutral / analysis.totalReviews) * 100).toFixed(1)}%)
- **主要问题**: 识别出 ${analysis.commonIssues.length} 类主要问题
- **改进建议**: 收集到 ${analysis.suggestions.length} 类用户建议
- **版本覆盖**: 涵盖 ${analysis.versionAnalysis.length} 个应用版本

## 详细分析

### 1. 情感分析

#### 整体情感分布

| 情感类型 | 数量 | 占比 |
|---------|------|------|
| 正面 | ${analysis.sentimentDistribution.positive} | ${((analysis.sentimentDistribution.positive / analysis.totalReviews) * 100).toFixed(1)}% |
| 负面 | ${analysis.sentimentDistribution.negative} | ${((analysis.sentimentDistribution.negative / analysis.totalReviews) * 100).toFixed(1)}% |
| 中性 | ${analysis.sentimentDistribution.neutral} | ${((analysis.sentimentDistribution.neutral / analysis.totalReviews) * 100).toFixed(1)}% |

#### 情感分析结论

${analysis.sentimentDistribution.positive > analysis.sentimentDistribution.negative 
  ? `用户对 ${app.name} 的整体反馈较为正面，正面评论占比达到 ${((analysis.sentimentDistribution.positive / analysis.totalReviews) * 100).toFixed(1)}%，表明产品在用户中有良好的口碑。`
  : `用户对 ${app.name} 的反馈存在较多负面意见，负面评论占比 ${((analysis.sentimentDistribution.negative / analysis.totalReviews) * 100).toFixed(1)}%，需要重点关注用户痛点并进行产品优化。`
}

### 2. 问题分析

${analysis.commonIssues.length > 0 ? `
#### 主要问题列表

${analysis.commonIssues.slice(0, 10).map((issue, index) => `
${index + 1}. **${issue.issue}** (出现 ${issue.count} 次)
   - 占比: ${((issue.count / analysis.totalReviews) * 100).toFixed(1)}%
   - 示例: ${issue.examples.slice(0, 2).map(example => `"${example}"`).join(', ')}
`).join('')}

#### 问题分析总结

最突出的问题是"${analysis.commonIssues[0].issue}"，在 ${analysis.commonIssues[0].count} 条评论中被提及，占总评论数的 ${((analysis.commonIssues[0].count / analysis.totalReviews) * 100).toFixed(1)}%。建议优先解决此类问题以提升用户满意度。
` : '暂未识别出明显的用户问题。'}

### 3. 改进建议

${analysis.suggestions.length > 0 ? `
#### 用户建议列表

${analysis.suggestions.slice(0, 10).map((suggestion, index) => `
${index + 1}. **${suggestion.suggestion}** (提及 ${suggestion.count} 次)
   - 占比: ${((suggestion.count / analysis.totalReviews) * 100).toFixed(1)}%
   - 示例: ${suggestion.examples.slice(0, 2).map(example => `"${example}"`).join(', ')}
`).join('')}

#### 建议优先级

根据用户提及频次，建议优先考虑实现"${analysis.suggestions[0].suggestion}"，该建议在 ${analysis.suggestions[0].count} 条评论中被提及，体现了用户的强烈需求。
` : '暂未收集到明确的用户改进建议。'}

### 4. 版本分析

${analysis.versionAnalysis.length > 0 ? `
#### 各版本表现对比

| 版本 | 评论数 | 平均评分 | 正面比例 | 负面比例 |
|------|--------|----------|----------|----------|
${analysis.versionAnalysis.slice(0, 10).map(version => 
`| ${version.version} | ${version.reviewCount} | ${version.averageRating.toFixed(1)} | ${((version.sentimentDistribution.positive / version.reviewCount) * 100).toFixed(1)}% | ${((version.sentimentDistribution.negative / version.reviewCount) * 100).toFixed(1)}% |`
).join('\n')}

#### 版本趋势分析

${this.generateVersionTrendAnalysis(analysis.versionAnalysis)}
` : '暂无足够的版本数据进行分析。'}

## 行动建议

### 短期优化 (1-2个月)

${analysis.commonIssues.slice(0, 3).map((issue, index) => `
${index + 1}. **解决${issue.issue}问题**
   - 影响范围: ${issue.count} 条评论提及
   - 建议措施: 针对该问题进行专项优化
`).join('')}

### 中期规划 (3-6个月)

${analysis.suggestions.slice(0, 3).map((suggestion, index) => `
${index + 1}. **实现${suggestion.suggestion}**
   - 用户需求度: ${suggestion.count} 次提及
   - 预期收益: 提升用户满意度和产品竞争力
`).join('')}

### 长期战略 (6个月以上)

- 建立用户反馈收集和分析的常态化机制
- 定期进行用户满意度调研
- 持续优化产品功能和用户体验

## 附录

### 数据说明

- 分析时间范围: 基于所有可用的用户评论数据
- 分析方法: 基于AI自然语言处理技术的情感分析和关键词提取
- 数据来源: App Store 用户评论

### 报告生成信息

- 生成时间: ${formatDate(analysis.generatedAt)}
- 分析工具: AppStore 评论分析系统
- 报告版本: 1.0

---

*本报告由 AppStore 评论分析系统自动生成，如有疑问请联系系统管理员。*
`;

    return report;
  }

  /**
   * 生成版本趋势分析
   */
  private static generateVersionTrendAnalysis(versionAnalysis: AggregatedAnalysis['versionAnalysis']): string {
    if (versionAnalysis.length < 2) {
      return '版本数据不足，无法进行趋势分析。';
    }

    const sortedVersions = versionAnalysis.sort((a, b) => a.version.localeCompare(b.version));
    const latest = sortedVersions[sortedVersions.length - 1];
    const previous = sortedVersions[sortedVersions.length - 2];

    const ratingTrend = latest.averageRating - previous.averageRating;
    const positiveRateTrend = (latest.sentimentDistribution.positive / latest.reviewCount) - 
                             (previous.sentimentDistribution.positive / previous.reviewCount);

    let analysis = `最新版本 ${latest.version} 相比上一版本 ${previous.version}：\n\n`;
    
    if (ratingTrend > 0.1) {
      analysis += `- 平均评分提升了 ${ratingTrend.toFixed(1)} 分，用户满意度有所改善\n`;
    } else if (ratingTrend < -0.1) {
      analysis += `- 平均评分下降了 ${Math.abs(ratingTrend).toFixed(1)} 分，需要关注用户反馈\n`;
    } else {
      analysis += `- 平均评分基本持平，用户满意度保持稳定\n`;
    }

    if (positiveRateTrend > 0.05) {
      analysis += `- 正面评论比例提升了 ${(positiveRateTrend * 100).toFixed(1)}%，产品改进效果显著\n`;
    } else if (positiveRateTrend < -0.05) {
      analysis += `- 正面评论比例下降了 ${Math.abs(positiveRateTrend * 100).toFixed(1)}%，建议重点关注新版本问题\n`;
    }

    return analysis;
  }

  /**
   * 生成 HTML 格式的分析报告
   */
  static generateHtmlReport(app: App, analysis: AggregatedAnalysis): string {
    const markdownReport = this.generateMarkdownReport(app, analysis);
    
    // 简单的 Markdown 到 HTML 转换
    const htmlReport = markdownReport
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
      .replace(/^\* (.*$)/gm, '<li>$1</li>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${app.name} 用户评论分析报告</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
        h2 { color: #374151; margin-top: 30px; }
        h3 { color: #4b5563; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
        th { background-color: #f9fafb; font-weight: 600; }
        code { background-color: #f3f4f6; padding: 2px 4px; border-radius: 3px; }
        .highlight { background-color: #fef3c7; padding: 10px; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <p>${htmlReport}</p>
</body>
</html>
    `;
  }

  /**
   * 生成简化的摘要报告
   */
  static generateSummaryReport(app: App, analysis: AggregatedAnalysis): string {
    const positiveRate = (analysis.sentimentDistribution.positive / analysis.totalReviews) * 100;
    const negativeRate = (analysis.sentimentDistribution.negative / analysis.totalReviews) * 100;

    return `${app.name} 评论分析摘要

📊 基本数据
• 总评论数: ${analysis.totalReviews}
• 正面评论: ${analysis.sentimentDistribution.positive} (${positiveRate.toFixed(1)}%)
• 负面评论: ${analysis.sentimentDistribution.negative} (${negativeRate.toFixed(1)}%)

${analysis.commonIssues.length > 0 ? `🔍 主要问题
• ${analysis.commonIssues[0].issue} (${analysis.commonIssues[0].count}次提及)
${analysis.commonIssues.slice(1, 3).map(issue => `• ${issue.issue} (${issue.count}次)`).join('\n')}` : ''}

${analysis.suggestions.length > 0 ? `💡 改进建议
• ${analysis.suggestions[0].suggestion} (${analysis.suggestions[0].count}次提及)
${analysis.suggestions.slice(1, 3).map(suggestion => `• ${suggestion.suggestion} (${suggestion.count}次)`).join('\n')}` : ''}

📈 总体评价
${positiveRate > 60 ? '用户反馈整体较为正面，产品表现良好' : 
  positiveRate > 40 ? '用户反馈喜忧参半，有改进空间' : 
  '用户反馈较多负面意见，需要重点优化'}

生成时间: ${formatDate(analysis.generatedAt)}`;
  }
}
