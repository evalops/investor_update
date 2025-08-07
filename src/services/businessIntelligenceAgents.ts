import { Agent, Task, Crew } from 'crewai';
import OpenAI from 'openai';
import { StartupMetrics } from './metricsCalculator';
import { RunwayPrediction } from './runwayIntelligence';
import { Logger } from '../utils/logger';

const logger = Logger.for('BusinessIntelligence');

export interface BusinessContext {
  // Financial data
  metrics: StartupMetrics;
  runway: RunwayPrediction;
  
  // Customer data
  customerTransactions: Array<{
    customerName: string;
    revenue: number;
    frequency: 'one-time' | 'monthly' | 'quarterly' | 'annual';
    firstTransaction: Date;
    lastTransaction: Date;
    totalTransactions: number;
  }>;
  
  // Market data
  industryInfo: {
    sector: string;
    stage: 'pre-seed' | 'seed' | 'series-a' | 'series-b+';
    competitors: string[];
    marketSize: string;
  };
  
  // Product data
  productMetrics?: {
    features: string[];
    usage: Record<string, number>;
    feedback: string[];
  };
  
  // Team data
  teamInfo: {
    size: number;
    roles: string[];
    recentHires: Array<{ role: string; date: Date; cost: number }>;
  };
}

export interface BusinessIntelligenceReport {
  customerIntelligence: {
    riskAssessment: {
      highRiskCustomers: Array<{ name: string; risk: string; impact: string }>;
      expansionOpportunities: Array<{ name: string; opportunity: string; potential: number }>;
    };
    insights: string[];
    recommendations: Array<{ action: string; priority: 'critical' | 'high' | 'medium'; timeline: string }>;
  };
  
  marketIntelligence: {
    competitivePosition: string;
    industryBenchmarks: Record<string, { value: number; percentile: number }>;
    marketTiming: string;
    insights: string[];
  };
  
  investorIntelligence: {
    fundingLandscape: {
      recentDeals: Array<{ company: string; amount: string; investors: string[] }>;
      hotInvestors: string[];
      marketSentiment: 'bullish' | 'bearish' | 'neutral';
    };
    readinessAssessment: {
      strengths: string[];
      gaps: string[];
      timeline: string;
    };
    insights: string[];
  };
  
  executionStrategy: {
    prioritizedActions: Array<{
      action: string;
      rationale: string;
      impact: string;
      effort: 'low' | 'medium' | 'high';
      timeline: string;
    }>;
    featurePriority: Array<{ feature: string; reason: string; impact: number }>;
    insights: string[];
  };
}

export class BusinessIntelligenceAgents {
  private openai: OpenAI;
  private context: BusinessContext;

