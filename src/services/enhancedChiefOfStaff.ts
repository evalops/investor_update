import { ChiefOfStaffReportGenerator } from './chiefOfStaffReports';
import { BusinessIntelligenceAgents, BusinessIntelligenceReport } from './businessIntelligenceAgents';
import { BusinessContextBuilder } from './businessContextBuilder';
import { StartupMetrics } from './metricsCalculator';
import { RunwayIntelligenceEngine } from './runwayIntelligence';
import { Transaction } from './mercuryClient';
import { Logger } from '../utils/logger';
import { format } from 'date-fns';

const logger = Logger.for('EnhancedChiefOfStaff');

export interface EnhancedExecutiveReport {
  // Original runway intelligence
  baselineSummary: {
    healthScore: number;
    runwayMonths: number;
    urgentActions: string[];
    keyInsights: string[];
  };

  // Enhanced AI-driven intelligence
  aiIntelligence: BusinessIntelligenceReport;

  // Synthesized recommendations combining both
  executiveInsights: {
    criticalDecisions: Array<{
      decision: string;
      context: string;
      options: Array<{ option: string; pros: string[]; cons: string[]; impact: string }>;
      recommendation: string;
      timeline: string;
    }>;
    
    strategicPriorities: Array<{
      priority: string;
      rationale: string;
      metrics: string[];
      timeline: string;
      success: string;
    }>;

    riskMitigation: Array<{
      risk: string;
      probability: number;
      impact: string;
      mitigation: string[];
      timeline: string;
    }>;
  };

  // Enhanced weekly update
  executiveWeeklyUpdate: string;
}

export class EnhancedChiefOfStaffSystem {
  private metrics: StartupMetrics;
  private transactions: Transaction[];

  constructor(metrics: StartupMetrics, transactions: Transaction[]) {
    this.metrics = metrics;
    this.transactions = transactions;
  }

  async generateEnhancedReport(): Promise<EnhancedExecutiveReport> {
    logger.info('Generating enhanced Chief of Staff report with AI agents');

    // Step 1: Generate baseline runway intelligence
    console.log('🔍 Analyzing financial runway and scenarios...');
    const runwayEngine = new RunwayIntelligenceEngine(this.metrics);
    const runway = await runwayEngine.generateRunwayIntelligence();

    // Step 2: Generate baseline executive summary  
    const baselineChief = new ChiefOfStaffReportGenerator(this.metrics);
    const baselineReport = await baselineChief.generateExecutiveReport();

    // Step 3: Build rich business context for AI agents
    console.log('📊 Building comprehensive business context...');
    const contextBuilder = new BusinessContextBuilder(this.transactions, this.metrics, runway);
    const businessContext = await contextBuilder.buildBusinessContext();

    // Step 4: Run AI agent analysis
    console.log('🤖 Running multi-agent business intelligence analysis...');
    let aiIntelligence: BusinessIntelligenceReport;
    
    if (process.env.OPENAI_API_KEY) {
      const aiAgents = new BusinessIntelligenceAgents(businessContext);
      aiIntelligence = await aiAgents.generateBusinessIntelligence();
    } else {
      logger.warn('OpenAI API key not found, using enhanced mock intelligence');
      aiIntelligence = await this.generateEnhancedMockIntelligence(businessContext);
    }

    // Step 5: Synthesize insights combining runway analysis + AI intelligence
    console.log('🧠 Synthesizing strategic insights...');
    const executiveInsights = await this.synthesizeExecutiveInsights(
      runway, 
      baselineReport.summary, 
      aiIntelligence, 
      businessContext
    );

    // Step 6: Generate enhanced weekly update
    const executiveWeeklyUpdate = this.generateExecutiveUpdate(
      baselineReport.summary,
      aiIntelligence,
      executiveInsights
    );

    return {
      baselineSummary: {
        healthScore: baselineReport.summary.healthScore,
        runwayMonths: runway.baseCase.runwayMonths,
        urgentActions: baselineReport.summary.urgentActions,
        keyInsights: baselineReport.summary.keyInsights
      },
      aiIntelligence,
      executiveInsights,
      executiveWeeklyUpdate
    };
  }

