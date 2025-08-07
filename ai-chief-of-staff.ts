#!/usr/bin/env bun

import { ChiefOfStaffReportGenerator } from './src/services/chiefOfStaffReports';
import { MetricsCalculator } from './src/services/metricsCalculator';
import { MetricsAggregator } from './src/services/metricsAggregator';
import { DataCollectionService } from './src/services/dataCollectionService';
import { StartupValidator } from './src/utils/startupValidator';
import { Logger } from './src/utils/logger';
import { promises as fs } from 'fs';
import path from 'path';
import { format } from 'date-fns';

const logger = Logger.for('AIChiefOfStaff');

interface ChiefOfStaffConfig {
  accountId?: string;
  outputDir: string;
  format: 'weekly-update' | 'executive-summary' | 'board-deck' | 'all';
  alertThreshold: 'low' | 'medium' | 'high' | 'critical';
}

async function parseArgs(): Promise<ChiefOfStaffConfig> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  return {
    accountId: args[0] || process.env.EVALOPS_MERCURY_ACCOUNT_ID,
    outputDir: args[1] || './chief-of-staff-reports',
    format: (args[2] as ChiefOfStaffConfig['format']) || 'all',
    alertThreshold: (args[3] as ChiefOfStaffConfig['alertThreshold']) || 'medium'
  };
}

function printUsage(): void {
  console.log('🤖 AI Chief of Staff for Startups');
  console.log('');
  console.log('Usage:');
  console.log('  bun run ai-chief-of-staff.ts [accountId] [outputDir] [format] [alertThreshold]');
  console.log('');
  console.log('Parameters:');
  console.log('  accountId      - Mercury account ID (default: from .env)');
  console.log('  outputDir      - Output directory (default: ./chief-of-staff-reports)');
  console.log('  format         - Report format: weekly-update, executive-summary, board-deck, all (default: all)');
  console.log('  alertThreshold - Alert sensitivity: low, medium, high, critical (default: medium)');
  console.log('');
  console.log('Examples:');
  console.log('  bun run ai-chief-of-staff.ts');
  console.log('  bun run ai-chief-of-staff.ts "" ./reports weekly-update high');
  console.log('');
  console.log('What your AI Chief of Staff provides:');
  console.log('  📊 Company health score and runway analysis');
  console.log('  🚨 Early warning system for cash flow issues');
  console.log('  📈 Scenario planning (hiring, fundraising, growth)');
  console.log('  🎯 Specific recommendations with action items');
  console.log('  📋 Board-ready metrics and insights');
  console.log('  💡 Fundraising readiness assessment');
}

function formatDisplayValue(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

function getHealthEmoji(score: number): string {
  if (score >= 80) return '🟢';
  if (score >= 60) return '🟡';
  if (score >= 40) return '🟠';
  return '🔴';
}

function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case 'danger': return '🚨';
    case 'warning': return '⚠️';
    case 'watch': return '👀';
    default: return '📋';
  }
}

