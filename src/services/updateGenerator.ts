import { format } from 'date-fns';

import { generateProfessionalHTML } from '../templates/htmlTemplate';
import { generateEmailUpdate } from '../templates/template';

import type { Metrics } from './metricsAggregator';
import type { StartupMetrics, EvalOpsMetrics } from './metricsCalculator';


export interface InvestorUpdate {
  generatedAt: string;
  period: string;
  summary: string;
  highlights: string[];
  metrics: {
    label: string;
    value: string;
    change?: string;
    status?: 'positive' | 'negative' | 'neutral';
  }[];
  monthlyBreakdown: {
    month: string;
    revenue: string;
    expenses: string;
    netBurn: string;
  }[];
  keyInsights: string[];
  concerns: string[];
  upcomingMilestones: string[];
  asks: string[];
}

export class UpdateGenerator {
  generateUpdate(metrics: StartupMetrics | EvalOpsMetrics): InvestorUpdate {
    const now = new Date();
    const period = this.generatePeriod(metrics);

    return {
      generatedAt: format(now, 'yyyy-MM-dd HH:mm:ss'),
      period,
      summary: this.generateSummary(metrics),
      highlights: this.generateHighlights(metrics),
      metrics: this.generateMetricsSection(metrics),
      monthlyBreakdown: this.generateMonthlyBreakdown(metrics),
      keyInsights: this.generateKeyInsights(metrics),
      concerns: this.generateConcerns(metrics),
      upcomingMilestones: this.generateMilestones(metrics),
      asks: this.generateAsks(metrics)
    };
  }

  private generatePeriod(metrics: StartupMetrics): string {
    if (metrics.monthlyMetrics.length === 0) {return 'No data available';}

    const firstMonth = metrics.monthlyMetrics[0].month;
    const lastMonth = metrics.monthlyMetrics[metrics.monthlyMetrics.length - 1].month;

    return `${firstMonth} to ${lastMonth}`;
  }

  private generateSummary(metrics: StartupMetrics | EvalOpsMetrics): string {
    const runwayText = metrics.runwayMonths === Infinity
      ? 'unlimited runway'
      : `${metrics.runwayMonths} months of runway`;

    const growthText = metrics.monthOverMonthGrowth > 0
      ? `${Math.abs(metrics.monthOverMonthGrowth).toFixed(1)}% MoM growth`
      : metrics.monthOverMonthGrowth < 0
      ? `${Math.abs(metrics.monthOverMonthGrowth).toFixed(1)}% MoM decline`
      : 'flat MoM growth';

    return `EvalOps has ${runwayText} with a current balance of $${this.formatNumber(metrics.currentBalance)}. ` +
           `Monthly burn rate is $${this.formatNumber(metrics.averageMonthlyBurn)} with ${growthText} in revenue. ` +
           `ARR stands at $${this.formatNumber(metrics.arr)} with ${metrics.customersCount} estimated customers.`;
  }

  private generateHighlights(metrics: StartupMetrics): string[] {
    const highlights: string[] = [];

    if (metrics.monthOverMonthGrowth > 20) {
      highlights.push(`Strong revenue growth of ${metrics.monthOverMonthGrowth.toFixed(1)}% MoM`);
    }

    if (metrics.runwayMonths > 18) {
      highlights.push(`Healthy runway of ${metrics.runwayMonths} months`);
    }

    if (metrics.cashEfficiency < 1 && metrics.cashEfficiency > 0) {
      highlights.push(`Excellent cash efficiency ratio of ${metrics.cashEfficiency.toFixed(2)}`);
    }

    if (metrics.arr > metrics.totalExpenses) {
      highlights.push('ARR exceeds total expenses - path to profitability clear');
    }

    if (metrics.revenueGrowthRate > metrics.expenseGrowthRate && metrics.revenueGrowthRate > 0) {
      highlights.push(`Revenue growing faster than expenses (${metrics.revenueGrowthRate.toFixed(1)}% vs ${metrics.expenseGrowthRate.toFixed(1)}%)`);
    }

    const lastMonth = metrics.monthlyMetrics[metrics.monthlyMetrics.length - 1];
    if (lastMonth && lastMonth.revenue > lastMonth.expenses) {
      highlights.push('Achieved positive cash flow in the last month');
    }

    return highlights.length > 0 ? highlights : ['Steady operations maintained'];
  }