  private async generateEnhancedMockIntelligence(context: any): Promise<BusinessIntelligenceReport> {
    // Enhanced mock that uses real business context to generate realistic insights
    const topCustomer = context.customerTransactions[0];
    const totalRevenue = context.metrics.totalRevenue;
    const customerConcentration = (topCustomer?.revenue / totalRevenue) * 100;

    return {
      customerIntelligence: {
        riskAssessment: {
          highRiskCustomers: customerConcentration > 30 ? [{
            name: topCustomer?.customerName || "Top Customer",
            risk: `Represents ${customerConcentration.toFixed(0)}% of revenue, ${this.daysSinceLastTransaction(topCustomer)} days since last payment`,
            impact: `$${(topCustomer?.revenue || 0).toLocaleString()} at risk (${customerConcentration.toFixed(0)}% of total revenue)`
          }] : [],
          expansionOpportunities: context.customerTransactions.slice(1, 3).map((customer: any) => ({
            name: customer.customerName,
            opportunity: `${customer.frequency} payer with consistent usage pattern, potential for upgrade`,
            potential: Math.round(customer.revenue * 0.3) // 30% expansion potential
          }))
        },
        insights: [
          `Revenue concentration: Top customer represents ${customerConcentration.toFixed(0)}% of total revenue`,
          `${context.customerTransactions.length} total customers with avg value of $${(totalRevenue / context.customerTransactions.length).toFixed(0)}`,
          `Customer acquisition trending: ${context.metrics.monthlyGrowthRate > 0.1 ? 'accelerating' : 'needs improvement'}`
        ],
        recommendations: customerConcentration > 40 ? [{
          action: `Immediately engage ${topCustomer?.customerName} for contract extension and expansion discussion`,
          priority: "critical" as const,
          timeline: "This week"
        }] : [{
          action: "Focus on customer diversification to reduce concentration risk",
          priority: "high" as const,
          timeline: "Next 30 days"
        }]
      },

      marketIntelligence: {
        competitivePosition: this.generateMarketPosition(context),
        industryBenchmarks: {
          "Monthly Growth Rate": { 
            value: Math.round(context.metrics.monthlyGrowthRate * 100), 
            percentile: context.metrics.monthlyGrowthRate >= 0.15 ? 85 : 
                       context.metrics.monthlyGrowthRate >= 0.10 ? 65 : 
                       context.metrics.monthlyGrowthRate >= 0.05 ? 40 : 20
          },
          "Customer Efficiency": {
            value: Math.round(context.metrics.totalRevenue / context.metrics.customersCount),
            percentile: (context.metrics.totalRevenue / context.metrics.customersCount) > 2000 ? 80 : 
                       (context.metrics.totalRevenue / context.metrics.customersCount) > 1000 ? 60 : 35
          },
          "Cash Efficiency": {
            value: Math.round(context.metrics.cashEfficiency * 100),
            percentile: context.metrics.cashEfficiency > 0.5 ? 85 : 
                       context.metrics.cashEfficiency > 0.3 ? 60 : 25
          }
        },
        marketTiming: this.assessMarketTiming(context),
        insights: [
          `Your ${context.industryInfo.sector} company is at ${context.industryInfo.stage} stage`,
          `Average customer value of $${(totalRevenue / context.customerTransactions.length).toFixed(0)} indicates ${
            totalRevenue / context.customerTransactions.length > 2000 ? 'enterprise' : 
            totalRevenue / context.customerTransactions.length > 500 ? 'mid-market' : 'SMB'
          } positioning`,
          `Growth rate ${context.metrics.monthlyGrowthRate >= 0.15 ? 'exceeds' : 'trails'} top-quartile companies in your space`
        ]
      },

      investorIntelligence: {
        fundingLandscape: {
          recentDeals: this.generateRecentDeals(context.industryInfo.sector),
          hotInvestors: this.getHotInvestors(context.industryInfo.sector),
          marketSentiment: context.metrics.runwayMonths < 6 ? "neutral" : "bullish"
        },
        readinessAssessment: {
          strengths: this.identifyFundraisingStrengths(context),
          gaps: this.identifyFundraisingGaps(context),
          timeline: this.recommendFundraisingTimeline(context)
        },
        insights: [
          `Your metrics ${this.assessInvestorReadiness(context)} for ${context.industryInfo.stage} fundraising`,
          `Customer concentration ${customerConcentration > 50 ? 'is a major' : customerConcentration > 30 ? 'poses some' : 'presents minimal'} investor concern`,
          `Runway of ${context.metrics.runwayMonths.toFixed(1)} months ${context.metrics.runwayMonths < 6 ? 'requires immediate' : context.metrics.runwayMonths < 12 ? 'suggests near-term' : 'allows strategic'} fundraising approach`
        ]
      },

      executionStrategy: {
        prioritizedActions: this.generatePrioritizedActions(context, customerConcentration),
        featurePriority: this.prioritizeFeatures(context),
        insights: [
          `Team of ${context.teamInfo.size} is ${this.assessTeamSizing(context)} for current revenue stage`,
          `Focus should be on ${customerConcentration > 40 ? 'retention and diversification' : 'growth acceleration'}`,
          `Cash burn efficiency suggests ${context.metrics.cashEfficiency > 0.4 ? 'sustainable' : 'unsustainable'} growth trajectory`
        ]
      }
    };
  }

