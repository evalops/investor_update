import { InvestorUpdate } from '../services/updateGenerator';
import { StartupMetrics, EvalOpsMetrics } from '../services/metricsCalculator';

export function generateYCEmailUpdate(update: InvestorUpdate, metrics: StartupMetrics | EvalOpsMetrics): string {
  // YC-style email template based on Aaron Harris's format
  const companyName = "EvalOps";
  const month = update.period.split(' ')[0] || new Date().toLocaleString('default', { month: 'long' });

  // Determine sentiment based on primary metric performance
  const sentiment = determineSentiment(metrics);

  return `Subject: ${companyName} - ${month} Update

Hi everyone,

It's been ${sentiment.adjective} month. We're ${sentiment.status} with ${metrics.primaryMetric.name.toLowerCase()} but ${sentiment.challenge}.

📊 KEY METRICS:
${generateKeyMetricsSection(metrics)}

✅ HIGHLIGHTS:
${update.highlights.slice(0, 4).map(h => `• ${h}`).join('\n')}

❌ CHALLENGES:
${update.concerns.slice(0, 3).map(c => `• ${c}`).join('\n')}

🙏 ASKS:
${generateIntelligentAsks(metrics, update).map(ask => `• ${ask}`).join('\n')}

Thanks for your continued support!

Best,
[Founder Name]

---
📈 YC Growth Score: ${metrics.ycGrowthScore}/10
🎯 Primary Metric: ${metrics.primaryMetric.name} (${getStatusEmoji(metrics.primaryMetric.status)} ${metrics.primaryMetric.status})
⏱️  Weekly Growth: ${formatPercentage(metrics.weeklyGrowthRate)} (Target: 7%)

Full dashboard: [link to detailed report]`;
}

function determineSentiment(metrics: StartupMetrics | EvalOpsMetrics) {
  const growthScore = metrics.ycGrowthScore;
  const primaryStatus = metrics.primaryMetric.status;

  if (growthScore >= 8 || primaryStatus === 'ahead') {
    return {
      adjective: 'an awesome',
      status: 'tracking really well',
      challenge: 'want to accelerate even faster'
    };
  } else if (growthScore >= 6 || primaryStatus === 'on-track') {
    return {
      adjective: 'a solid',
      status: 'making good progress',
      challenge: 'could use help breaking through to the next level'
    };
  } else if (growthScore >= 4) {
    return {
      adjective: 'an intense',
      status: 'working hard',
      challenge: 'need support tackling some key challenges'
    };
  } else {
    return {
      adjective: 'a tough',
      status: 'facing headwinds',
      challenge: 'could really use your help and advice'
    };
  }
}

function generateKeyMetricsSection(metrics: StartupMetrics | EvalOpsMetrics): string {
  const sections = [];

  // Primary metric always comes first (YC philosophy)
  const primaryGrowth = formatPercentage(metrics.primaryMetric.growthRate);
  const primaryIcon = getGrowthIcon(metrics.primaryMetric.growthRate);
  sections.push(`⭐ ${metrics.primaryMetric.name}: ${formatCurrency(metrics.primaryMetric.value)} (${primaryIcon} ${primaryGrowth} MoM)`);

  // Core financial metrics
  if (metrics.mrr > 0) {
    const mrrGrowth = formatPercentage(metrics.monthlyGrowthRate);
    const mrrIcon = getGrowthIcon(metrics.monthlyGrowthRate);
    sections.push(`💰 MRR: ${formatCurrency(metrics.mrr)} (${mrrIcon} ${mrrGrowth} MoM)`);
  }

  // Cash position (always important for YC companies)
  const runwayText = metrics.runwayMonths === Infinity ? 'Unlimited' : `${Math.round(metrics.runwayMonths)} months`;
  sections.push(`🏦 Cash: ${formatCurrency(metrics.currentBalance)} (${runwayText} runway)`);

  // Burn rate
  if (metrics.averageMonthlyBurn > 0) {
    sections.push(`🔥 Monthly Burn: ${formatCurrency(metrics.averageMonthlyBurn)}`);
  }

  // Additional EvalOps metrics if available
  if ('evalRuns' in metrics && metrics.evalRuns > 0) {
    const evalGrowth = formatPercentage(metrics.evalRunsGrowth);
    const evalIcon = getGrowthIcon(metrics.evalRunsGrowth);
    sections.push(`🧪 Evaluation Runs: ${metrics.evalRuns.toLocaleString()} (${evalIcon} ${evalGrowth} MoM)`);
  }

  if ('activeWorkspaces' in metrics && metrics.activeWorkspaces > 0) {
    const workspaceGrowth = formatPercentage(metrics.activeWorkspacesGrowth);
    const workspaceIcon = getGrowthIcon(metrics.activeWorkspacesGrowth);
    sections.push(`👥 Active Workspaces: ${metrics.activeWorkspaces} (${workspaceIcon} ${workspaceGrowth} MoM)`);
  }

  return sections.join('\n');
}

function generateIntelligentAsks(metrics: StartupMetrics | EvalOpsMetrics, update: InvestorUpdate): string[] {
  const asks = [];

  // Generate asks based on current performance and stage
  if (metrics.primaryMetric.status === 'behind') {
    if (metrics.primaryMetric.name === 'Revenue') {
      asks.push(`Customer introductions - we need help getting to ${formatCurrency(metrics.primaryMetric.target * metrics.primaryMetric.value)} revenue`);
      asks.push('Sales playbook review - what worked for your other B2B portfolio companies?');
    } else if (metrics.primaryMetric.name === 'MRR') {
      asks.push('Help with pricing strategy - considering value-based pricing approaches');
      asks.push('Referral program advice from your network');
    }
  }

  // Cash-specific asks
  if (metrics.runwayMonths < 12 && metrics.runwayMonths !== Infinity) {
    asks.push('Fundraising introductions for Series A/Seed extension');
    asks.push('Bridge round participants if we decide to extend runway');
  }

  // Growth-specific asks
  if (metrics.ycGrowthScore < 6) {
    asks.push('Product-market fit feedback from technical decision makers');
    asks.push('Growth hacking tactics that worked for similar B2B tools');
  }

  // EvalOps-specific asks
  if ('evalRuns' in metrics) {
    if (metrics.evalRuns < 1000) {
      asks.push('ML team introductions at Series A+ companies');
      asks.push('Speaking opportunities at ML conferences/meetups');
    }
  }

  // Always include at least one ask
  if (asks.length === 0) {
    asks.push('Customer development interviews with target personas');
    asks.push('Feedback on our roadmap priorities');
  }

  // Limit to 3 asks max (YC best practice)
  return asks.slice(0, 3);
}

function formatCurrency(amount: number): string {
  if (amount === 0) return '$0';
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${Math.round(amount).toLocaleString()}`;
}

function formatPercentage(rate: number): string {
  if (rate === 0) return '0%';
  const percentage = (rate * 100);
  if (Math.abs(percentage) < 0.1) return '<0.1%';
  return `${percentage > 0 ? '+' : ''}${percentage.toFixed(1)}%`;
}

function getGrowthIcon(rate: number): string {
  if (rate > 0.10) return '🚀'; // >10% growth
  if (rate > 0.05) return '📈'; // >5% growth
  if (rate > 0) return '⬆️'; // positive growth
  if (rate === 0) return '➖'; // flat
  return '⬇️'; // declining
}

function getStatusEmoji(status: 'on-track' | 'behind' | 'ahead'): string {
  switch (status) {
    case 'ahead': return '🎯';
    case 'on-track': return '✅';
    case 'behind': return '⚠️';
    default: return '❓';
  }
}