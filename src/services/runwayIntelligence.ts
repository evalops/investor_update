import { addMonths, format, differenceInMonths } from 'date-fns';

import { Logger } from '../utils/logger';

import type { StartupMetrics} from './metricsCalculator';
import { MonthlyMetrics } from './metricsCalculator';



const logger = Logger.for('RunwayIntelligence');

export interface RunwayScenario {
  name: string;
  description: string;
  monthlyBurnChange: number; // Percentage change from current
  revenueGrowthChange: number; // Percentage change from current
  oneTimeExpenses?: Array<{ month: number; amount: number; description: string }>;
  hiringPlan?: Array<{ month: number; roleCost: number; description: string }>;
}

export interface RunwayPrediction {
  baseCase: {
    runwayMonths: number;
    runwayDate: Date;
    confidenceInterval: {
      pessimistic: { months: number; date: Date };
      optimistic: { months: number; date: Date };
    };
  };
  scenarios: Array<{
    scenario: RunwayScenario;
    runwayMonths: number;
    runwayDate: Date;
    monthlyProjections: Array<{
      month: string;
      projectedBalance: number;
      projectedBurn: number;
      projectedRevenue: number;
    }>;
  }>;
  recommendations: Array<{
    priority: 'critical' | 'high' | 'medium' | 'low';
    category: 'fundraising' | 'cost-reduction' | 'revenue-growth' | 'cash-management';
    title: string;
    description: string;
    impact: string;
    actionItems: string[];
    timeframe: string;
  }>;
  earlyWarnings: Array<{
    severity: 'danger' | 'warning' | 'watch';
    trigger: string;
    description: string;
    timeline: string;
    suggestedActions: string[];
  }>;
}

export interface BenchmarkData {
  stage: 'pre-seed' | 'seed' | 'series-a' | 'series-b+';
  industry: string;
  avgRunwayMonths: number;
  avgMonthlyBurn: number;
  avgGrowthRate: number;
  survivalRate: number; // What % of companies with similar metrics survive
}

export class RunwayIntelligenceEngine {
  private metrics: StartupMetrics;

  constructor(metrics: StartupMetrics) {
    this.metrics = metrics;
  }

  /**
   * Generate comprehensive runway prediction with scenarios and recommendations
   */
  async generateRunwayIntelligence(): Promise<RunwayPrediction> {
    logger.info('Generating runway intelligence analysis');

    const baseCase = this.calculateBaseCaseRunway();
    const scenarios = await this.runScenarioAnalysis();
    const recommendations = this.generateRecommendations(baseCase, scenarios);
    const earlyWarnings = this.generateEarlyWarnings(baseCase);

    return {
      baseCase,
      scenarios,
      recommendations,
      earlyWarnings
    };
  }

  /**
   * Calculate base case runway with confidence intervals
   */
  private calculateBaseCaseRunway() {
    const currentBalance = this.metrics.currentBalance;
    const avgBurn = Math.abs(this.metrics.averageMonthlyBurn);
    const revenueGrowth = this.metrics.revenueGrowthRate || 0;
    const burnGrowth = this.metrics.expenseGrowthRate || 0;

    // Base calculation
    const baseRunwayMonths = avgBurn > 0 ? currentBalance / avgBurn : Infinity;
    const baseRunwayDate = avgBurn > 0 ? addMonths(new Date(), baseRunwayMonths) : new Date(2099, 11, 31);

    // Confidence intervals based on historical volatility
    const burnVolatility = this.calculateBurnVolatility();
    const revenueVolatility = this.calculateRevenueVolatility();

    // Pessimistic: higher burn growth, lower revenue growth
    const pessimisticBurn = avgBurn * (1 + burnVolatility + 0.2);
    const pessimisticRevenue = this.metrics.averageMonthlyRevenue * (1 - revenueVolatility);
    const pessimisticNetBurn = pessimisticBurn - pessimisticRevenue;
    const pessimisticMonths = pessimisticNetBurn > 0 ? currentBalance / pessimisticNetBurn : Infinity;

    // Optimistic: lower burn growth, higher revenue growth  
    const optimisticBurn = avgBurn * Math.max(0.5, 1 - burnVolatility);
    const optimisticRevenue = this.metrics.averageMonthlyRevenue * (1 + revenueVolatility + 0.3);
    const optimisticNetBurn = Math.max(optimisticBurn - optimisticRevenue, avgBurn * 0.3);
    const optimisticMonths = optimisticNetBurn > 0 ? currentBalance / optimisticNetBurn : Infinity;

    return {
      runwayMonths: baseRunwayMonths,
      runwayDate: baseRunwayDate,
      confidenceInterval: {
        pessimistic: { 
          months: pessimisticMonths === Infinity ? 999 : pessimisticMonths,
          date: pessimisticMonths === Infinity ? new Date(2099, 11, 31) : addMonths(new Date(), pessimisticMonths)
        },
        optimistic: { 
          months: optimisticMonths === Infinity ? 999 : optimisticMonths,
          date: optimisticMonths === Infinity ? new Date(2099, 11, 31) : addMonths(new Date(), optimisticMonths)
        }
      }
    };
  }