  private daysSinceLastTransaction(customer: any): number {
    if (!customer?.lastTransaction) return 999;
    return Math.floor((Date.now() - customer.lastTransaction.getTime()) / (1000 * 60 * 60 * 24));
  }

  private generateMarketPosition(context: any): string {
    const growth = context.metrics.monthlyGrowthRate;
    const efficiency = context.metrics.cashEfficiency;
    
    if (growth >= 0.15 && efficiency >= 0.4) {
      return "Strong competitive position - top quartile growth with sustainable unit economics";
    } else if (growth >= 0.10) {
      return "Solid competitive position - good growth trajectory, focus on efficiency improvements";
    } else {
      return "Challenging competitive position - need to accelerate growth and improve efficiency";
    }
  }

  private assessMarketTiming(context: any): string {
    const runway = context.metrics.runwayMonths;
    const growth = context.metrics.monthlyGrowthRate;
    
    if (runway < 6) {
      return "Constrained by timeline - need to move quickly due to runway limitations";
    } else if (growth >= 0.15) {
      return "Favorable timing - strong growth metrics support strategic initiatives";
    } else {
      return "Mixed timing - stable runway but need growth improvement before major moves";
    }
  }

  private generateRecentDeals(sector: string): Array<{ company: string; amount: string; investors: string[] }> {
    const sectorDeals = {
      'B2B SaaS': [
        { company: 'DataFlow Co', amount: '$3.2M Seed', investors: ['Bessemer', 'FirstRound'] },
        { company: 'WorkflowAI', amount: '$8M Series A', investors: ['Sequoia', 'GV'] }
      ],
      'Enterprise B2B': [
        { company: 'EnterpriseTech', amount: '$12M Series A', investors: ['Andreessen', 'Accel'] },
        { company: 'BusinessCore', amount: '$5M Seed', investors: ['Index', 'LocalGlobe'] }
      ]
    };
    
    return sectorDeals[sector as keyof typeof sectorDeals] || sectorDeals['B2B SaaS'];
  }

  private getHotInvestors(sector: string): string[] {
    const investorMap = {
      'B2B SaaS': ['Bessemer Venture Partners', 'OpenView', 'SaaStr Fund', 'Insight Partners'],
      'Enterprise B2B': ['Andreessen Horowitz', 'Sequoia', 'GV', 'NEA'],
      'Consumer/B2C': ['Andreessen Horowitz', 'GV', 'Kleiner Perkins', 'Founders Fund']
    };
    
    return investorMap[sector as keyof typeof investorMap] || investorMap['B2B SaaS'];
  }

  private identifyFundraisingStrengths(context: any): string[] {
    const strengths: string[] = [];
    
    if (context.metrics.monthlyGrowthRate >= 0.10) {
      strengths.push('Double-digit monthly growth rate');
    }
    if (context.metrics.cashEfficiency >= 0.3) {
      strengths.push('Reasonable unit economics and cash efficiency');
    }
    if (context.customerTransactions.length >= 10) {
      strengths.push('Established customer base with proven demand');
    }
    if (context.metrics.mrr > 0) {
      strengths.push('Recurring revenue model with predictable income');
    }
    
    return strengths.length > 0 ? strengths : ['Established product with early traction'];
  }

