import type { GitHubMetrics } from '../collectors/githubCollector';
import type { PostHogMetrics } from '../collectors/posthogCollector';

import type { CohortMetrics } from './cohortAnalyzer';
import type { StartupMetrics, EvalOpsMetrics } from './metricsCalculator';
import type { UnitEconomics } from './unitEconomicsCalculator';

export interface NarrativeInsights {
  executiveSummary: string;
  keyHighlights: string[];
  challengesAndConcerns: string[];
  actionableInsights: string[];
  growthStoryNarrative: string;
  investorFocusedSummary: string;
  contextualization: string;
}

interface MetricsContext {
  financialMetrics: StartupMetrics | EvalOpsMetrics;
  gitHubMetrics?: GitHubMetrics;
  posthogMetrics?: PostHogMetrics;
  cohortMetrics?: CohortMetrics;
  unitEconomics?: UnitEconomics;
}

export class NarrativeGenerator {
  private metrics: MetricsContext;

  constructor(
    financialMetrics: StartupMetrics | EvalOpsMetrics,
    gitHubMetrics?: GitHubMetrics,
    cohortMetrics?: CohortMetrics,
    unitEconomics?: UnitEconomics,
    posthogMetrics?: PostHogMetrics
  ) {
    this.metrics = {
      financialMetrics,
      gitHubMetrics,
      posthogMetrics,
      cohortMetrics,
      unitEconomics
    };
  }

  generateNarrative(): NarrativeInsights {
    const executiveSummary = this.generateExecutiveSummary();
    const keyHighlights = this.generateKeyHighlights();
    const challengesAndConcerns = this.generateChallengesAndConcerns();
    const actionableInsights = this.generateActionableInsights();
    const growthStoryNarrative = this.generateGrowthStoryNarrative();
    const investorFocusedSummary = this.generateInvestorFocusedSummary();
    const contextualization = this.generateContextualization();

    return {
      executiveSummary,
      keyHighlights,
      challengesAndConcerns,
      actionableInsights,
      growthStoryNarrative,
      investorFocusedSummary,
      contextualization
    };
  }

  private generateExecutiveSummary(): string {
    const { financialMetrics } = this.metrics;
    const sentiment = this.determineOverallSentiment();
    const primaryMetric = financialMetrics.primaryMetric;

    let summary = '';

    // Opening sentiment
    if (sentiment.score >= 7) {
      summary += "We're hitting our stride with strong momentum across key metrics. ";
    } else if (sentiment.score >= 5) {
      summary += "We're making solid progress with good traction in several areas. ";
    } else if (sentiment.score >= 3) {
      summary += "We're navigating through some headwinds while building strong foundations. ";
    } else {
      summary += "We're facing challenges but taking decisive action to get back on track. ";
    }

    // Primary metric performance
    const primaryGrowth = (primaryMetric.growthRate * 100).toFixed(1);
    summary += `Our primary metric (${primaryMetric.name.toLowerCase()}) is ${primaryMetric.status === 'ahead' ? 'exceeding' : primaryMetric.status === 'on-track' ? 'meeting' : 'below'} expectations at ${primaryGrowth}% monthly growth. `;

    // Financial position
    if (financialMetrics.runwayMonths === Infinity) {
      summary += "We maintain a strong cash position with unlimited runway. ";
    } else if (financialMetrics.runwayMonths >= 18) {
      summary += `We have ${Math.round(financialMetrics.runwayMonths)} months of runway, giving us flexibility to execute on our vision. `;
    } else if (financialMetrics.runwayMonths >= 12) {
      summary += `With ${Math.round(financialMetrics.runwayMonths)} months of runway, we're well-positioned for our next fundraising milestone. `;
    } else {
      summary += `Our current runway of ${Math.round(financialMetrics.runwayMonths)} months makes fundraising a near-term priority. `;
    }

    // Unit economics insight
    if (this.metrics.unitEconomics && this.metrics.unitEconomics.ltvToCacRatio > 0) {
      const ratio = this.metrics.unitEconomics.ltvToCacRatio;
      if (ratio >= 3) {
        summary += `Strong unit economics with a ${ratio.toFixed(1)}:1 LTV:CAC ratio demonstrate sustainable growth potential.`;
      } else if (ratio >= 2) {
        summary += `Our ${ratio.toFixed(1)}:1 LTV:CAC ratio shows improving unit economics as we scale.`;
      } else {
        summary += `We're optimizing unit economics (currently ${ratio.toFixed(1)}:1 LTV:CAC) as we refine our go-to-market strategy.`;
      }
    }

    return summary.trim();
  }