  /**
   * Run multiple scenarios to show founders different paths
   */
  private async runScenarioAnalysis() {
    const scenarios: RunwayScenario[] = [
      {
        name: 'Status Quo',
        description: 'Continue current burn and revenue trajectory',
        monthlyBurnChange: 0,
        revenueGrowthChange: 0
      },
      {
        name: 'Aggressive Hiring',
        description: 'Add 2 engineers ($15K/month each) in months 2-3',
        monthlyBurnChange: 0,
        revenueGrowthChange: 0,
        hiringPlan: [
          { month: 2, roleCost: 15000, description: 'Senior Engineer #1' },
          { month: 3, roleCost: 15000, description: 'Senior Engineer #2' }
        ]
      },
      {
        name: 'Revenue Acceleration',
        description: 'Invest in sales/marketing, grow revenue 50% faster',
        monthlyBurnChange: 25, // 25% higher burn for sales/marketing
        revenueGrowthChange: 50  // 50% faster revenue growth
      },
      {
        name: 'Cost Cutting',
        description: 'Reduce burn by 30% while maintaining core team',
        monthlyBurnChange: -30,
        revenueGrowthChange: -10 // Slight revenue impact from reduced investment
      },
      {
        name: 'Fundraise Preparation',
        description: 'Higher burn for 3 months preparing for Series A',
        monthlyBurnChange: 40,
        revenueGrowthChange: 0,
        oneTimeExpenses: [
          { month: 1, amount: 25000, description: 'Legal fees for fundraise prep' },
          { month: 2, amount: 15000, description: 'Investment banker retainer' },
          { month: 3, amount: 10000, description: 'Due diligence preparation' }
        ]
      }
    ];

    const scenarioResults = [];

    for (const scenario of scenarios) {
      const result = this.calculateScenarioRunway(scenario);
      scenarioResults.push({
        scenario,
        ...result
      });
    }

    return scenarioResults;
  }

  /**
   * Calculate runway for a specific scenario
   */
  private calculateScenarioRunway(scenario: RunwayScenario) {
    const currentBalance = this.metrics.currentBalance;
    const baseBurn = Math.abs(this.metrics.averageMonthlyBurn);
    const baseRevenue = this.metrics.averageMonthlyRevenue;
    const baseGrowth = this.metrics.revenueGrowthRate || 0.05; // Default 5% monthly

    // Adjust burn and revenue based on scenario
    const newBurn = baseBurn * (1 + scenario.monthlyBurnChange / 100);
    const newRevenueGrowth = baseGrowth * (1 + scenario.revenueGrowthChange / 100);

    let balance = currentBalance;
    const monthlyProjections = [];
    let month = 0;

    // Project forward until balance hits zero or 60 months (whichever comes first)  
    while (balance > 0 && month < 60) {
      month++;
      const monthStr = format(addMonths(new Date(), month), 'yyyy-MM');

      // Calculate revenue with growth
      const monthlyRevenue = baseRevenue * Math.pow(1 + newRevenueGrowth, month);
      
      // Calculate burn with hiring and one-time expenses
      let monthlyBurn = newBurn;
      
      // Add hiring costs
      if (scenario.hiringPlan) {
        const cumulativeHiringCosts = scenario.hiringPlan
          .filter(hire => hire.month <= month)
          .reduce((sum, hire) => sum + hire.roleCost, 0);
        monthlyBurn += cumulativeHiringCosts;
      }

      // Add one-time expenses
      if (scenario.oneTimeExpenses) {
        const monthlyOneTime = scenario.oneTimeExpenses
          .filter(expense => expense.month === month)
          .reduce((sum, expense) => sum + expense.amount, 0);
        monthlyBurn += monthlyOneTime;
      }

      const netBurn = monthlyBurn - monthlyRevenue;
      balance -= netBurn;

      monthlyProjections.push({
        month: monthStr,
        projectedBalance: balance,
        projectedBurn: monthlyBurn,
        projectedRevenue: monthlyRevenue
      });

      if (balance <= 0) {break;}
    }

    const runwayMonths = month;
    const runwayDate = addMonths(new Date(), runwayMonths);

    return {
      runwayMonths,
      runwayDate,
      monthlyProjections
    };
  }