async function generateChiefOfStaffReports(): Promise<void> {
  const config = await parseArgs();

  console.log('🤖 AI Chief of Staff - Startup Intelligence Engine');
  console.log('================================================');
  console.log(`📊 Account ID: ${config.accountId || 'default'}`);
  console.log(`📁 Output: ${config.outputDir}`);
  console.log(`📄 Format: ${config.format}`);
  console.log(`🚨 Alert Level: ${config.alertThreshold}`);
  console.log('');

  try {
    // Quick system validation
    console.log('🔍 Validating system health...');
    const startupValidator = new StartupValidator();
    const validationResult = await startupValidator.validateAll();
    
    if (validationResult.overall === 'error') {
      console.log('❌ System validation failed! Fix errors before proceeding.');
      process.exit(1);
    }

    // Collect data using our robust pipeline
    console.log('📊 Collecting data from all sources...');
    const dataCollectionService = new DataCollectionService();
    const dataResults = await dataCollectionService.collectAllData(30);
    const dataQuality = dataCollectionService.generateSummary(dataResults);

    // Show data status
    console.log('📈 Data Collection Results:');
    dataResults.forEach(result => {
      const icon = result.status === 'success' ? '✅' : result.status === 'stale' ? '🕐' : '❌';
      console.log(`  ${icon} ${result.source} - ${result.dataAge || 'unknown'}`);
    });

    if (dataQuality.recommendations.length > 0) {
      console.log('\n⚠️ Data Quality Notes:');
      dataQuality.recommendations.forEach(rec => console.log(`   • ${rec}`));
    }

    // Get Mercury data
    const mercuryResult = dataResults.find(r => r.source === 'mercury');
    if (!mercuryResult || mercuryResult.status === 'error') {
      throw new Error('Mercury banking data required for Chief of Staff analysis');
    }

    const { accounts, primaryAccount, transactions } = mercuryResult.data;
    const account = accounts.find((a: any) => a.id === config.accountId) || primaryAccount;

    console.log(`💰 Found ${transactions.length} transactions across ${accounts.length} accounts`);
    console.log(`💵 Current balance: ${formatDisplayValue(account.currentBalance)}`);

    // Calculate comprehensive metrics
    console.log('🧮 Calculating startup metrics...');
    const calculator = new MetricsCalculator(transactions);
    const baseMetrics = await calculator.calculateEvalOpsMetrics(account.currentBalance, 6);

    console.log('🔄 Enriching with additional data sources...');
    const metricsAggregator = new MetricsAggregator();
    const enrichedResult = await metricsAggregator.aggregateMetrics(baseMetrics.metrics, transactions);
    const metrics = enrichedResult.metrics;

    // Generate Chief of Staff intelligence
    console.log('🤖 Generating Chief of Staff intelligence...');
    const chiefOfStaff = new ChiefOfStaffReportGenerator(metrics);
    const intelligence = await chiefOfStaff.generateExecutiveReport();

    // Create output directory
    await fs.mkdir(config.outputDir, { recursive: true });

    // Show executive summary
    console.log('');
    console.log('🎯 EXECUTIVE INTELLIGENCE SUMMARY');
    console.log('==================================');
    console.log(`${getHealthEmoji(intelligence.summary.healthScore)} Company Health: ${intelligence.summary.healthScore}/100`);
    
    if (intelligence.summary.urgentActions.length > 0) {
      console.log('');
      console.log('🚨 URGENT ACTIONS REQUIRED:');
      intelligence.summary.urgentActions.forEach(action => {
        console.log(`   • ${action}`);
      });
    }

    console.log('');
    console.log('🔍 Key Insights:');
    intelligence.summary.keyInsights.forEach(insight => {
      console.log(`   • ${insight}`);
    });

    // Show critical warnings
    const criticalWarnings = intelligence.operations.runway.earlyWarnings.filter(w => 
      w.severity === 'danger' || (w.severity === 'warning' && config.alertThreshold !== 'critical')
    );

    if (criticalWarnings.length > 0) {
      console.log('');
      console.log('⚠️ EARLY WARNINGS:');
      criticalWarnings.forEach(warning => {
        console.log(`   ${getSeverityEmoji(warning.severity)} ${warning.trigger}: ${warning.description}`);
      });
    }

    // Show top recommendations
    const topRecs = intelligence.operations.runway.recommendations
      .filter(r => r.priority === 'critical' || r.priority === 'high')
      .slice(0, 3);

    if (topRecs.length > 0) {
      console.log('');
      console.log('💡 TOP RECOMMENDATIONS:');
      topRecs.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec.title} (${rec.priority})`);
        console.log(`      Impact: ${rec.impact}`);
      });
    }

    // Generate outputs based on format
    const dateStr = format(new Date(), 'yyyy-MM-dd');

    if (config.format === 'weekly-update' || config.format === 'all') {
      console.log('📝 Generating weekly update...');
      await fs.writeFile(
        path.join(config.outputDir, `weekly-update-${dateStr}.md`), 
        intelligence.weeklyUpdate
      );
    }

    if (config.format === 'executive-summary' || config.format === 'all') {
      console.log('📊 Generating executive summary...');
      const summary = JSON.stringify({
        date: new Date().toISOString(),
        healthScore: intelligence.summary.healthScore,
        runway: intelligence.operations.runway.baseCase,
        recommendations: intelligence.operations.runway.recommendations,
        warnings: intelligence.operations.runway.earlyWarnings
      }, null, 2);
      
      await fs.writeFile(
        path.join(config.outputDir, `executive-summary-${dateStr}.json`), 
        summary
      );
    }

    if (config.format === 'board-deck' || config.format === 'all') {
      console.log('📋 Generating board deck data...');
      await fs.writeFile(
        path.join(config.outputDir, `board-deck-data-${dateStr}.md`), 
        intelligence.boardDeck
      );
    }

    // Always generate scenario analysis
    console.log('📈 Generating scenario analysis...');
    const scenarioData = {
      baseCase: intelligence.operations.runway.baseCase,
      scenarios: intelligence.operations.runway.scenarios.map(s => ({
        name: s.scenario.name,
        description: s.scenario.description,
        runwayMonths: s.runwayMonths,
        runwayDate: s.runwayDate
      })),
      generatedAt: new Date().toISOString()
    };
    
    await fs.writeFile(
      path.join(config.outputDir, `runway-scenarios-${dateStr}.json`), 
      JSON.stringify(scenarioData, null, 2)
    );

    console.log('');
    console.log('✅ Chief of Staff reports generated successfully!');
    console.log(`📁 Files saved to: ${config.outputDir}`);
    console.log('');
    
    // Final runway summary
    const runway = intelligence.operations.runway.baseCase;
    console.log('💼 CHIEF OF STAFF RUNWAY BRIEFING');
    console.log('=================================');
    console.log(`Current Runway: ${runway.runwayMonths.toFixed(1)} months (until ${format(runway.runwayDate, 'MMM yyyy')})`);
    console.log(`Confidence Range: ${runway.confidenceInterval.pessimistic.months.toFixed(1)} - ${runway.confidenceInterval.optimistic.months.toFixed(1)} months`);
    console.log(`Fundraising Readiness: ${intelligence.summary.fundraisingReadiness.score}/100 - ${intelligence.summary.fundraisingReadiness.timeline}`);

    if (runway.runwayMonths < 6) {
      console.log('');
      console.log('🚨 IMMEDIATE ACTION REQUIRED: Begin fundraising or cost reduction NOW');
    } else if (runway.runwayMonths < 12) {
      console.log('');
      console.log('⚠️ PLANNING REQUIRED: Prepare fundraising strategy within 2-3 months');
    } else {
      console.log('');
      console.log('✅ HEALTHY RUNWAY: Focus on growth and operational excellence');
    }

  } catch (error: any) {
    console.error('❌ Chief of Staff analysis failed:', error.message);
    logger.error('Analysis failed', error);
    process.exit(1);
  }
}

// Main execution
if (import.meta.main) {
  generateChiefOfStaffReports().catch(error => {
    logger.critical('AI Chief of Staff failed', error);
    console.error('💥 Critical failure:', error);
    process.exit(1);
  });
}