  private generateKeyHighlights(): string[] {
    const highlights: string[] = [];
    const { financialMetrics, gitHubMetrics, posthogMetrics, cohortMetrics, unitEconomics } = this.metrics;

    // Financial highlights
    if (financialMetrics.monthlyGrowthRate > 0.15) {
      highlights.push(`Exceptional ${(financialMetrics.monthlyGrowthRate * 100).toFixed(1)}% monthly growth rate - well above YC's 15% target`);
    } else if (financialMetrics.monthlyGrowthRate > 0.10) {
      highlights.push(`Strong ${(financialMetrics.monthlyGrowthRate * 100).toFixed(1)}% monthly growth rate showing solid momentum`);
    }

    if (financialMetrics.weeklyGrowthRate > 0.07) {
      highlights.push(`Weekly growth of ${(financialMetrics.weeklyGrowthRate * 100).toFixed(1)}% exceeds YC's 7% benchmark`);
    }

    if (financialMetrics.ycGrowthScore >= 8) {
      highlights.push(`YC Growth Score of ${financialMetrics.ycGrowthScore}/10 puts us in the top tier of startups`);
    }

    // Product usage highlights
    if (posthogMetrics) {
      if (posthogMetrics.monthlyActiveUsers > 0) {
        highlights.push(`${posthogMetrics.monthlyActiveUsers} monthly active users with ${posthogMetrics.customerHealthScore}/10 customer health score`);
      }

      if (posthogMetrics.userRetentionRates['1-week'] && posthogMetrics.userRetentionRates['1-week'] > 0.4) {
        highlights.push(`Strong product engagement with ${(posthogMetrics.userRetentionRates['1-week'] * 100).toFixed(0)}% week-1 user retention`);
      }

      if (posthogMetrics.activationRate > 25) {
        highlights.push(`High activation rate of ${posthogMetrics.activationRate.toFixed(0)}% - users quickly find value in the product`);
      }

      if (posthogMetrics.dailyActiveUsers > 0 && posthogMetrics.monthlyActiveUsers > 0) {
        const stickiness = (posthogMetrics.dailyActiveUsers / posthogMetrics.monthlyActiveUsers * 100);
        if (stickiness > 20) {
          highlights.push(`Exceptional user stickiness at ${stickiness.toFixed(0)}% DAU/MAU ratio`);
        }
      }
    }

    // GitHub/Engineering highlights
    if (gitHubMetrics) {
      if (gitHubMetrics.engineeringVelocityScore >= 8) {
        highlights.push(`High engineering velocity with ${gitHubMetrics.commitsLast30Days} commits and ${gitHubMetrics.pullRequestsLast30Days} PRs in the last 30 days`);
      }

      if (gitHubMetrics.releasesLast30Days >= 2) {
        highlights.push(`Shipped ${gitHubMetrics.releasesLast30Days} releases this month, maintaining rapid iteration`);
      }

      if (gitHubMetrics.averagePRMergeTime <= 24) {
        highlights.push(`Fast development cycle with ${gitHubMetrics.averagePRMergeTime.toFixed(1)}-hour average PR merge time`);
      }
    }

    // Cohort/Retention highlights
    if (cohortMetrics && cohortMetrics.overallRetentionRates[3] > 0.6) {
      highlights.push(`Strong product-market fit with ${(cohortMetrics.overallRetentionRates[3] * 100).toFixed(0)}% customer retention at 3 months`);
    }

    if (cohortMetrics && cohortMetrics.netRevenueRetention > 100) {
      highlights.push(`Net Revenue Retention of ${cohortMetrics.netRevenueRetention.toFixed(0)}% indicates strong customer expansion`);
    }

    // Unit economics highlights
    if (unitEconomics && unitEconomics.ltvToCacRatio >= 3) {
      highlights.push(`Healthy unit economics with ${unitEconomics.ltvToCacRatio.toFixed(1)}:1 LTV:CAC ratio and ${unitEconomics.paybackPeriodMonths.toFixed(1)}-month payback period`);
    }

    if (unitEconomics && unitEconomics.paybackPeriodMonths <= 6) {
      highlights.push(`Fast capital recovery with ${unitEconomics.paybackPeriodMonths.toFixed(1)}-month CAC payback period`);
    }

    // Revenue milestones
    if (financialMetrics.mrr >= 100000) {
      highlights.push(`Crossed $${(financialMetrics.mrr / 1000).toFixed(0)}K MRR milestone with strong recurring revenue base`);
    } else if (financialMetrics.mrr >= 10000) {
      highlights.push(`Growing MRR base of $${(financialMetrics.mrr / 1000).toFixed(0)}K demonstrates product-market fit`);
    }

    // Efficiency metrics
    if (financialMetrics.cashEfficiency < 1 && financialMetrics.averageMonthlyRevenue > 0) {
      highlights.push(`Approaching cash flow positive with burn-to-revenue ratio improving`);
    }

    return highlights.slice(0, 5); // Limit to top 5 highlights
  }

