#!/usr/bin/env bun

import { promises as fs } from 'fs';
import path from 'path';
import { MercuryClient } from './src/services/mercuryClient';
import { MetricsCalculator } from './src/services/metricsCalculator';
import { UpdateGenerator } from './src/services/updateGenerator';
import { ChartGenerator } from './src/services/chartGenerator';
import { MetricsAggregator, Metrics } from './src/services/metricsAggregator';
import { printConfigurationHelp, validateConfiguration } from './src/utils/configurationHelper';
import { validateConfig, ValidationError, APIError, formatError, withRetry } from './src/utils/validation';
import { Logger } from './src/utils/logger';
import { validateEnvironmentVariables, testDataSourceConnections, ensureRequiredEnvironment } from './src/utils/environmentValidator';
import { runConfigurationWizard } from './src/utils/configWizard';
import { StartupValidator } from './src/utils/startupValidator';
import { format } from 'date-fns';

const logger = Logger.for('InvestorUpdate');

interface Config {
  accountId: string;
  months: number;
  format: 'markdown' | 'html' | 'json' | 'yc-email' | 'all';
  outputDir: string;
}

async function parseArgs(): Promise<Config> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  if (args.includes('--config') || args.includes('-c')) {
    if (args.includes('--wizard')) {
      await runConfigurationWizard();
    } else {
      printConfigurationHelp();
    }
    process.exit(0);
  }

  if (args.includes('--setup') || args.includes('--wizard')) {
    await runConfigurationWizard();
    process.exit(0);
  }

  if (args.includes('--check-config')) {
    logger.info('Validating environment configuration...');
    const validation = validateEnvironmentVariables();
    process.exit(validation.valid ? 0 : 1);
  }

  if (args.includes('--health-check')) {
    await performHealthCheck();
    process.exit(0);
  }

  // Parse configuration with validation
  const rawConfig = {
    accountId: args[0] || process.env.EVALOPS_MERCURY_ACCOUNT_ID || '9d1529f8-7258-11f0-9f3a-ebb715794c15',
    months: parseInt(args[1]) || 6,
    format: (args[2] as Config['format']) || 'yc-email',
    outputDir: args[3] || './report-output'
  };

  // Validate configuration
  const validation = validateConfig(rawConfig);
  if (!validation.success) {
    logger.error('Invalid configuration provided', undefined, { errors: validation.errors });
    throw new ValidationError(validation.errors);
  }

  logger.debug('Configuration parsed and validated', rawConfig);
  return validation.data;
}

function printUsage(): void {
  console.log('📊 EvalOps Investor Update Generator');
  console.log('');
  console.log('Usage:');
  console.log('  bun run generate-report.ts [accountId] [months] [format] [outputDir]');
  console.log('  investor-update [accountId] [months] [format] [outputDir]');
  console.log('');
  console.log('Parameters:');
  console.log('  accountId  - Mercury account ID (default: from .env)');
  console.log('  months     - Number of months to analyze (default: 6)');
  console.log('  format     - Output format: markdown, html, json, yc-email, all (default: yc-email)');
  console.log('  outputDir  - Output directory (default: ./report-output)');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h        Show this help message');
  console.log('  --config, -c      Show configuration guide for data sources');
  console.log('  --setup, --wizard Interactive configuration wizard');
  console.log('  --check-config    Validate current configuration');
  console.log('  --health-check    Test connectivity to all data sources');
  console.log('');
  console.log('Examples:');
  console.log('  bun run generate-report.ts');
  console.log('  bun run generate-report.ts "" 12 all ./reports');
  console.log('  investor-update "" 3 html');
  console.log('  investor-update --config  # Show setup guide');
  console.log('');
  console.log('Environment variables needed:');
  console.log('  MERCURY_API_TOKEN (required)');
  console.log('  EVALOPS_MERCURY_ACCOUNT_ID (optional)');
  console.log('  SNOWFLAKE_* (optional, for enhanced metrics)');
  console.log('  STRIPE_API_KEY (optional, for revenue metrics)');
  console.log('  GCP_* (optional, for usage metrics)');
  console.log('');
  console.log('Run "investor-update --config" for detailed setup instructions.');
}