  private generateMetricsSection(metrics: StartupMetrics | EvalOpsMetrics): InvestorUpdate['metrics'] {
    const baseMetrics = [
      {
        label: 'Current Balance',
        value: `$${this.formatNumber(metrics.currentBalance)}`,
        status: (metrics.currentBalance > metrics.averageMonthlyBurn * 6 ? 'positive' : 'negative') as 'positive' | 'negative' | 'neutral'
      },
      {
        label: 'Monthly Burn Rate',
        value: `$${this.formatNumber(metrics.averageMonthlyBurn)}`,
        status: 'neutral' as 'positive' | 'negative' | 'neutral'
      },
      {
        label: 'Monthly Revenue',
        value: `$${this.formatNumber(metrics.averageMonthlyRevenue)}`,
        change: `${metrics.monthOverMonthGrowth > 0 ? '+' : ''}${metrics.monthOverMonthGrowth.toFixed(1)}% MoM`,
        status: (metrics.monthOverMonthGrowth > 0 ? 'positive' : metrics.monthOverMonthGrowth < 0 ? 'negative' : 'neutral') as 'positive' | 'negative' | 'neutral'
      },
      {
        label: 'Runway',
        value: metrics.runwayMonths === Infinity ? 'Unlimited' : `${metrics.runwayMonths} months`,
        status: (metrics.runwayMonths > 12 ? 'positive' : metrics.runwayMonths > 6 ? 'neutral' : 'negative') as 'positive' | 'negative' | 'neutral'
      },
      {
        label: 'ARR',
        value: `$${this.formatNumber(metrics.arr)}`,
        status: (metrics.arr > 0 ? 'positive' : 'neutral') as 'positive' | 'negative' | 'neutral'
      }
    ];

    // Add EvalOps-specific metrics if available
    if (this.isEvalOpsMetrics(metrics)) {
      baseMetrics.push(
        {
          label: 'Evaluation Runs',
          value: this.formatNumber(metrics.evalRuns),
          change: `${metrics.evalRunsGrowth > 0 ? '+' : ''}${metrics.evalRunsGrowth.toFixed(1)}% MoM`,
          status: (metrics.evalRunsGrowth > 0 ? 'positive' : 'negative') as 'positive' | 'negative' | 'neutral'
        },
        {
          label: 'Active Workspaces',
          value: metrics.activeWorkspaces.toString(),
          change: `${metrics.activeWorkspacesGrowth > 0 ? '+' : ''}${metrics.activeWorkspacesGrowth.toFixed(1)}% MoM`,
          status: (metrics.activeWorkspacesGrowth > 0 ? 'positive' : 'negative') as 'positive' | 'negative' | 'neutral'
        },
        {
          label: 'Total Compute Spend',
          value: `$${this.formatNumber(metrics.totalComputeSpend)}`,
          change: `${metrics.computeSpendGrowth > 0 ? '+' : ''}${metrics.computeSpendGrowth.toFixed(1)}% MoM`,
          status: (metrics.computeSpendGrowth < 10 ? 'positive' : 'neutral') as 'positive' | 'negative' | 'neutral'
        },
        {
          label: 'Gross Margin',
          value: `${metrics.grossMargin.toFixed(1)}%`,
          status: (metrics.grossMargin > 70 ? 'positive' : metrics.grossMargin > 50 ? 'neutral' : 'negative') as 'positive' | 'negative' | 'neutral'
        },
        {
          label: 'Cost per Eval Run',
          value: `$${metrics.costPerEvalRun.toFixed(3)}`,
          status: (metrics.costPerEvalRun < 0.20 ? 'positive' : 'neutral') as 'positive' | 'negative' | 'neutral'
        }
      );
    }

    return baseMetrics;
  }

  private isEvalOpsMetrics(metrics: StartupMetrics | EvalOpsMetrics): metrics is EvalOpsMetrics {
    return 'evalRuns' in metrics;
  }

  private generateMonthlyBreakdown(metrics: StartupMetrics): InvestorUpdate['monthlyBreakdown'] {
    return metrics.monthlyMetrics.slice(-6).map(m => ({
      month: m.month,
      revenue: `$${this.formatNumber(m.revenue)}`,
      expenses: `$${this.formatNumber(m.expenses)}`,
      netBurn: `$${this.formatNumber(m.netBurn)}`
    }));
  }