  private generateChallengesAndConcerns(): string[] {
    const concerns: string[] = [];
    const { financialMetrics, gitHubMetrics, cohortMetrics, unitEconomics } = this.metrics;

    // Growth concerns
    if (financialMetrics.monthlyGrowthRate < 0.05) {
      concerns.push(`Monthly growth rate of ${(financialMetrics.monthlyGrowthRate * 100).toFixed(1)}% is below sustainable levels - need to accelerate customer acquisition`);
    }

    if (financialMetrics.weeklyGrowthRate < 0.02) {
      concerns.push(`Weekly growth momentum has slowed - requires immediate focus on growth drivers`);
    }

    // Cash concerns
    if (financialMetrics.runwayMonths < 6 && financialMetrics.runwayMonths !== Infinity) {
      concerns.push(`Critical runway situation with only ${Math.round(financialMetrics.runwayMonths)} months remaining - fundraising urgent`);
    } else if (financialMetrics.runwayMonths < 12 && financialMetrics.runwayMonths !== Infinity) {
      concerns.push(`Runway of ${Math.round(financialMetrics.runwayMonths)} months requires near-term fundraising planning`);
    }

    // Unit economics concerns
    if (unitEconomics && unitEconomics.ltvToCacRatio < 2) {
      concerns.push(`LTV:CAC ratio of ${unitEconomics.ltvToCacRatio.toFixed(1)}:1 indicates unit economics need optimization before scaling`);
    }

    if (unitEconomics && unitEconomics.paybackPeriodMonths > 18) {
      concerns.push(`Long CAC payback period of ${unitEconomics.paybackPeriodMonths.toFixed(1)} months constrains cash flow efficiency`);
    }

    // Retention concerns
    if (cohortMetrics && cohortMetrics.churnRate > 15) {
      concerns.push(`High monthly churn rate of ${cohortMetrics.churnRate.toFixed(1)}% suggests product-market fit issues`);
    }

    if (cohortMetrics && cohortMetrics.overallRetentionRates[1] < 0.5) {
      concerns.push(`Month-1 retention of ${(cohortMetrics.overallRetentionRates[1] * 100).toFixed(0)}% indicates onboarding or early value delivery problems`);
    }

    // Engineering concerns
    if (gitHubMetrics && gitHubMetrics.averagePRMergeTime > 72) {
      concerns.push(`Slow development cycle with ${gitHubMetrics.averagePRMergeTime.toFixed(0)}-hour PR merge times may impact product velocity`);
    }

    if (gitHubMetrics && gitHubMetrics.releasesLast30Days === 0) {
      concerns.push(`No releases in the past month suggests development bottlenecks or planning issues`);
    }

    // Market concerns
    if (financialMetrics.customersCount === 0) {
      concerns.push(`No identifiable paying customers in transaction data indicates product-market fit challenges`);
    }

    return concerns.slice(0, 4); // Limit to top 4 concerns
  }

