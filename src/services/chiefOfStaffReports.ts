import { format, addMonths } from 'date-fns';

import { Logger } from '../utils/logger';

import type { StartupMetrics } from './metricsCalculator';
import { RunwayIntelligenceEngine } from './runwayIntelligence';
import type { RunwayPrediction } from './runwayIntelligence';

const logger = Logger.for('ChiefOfStaffReports');

export interface ExecutiveSummary {
  healthScore: number; // 1-100 overall company health
  keyInsights: string[];
  urgentActions: string[];
  boardReadiness: {
    score: number;
    missingItems: string[];
    strengths: string[];
  };
  fundraisingReadiness: {
    score: number;
    timeline: string;
    keyMetricsToImprove: string[];
  };
}

export interface OperationalIntelligence {
  runway: RunwayPrediction;
  benchmarks: {
    industryComparison: string;
    stageComparison: string;
    survivalProbability: number;
  };
  growthTrajectory: {
    currentState: string;
    projectedPath: string;
    inflectionPoints: Array<{
      date: Date;
      event: string;
      impact: string;
    }>;
  };
  riskAssessment: {
    topRisks: Array<{
      category: string;
      risk: string;
      probability: number;
      impact: string;
      mitigation: string[];
    }>;
  };
}

export class ChiefOfStaffReportGenerator {
  private metrics: StartupMetrics;
  private runwayEngine: RunwayIntelligenceEngine;

  constructor(metrics: StartupMetrics) {
    this.metrics = metrics;
    this.runwayEngine = new RunwayIntelligenceEngine(metrics);
  }

  /**
   * Generate comprehensive Chief of Staff intelligence report
   */
  async generateExecutiveReport(): Promise<{
    summary: ExecutiveSummary;
    operations: OperationalIntelligence;
    weeklyUpdate: string;
    boardDeck: string;
  }> {
    logger.info('Generating Chief of Staff executive report');

    const runway = await this.runwayEngine.generateRunwayIntelligence();
    const summary = this.generateExecutiveSummary(runway);
    const operations = await this.generateOperationalIntelligence(runway);
    const weeklyUpdate = this.generateWeeklyUpdate(summary, operations);
    const boardDeck = this.generateBoardDeckData(summary, operations);

    return {
      summary,
      operations,
      weeklyUpdate,
      boardDeck
    };
  }

  /**
   * Generate executive summary with health score and key insights
   */
  private generateExecutiveSummary(runway: RunwayPrediction): ExecutiveSummary {
    const healthScore = this.calculateCompanyHealthScore(runway);
    
    const keyInsights = [
      `Runway: ${runway.baseCase.runwayMonths.toFixed(1)} months (${format(runway.baseCase.runwayDate, 'MMM yyyy')})`,
      `YC Growth Score: ${this.metrics.ycGrowthScore}/10 ${this.getGrowthEmoji(this.metrics.ycGrowthScore)}`,
      `Monthly Growth: ${(this.metrics.monthlyGrowthRate * 100).toFixed(1)}% (YC target: 15%)`,
      `Cash Efficiency: ${(this.metrics.cashEfficiency * 100).toFixed(0)}% of burn converts to value`
    ];

    // Add customer insights if available
    if (this.metrics.customersCount > 0) {
      const customerGrowth = this.calculateCustomerGrowth();
      keyInsights.push(`Customers: ${this.metrics.customersCount} (${customerGrowth}% growth)`);
    }

    const urgentActions = runway.recommendations
      .filter(r => r.priority === 'critical')
      .map(r => r.title);

    const boardReadiness = this.assessBoardReadiness();
    const fundraisingReadiness = this.assessFundraisingReadiness(runway);

    return {
      healthScore,
      keyInsights,
      urgentActions,
      boardReadiness,
      fundraisingReadiness
    };
  }

  /**
   * Generate operational intelligence with deep insights
   */
  private async generateOperationalIntelligence(runway: RunwayPrediction): Promise<OperationalIntelligence> {
    const benchmarks = this.generateBenchmarkAnalysis();
    const growthTrajectory = this.analyzeGrowthTrajectory();
    const riskAssessment = this.conductRiskAssessment(runway);

    return {
      runway,
      benchmarks,
      growthTrajectory,
      riskAssessment
    };
  }

