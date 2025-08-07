import { InvestorUpdate } from '../services/updateGenerator';
import { EnhancedMetrics } from '../services/metricsAggregator';

export function generateEnhancedYCEmailUpdate(update: InvestorUpdate, metrics: EnhancedMetrics): string {
  const companyName = "EvalOps";
  const month = update.period.split(' ')[0] || new Date().toLocaleString('default', { month: 'long' });

  // Use AI-generated narrative if available, otherwise fall back to basic sentiment
  const narrative = metrics.narrativeInsights?.executiveSummary || determineSentiment(metrics);

  let email = `Subject: ${companyName} - ${month} Update

Hi everyone,

${narrative}

🚀 FOUNDING PROGRESS:
📅 Founded: ${formatFoundingDate(metrics.foundingDate)} (Day ${metrics.daysSinceFounding})
⚡ Velocity Score: ${metrics.aggressiveGrowthMetrics.velocityScore}/10
🎯 Daily Growth: ${formatPercentage(metrics.aggressiveGrowthMetrics.dailyGrowthRate)}
💰 Weekly Velocity: $${Math.round(metrics.aggressiveGrowthMetrics.weeklyVelocity)}

🏆 MILESTONES:
${generateMilestonesSection(metrics)}

📊 KEY METRICS:
${generateKeyMetricsSection(metrics)}

✅ HIGHLIGHTS:
${generateHighlights(metrics, update)}

❌ CHALLENGES:
${generateChallenges(metrics, update)}

🙏 ASKS:
${generateIntelligentAsks(metrics, update).map(ask => `• ${ask}`).join('\n')}

Thanks for your continued support!

Best,
[Founder Name]

---
📈 YC Growth Score: ${metrics.ycGrowthScore}/10
🎯 Primary Metric: ${metrics.primaryMetric.name} (${getStatusEmoji(metrics.primaryMetric.status)} ${metrics.primaryMetric.status})
⏱️  Weekly Growth: ${formatPercentage(metrics.weeklyGrowthRate)} (Target: 7%)
🔥 Burn Multiple: ${metrics.aggressiveGrowthMetrics.burnMultiple.toFixed(1)}x`;

  // Add product analytics if PostHog data is available
  if (metrics.posthogMetrics && metrics.posthogMetrics.monthlyActiveUsers > 0) {
    const stickiness = metrics.posthogMetrics.dailyActiveUsers > 0 && metrics.posthogMetrics.monthlyActiveUsers > 0
      ? (metrics.posthogMetrics.dailyActiveUsers / metrics.posthogMetrics.monthlyActiveUsers * 100).toFixed(0)
      : 0;
    email += `
📱 Product Usage: ${metrics.posthogMetrics.monthlyActiveUsers} MAU, ${stickiness}% stickiness, ${metrics.posthogMetrics.customerHealthScore}/10 health`;
  }

  // Add engineering metrics section if GitHub data is available
  if (metrics.githubMetrics) {
    email += `
⚙️  Engineering Velocity: ${metrics.githubMetrics.engineeringVelocityScore}/10 (${metrics.githubMetrics.commitsLast30Days} commits, ${metrics.githubMetrics.pullRequestsLast30Days} PRs)`;
  }

  // Add unit economics if available
  if (metrics.unitEconomics && metrics.unitEconomics.ltvToCacRatio > 0) {
    email += `
💰 Unit Economics: ${metrics.unitEconomics.ltvToCacRatio.toFixed(1)}:1 LTV:CAC, ${metrics.unitEconomics.paybackPeriodMonths.toFixed(1)}mo payback`;
  }

  // Add cohort insights if available
  if (metrics.cohortMetrics && metrics.cohortMetrics.cohorts.length > 0) {
    const retention3mo = metrics.cohortMetrics.overallRetentionRates[3];
    if (retention3mo !== undefined) {
      email += `
📈 Customer Retention: ${(retention3mo * 100).toFixed(0)}% at 3 months`;
    }
  }

  email += `

Full dashboard: [link to detailed report]`;

  return email;
}

function generateKeyMetricsSection(metrics: EnhancedMetrics): string {
  let section = `⭐ ${metrics.primaryMetric.name}: ${formatDisplayValue(metrics.primaryMetric.value)} (${formatGrowthRate(metrics.primaryMetric.growthRate)} MoM)`;
  section += `\n🏦 Cash: ${formatDisplayValue(metrics.currentBalance)} (${formatRunway(metrics.runwayMonths)})`;

  // Add key business metrics
  if (metrics.mrr > 0) {
    section += `\n💰 MRR: ${formatDisplayValue(metrics.mrr)} (${formatPercentage(metrics.monthlyGrowthRate)} growth)`;
  }

  return section;
}

function generateHighlights(metrics: EnhancedMetrics, update: InvestorUpdate): string {
  // Use AI-generated highlights if available
  if (metrics.narrativeInsights?.keyHighlights.length) {
    return metrics.narrativeInsights.keyHighlights.slice(0, 4).map(h => `• ${h}`).join('\n');
  }

  // Fall back to basic highlights
  return update.highlights.slice(0, 4).map(h => `• ${h}`).join('\n');
}