  private identifyFundraisingGaps(context: any): string[] {
    const gaps: string[] = [];
    
    if (context.metrics.monthlyGrowthRate < 0.15) {
      gaps.push('Growth rate below VC expectations (target: 15%+ monthly)');
    }
    if (context.customerTransactions.length < 20) {
      gaps.push('Limited customer base - need broader market validation');
    }
    if ((context.customerTransactions[0]?.revenue / context.metrics.totalRevenue) > 0.4) {
      gaps.push('High customer concentration risk');
    }
    if (context.metrics.runwayMonths < 8) {
      gaps.push('Limited runway creates fundraising pressure');
    }
    
    return gaps;
  }

  private recommendFundraisingTimeline(context: any): string {
    const runway = context.metrics.runwayMonths;
    const growth = context.metrics.monthlyGrowthRate;
    
    if (runway < 6) {
      return "Immediate fundraising required - start this month";
    } else if (growth >= 0.15 && runway > 8) {
      return "Strong position - can fundraise strategically in 2-3 months";
    } else if (growth < 0.10) {
      return "Improve growth metrics for 2-3 months before fundraising";
    } else {
      return "Begin fundraising preparation now, launch in 6-8 weeks";
    }
  }

  private assessInvestorReadiness(context: any): string {
    const growth = context.metrics.monthlyGrowthRate;
    const customers = context.customerTransactions.length;
    
    if (growth >= 0.15 && customers >= 20) return "align well";
    if (growth >= 0.10 && customers >= 10) return "are competitive";
    return "need improvement";
  }

  private generatePrioritizedActions(context: any, customerConcentration: number) {
    const actions = [];
    
    if (customerConcentration > 40) {
      actions.push({
        action: `Secure renewal/expansion with top customer (${customerConcentration.toFixed(0)}% of revenue)`,
        rationale: "Revenue concentration creates existential risk",
        impact: `Protects $${(context.metrics.totalRevenue * customerConcentration / 100).toFixed(0)} in revenue`,
        effort: "medium" as const,
        timeline: "Next 2 weeks"
      });
    }
    
    if (context.metrics.monthlyGrowthRate < 0.10) {
      actions.push({
        action: "Implement growth acceleration program (referrals, upsells, new acquisition)",
        rationale: "Growth rate below investor expectations impacts all strategic options",
        impact: "Target 15%+ monthly growth within 90 days",
        effort: "high" as const,
        timeline: "Start immediately"
      });
    }
    
    if (context.metrics.runwayMonths < 8) {
      actions.push({
        action: "Optimize cash burn while maintaining growth investments",
        rationale: "Limited runway constrains strategic flexibility",
        impact: `Extend runway by ${Math.round(context.metrics.runwayMonths * 0.2)} months`,
        effort: "medium" as const,
        timeline: "Next 30 days"
      });
    }
    
    return actions;
  }

  private prioritizeFeatures(context: any) {
    const features = [];
    
    if ((context.customerTransactions[0]?.revenue / context.metrics.totalRevenue) > 0.3) {
      features.push({
        feature: "Enterprise customer success dashboard",
        reason: "Critical for retaining largest revenue source",
        impact: 95
      });
    }
    
    features.push({
      feature: "Customer referral system",
      reason: "Lowest cost acquisition channel for proven product-market fit",
      impact: 80
    });
    
    if (context.customerTransactions.length < 20) {
      features.push({
        feature: "Self-service onboarding flow",
        reason: "Reduce friction for new customer acquisition",
        impact: 70
      });
    }
    
    return features;
  }

  private assessTeamSizing(context: any): string {
    const revenuePerEmployee = context.metrics.totalRevenue / context.teamInfo.size;
    
    if (revenuePerEmployee > 50000) return "efficiently sized";
    if (revenuePerEmployee > 20000) return "appropriately sized";
    return "potentially oversized for current revenue";
  }