  private generateActionableInsights(): string[] {
    const insights: string[] = [];
    const { financialMetrics, gitHubMetrics, cohortMetrics, unitEconomics } = this.metrics;

    // Growth optimization insights
    if (financialMetrics.monthlyGrowthRate < 0.15) {
      insights.push(`Focus on doubling down on highest-performing growth channels to reach 15% monthly growth target`);
    }

    // Unit economics optimization
    if (unitEconomics && unitEconomics.ltvToCacRatio < 3) {
      insights.push(`Optimize marketing efficiency by focusing on channels with lowest CAC or highest conversion rates`);
    }

    if (cohortMetrics && cohortMetrics.overallRetentionRates[0] < 0.8) {
      insights.push(`Improve onboarding experience - low first-month retention suggests users aren't reaching activation`);
    }

    // Engineering productivity
    if (gitHubMetrics && gitHubMetrics.engineeringVelocityScore < 6) {
      insights.push(`Streamline development processes to increase feature shipping velocity and reduce time-to-market`);
    }

    // Cash efficiency
    if (financialMetrics.averageMonthlyBurn > financialMetrics.averageMonthlyRevenue * 3) {
      insights.push(`Review expense structure to improve burn efficiency - consider consolidating tools and optimizing team size`);
    }

    // Revenue expansion
    if (cohortMetrics && cohortMetrics.netRevenueRetention < 100) {
      insights.push(`Implement expansion revenue strategies to increase revenue per customer over time`);
    }

    // Data quality
    if (unitEconomics && unitEconomics.dataQuality.confidenceLevel === 'low') {
      insights.push(`Improve tracking infrastructure to get more reliable CAC and LTV metrics for better decision-making`);
    }

    return insights.slice(0, 5);
  }

  private generateGrowthStoryNarrative(): string {
    const { financialMetrics } = this.metrics;

    let narrative = `Our growth trajectory over the past ${financialMetrics.monthlyMetrics.length} months tells a story of `;

    const growthTrend = this.analyzeGrowthTrend();

    if (growthTrend === 'accelerating') {
      narrative += `accelerating momentum. We've consistently improved our key metrics, with our primary metric (${financialMetrics.primaryMetric.name.toLowerCase()}) showing ${(financialMetrics.primaryMetric.growthRate * 100).toFixed(1)}% monthly growth. `;
    } else if (growthTrend === 'steady') {
      narrative += `steady, sustainable progress. While growth has been consistent, we see opportunities to accelerate by optimizing our strongest channels. `;
    } else {
      narrative += `strategic pivoting and optimization. We've identified key areas for improvement and are taking decisive action to reignite growth. `;
    }

    // Add context about the business model
    if (financialMetrics.mrr > 0) {
      narrative += `Our recurring revenue model provides strong foundation with $${(financialMetrics.mrr / 1000).toFixed(0)}K MRR. `;
    }

    // Add unit economics context if available
    if (this.metrics.unitEconomics && this.metrics.unitEconomics.ltvToCacRatio > 0) {
      const ratio = this.metrics.unitEconomics.ltvToCacRatio;
      narrative += `Unit economics of ${ratio.toFixed(1)}:1 LTV:CAC ${ratio >= 3 ? 'support' : 'guide'} our scaling strategy. `;
    }

    return narrative.trim();
  }

  private generateInvestorFocusedSummary(): string {
    const { financialMetrics } = this.metrics;

    let summary = `Key investor highlights: `;

    // Growth metrics for investors
    if (financialMetrics.ycGrowthScore >= 7) {
      summary += `Strong YC Growth Score of ${financialMetrics.ycGrowthScore}/10 indicates top-tier performance. `;
    }

    // Market opportunity
    summary += `We're addressing ${this.inferMarketContext()} with our ${this.inferBusinessModel()} model. `;

    // Traction metrics
    if (this.metrics.cohortMetrics && this.metrics.cohortMetrics.cohorts.length > 0) {
      const totalCustomers = this.metrics.cohortMetrics.cohorts.reduce((sum, c) => sum + c.customersAcquired, 0);
      summary += `${totalCustomers} customers acquired across ${this.metrics.cohortMetrics.cohorts.length} cohorts. `;
    }

    // Investment readiness
    if (financialMetrics.runwayMonths < 12 && financialMetrics.runwayMonths !== Infinity) {
      summary += `Fundraising timeline aligns with ${Math.round(financialMetrics.runwayMonths)}-month runway for optimal Series A positioning.`;
    } else {
      summary += `Strong cash position provides flexibility for growth investments and strategic initiatives.`;
    }

    return summary.trim();
  }