  /**
   * Calculate overall company health score (1-100)
   */
  private calculateCompanyHealthScore(runway: RunwayPrediction): number {
    let score = 50; // Start at neutral

    // Runway component (30 points)
    const runwayMonths = runway.baseCase.runwayMonths;
    if (runwayMonths >= 18) {score += 30;}
    else if (runwayMonths >= 12) {score += 20;}
    else if (runwayMonths >= 6) {score += 10;}
    else if (runwayMonths >= 3) {score += 0;}
    else {score -= 20;}

    // Growth component (25 points)
    const monthlyGrowth = this.metrics.monthlyGrowthRate;
    if (monthlyGrowth >= 0.20) {score += 25;}
    else if (monthlyGrowth >= 0.15) {score += 20;}
    else if (monthlyGrowth >= 0.10) {score += 10;}
    else if (monthlyGrowth >= 0.05) {score += 5;}
    else {score -= 10;}

    // Cash efficiency (20 points)
    const efficiency = this.metrics.cashEfficiency;
    if (efficiency >= 0.8) {score += 20;}
    else if (efficiency >= 0.5) {score += 15;}
    else if (efficiency >= 0.3) {score += 10;}
    else {score += 0;}

    // Revenue growth trend (15 points)
    const revenueGrowth = this.metrics.revenueGrowthRate;
    if (revenueGrowth >= 0.25) {score += 15;}
    else if (revenueGrowth >= 0.15) {score += 10;}
    else if (revenueGrowth >= 0.05) {score += 5;}
    else {score += 0;}

    // Stability and risk (10 points)
    const hasStableRevenue = this.metrics.mrr > 0;
    const hasGrowingCustomerBase = this.metrics.customersCount >= 10;
    if (hasStableRevenue && hasGrowingCustomerBase) {score += 10;}
    else if (hasStableRevenue || hasGrowingCustomerBase) {score += 5;}

    return Math.max(1, Math.min(100, score));
  }

  /**
   * Generate weekly update for founders/team
   */
  private generateWeeklyUpdate(summary: ExecutiveSummary, operations: OperationalIntelligence): string {
    const urgent = summary.urgentActions.length > 0 ? 
      `\n🚨 URGENT ACTIONS NEEDED:\n${summary.urgentActions.map(action => `• ${action}`).join('\n')}\n` : '';

    return `# Weekly Chief of Staff Update
${format(new Date(), 'MMMM do, yyyy')}

## 📊 Company Health: ${summary.healthScore}/100 ${this.getHealthEmoji(summary.healthScore)}
${urgent}
## 🔍 Key Insights
${summary.keyInsights.map(insight => `• ${insight}`).join('\n')}

## 💰 Runway Analysis
**Base Case:** ${operations.runway.baseCase.runwayMonths.toFixed(1)} months (until ${format(operations.runway.baseCase.runwayDate, 'MMM yyyy')})
**Confidence Range:** ${operations.runway.baseCase.confidenceInterval.pessimistic.months.toFixed(1)} - ${operations.runway.baseCase.confidenceInterval.optimistic.months.toFixed(1)} months

## 📈 Growth Trajectory
${operations.growthTrajectory.currentState}
${operations.growthTrajectory.projectedPath}

## ⚠️ Top Risks
${operations.riskAssessment.topRisks.slice(0, 3).map(risk => 
  `• **${risk.category}:** ${risk.risk} (${risk.probability}% chance)`
).join('\n')}

## 🎯 This Week's Priorities
${operations.runway.recommendations
  .filter(r => r.timeframe.includes('week') || r.timeframe.includes('30 days'))
  .slice(0, 3)
  .map(r => `• ${r.title}`)
  .join('\n')}

## 📋 Board Readiness: ${summary.boardReadiness.score}/100
${summary.boardReadiness.missingItems.length > 0 ? 
  `**Missing:** ${summary.boardReadiness.missingItems.join(', ')}` : 
  '✅ Board meeting ready'}

---
*This report was generated automatically by your AI Chief of Staff*`;
  }

