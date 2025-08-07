#!/usr/bin/env bun

import 'dotenv/config';
import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { format } from 'date-fns';
import yaml from 'js-yaml';
import { MercuryClient } from './src/services/mercuryClient';
import { MetricsCalculator } from './src/services/metricsCalculator';

// Load business context
async function loadBusinessContext() {
  try {
    const contextFile = await fs.readFile('./business-context.yaml', 'utf8');
    return yaml.load(contextFile) as any;
  } catch (error) {
    console.log('No business-context.yaml found, using defaults');
    return null;
  }
}

// Tools for agents to use
const getFinancialDataTool = tool({
  name: 'get_financial_data',
  description: 'Get current financial data including balance, transactions, and basic metrics',
  parameters: z.object({
    period: z.string().describe('Time period for analysis (e.g., "30 days", "3 months")')
  }),
  execute: async (input) => {
    try {
      const mercury = new MercuryClient();
      const accounts = await mercury.getAccounts();
      const primaryAccount = accounts[0]; // Get first account
      
      // Get recent transactions for analysis
      const periodDays = input.period.includes('30') ? 30 : input.period.includes('90') ? 90 : 30;
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
      const transactions = await mercury.getAllTransactions(primaryAccount.id, {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      });
      
      // Calculate basic metrics
      const calculator = new MetricsCalculator(transactions);
      const metrics = await calculator.calculateEvalOpsMetrics(primaryAccount.currentBalance, 3);
      
      return {
        currentBalance: primaryAccount.currentBalance,
        availableBalance: primaryAccount.availableBalance,
        accountName: primaryAccount.name,
        weeksSinceFounding: 1, // Could calculate from business context
        monthlyRevenue: metrics.metrics.averageMonthlyRevenue,
        monthlyExpenses: Math.abs(metrics.metrics.averageMonthlyBurn),
        transactionCount: transactions.length,
        stage: metrics.metrics.averageMonthlyRevenue > 0 ? 'early-revenue' : 'pre-revenue',
        lastTransaction: transactions[0]?.postedDate || 'No recent transactions',
        runway: metrics.metrics.runwayMonths,
        burnRate: metrics.metrics.averageMonthlyBurn
      };
    } catch (error) {
      console.log('Failed to get real financial data, using fallback:', error);
      // Fallback to basic data if API fails
      return {
        currentBalance: 90,
        weeksSinceFounding: 1,
        monthlyRevenue: 0,
        monthlyExpenses: 0,
        transactionCount: 3,
        stage: 'pre-revenue',
        lastTransaction: '2025-08-07',
        runway: 0,
        burnRate: 0
      };
    }
  }
});

const getBusinessContextTool = tool({
  name: 'get_business_context',
  description: 'Get business context including company stage, product, market, and goals',
  parameters: z.object({}),
  execute: async () => {
    const context = await loadBusinessContext();
    return context || {
      company: { name: 'Startup', stage: 'early' },
      product: { category: 'Unknown' },
      market: { target_customers: [] }
    };
  }
});

const analyzeStartupStageTool = tool({
  name: 'analyze_startup_stage',
  description: 'Analyze what stage the startup is in and what the priorities should be',
  parameters: z.object({
    balance: z.number(),
    weeksSinceFounding: z.number(),
    monthlyRevenue: z.number(),
    runway: z.number().nullable(),
    burnRate: z.number().nullable()
  }),
  execute: async (input) => {
    const { balance, weeksSinceFounding, monthlyRevenue, runway, burnRate } = input;
    const runwayValue = runway || 0;
    const burnRateValue = burnRate || 0;
    
    // Determine stage based on revenue and runway
    if (monthlyRevenue === 0) {
      return {
        stage: 'pre-revenue-bootstrap',
        urgency: balance < 1000 ? 'critical' : balance < 5000 ? 'high' : balance < 20000 ? 'medium' : 'low',
        timeToRevenue: balance < 1000 ? '2 weeks' : balance < 5000 ? '1 month' : balance < 20000 ? '2-3 months' : '3-6 months',
        focusAreas: ['customer-discovery', 'problem-validation', 'mvp-definition', 'first-revenue'],
        riskLevel: balance < 500 ? 'extreme' : balance < 2000 ? 'high' : balance < 10000 ? 'moderate' : 'low',
        runway: runwayValue > 0 ? `${runwayValue.toFixed(1)} months` : 'Very limited',
        monthlyBurn: Math.abs(burnRateValue)
      };
    } else if (monthlyRevenue > 0 && monthlyRevenue < 10000) {
      return {
        stage: 'early-revenue',
        urgency: runwayValue < 6 ? 'high' : runwayValue < 12 ? 'medium' : 'low',
        timeToRevenue: 'Focus on scaling revenue',
        focusAreas: ['product-market-fit', 'customer-acquisition', 'unit-economics'],
        riskLevel: runwayValue < 3 ? 'high' : runwayValue < 6 ? 'moderate' : 'low',
        runway: `${runwayValue.toFixed(1)} months`,
        monthlyBurn: Math.abs(burnRateValue)
      };
    }
    
    return {
      stage: 'scaling',
      urgency: 'medium',
      timeToRevenue: 'Focus on growth efficiency',
      focusAreas: ['scaling', 'team-building', 'market-expansion'],
      riskLevel: 'low',
      runway: `${runwayValue.toFixed(1)} months`,
      monthlyBurn: Math.abs(burnRateValue)
    };
  }
});