  constructor(context: BusinessContext) {
    this.context = context;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async generateBusinessIntelligence(): Promise<BusinessIntelligenceReport> {
    logger.info('Starting multi-agent business intelligence analysis');

    // Create specialized agents
    const customerAgent = this.createCustomerIntelligenceAgent();
    const marketAgent = this.createMarketIntelligenceAgent();
    const investorAgent = this.createInvestorIntelligenceAgent();
    const executionAgent = this.createExecutionStrategyAgent();

    // Create tasks for each agent
    const customerTask = this.createCustomerAnalysisTask();
    const marketTask = this.createMarketAnalysisTask();
    const investorTask = this.createInvestorAnalysisTask();
    const executionTask = this.createExecutionStrategyTask();

    // Create crew and run analysis
    const crew = new Crew({
      agents: [customerAgent, marketAgent, investorAgent, executionAgent],
      tasks: [customerTask, marketTask, investorTask, executionTask],
      verbose: process.env.NODE_ENV === 'development'
    });

    const results = await crew.kickoff();
    
    return this.parseResults(results);
  }

  private createCustomerIntelligenceAgent(): Agent {
    const customerData = this.formatCustomerData();
    
    return new Agent({
      role: 'Customer Intelligence Analyst',
      goal: 'Provide deep customer insights including churn risk, expansion opportunities, and revenue concentration analysis',
      backstory: `You are a senior customer success analyst with 10+ years experience at high-growth SaaS companies. 
                 You specialize in identifying customer health signals, predicting churn, and finding expansion opportunities.
                 You have deep expertise in customer lifetime value, revenue concentration risk, and usage patterns.`,
      tools: [], // We'll use OpenAI directly for now
      verbose: true,
      allowDelegation: false,
      context: customerData
    });
  }

  private createMarketIntelligenceAgent(): Agent {
    const marketData = this.formatMarketData();
    
    return new Agent({
      role: 'Market Intelligence Analyst',
      goal: 'Analyze competitive landscape, industry benchmarks, and market timing for strategic positioning',
      backstory: `You are a senior market research analyst with expertise in startup ecosystems and competitive intelligence. 
                 You have 8+ years experience analyzing market trends, competitive positioning, and industry benchmarks.
                 You specialize in early-stage company positioning and market timing analysis.`,
      tools: [],
      verbose: true,
      allowDelegation: false,
      context: marketData
    });
  }

  private createInvestorIntelligenceAgent(): Agent {
    const financialData = this.formatFinancialData();
    
    return new Agent({
      role: 'Investor Intelligence Analyst',
      goal: 'Assess fundraising readiness, analyze funding landscape, and provide investor strategy recommendations',
      backstory: `You are a former venture capitalist turned advisor with 12+ years in startup financing. 
                 You have invested in 50+ startups and understand exactly what investors look for at each stage.
                 You specialize in funding strategy, investor relations, and fundraising timing.`,
      tools: [],
      verbose: true,
      allowDelegation: false,
      context: financialData
    });
  }

  private createExecutionStrategyAgent(): Agent {
    const executionData = this.formatExecutionData();
    
    return new Agent({
      role: 'Execution Strategy Advisor',
      goal: 'Provide specific, actionable recommendations for product, growth, and operational priorities',
      backstory: `You are a former startup CEO and operator with 15+ years building and scaling companies. 
                 You have taken 3 companies from seed to Series A and understand execution at every stage.
                 You specialize in prioritization, resource allocation, and tactical execution strategies.`,
      tools: [],
      verbose: true,
      allowDelegation: false,
      context: executionData
    });
  }

  private createCustomerAnalysisTask(): Task {
    return new Task({
      description: `Analyze customer data and provide intelligence on:
        1. Customer health and churn risk assessment
        2. Revenue concentration analysis (which customers represent what % of revenue)
        3. Expansion opportunities within existing customer base
        4. Customer lifecycle insights and patterns
        5. Specific recommendations for customer success and retention
        
        Use the provided customer transaction data, revenue patterns, and business metrics.
        Focus on actionable insights that can directly impact revenue and reduce risk.`,
      expectedOutput: `JSON object with customer intelligence including:
        - High-risk customers with specific risk factors and mitigation strategies
        - Top expansion opportunities with estimated potential revenue
        - Customer concentration analysis with risk assessment
        - Specific actionable recommendations with priorities and timelines`
    });
  }

  private createMarketAnalysisTask(): Task {
    return new Task({
      description: `Analyze market positioning and competitive landscape:
        1. Assess competitive position based on growth metrics and market stage
        2. Benchmark performance against industry standards
        3. Analyze market timing and funding environment
        4. Identify market opportunities and threats
        5. Provide strategic positioning recommendations
        
        Use provided business metrics, growth rates, and industry context.
        Focus on strategic insights that inform positioning and growth strategy.`,
      expectedOutput: `JSON object with market intelligence including:
        - Competitive positioning analysis with specific comparisons
        - Industry benchmark comparisons with percentile rankings
        - Market timing assessment for current strategy
        - Strategic recommendations for market positioning`
    });
  }

  private createInvestorAnalysisTask(): Task {
    return new Task({
      description: `Assess fundraising readiness and investor strategy:
        1. Evaluate current metrics against investor expectations
        2. Assess funding landscape and market sentiment
        3. Identify fundraising strengths and gaps
        4. Recommend fundraising timing and strategy
        5. Suggest specific metrics to improve before fundraising
        
        Use financial metrics, runway analysis, and growth data.
        Focus on practical fundraising advice and investor positioning.`,
      expectedOutput: `JSON object with investor intelligence including:
        - Fundraising readiness assessment with specific strengths and gaps
        - Recommended fundraising timeline with key milestones
        - Investor market analysis and targeting strategy
        - Specific metrics to improve with priorities and impact`
    });
  }

  private createExecutionStrategyTask(): Task {
    return new Task({
      description: `Provide specific execution strategy and prioritization:
        1. Analyze resource allocation and identify highest-impact activities
        2. Prioritize product features and growth initiatives
        3. Recommend operational improvements and cost optimizations
        4. Suggest team and hiring priorities
        5. Create tactical action plan with specific timelines
        
        Use all available business data, team information, and market context.
        Focus on specific, actionable recommendations that maximize ROI.`,
      expectedOutput: `JSON object with execution strategy including:
        - Prioritized action plan with specific tasks and timelines
        - Feature development priorities with business rationale
        - Resource allocation recommendations
        - Tactical growth initiatives with expected impact`
    });
  }

  private formatCustomerData(): string {
    const customers = this.context.customerTransactions;
    const metrics = this.context.metrics;
    
    return `CUSTOMER INTELLIGENCE DATA:
      
    Revenue Metrics:
    - Total Revenue: $${metrics.totalRevenue.toLocaleString()}
    - MRR: $${metrics.mrr.toLocaleString()}
    - Customer Count: ${metrics.customersCount}
    - Average Revenue per Customer: $${(metrics.totalRevenue / metrics.customersCount).toFixed(0)}
    
    Customer Transaction Patterns:
    ${customers.map(c => `
    - ${c.customerName}: $${c.revenue.toLocaleString()} (${c.frequency}, ${c.totalTransactions} transactions)
      First: ${c.firstTransaction.toDateString()}, Last: ${c.lastTransaction.toDateString()}
    `).join('')}
    
    Revenue Trends:
    ${metrics.monthlyMetrics.map(m => `
    - ${m.month}: $${m.revenue.toLocaleString()} revenue, ${m.transactionCount} transactions
    `).join('')}`;
  }

  private formatMarketData(): string {
    const metrics = this.context.metrics;
    const industry = this.context.industryInfo;
    
    return `MARKET INTELLIGENCE DATA:
    
    Company Performance:
    - Growth Rate: ${(metrics.monthlyGrowthRate * 100).toFixed(1)}% monthly
    - YC Growth Score: ${metrics.ycGrowthScore}/10
    - Cash Efficiency: ${(metrics.cashEfficiency * 100).toFixed(0)}%
    - Runway: ${metrics.runwayMonths.toFixed(1)} months
    
    Industry Context:
    - Sector: ${industry.sector}
    - Stage: ${industry.stage}
    - Market Size: ${industry.marketSize}
    - Key Competitors: ${industry.competitors.join(', ')}
    
    Historical Performance:
    ${metrics.monthlyMetrics.map(m => `
    - ${m.month}: $${m.revenue.toLocaleString()} revenue, ${((m.revenue / (m.revenue + Math.abs(m.netBurn))) * 100).toFixed(0)}% efficiency
    `).join('')}`;
  }

  private formatFinancialData(): string {
    const metrics = this.context.metrics;
    const runway = this.context.runway;
    
    return `INVESTOR INTELLIGENCE DATA:
    
    Financial Health:
    - Current Balance: $${metrics.currentBalance.toLocaleString()}
    - Monthly Burn: $${Math.abs(metrics.averageMonthlyBurn).toLocaleString()}
    - Monthly Revenue: $${metrics.averageMonthlyRevenue.toLocaleString()}
    - Runway: ${runway.baseCase.runwayMonths.toFixed(1)} months
    
    Growth Metrics:
    - Monthly Growth: ${(metrics.monthlyGrowthRate * 100).toFixed(1)}%
    - Revenue Growth Rate: ${(metrics.revenueGrowthRate * 100).toFixed(1)}%
    - YC Growth Score: ${metrics.ycGrowthScore}/10
    
    Runway Scenarios:
    ${runway.scenarios.map(s => `
    - ${s.scenario.name}: ${s.runwayMonths.toFixed(1)} months
    `).join('')}
    
    Key Recommendations from Financial Analysis:
    ${runway.recommendations.map(r => `
    - ${r.title} (${r.priority}): ${r.impact}
    `).join('')}`;
  }

  private formatExecutionData(): string {
    const metrics = this.context.metrics;
    const team = this.context.teamInfo;
    const product = this.context.productMetrics;
    
    return `EXECUTION STRATEGY DATA:
    
    Current State:
    - Team Size: ${team.size}
    - Key Roles: ${team.roles.join(', ')}
    - Monthly Burn: $${Math.abs(metrics.averageMonthlyBurn).toLocaleString()}
    - Customer Count: ${metrics.customersCount}
    
    Recent Team Changes:
    ${team.recentHires.map(h => `
    - Hired ${h.role} on ${h.date.toDateString()} at $${h.cost.toLocaleString()}/month
    `).join('')}
    
    Product Context:
    ${product ? `
    - Features: ${product.features.join(', ')}
    - Usage Patterns: ${Object.entries(product.usage).map(([k,v]) => `${k}: ${v}`).join(', ')}
    - Recent Feedback: ${product.feedback.join('; ')}
    ` : 'Limited product data available'}
    
    Resource Allocation:
    - Burn Breakdown: Payroll ~70%, Other ~30%
    - Customer Acquisition Cost: ~$${(metrics.averageMonthlyBurn / (metrics.customersCount / 6)).toFixed(0)} per customer
    - Revenue per Employee: $${(metrics.totalRevenue / team.size).toFixed(0)}`;
  }

  private async parseResults(results: any): Promise<BusinessIntelligenceReport> {
    // In a real implementation, we'd parse the structured output from each agent
    // For now, we'll create a mock response that demonstrates the concept
    logger.info('Parsing multi-agent analysis results');
    
    return {
      customerIntelligence: {
        riskAssessment: {
          highRiskCustomers: [
            {
              name: "Enterprise Customer A",
              risk: "Contract expires in 2 months, no recent usage spikes",
              impact: "Represents 40% of total revenue ($9,600/month)"
            }
          ],
          expansionOpportunities: [
            {
              name: "SMB Customer B", 
              opportunity: "Using basic plan but high engagement, ready for upgrade",
              potential: 2400
            }
          ]
        },
        insights: [
          "Revenue concentration risk: Top 2 customers represent 60% of MRR",
          "Customer #1 shows declining usage pattern - immediate intervention needed",
          "3 customers have usage patterns indicating expansion readiness"
        ],
        recommendations: [
          {
            action: "Schedule renewal discussion with Enterprise Customer A immediately",
            priority: "critical",
            timeline: "This week"
          }
        ]
      },
      
      marketIntelligence: {
        competitivePosition: "Growing faster than 70% of similar-stage SaaS companies despite current market conditions",
        industryBenchmarks: {
          "Monthly Growth Rate": { value: 8, percentile: 65 },
          "Customer Count": { value: 12, percentile: 40 },
          "Runway": { value: 5.1, percentile: 20 }
        },
        marketTiming: "Favorable for fundraising - VCs are actively investing in your sector",
        insights: [
          "Your 8% growth rate is actually above median for B2B SaaS in current market",
          "Customer acquisition efficiency is better than 60% of competitors",
          "Market timing favorable - 3 major VCs just raised $500M+ funds focusing on your space"
        ]
      },
      
      investorIntelligence: {
        fundingLandscape: {
          recentDeals: [
            { company: "Similar SaaS Co", amount: "$2M Seed", investors: ["Accel", "LocalGlobe"] },
            { company: "Competitor X", amount: "$5M Series A", investors: ["Sequoia", "Index"] }
          ],
          hotInvestors: ["Bessemer", "OpenView", "SaaStr Fund"],
          marketSentiment: "neutral"
        },
        readinessAssessment: {
          strengths: ["Strong unit economics", "Proven customer retention", "Clear market opportunity"],
          gaps: ["Need 15%+ monthly growth", "Expand customer base to 25+", "Improve cash efficiency"],
          timeline: "Ready for Seed round in 3-4 months with improvements"
        },
        insights: [
          "Your metrics align with successful Seed rounds in current market",
          "Focus on growth rate improvement - that's the #1 investor concern",
          "Customer concentration is a red flag - diversify before fundraising"
        ]
      },
      
      executionStrategy: {
        prioritizedActions: [
          {
            action: "Implement customer health scoring and expand Enterprise Customer A engagement",
            rationale: "Prevents 40% revenue loss and demonstrates retention strength to investors",
            impact: "Protects $115K ARR, improves investor story",
            effort: "medium",
            timeline: "Next 2 weeks"
          },
          {
            action: "Launch referral program targeting existing high-engagement customers",
            rationale: "Lowest-cost customer acquisition channel, proven to work in your segment",
            impact: "3-5 new customers in 60 days, improves growth metrics",
            effort: "low",
            timeline: "Next 30 days"
          }
        ],
        featurePriority: [
          { 
            feature: "Customer health dashboard", 
            reason: "Enables proactive churn prevention and expansion identification",
            impact: 85 
          },
          { 
            feature: "Integration with top customer's workflow tool", 
            reason: "Increases stickiness for largest revenue source",
            impact: 90 
          }
        ],
        insights: [
          "Focus on retention over acquisition until customer concentration improves",
          "Your team is right-sized for current revenue - don't hire until growth accelerates",
          "Product development should focus on enterprise features for top customers"
        ]
      }
    };
  }
}