  private generateContextualization(): string {
    const { financialMetrics } = this.metrics;

    let context = `At our current stage, `;

    // Stage-based context
    if (financialMetrics.totalRevenue < 10000) {
      context += `we're in the product-market fit validation phase, focusing on proving strong unit economics before scaling. `;
    } else if (financialMetrics.totalRevenue < 100000) {
      context += `we're in the early traction phase, optimizing our go-to-market motion and proving repeatability. `;
    } else {
      context += `we're in the growth and scaling phase, focusing on market expansion and operational efficiency. `;
    }

    // Industry context
    context += `Our metrics compare favorably to typical B2B SaaS benchmarks, `;

    if (financialMetrics.weeklyGrowthRate > 0.05) {
      context += `with weekly growth exceeding most early-stage companies. `;
    } else {
      context += `and we're implementing proven strategies to accelerate growth. `;
    }

    // Forward-looking context
    context += `The next 6 months will focus on ${this.identifyKeyPriorities().join(', ')}.`;

    return context;
  }

  private determineOverallSentiment(): { score: number; sentiment: 'positive' | 'neutral' | 'negative' } {
    const { financialMetrics, gitHubMetrics, cohortMetrics, unitEconomics } = this.metrics;

    let score = 5; // Start neutral

    // YC growth score influence (40% weight)
    score += (financialMetrics.ycGrowthScore - 5) * 0.4;

    // Primary metric performance (30% weight)
    if (financialMetrics.primaryMetric.status === 'ahead') {score += 1.5;}
    else if (financialMetrics.primaryMetric.status === 'behind') {score -= 1.5;}

    // Financial health (20% weight)
    if (financialMetrics.runwayMonths > 18) {score += 1;}
    else if (financialMetrics.runwayMonths < 6 && financialMetrics.runwayMonths !== Infinity) {score -= 2;}

    // Unit economics (10% weight)
    if (unitEconomics) {
      if (unitEconomics.ltvToCacRatio >= 3) {score += 0.5;}
      else if (unitEconomics.ltvToCacRatio < 2) {score -= 0.5;}
    }

    const sentiment = score >= 6.5 ? 'positive' : score >= 4.5 ? 'neutral' : 'negative';

    return { score: Math.max(1, Math.min(10, score)), sentiment };
  }

  private analyzeGrowthTrend(): 'accelerating' | 'steady' | 'declining' {
    const { financialMetrics } = this.metrics;

    if (financialMetrics.monthlyMetrics.length < 3) {return 'steady';}

    const recentGrowth = financialMetrics.monthlyMetrics.slice(-3);
    const revenues = recentGrowth.map(m => m.revenue);

    let accelerating = 0;
    let declining = 0;

    for (let i = 1; i < revenues.length; i++) {
      const growthRate = revenues[i - 1] > 0 ? (revenues[i] - revenues[i - 1]) / revenues[i - 1] : 0;
      if (growthRate > 0.1) {accelerating++;}
      else if (growthRate < -0.05) {declining++;}
    }

    if (accelerating > declining) {return 'accelerating';}
    if (declining > accelerating) {return 'declining';}
    return 'steady';
  }

  private inferMarketContext(): string {
    // This could be expanded with actual market data or user configuration
    return 'a large, growing market opportunity in enterprise software';
  }

  private inferBusinessModel(): string {
    const { financialMetrics } = this.metrics;

    if (financialMetrics.mrr > 0) {return 'subscription SaaS';}
    if (financialMetrics.customersCount > 0) {return 'B2B sales';}
    return 'product-led growth';
  }

  private identifyKeyPriorities(): string[] {
    const priorities: string[] = [];
    const { financialMetrics, unitEconomics } = this.metrics;

    if (financialMetrics.monthlyGrowthRate < 0.15) {
      priorities.push('accelerating growth');
    }

    if (financialMetrics.runwayMonths < 12 && financialMetrics.runwayMonths !== Infinity) {
      priorities.push('fundraising execution');
    }

    if (unitEconomics && unitEconomics.ltvToCacRatio < 3) {
      priorities.push('optimizing unit economics');
    }

    if (priorities.length === 0) {
      priorities.push('scaling operations', 'market expansion');
    }

    return priorities.slice(0, 3);
  }
}