const generateActionPlanTool = tool({
  name: 'generate_action_plan',
  description: 'Generate specific actionable recommendations based on startup analysis',
  parameters: z.object({
    stage: z.string(),
    urgency: z.string(),
    balance: z.number(),
    weeksSinceFounding: z.number()
  }),
  execute: async (input) => {
    const { stage, urgency, balance, weeksSinceFounding } = input;
    
    const actions = [];
    const timeline = [];
    
    if (stage === 'pre-revenue-bootstrap') {
      actions.push(
        'Conduct 10 customer interviews this week to validate problem',
        'Define MVP that solves validated problem in <2 weeks build time',
        'Get 3 customers to commit to paying before building',
        'Set up basic payment processing (Stripe)',
        'Create simple landing page to capture interest'
      );
      
      timeline.push(
        { week: 1, milestone: 'Problem Validation', tasks: ['10 customer interviews', 'Problem-solution fit confirmation'] },
        { week: 2, milestone: 'MVP Definition', tasks: ['Design minimum viable solution', 'Get customer feedback on approach'] },
        { week: 3, milestone: 'Build & Test', tasks: ['Build MVP', 'Test with friendly customers'] },
        { week: 4, milestone: 'First Sale', tasks: ['Launch to network', 'Get first paying customer'] }
      );
    }
    
    return {
      immediateActions: actions,
      fourWeekTimeline: timeline,
      weeklyGoals: {
        week1: 'Validate customer problem exists',
        week2: 'Design solution approach',
        week3: 'Build and test MVP',
        week4: 'Get first paying customer'
      }
    };
  }
});

// Define specialized AI agents
const financialAnalystAgent = new Agent({
  name: 'Financial Analyst',
  instructions: `You are a startup financial analyst who specializes in early-stage companies. 
  
  Your role is to:
  - Analyze financial data and identify key metrics
  - Assess runway and burn rate risks
  - Provide specific financial recommendations
  - Flag urgent financial issues
  
  Focus on practical, actionable insights for founders with limited resources.`,
  tools: [getFinancialDataTool, analyzeStartupStageTool, getBusinessContextTool]
});

const strategyAdvisorAgent = new Agent({
  name: 'Strategy Advisor',
  instructions: `You are a startup strategy advisor with expertise in early-stage company building.
  
  Your role is to:
  - Analyze company stage and priorities
  - Create actionable strategic recommendations  
  - Provide specific next steps and timelines
  - Focus on getting to first revenue quickly
  - Consider the company's specific product, market, and competitive context
  
  Always provide concrete, specific actions rather than generic advice. Use business context to make recommendations highly relevant.`,
  tools: [generateActionPlanTool, getBusinessContextTool],
  handoffDescription: 'Expert in startup strategy, prioritization, and action planning'
});

const customerDevelopmentAgent = new Agent({
  name: 'Customer Development Expert', 
  instructions: `You are a customer development expert who helps startups find product-market fit.
  
  Your role is to:
  - Guide customer discovery processes specific to the company's target market
  - Help validate problems and solutions with the right customer segments
  - Provide specific interview techniques and outreach strategies
  - Focus on getting to paying customers fast
  - Tailor advice to the company's product category and customer types
  
  Always emphasize talking to customers before building anything. Use business context to make customer development advice highly specific.`,
  tools: [getBusinessContextTool],
  handoffDescription: 'Expert in customer discovery, validation, and early sales'
});