  private generateKeyInsights(metrics: StartupMetrics): string[] {
    const insights: string[] = [];

    const lastThreeMonths = metrics.monthlyMetrics.slice(-3);
    if (lastThreeMonths.length === 3) {
      const trend = this.analyzeTrend(lastThreeMonths.map(m => m.revenue));
      if (trend === 'increasing') {
        insights.push('Revenue showing consistent upward trend over last 3 months');
      } else if (trend === 'decreasing') {
        insights.push('Revenue declining - requires immediate attention');
      }
    }

    const topCategories = metrics.monthlyMetrics[metrics.monthlyMetrics.length - 1]?.topExpenseCategories;
    if (topCategories && topCategories.length > 0) {
      const topCategory = topCategories[0];
      insights.push(`Largest expense category: ${topCategory.category} ($${this.formatNumber(topCategory.amount)}/month)`);
    }

    if (metrics.cashEfficiency > 2) {
      insights.push('High cash burn relative to revenue - consider optimizing operations');
    }

    if (metrics.customersCount > 0 && metrics.mrr > 0) {
      const arpu = metrics.mrr / metrics.customersCount;
      insights.push(`Average revenue per customer: $${this.formatNumber(arpu)}/month`);
    }

    const burnTrend = this.analyzeTrend(lastThreeMonths.map(m => m.netBurn));
    if (burnTrend === 'decreasing') {
      insights.push('Burn rate improving - moving towards sustainability');
    }

    return insights.length > 0 ? insights : ['Operations stable with no significant changes'];
  }

  private generateConcerns(metrics: StartupMetrics): string[] {
    const concerns: string[] = [];

    if (metrics.runwayMonths < 6 && metrics.runwayMonths !== Infinity) {
      concerns.push(`Only ${metrics.runwayMonths} months of runway remaining - fundraising critical`);
    }

    if (metrics.monthOverMonthGrowth < -10) {
      concerns.push(`Revenue declining at ${Math.abs(metrics.monthOverMonthGrowth).toFixed(1)}% MoM`);
    }

    if (metrics.expenseGrowthRate > metrics.revenueGrowthRate && metrics.expenseGrowthRate > 10) {
      concerns.push('Expenses growing faster than revenue');
    }

    if (metrics.customersCount === 0) {
      concerns.push('No identifiable customer transactions');
    }

    if (metrics.averageMonthlyBurn > metrics.currentBalance / 3) {
      concerns.push('High burn rate relative to available cash');
    }

    return concerns;
  }

  private generateMilestones(metrics: StartupMetrics): string[] {
    const milestones: string[] = [];

    if (metrics.runwayMonths < 9 && metrics.runwayMonths !== Infinity) {
      milestones.push('Close Series A funding round (3-6 months)');
    }

    if (metrics.arr < 1000000) {
      const monthsTo1M = this.estimateMonthsToTarget(metrics.arr, metrics.monthOverMonthGrowth, 1000000);
      if (monthsTo1M > 0 && monthsTo1M < 24) {
        milestones.push(`Reach $1M ARR (~${monthsTo1M} months at current growth rate)`);
      }
    }

    if (metrics.customersCount < 100) {
      milestones.push('Acquire first 100 customers');
    }

    if (metrics.averageMonthlyRevenue < metrics.averageMonthlyBurn) {
      milestones.push('Achieve cash flow positive operations');
    }

    return milestones.length > 0 ? milestones : ['Continue executing on product roadmap'];
  }

  private generateAsks(metrics: StartupMetrics): string[] {
    const asks: string[] = [];

    // YC-style specific, actionable asks based on current metrics
    if (metrics.primaryMetric.status === 'behind') {
      if (metrics.primaryMetric.name === 'Revenue') {
        asks.push(`Customer introductions to get to ${this.formatNumber(metrics.primaryMetric.target * metrics.primaryMetric.value)} monthly revenue`);
        asks.push('Sales process review - what worked for your other B2B portfolio companies?');
      } else if (metrics.primaryMetric.name === 'MRR') {
        asks.push('Pricing strategy feedback from technical buyers');
        asks.push('Referral program examples from your network');
      }
    }

    // Cash runway asks
    if (metrics.runwayMonths < 12 && metrics.runwayMonths !== Infinity) {
      asks.push('Series A introductions for 18-month runway extension');
      asks.push('Bridge round participants if needed');
    }

    // Growth asks based on YC score
    if (metrics.ycGrowthScore < 6) {
      asks.push('Product-market fit feedback from technical decision makers');
      asks.push('Growth tactics that worked for similar developer tools');
    }

    // Weekly growth specific asks
    if (metrics.weeklyGrowthRate < 0.03) { // Less than 3% weekly
      asks.push('Customer development interviews with recent churned users');
      asks.push('Pricing model optimization advice');
    }

    // Always include at least one ask
    if (asks.length === 0) {
      asks.push('Customer introductions in target verticals');
      asks.push('Feedback on roadmap prioritization');
    }

    // Limit to 3 asks max (YC best practice)
    return asks.slice(0, 3);
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(0);
  }