  /**
   * Generate board deck data points
   */
  private generateBoardDeckData(summary: ExecutiveSummary, operations: OperationalIntelligence): string {
    const runway = operations.runway;
    
    return `# Board Deck Key Data Points

## Financial Health
• **Current Balance:** $${this.metrics.currentBalance.toLocaleString()}
• **Monthly Burn:** $${Math.abs(this.metrics.averageMonthlyBurn).toLocaleString()}
• **Monthly Revenue:** $${this.metrics.averageMonthlyRevenue.toLocaleString()}
• **Runway:** ${runway.baseCase.runwayMonths.toFixed(1)} months

## Growth Metrics  
• **Monthly Growth Rate:** ${(this.metrics.monthlyGrowthRate * 100).toFixed(1)}%
• **YC Growth Score:** ${this.metrics.ycGrowthScore}/10
• **Primary Metric:** ${this.metrics.primaryMetric.name} - ${this.formatValue(this.metrics.primaryMetric.value)}

## Business Health
• **Company Health Score:** ${summary.healthScore}/100
• **Cash Efficiency:** ${(this.metrics.cashEfficiency * 100).toFixed(0)}%
• **Customer Count:** ${this.metrics.customersCount}
• **MRR:** $${this.metrics.mrr.toLocaleString()}

## Scenario Planning
${runway.scenarios.slice(1, 4).map(scenario => 
  `• **${scenario.scenario.name}:** ${scenario.runwayMonths.toFixed(1)} months`
).join('\n')}

## Key Recommendations
${runway.recommendations.slice(0, 5).map((rec, index) => 
  `${index + 1}. **${rec.title}** (${rec.priority}) - ${rec.impact}`
).join('\n')}`;
  }

  private assessBoardReadiness() {
    const missingItems = [];
    const strengths = [];
    let score = 70; // Start with base score

    // Check for key metrics
    if (this.metrics.monthlyMetrics.length >= 3) {
      strengths.push('Historical financial data');
      score += 10;
    } else {
      missingItems.push('Sufficient historical data');
      score -= 10;
    }

    // Check growth metrics
    if (this.metrics.monthlyGrowthRate >= 0.10) {
      strengths.push('Strong growth metrics');
      score += 10;
    } else {
      missingItems.push('Consistent growth story');
      score -= 5;
    }

    // Check customer metrics
    if (this.metrics.customersCount >= 10) {
      strengths.push('Meaningful customer base');
      score += 5;
    } else {
      missingItems.push('Larger customer base');
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      missingItems,
      strengths
    };
  }

  private assessFundraisingReadiness(runway: RunwayPrediction) {
    let score = 50;
    const keyMetricsToImprove = [];
    
    // Growth rate assessment
    if (this.metrics.monthlyGrowthRate >= 0.15) {
      score += 25;
    } else {
      keyMetricsToImprove.push('Monthly growth rate (target: 15%+)');
      score += Math.max(0, this.metrics.monthlyGrowthRate * 100);
    }

    // Revenue assessment
    if (this.metrics.totalRevenue >= 50000) {
      score += 20;
    } else if (this.metrics.totalRevenue >= 10000) {
      score += 10;
    } else {
      keyMetricsToImprove.push('Total revenue (target: $50K+)');
    }

    // Customer base
    if (this.metrics.customersCount >= 50) {
      score += 15;
    } else if (this.metrics.customersCount >= 10) {
      score += 8;
    } else {
      keyMetricsToImprove.push('Customer count (target: 50+)');
    }

    // Determine timeline based on runway and readiness
    let timeline = 'Not ready';
    if (score >= 80 && runway.baseCase.runwayMonths > 6) {
      timeline = 'Ready now';
    } else if (score >= 60) {
      timeline = 'Ready in 2-3 months with improvements';
    } else if (runway.baseCase.runwayMonths < 6) {
      timeline = 'Emergency fundraising needed';
    } else {
      timeline = 'Need 3-6 months of metric improvement';
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      timeline,
      keyMetricsToImprove
    };
  }

  private generateBenchmarkAnalysis() {
    // This would eventually pull from our customer database
    // For now, provide general benchmarks
    const revenue = this.metrics.totalRevenue;
    let stage = 'pre-seed';
    
    if (revenue > 1000000) {stage = 'series-b+';}
    else if (revenue > 100000) {stage = 'series-a';}
    else if (revenue > 10000) {stage = 'seed';}

    return {
      industryComparison: `Revenue in top ${this.getPercentileForRevenue(revenue)}% for ${stage} startups`,
      stageComparison: `Growth rate ${this.metrics.monthlyGrowthRate >= 0.15 ? 'above' : 'below'} median for ${stage}`,
      survivalProbability: this.calculateSurvivalProbability()
    };
  }