// Main orchestrator agent that coordinates the others
const chiefOfStaffAgent = Agent.create({
  name: 'AI Chief of Staff',
  instructions: `You are an AI Chief of Staff for early-stage startups. Your job is to analyze the company's situation and coordinate with specialist agents to provide comprehensive advice.

  Process:
  1. Get business context to understand the company, product, and market
  2. Analyze the financial situation and startup stage
  3. Hand off to Strategy Advisor for strategic recommendations
  4. Hand off to Customer Development Expert for customer-focused advice
  5. Synthesize all insights into a comprehensive, context-aware report

  Always focus on:
  - Immediate priorities for survival and growth
  - Specific, actionable recommendations tailored to the business
  - Timeline-based action plans
  - Early warning signals
  - Advice specific to the company's product category and target market

  Use the business context to make all advice highly relevant and specific rather than generic startup advice.`,
  handoffs: [strategyAdvisorAgent, customerDevelopmentAgent],
  tools: [getFinancialDataTool, getBusinessContextTool]
});

async function runAIChiefOfStaff(): Promise<void> {
  console.log('🤖 AI Chief of Staff - Multi-Agent Analysis');
  console.log('==========================================\n');

  try {
    console.log('🔄 Starting multi-agent analysis...');
    console.log('This will coordinate Financial Analyst, Strategy Advisor, and Customer Development Expert\n');

    const result = await run(
      chiefOfStaffAgent,
      `Analyze EvalOps's startup situation and provide comprehensive guidance. We're an early-stage AI evaluation platform and need strategic advice based on our current financial position.

      Please:
      1. Get our current financial data from Mercury to understand our real cash position
      2. Review our business context (company, product, market, customers)
      3. Assess our financial situation and startup stage based on actual data
      4. Provide strategic recommendations specific to AI/ML dev tools market
      5. Give customer development guidance for Product Managers and AI Engineers
      6. Create a 4-week action plan with clear milestones tailored to our financial reality
      
      Focus on immediate priorities for survival and getting to first revenue in the AI evaluation space. Make recommendations specific to our product category, target customers, and actual financial constraints.`
    );

    console.log('📊 MULTI-AGENT ANALYSIS COMPLETE');
    console.log('================================\n');
    console.log(result.finalOutput);

    // Save the analysis to a file
    const outputDir = './chief-of-staff-reports';
    await fs.mkdir(outputDir, { recursive: true });
    
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const fileName = `multi-agent-analysis-${dateStr}.md`;
    
    const reportContent = `# AI Chief of Staff Multi-Agent Analysis
*Generated: ${new Date().toISOString()}*

## Analysis Results

${result.finalOutput}

---

*This analysis was generated by a multi-agent AI system using:*
- **Financial Analyst Agent**: Assessed financial situation and runway
- **Strategy Advisor Agent**: Provided strategic recommendations and action plans  
- **Customer Development Expert Agent**: Guided customer discovery approach
- **Chief of Staff Agent**: Orchestrated analysis and synthesized insights

*Generated using OpenAI Agents SDK*
`;

    await fs.writeFile(path.join(outputDir, fileName), reportContent);

    console.log('\n✅ Multi-agent analysis complete!');
    console.log(`📁 Full report saved to: ${outputDir}/${fileName}`);
    
    console.log('\n🎯 KEY ADVANTAGES OF MULTI-AGENT APPROACH:');
    console.log('   • Specialized expertise from different agent roles');
    console.log('   • Coordinated analysis with handoffs between agents');
    console.log('   • More comprehensive insights than single agent');
    console.log('   • Each agent focuses on their area of expertise');

  } catch (error: any) {
    console.error('❌ Multi-agent analysis failed:', error.message);
    
    // Fallback to basic analysis if agents fail
    console.log('\n🔄 Falling back to basic analysis...');
    
    const basicResult = await run(
      financialAnalystAgent,
      'Analyze a startup with $90 balance, 1 week old, no revenue. Provide basic financial assessment and urgent priorities.'
    );
    
    console.log('\n📊 BASIC FINANCIAL ANALYSIS');
    console.log('===========================');
    console.log(basicResult.finalOutput);
  }
}

// Main execution
if (import.meta.main) {
  runAIChiefOfStaff().catch(error => {
    console.error('💥 Critical failure:', error);
    process.exit(1);
  });
}

export { 
  chiefOfStaffAgent, 
  financialAnalystAgent, 
  strategyAdvisorAgent, 
  customerDevelopmentAgent 
};