  /**
   * Generate specific, actionable recommendations based on runway analysis
   */
  private generateRecommendations(baseCase: any, scenarios: any[]): RunwayPrediction['recommendations'] {
    const recommendations = [];
    const runway = baseCase.runwayMonths;

    // Critical fundraising recommendations
    if (runway < 6) {
      recommendations.push({
        priority: 'critical' as const,
        category: 'fundraising' as const,
        title: 'URGENT: Begin fundraising immediately',
        description: `With ${runway.toFixed(1)} months of runway, you need to start fundraising NOW. Fundraising typically takes 3-6 months.`,
        impact: 'Company survival',
        actionItems: [
          'Prepare pitch deck this week',
          'Reach out to warm investor connections',
          'Consider convertible note for bridge funding',
          'Update board/advisors on runway situation'
        ],
        timeframe: 'This week'
      });
    } else if (runway < 12) {
      recommendations.push({
        priority: 'high' as const,
        category: 'fundraising' as const,
        title: 'Plan fundraising timeline',
        description: `With ${runway.toFixed(1)} months of runway, begin fundraising preparation in the next 2-3 months.`,
        impact: 'Avoid emergency fundraising',
        actionItems: [
          'Update financial model and projections',
          'Strengthen key metrics and growth story',
          'Build investor pipeline',
          'Consider fundraising consultants'
        ],
        timeframe: 'Next 2-3 months'
      });
    }

    // Cash efficiency recommendations
    const cashEfficiency = this.metrics.cashEfficiency;
    if (cashEfficiency < 0.3) {
      recommendations.push({
        priority: 'high' as const,
        category: 'cash-management' as const,
        title: 'Improve cash efficiency',
        description: `Cash efficiency of ${(cashEfficiency * 100).toFixed(0)}% is below healthy levels. Focus on revenue per dollar of burn.`,
        impact: `Could extend runway by ${(runway * 0.3).toFixed(1)} months`,
        actionItems: [
          'Audit all recurring expenses and subscriptions',
          'Negotiate better rates with vendors',
          'Focus sales on highest-margin customers',
          'Consider remote-first to reduce office costs'
        ],
        timeframe: 'Next 30 days'
      });
    }

    // Growth recommendations
    const monthlyGrowth = this.metrics.monthlyGrowthRate;
    if (monthlyGrowth < 0.15) {
      recommendations.push({
        priority: 'medium' as const,
        category: 'revenue-growth' as const,
        title: 'Accelerate revenue growth',
        description: `Monthly growth of ${(monthlyGrowth * 100).toFixed(1)}% is below YC target of 15%. This impacts fundraising prospects.`,
        impact: 'Better fundraising position and longer runway',
        actionItems: [
          'Double down on top-performing marketing channels',
          'Implement referral program',
          'Optimize onboarding and activation',
          'Consider partnerships for distribution'
        ],
        timeframe: 'Next quarter'
      });
    }

    // Benchmark against scenarios
    const costCuttingScenario = scenarios.find(s => s.scenario.name === 'Cost Cutting');
    if (costCuttingScenario && costCuttingScenario.runwayMonths > runway + 3) {
      recommendations.push({
        priority: 'medium' as const,
        category: 'cost-reduction' as const,
        title: 'Consider strategic cost reduction',
        description: `Cost cutting could extend runway by ${(costCuttingScenario.runwayMonths - runway).toFixed(1)} months.`,
        impact: `Extend runway to ${costCuttingScenario.runwayMonths.toFixed(1)} months`,
        actionItems: [
          'Review all non-essential subscriptions and services',
          'Renegotiate contracts with major vendors',
          'Consider temporary salary reductions for leadership',
          'Pause non-critical hiring'
        ],
        timeframe: 'Next 2 weeks'
      });
    }

    return recommendations;
  }