function generateChallenges(metrics: EnhancedMetrics, update: InvestorUpdate): string {
  // Use AI-generated challenges if available
  if (metrics.narrativeInsights?.challengesAndConcerns.length) {
    return metrics.narrativeInsights.challengesAndConcerns.slice(0, 3).map(c => `• ${c}`).join('\n');
  }

  // Fall back to basic concerns
  return update.concerns.slice(0, 3).map(c => `• ${c}`).join('\n');
}

function determineSentiment(metrics: EnhancedMetrics): string {
  const growthScore = metrics.ycGrowthScore;
  const primaryStatus = metrics.primaryMetric.status;

  if (growthScore >= 8 || primaryStatus === 'ahead') {
    return `It's been an awesome month. We're tracking really well with ${metrics.primaryMetric.name.toLowerCase()} and hitting all our key milestones.`;
  } else if (growthScore >= 5 || primaryStatus === 'on-track') {
    return `It's been a solid month. We're making good progress with ${metrics.primaryMetric.name.toLowerCase()} and building strong foundations.`;
  } else {
    return `It's been a tough month. We're facing headwinds with ${metrics.primaryMetric.name.toLowerCase()} but could really use your help and advice.`;
  }
}

function generateIntelligentAsks(metrics: EnhancedMetrics, update: InvestorUpdate): string[] {
  const asks: string[] = [];

  // Use AI-generated actionable insights if available
  if (metrics.narrativeInsights?.actionableInsights.length) {
    return metrics.narrativeInsights.actionableInsights.slice(0, 3);
  }

  // Generate contextual asks based on metrics
  if (metrics.primaryMetric.status === 'behind' || metrics.ycGrowthScore < 5) {
    asks.push(`Product-market fit feedback from technical decision makers`);
    asks.push(`Growth hacking tactics that worked for similar B2B tools`);
  }

  if (metrics.runwayMonths < 12 && metrics.runwayMonths !== Infinity) {
    asks.push(`Series A investor introductions`);
  }

  // Engineering-specific asks if GitHub data shows issues
  if (metrics.githubMetrics && metrics.githubMetrics.engineeringVelocityScore < 6) {
    asks.push(`Senior engineering talent recommendations`);
  }

  // Default asks
  if (asks.length === 0) {
    asks.push(`ML team introductions at Series A+ companies`);
    asks.push(`Technical advisory support for scaling challenges`);
  }

  return asks.slice(0, 3);
}

function formatDisplayValue(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  } else if (value === Math.floor(value)) {
    return value.toLocaleString();
  }
  return `$${Math.round(value).toLocaleString()}`;
}

function formatPercentage(value: number): string {
  const percentage = (value * 100).toFixed(1);
  return `${percentage}%`;
}

function formatGrowthRate(rate: number): string {
  const sign = rate >= 0 ? '➕' : '➖';
  return `${sign} ${Math.abs(rate * 100).toFixed(1)}%`;
}

function formatRunway(months: number): string {
  if (months === Infinity) return 'Unlimited runway';
  const years = Math.floor(months / 12);
  const remainingMonths = Math.round(months % 12);

  if (years > 0) {
    return `${years}y ${remainingMonths}m runway`;
  }
  return `${Math.round(months)} months runway`;
}

function getStatusEmoji(status: 'ahead' | 'on-track' | 'behind'): string {
  switch (status) {
    case 'ahead': return '🚀';
    case 'on-track': return '✅';
    case 'behind': return '⚠️';
    default: return '❓';
  }
}

function formatFoundingDate(date: Date): string {
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });
}

function generateMilestonesSection(metrics: EnhancedMetrics): string {
  const milestones = [];

  // First Revenue
  if (metrics.timeToMilestones.firstRevenue?.achieved) {
    milestones.push(`✅ First Revenue (Day ${metrics.timeToMilestones.firstRevenue.days})`);
  } else {
    milestones.push(`⏳ First Revenue (Target: ${formatTargetDate(metrics.timeToMilestones.firstRevenue?.target)})`);
  }

  // $1K milestone
  if (metrics.timeToMilestones.first1K?.achieved) {
    milestones.push(`✅ $1K Revenue (Day ${metrics.timeToMilestones.first1K.days})`);
  } else if (metrics.totalRevenue > 0) {
    milestones.push(`🎯 $1K Revenue (${formatProgress(metrics.totalRevenue, 1000)})`);
  }

  // $10K milestone
  if (metrics.timeToMilestones.first10K?.achieved) {
    milestones.push(`✅ $10K Revenue (Day ${metrics.timeToMilestones.first10K.days})`);
  } else if (metrics.totalRevenue >= 1000) {
    milestones.push(`🎯 $10K Revenue (${formatProgress(metrics.totalRevenue, 10000)})`);
  }

  // First Customer
  if (metrics.timeToMilestones.firstCustomer?.achieved) {
    milestones.push(`✅ First Customer (Day ${metrics.timeToMilestones.firstCustomer.days})`);
  } else {
    milestones.push(`⏳ First Customer`);
  }

  return milestones.slice(0, 4).join('\n');
}

function formatTargetDate(date?: Date): string {
  if (!date) return 'TBD';
  const today = new Date();
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Overdue';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `${diffDays} days`;
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks`;
  return `${Math.ceil(diffDays / 30)} months`;
}

function formatProgress(current: number, target: number): string {
  const percentage = Math.min((current / target) * 100, 100);
  return `${percentage.toFixed(0)}% there`;
}