  private analyzeGrowthTrajectory() {
    const currentGrowth = this.metrics.monthlyGrowthRate;
    const runway = this.metrics.runwayMonths;
    
    let currentState = '';
    if (currentGrowth >= 0.20) {
      currentState = 'Exceptional growth trajectory - in top 10% of startups';
    } else if (currentGrowth >= 0.15) {
      currentState = 'Strong growth trajectory - meeting YC targets';
    } else if (currentGrowth >= 0.10) {
      currentState = 'Moderate growth - room for improvement';
    } else {
      currentState = 'Growth below expectations - intervention needed';
    }

    const projectedRevenue = this.metrics.totalRevenue * Math.pow(1 + currentGrowth, 12);
    const projectedPath = `At current growth rate, annual revenue will reach $${projectedRevenue.toLocaleString()} by next year`;

    return {
      currentState,
      projectedPath,
      inflectionPoints: [
        {
          date: addMonths(new Date(), Math.max(1, Math.floor(runway * 0.7))),
          event: 'Fundraising deadline',
          impact: 'Must begin fundraising or achieve profitability'
        },
        {
          date: addMonths(new Date(), 6),
          event: 'Growth milestone check',
          impact: 'Assess if growth targets are being met'
        }
      ]
    };
  }

  private conductRiskAssessment(runway: RunwayPrediction) {
    const risks = [
      {
        category: 'Financial',
        risk: 'Cash runway insufficient for next milestone',
        probability: runway.baseCase.runwayMonths < 6 ? 90 : 
                    runway.baseCase.runwayMonths < 12 ? 60 : 30,
        impact: 'Company failure',
        mitigation: ['Begin fundraising immediately', 'Implement cost controls', 'Focus on revenue acceleration']
      },
      {
        category: 'Growth',
        risk: 'Monthly growth below investor expectations',
        probability: this.metrics.monthlyGrowthRate < 0.15 ? 80 : 20,
        impact: 'Difficulty raising next round',
        mitigation: ['Double down on top growth channels', 'Improve product-market fit', 'Optimize conversion funnel']
      },
      {
        category: 'Market',
        risk: 'High customer concentration',
        probability: 50, // Would calculate from actual customer data
        impact: 'Revenue volatility',
        mitigation: ['Diversify customer base', 'Strengthen key relationships', 'Build predictable revenue streams']
      },
      {
        category: 'Operational',
        risk: 'Burn rate increasing faster than revenue',
        probability: this.metrics.expenseGrowthRate > this.metrics.revenueGrowthRate ? 70 : 30,
        impact: 'Shortened runway',
        mitigation: ['Implement strict budget controls', 'Review all hiring plans', 'Focus on revenue efficiency']
      }
    ];

    return {
      topRisks: risks.sort((a, b) => b.probability - a.probability)
    };
  }

  // Helper functions
  private getGrowthEmoji(score: number): string {
    if (score >= 9) {return '🚀';}
    if (score >= 7) {return '🔥';}
    if (score >= 5) {return '📈';}
    if (score >= 3) {return '⚠️';}
    return '🆘';
  }

  private getHealthEmoji(score: number): string {
    if (score >= 80) {return '🟢';}
    if (score >= 60) {return '🟡';}
    if (score >= 40) {return '🟠';}
    return '🔴';
  }

  private formatValue(value: number): string {
    if (value >= 1000000) {return `$${(value / 1000000).toFixed(1)}M`;}
    if (value >= 1000) {return `$${(value / 1000).toFixed(0)}K`;}
    return `$${value.toLocaleString()}`;
  }

  private calculateCustomerGrowth(): number {
    // Would calculate from historical data
    return Math.round(Math.random() * 30 + 10); // Placeholder
  }

  private getPercentileForRevenue(revenue: number): number {
    // Simplified percentile calculation
    if (revenue > 1000000) {return 5;}
    if (revenue > 100000) {return 15;}
    if (revenue > 50000) {return 30;}
    if (revenue > 10000) {return 50;}
    return 75;
  }

  private calculateSurvivalProbability(): number {
    const healthScore = this.calculateCompanyHealthScore(null as any);
    const runway = this.metrics.runwayMonths;
    const growth = this.metrics.monthlyGrowthRate;

    let probability = 50; // Base probability
    
    if (runway >= 18) {probability += 20;}
    else if (runway >= 12) {probability += 10;}
    else if (runway < 6) {probability -= 20;}

    if (growth >= 0.15) {probability += 15;}
    else if (growth < 0.05) {probability -= 15;}

    if (healthScore >= 80) {probability += 10;}
    else if (healthScore < 40) {probability -= 10;}

    return Math.max(10, Math.min(95, probability));
  }
}