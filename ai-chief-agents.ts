#!/usr/bin/env bun

import 'dotenv/config';
import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { format } from 'date-fns';

// Tools for agents to use
const getFinancialDataTool = tool({
  name: 'get_financial_data',
  description: 'Get current financial data including balance, transactions, and basic metrics',
  parameters: z.object({
    period: z.string().describe('Time period for analysis (e.g., "30 days", "3 months")')
  }),
  execute: async (input) => {
    // In real implementation, this would fetch from your existing data collectors
    return {
      currentBalance: 90,
      weeksSinceFounding: 1,
      monthlyRevenue: 0,
      monthlyExpenses: 0,
      transactionCount: 3,
      stage: 'pre-revenue',
      lastTransaction: '2025-08-07'
    };
  }
});

const analyzeStartupStageTool = tool({
  name: 'analyze_startup_stage',
  description: 'Analyze what stage the startup is in and what the priorities should be',
  parameters: z.object({
    balance: z.number(),
    weeksSinceFounding: z.number(),
    monthlyRevenue: z.number()
  }),
  execute: async (input) => {
    const { balance, weeksSinceFounding, monthlyRevenue } = input;
    
    if (monthlyRevenue === 0 && weeksSinceFounding <= 8) {
      return {
        stage: 'pre-revenue-bootstrap',
        urgency: balance < 1000 ? 'critical' : balance < 5000 ? 'high' : 'medium',
        timeToRevenue: balance < 1000 ? '2 weeks' : balance < 5000 ? '1 month' : '2-3 months',
        focusAreas: ['customer-discovery', 'problem-validation', 'mvp-definition'],
        riskLevel: balance < 500 ? 'extreme' : balance < 2000 ? 'high' : 'moderate'
      };
    }
    
    return {
      stage: 'unknown',
      urgency: 'medium',
      timeToRevenue: 'unknown',
      focusAreas: ['assess-current-state'],
      riskLevel: 'unknown'
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
  tools: [getFinancialDataTool, analyzeStartupStageTool]
});

const strategyAdvisorAgent = new Agent({
  name: 'Strategy Advisor',
  instructions: `You are a startup strategy advisor with expertise in early-stage company building.
  
  Your role is to:
  - Analyze company stage and priorities
  - Create actionable strategic recommendations
  - Provide specific next steps and timelines
  - Focus on getting to first revenue quickly
  
  Always provide concrete, specific actions rather than generic advice.`,
  tools: [generateActionPlanTool],
  handoffDescription: 'Expert in startup strategy, prioritization, and action planning'
});

const customerDevelopmentAgent = new Agent({
  name: 'Customer Development Expert',
  instructions: `You are a customer development expert who helps startups find product-market fit.
  
  Your role is to:
  - Guide customer discovery processes
  - Help validate problems and solutions
  - Provide specific interview techniques
  - Focus on getting to paying customers fast
  
  Always emphasize talking to customers before building anything.`,
  handoffDescription: 'Expert in customer discovery, validation, and early sales'
});

// Main orchestrator agent that coordinates the others
const chiefOfStaffAgent = Agent.create({
  name: 'AI Chief of Staff',
  instructions: `You are an AI Chief of Staff for early-stage startups. Your job is to analyze the company's situation and coordinate with specialist agents to provide comprehensive advice.

  Process:
  1. First, analyze the financial situation and startup stage
  2. Hand off to Strategy Advisor for strategic recommendations
  3. Hand off to Customer Development Expert for customer-focused advice
  4. Synthesize all insights into a comprehensive report

  Always focus on:
  - Immediate priorities for survival and growth
  - Specific, actionable recommendations
  - Timeline-based action plans
  - Early warning signals

  For pre-revenue startups, emphasize speed to first customer and revenue.`,
  handoffs: [strategyAdvisorAgent, customerDevelopmentAgent],
  tools: [getFinancialDataTool]
});

async function runAIChiefOfStaff(): Promise<void> {
  console.log('🤖 AI Chief of Staff - Multi-Agent Analysis');
  console.log('==========================================\n');

  try {
    console.log('🔄 Starting multi-agent analysis...');
    console.log('This will coordinate Financial Analyst, Strategy Advisor, and Customer Development Expert\n');

    const result = await run(
      chiefOfStaffAgent,
      `Analyze our startup situation and provide comprehensive guidance. We're a week-old company with $90 in the bank, no revenue yet, and need strategic advice on next steps.

      Please:
      1. Assess our financial situation and startup stage
      2. Provide strategic recommendations with specific actions
      3. Give customer development guidance
      4. Create a 4-week action plan with clear milestones
      
      Focus on immediate priorities for survival and getting to first revenue.`
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
