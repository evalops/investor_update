#!/usr/bin/env bun

import 'dotenv/config';

/**
 * Background data collection script
 * Usage: 
 *   bun run collect-data.ts              # Collect all data
 *   bun run collect-data.ts --fresh      # Force fresh collection (ignore cache)
 *   bun run collect-data.ts --summary    # Show collection status only
 */

import { DataCollectionService } from './src/services/dataCollectionService';
import { logger } from './src/utils/logger';
import { validateStartup } from './src/utils/startupValidator';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📊 EvalOps Data Collection Tool

Commands:
  bun run collect-data.ts              Collect all data sources
  bun run collect-data.ts --fresh      Force fresh collection (ignore cache)
  bun run collect-data.ts --summary    Show collection status only
  bun run collect-data.ts --health     Quick health check

Options:
  --max-age <minutes>                  Maximum age for cached data (default: 30)
  --verbose                            Show detailed collection logs
    `);
    process.exit(0);
  }

  const maxAge = args.includes('--max-age') 
    ? parseInt(args[args.indexOf('--max-age') + 1]) || 30 
    : 30;
  
  const freshOnly = args.includes('--fresh');
  const summaryOnly = args.includes('--summary');
  const healthCheck = args.includes('--health');
  const verbose = args.includes('--verbose');

  if (!verbose) {
    // Reduce log noise for non-verbose runs
    process.env.LOG_LEVEL = 'WARN';
  }

  console.log('📊 EvalOps Data Collection Service\n');

  try {
    // Quick startup validation if doing fresh collection
    if (!summaryOnly && !healthCheck) {
      console.log('🔍 Validating system health...');
      const isHealthy = await validateStartup();
      
      if (!isHealthy) {
        console.log('❌ System validation failed! Fix issues before collecting data.');
        process.exit(1);
      }
      console.log('✅ System validation passed\n');
    }

    const service = new DataCollectionService();

    if (healthCheck) {
      console.log('🏥 Running health check...');
      const health = await service.healthCheck();
      
      if (health.healthy) {
        console.log('✅ Data collection system is healthy');
      } else {
        console.log('⚠️  Data collection system has issues:');
        health.issues.forEach(issue => console.log(`   • ${issue}`));
      }
      
      process.exit(health.healthy ? 0 : 1);
    }

    const results = summaryOnly || freshOnly === false 
      ? await service.getCachedResults()
      : await service.collectAllData(maxAge);

    // Display results
    console.log('📋 Collection Results:');
    console.log('==================');

    results.forEach(result => {
      const icon = result.status === 'success' ? '✅' 
                 : result.status === 'stale' ? '🕐' 
                 : '❌';
      
      const responseInfo = result.responseTime 
        ? ` (${result.responseTime}ms)`
        : '';
      
      const ageInfo = result.dataAge ? ` - ${result.dataAge}` : '';
      
      console.log(`${icon} ${result.source}${responseInfo}${ageInfo}`);
      
      if (result.error && verbose) {
        console.log(`   Error: ${result.error}`);
      }
    });

    // Generate and display summary
    const summary = service.generateSummary(results);
    
    console.log('\n📈 Summary:');
    console.log('==========');
    console.log(`Total Sources: ${summary.totalSources}`);
    console.log(`✅ Successful: ${summary.successful}`);
    console.log(`🕐 Stale: ${summary.stale}`);
    console.log(`❌ Failed: ${summary.failed}`);
    
    if (summary.oldestData) {
      console.log(`📅 Oldest Data: ${summary.oldestData.toLocaleString()}`);
    }
    if (summary.newestData) {
      console.log(`🆕 Newest Data: ${summary.newestData.toLocaleString()}`);
    }

    // Show recommendations
    if (summary.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      summary.recommendations.forEach(rec => console.log(`   • ${rec}`));
    }

    // Exit status based on data quality
    if (summary.successful === 0) {
      console.log('\n❌ No data sources are working - reports cannot be generated');
      process.exit(1);
    } else if (summary.failed > 0 || summary.stale > 0) {
      console.log('\n⚠️  Some data sources have issues - reports may be incomplete');
      process.exit(2); // Warning status
    } else {
      console.log('\n🎉 All data sources are healthy and up-to-date!');
      process.exit(0);
    }

  } catch (error) {
    logger.error('Data collection failed', { error });
    console.log(`\n💥 Data collection failed: ${error}`);
    process.exit(1);
  }
}

main();