  private async synthesizeExecutiveInsights(runway: any, baseline: any, ai: BusinessIntelligenceReport, context: any) {
    // Combine runway intelligence with AI insights for strategic decisions
    const criticalDecisions = [];
    const strategicPriorities = [];
    const riskMitigation = [];

    // Critical decision: Fundraising vs cost cutting
    if (runway.baseCase.runwayMonths < 8) {
      criticalDecisions.push({
        decision: "Immediate fundraising vs cost optimization strategy",
        context: `${runway.baseCase.runwayMonths.toFixed(1)} months runway with current burn rate`,
        options: [
          {
            option: "Emergency fundraising",
            pros: ["Maintains growth trajectory", "Preserves team"],
            cons: ["Weaker negotiating position", "Valuation pressure"],
            impact: "High dilution but survival"
          },
          {
            option: "Cost optimization first",
            pros: ["Extends runway 2-3 months", "Stronger fundraising position"],
            cons: ["May slow growth", "Team morale impact"],
            impact: "Better fundraising terms but growth risk"
          }
        ],
        recommendation: ai.investorIntelligence.readinessAssessment.timeline.includes('Immediate') ? 
          "Emergency fundraising" : "Cost optimization first",
        timeline: "Decision needed this week"
      });
    }

    // Strategic priority: Growth vs efficiency
    strategicPriorities.push({
      priority: context.metrics.monthlyGrowthRate < 0.10 ? "Growth Acceleration" : "Operational Excellence",
      rationale: context.metrics.monthlyGrowthRate < 0.10 ? 
        "Below-market growth rate limits strategic options" :
        "Strong growth foundation, optimize for sustainability",
      metrics: ["Monthly growth rate", "Customer acquisition cost", "Customer lifetime value"],
      timeline: "Next 90 days",
      success: context.metrics.monthlyGrowthRate < 0.10 ? "15%+ monthly growth" : "Maintain >10% growth with improved efficiency"
    });

    // Risk mitigation for top business risks
    const customerRisk = ai.customerIntelligence.riskAssessment.highRiskCustomers[0];
    if (customerRisk) {
      riskMitigation.push({
        risk: `Customer concentration - ${customerRisk.name} represents large portion of revenue`,
        probability: 70,
        impact: customerRisk.impact,
        mitigation: [
          "Immediate renewal/expansion discussion",
          "Diversification strategy for new customer acquisition",
          "Product development focused on retention"
        ],
        timeline: "Next 2 weeks"
      });
    }

    return {
      criticalDecisions,
      strategicPriorities,
      riskMitigation
    };
  }

  private generateExecutiveUpdate(baseline: any, ai: BusinessIntelligenceReport, insights: any): string {
    return `# Executive Weekly Intelligence Brief
${format(new Date(), 'MMMM do, yyyy')}

## 🎯 EXECUTIVE DECISION REQUIRED
${insights.criticalDecisions.map((decision: any) => `
**${decision.decision}**
Context: ${decision.context}
Recommendation: **${decision.recommendation}**
Timeline: ${decision.timeline}
`).join('\n')}

## 🔍 AI-POWERED BUSINESS INTELLIGENCE

### Customer Intelligence
${ai.customerIntelligence.insights.map((insight: string) => `• ${insight}`).join('\n')}

**High-Risk Customers:**
${ai.customerIntelligence.riskAssessment.highRiskCustomers.map(c => `• ${c.name}: ${c.risk}`).join('\n')}

### Market Position
${ai.marketIntelligence.insights.map((insight: string) => `• ${insight}`).join('\n')}

### Investment Climate
${ai.investorIntelligence.insights.map((insight: string) => `• ${insight}`).join('\n')}

## 🚀 STRATEGIC PRIORITIES
${insights.strategicPriorities.map((priority: any) => `
**${priority.priority}**
${priority.rationale}
Success metric: ${priority.success}
`).join('\n')}

## ⚠️ CRITICAL RISKS & MITIGATION
${insights.riskMitigation.map((risk: any) => `
**${risk.risk}** (${risk.probability}% probability)
Impact: ${risk.impact}
Actions: ${risk.mitigation.slice(0, 2).join(', ')}
`).join('\n')}

## 💡 THIS WEEK'S EXECUTION FOCUS
${ai.executionStrategy.prioritizedActions.slice(0, 3).map((action: any) => `
• **${action.action}**
  Impact: ${action.impact} | Effort: ${action.effort} | Timeline: ${action.timeline}
`).join('\n')}

---
*This intelligence brief combines financial runway analysis with AI-powered business intelligence across customer, market, investor, and execution domains.*`;
  }
}