async function performHealthCheck(): Promise<void> {
  logger.info('Starting comprehensive data source health check...');
  
  try {
    const result = await testDataSourceConnections();
    
    const connectedRequired = result.dataSources.filter(ds => ds.required && ds.testResult === 'success').length;
    const totalRequired = result.dataSources.filter(ds => ds.required).length;
    const connectedOptional = result.dataSources.filter(ds => !ds.required && ds.testResult === 'success').length;
    
    if (connectedRequired === totalRequired) {
      logger.info('🎉 All required data sources are healthy!');
    } else {
      logger.warn('⚠️  Some required data sources have issues.');
      process.exit(1);
    }
    
    logger.business('Data sources connected', `${connectedRequired + connectedOptional}/${result.dataSources.length}`);
    
  } catch (error) {
    logger.critical('Health check failed', error as Error);
    process.exit(1);
  }
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

function getScoreEmoji(score: number): string {
  if (score >= 9) return '🚀'; // Exceptional
  if (score >= 7) return '🔥'; // Great
  if (score >= 5) return '💪'; // Good
  if (score >= 3) return '⚠️';  // Needs work
  return '🆘'; // Critical
}

async function generateReport(): Promise<void> {
  const config = await parseArgs();

  logger.info('Starting investor update generation', config);

  // Quick startup validation - fail fast with clear errors
  console.log('🔍 Validating system health...');
  const startupValidator = new StartupValidator();
  const validationResult = await startupValidator.validateAll();
  
  if (validationResult.overall === 'error') {
    console.log('\n❌ System validation failed! Please fix the errors above before generating reports.');
    console.log('💡 Run "bun run validate" for detailed diagnostics.');
    process.exit(1);
  }

  // Validate environment before proceeding
  logger.debug('Validating required environment configuration...');
  ensureRequiredEnvironment();

  console.log('🚀 EvalOps Investor Update Generator');
  console.log(`📊 Account ID: ${config.accountId}`);
  console.log(`📅 Analyzing last ${config.months} months`);
  console.log(`📄 Output format: ${config.format}`);
  console.log(`📁 Output directory: ${config.outputDir}`);
  console.log('');

  try {
    // Initialize services
    const mercuryClient = new MercuryClient();
    const updateGenerator = new UpdateGenerator();
    const chartGenerator = new ChartGenerator();
    const metricsAggregator = new MetricsAggregator();

    console.log('🔄 Fetching account data...');
    const [account, transactions] = await Promise.all([
      mercuryClient.getAccount(config.accountId),
      mercuryClient.getAllTransactions(config.accountId)
    ]);

    if (!account) {
      throw new Error('Account not found');
    }

    if (!transactions || transactions.length === 0) {
      throw new Error('No transactions found for this account');
    }

    console.log(`✅ Found ${transactions.length} transactions`);
    console.log(`💰 Current balance: $${account.currentBalance.toLocaleString()}`);

    console.log('🔄 Calculating base metrics...');
    const calculator = new MetricsCalculator(transactions);
    const baseResult = await calculator.calculateEvalOpsMetrics(account.currentBalance, config.months);

    console.log('🔄 Aggregating metrics from all data sources...');
    const enrichedResult = await metricsAggregator.aggregateMetrics(baseResult.metrics, transactions);
    const metrics = enrichedResult.metrics;

    // Log data source status
    console.log('📡 Data source status:');
    const connectedSources = [];
    const failedSources = [];

    for (const [source, status] of Object.entries(enrichedResult.dataSourceStatus)) {
      const icon = status.connected ? '✅' : '❌';
      console.log(`  ${icon} ${source}: ${status.connected ? 'Connected' : `Failed - ${status.error}`}`);

      if (status.connected) {
        connectedSources.push(source);
      } else {
        failedSources.push({ source, error: status.error });
      }
    }

    if (failedSources.length > 0) {
      console.log('');
      console.log('⚠️  Some data sources are unavailable:');
      failedSources.forEach(({ source, error }) => {
        console.log(`   • ${source}: ${error}`);
      });
      console.log('   Report will be generated with available data only.');

      if (connectedSources.length === 0) {
        console.log('   ⚠️  Only Mercury banking data is available - some metrics may be incomplete.');
      }
    }

    console.log('🔄 Generating update content...');
    const update = updateGenerator.generateUpdate(metrics);

    // Create output directory
    await fs.mkdir(config.outputDir, { recursive: true });

    console.log('🔄 Generating charts...');
    const chartPaths = await chartGenerator.generateAllCharts(metrics, config.outputDir);
    console.log(`✅ Generated ${chartPaths.length} charts`);

    // Generate outputs based on format
    if (config.format === 'markdown' || config.format === 'all') {
      console.log('📝 Generating Markdown report...');
      const markdown = updateGenerator.formatUpdateAsMarkdown(update, './');
      await fs.writeFile(path.join(config.outputDir, 'investor-update.md'), markdown);
      console.log('✅ Markdown report saved to investor-update.md');
    }

    if (config.format === 'html' || config.format === 'all') {
      console.log('🌐 Generating HTML report...');
      const html = updateGenerator.formatUpdateAsHTML(update, './');
      await fs.writeFile(path.join(config.outputDir, 'investor-update.html'), html);
      console.log('✅ HTML report saved to investor-update.html');
    }

    if (config.format === 'yc-email' || config.format === 'all') {
      console.log('📧 Generating email update...');
      const email = updateGenerator.formatUpdateAsEmail(update, metrics);
      const dateStr = format(new Date(), 'yyyy-MM');
      const emailFileName = `email-update-${dateStr}.txt`;
      await fs.writeFile(path.join(config.outputDir, emailFileName), email);
      console.log(`✅ Email update saved to ${emailFileName}`);
    }

    if (config.format === 'json' || config.format === 'all') {
      console.log('📋 Saving raw data...');
      await fs.writeFile(path.join(config.outputDir, 'metrics.json'), JSON.stringify(metrics, null, 2));
      await fs.writeFile(path.join(config.outputDir, 'update.json'), JSON.stringify(update, null, 2));
      console.log('✅ Raw data saved to metrics.json and update.json');
    }

    // Generate YC-focused summary
    console.log('');
    console.log('📊 YC GROWTH DASHBOARD');
    console.log('======================');

    // Primary Metric (YC philosophy: focus on ONE key metric)
    const primaryIcon = metrics.primaryMetric.status === 'ahead' ? '🎯' : metrics.primaryMetric.status === 'on-track' ? '✅' : '⚠️';
    console.log(`${primaryIcon} PRIMARY METRIC: ${metrics.primaryMetric.name}`);
    console.log(`   Value: ${formatDisplayValue(metrics.primaryMetric.value)}`);
    console.log(`   Growth: ${(metrics.primaryMetric.growthRate * 100).toFixed(1)}% MoM (Target: ${(metrics.primaryMetric.target * 100).toFixed(0)}%)`);
    console.log(`   Status: ${metrics.primaryMetric.status.toUpperCase()}`);
    console.log('');

    // YC Growth Metrics
    console.log('📈 GROWTH METRICS');
    console.log(`   Weekly Growth: ${(metrics.weeklyGrowthRate * 100).toFixed(1)}% (YC Target: 7%)`);
    console.log(`   Monthly Growth: ${(metrics.monthlyGrowthRate * 100).toFixed(1)}% (YC Target: 15%)`);
    console.log(`   YC Growth Score: ${metrics.ycGrowthScore}/10 ${getScoreEmoji(metrics.ycGrowthScore)}`);
    console.log('');

    // Financial Metrics
    console.log('💰 FINANCIAL HEALTH');
    console.log(`   Current Balance: $${metrics.currentBalance.toLocaleString()}`);
    console.log(`   Monthly Burn: $${metrics.averageMonthlyBurn?.toLocaleString() || '0'}`);
    console.log(`   Runway: ${metrics.runwayMonths === Infinity ? 'Unlimited' : Math.round(metrics.runwayMonths) + ' months'}`);
    if (metrics.mrr > 0) {
      console.log(`   MRR: $${metrics.mrr.toLocaleString()}`);
    }

    console.log('');
    console.log('🎉 Report generation complete!');
    console.log(`📁 Files saved to: ${config.outputDir}`);

  } catch (error: any) {
    console.error('❌ Error generating report:', error.message);
    process.exit(1);
  }
}

// Main execution
if (import.meta.main) {
  generateReport().catch(error => {
    logger.critical('Application failed', error);
    console.error(formatError(error));
    process.exit(1);
  });
}