  /**
   * Generate early warning alerts for potential issues
   */
  private generateEarlyWarnings(baseCase: any): RunwayPrediction['earlyWarnings'] {
    const warnings = [];
    const runway = baseCase.runwayMonths;
    const burn = Math.abs(this.metrics.averageMonthlyBurn);
    const revenue = this.metrics.averageMonthlyRevenue;

    // Runway warnings
    if (runway < 3) {
      warnings.push({
        severity: 'danger' as const,
        trigger: 'Less than 3 months runway',
        description: 'Critical cash situation requiring immediate action',
        timeline: 'Next 30 days',
        suggestedActions: [
          'Emergency fundraising or bridge round',
          'Immediate cost cutting',
          'Consider strategic acquisition'
        ]
      });
    } else if (runway < 6) {
      warnings.push({
        severity: 'warning' as const,
        trigger: 'Less than 6 months runway',
        description: 'Begin fundraising preparations immediately',
        timeline: 'Next 60 days',
        suggestedActions: [
          'Start fundraising process',
          'Update board on cash situation',
          'Prepare contingency cost-cutting plan'
        ]
      });
    }

    // Burn rate acceleration warning
    const recentBurnGrowth = this.calculateRecentBurnGrowth();
    if (recentBurnGrowth > 0.2) {
      warnings.push({
        severity: 'warning' as const,
        trigger: 'Burn rate accelerating',
        description: `Burn rate has increased ${(recentBurnGrowth * 100).toFixed(0)}% recently, faster than revenue growth`,
        timeline: 'Monitor monthly',
        suggestedActions: [
          'Review recent hiring and expense decisions',
          'Set stricter budget controls',
          'Track burn rate weekly instead of monthly'
        ]
      });
    }

    // Revenue concentration risk
    const customerConcentration = this.assessCustomerConcentration();
    if (customerConcentration > 0.5) {
      warnings.push({
        severity: 'watch' as const,
        trigger: 'High customer concentration',
        description: 'Significant portion of revenue from few customers increases risk',
        timeline: 'Ongoing monitoring',
        suggestedActions: [
          'Diversify customer base',
          'Strengthen relationships with key accounts',
          'Build predictable revenue streams'
        ]
      });
    }

    return warnings;
  }

  private calculateBurnVolatility(): number {
    const monthlyMetrics = this.metrics.monthlyMetrics || [];
    if (monthlyMetrics.length < 3) {return 0.2;} // Default volatility

    const burnRates = monthlyMetrics.map(m => Math.abs(m.netBurn));
    const avgBurn = burnRates.reduce((sum, burn) => sum + burn, 0) / burnRates.length;
    if (avgBurn === 0) {return 0.2;}
    
    const variance = burnRates.reduce((sum, burn) => sum + Math.pow(burn - avgBurn, 2), 0) / burnRates.length;
    
    return Math.sqrt(variance) / avgBurn; // Coefficient of variation
  }

  private calculateRevenueVolatility(): number {
    const monthlyMetrics = this.metrics.monthlyMetrics || [];
    if (monthlyMetrics.length < 3) {return 0.15;} // Default volatility

    const revenues = monthlyMetrics.map(m => m.revenue);
    const avgRevenue = revenues.reduce((sum, rev) => sum + rev, 0) / revenues.length;
    if (avgRevenue === 0) {return 0.15;}
    
    const variance = revenues.reduce((sum, rev) => sum + Math.pow(rev - avgRevenue, 2), 0) / revenues.length;
    
    return Math.sqrt(variance) / avgRevenue; // Coefficient of variation
  }

  private calculateRecentBurnGrowth(): number {
    const monthlyMetrics = this.metrics.monthlyMetrics || [];
    if (monthlyMetrics.length < 2) {return 0;}

    const recent = monthlyMetrics.slice(-2);
    const oldBurn = Math.abs(recent[0].netBurn);
    const newBurn = Math.abs(recent[1].netBurn);
    
    return oldBurn > 0 ? (newBurn - oldBurn) / oldBurn : 0;
  }

  private assessCustomerConcentration(): number {
    // This would need customer-level data to calculate properly
    // For now, return a placeholder based on revenue volatility
    return Math.min(0.8, this.calculateRevenueVolatility() * 2);
  }
}