  private analyzeTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) {return 'stable';}

    let increasingCount = 0;
    let decreasingCount = 0;

    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i - 1] * 1.05) {increasingCount++;}
      else if (values[i] < values[i - 1] * 0.95) {decreasingCount++;}
    }

    if (increasingCount > decreasingCount && increasingCount > values.length / 2) {
      return 'increasing';
    } else if (decreasingCount > increasingCount && decreasingCount > values.length / 2) {
      return 'decreasing';
    }

    return 'stable';
  }

  private estimateMonthsToTarget(current: number, growthRate: number, target: number): number {
    if (current >= target || growthRate <= 0) {return -1;}

    const monthlyGrowth = 1 + (growthRate / 100);
    return Math.ceil(Math.log(target / current) / Math.log(monthlyGrowth));
  }

  formatUpdateAsMarkdown(update: InvestorUpdate, chartBasePath?: string): string {
    let markdown = `# Investor Update\n\n`;
    markdown += `**Generated:** ${update.generatedAt}\n`;
    markdown += `**Period:** ${update.period}\n\n`;

    markdown += `## Executive Summary\n${update.summary}\n\n`;

    if (update.highlights.length > 0) {
      markdown += `## Highlights\n`;
      update.highlights.forEach(h => markdown += `- ${h}\n`);
      markdown += '\n';
    }

    markdown += `## Key Metrics\n`;
    markdown += `| Metric | Value | Change | Status |\n`;
    markdown += `|--------|-------|--------|--------|\n`;
    update.metrics.forEach(m => {
      const statusEmoji = m.status === 'positive' ? '✅' : m.status === 'negative' ? '⚠️' : '➖';
      markdown += `| ${m.label} | ${m.value} | ${m.change || '-'} | ${statusEmoji} |\n`;
    });
    markdown += '\n';

    // Add charts section if chartBasePath is provided
    if (chartBasePath) {
      markdown += `## Financial Charts\n\n`;
      const charts = [
        { name: 'Revenue vs Expenses', file: 'revenue-expenses.png' },
        { name: 'MRR Components', file: 'mrr-components.png' },
        { name: 'Break-even Analysis', file: 'breakeven.png' },
        { name: 'Burn Rate Trend', file: 'burn-rate.png' },
        { name: 'Runway Scenarios', file: 'runway-scenarios.png' },
        { name: 'Cash Flow Analysis', file: 'cash-flow.png' },
        { name: 'Expense Category Trends', file: 'expense-trends.png' },
        { name: 'Revenue Growth Rate', file: 'growth-rate.png' },
        { name: 'Expense Categories', file: 'expense-categories.png' }
      ];

      charts.forEach(chart => {
        markdown += `### ${chart.name}\n`;
        markdown += `![${chart.name}](${chartBasePath}/${chart.file})\n\n`;
      });
    }

    markdown += `## Monthly Breakdown\n`;
    markdown += `| Month | Revenue | Expenses | Net Burn |\n`;
    markdown += `|-------|---------|----------|----------|\n`;
    update.monthlyBreakdown.forEach(m => {
      markdown += `| ${m.month} | ${m.revenue} | ${m.expenses} | ${m.netBurn} |\n`;
    });
    markdown += '\n';

    if (update.keyInsights.length > 0) {
      markdown += `## Key Insights\n`;
      update.keyInsights.forEach(i => markdown += `- ${i}\n`);
      markdown += '\n';
    }

    if (update.concerns.length > 0) {
      markdown += `## Areas of Concern\n`;
      update.concerns.forEach(c => markdown += `- ${c}\n`);
      markdown += '\n';
    }

    if (update.upcomingMilestones.length > 0) {
      markdown += `## Upcoming Milestones\n`;
      update.upcomingMilestones.forEach(m => markdown += `- ${m}\n`);
      markdown += '\n';
    }

    if (update.asks.length > 0) {
      markdown += `## Asks\n`;
      update.asks.forEach(a => markdown += `- ${a}\n`);
      markdown += '\n';
    }

    return markdown;
  }

  formatUpdateAsHTML(update: InvestorUpdate, chartBasePath?: string): string {
    return generateProfessionalHTML(update, chartBasePath);
  }

  formatUpdateAsEmail(update: InvestorUpdate, metrics: Metrics): string {
    return generateEmailUpdate(update, metrics);
  }
}