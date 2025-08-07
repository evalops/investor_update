#!/usr/bin/env bun

/**
 * Quick validation script to test all API connections and configuration
 * Usage: bun run validate-setup.ts
 */

import { validateStartup } from './src/utils/startupValidator';
import { logger } from './src/utils/logger';

async function main() {
  console.log('🚀 EvalOps Investor Update - Setup Validation\n');
  
  try {
    const isHealthy = await validateStartup();
    
    if (isHealthy) {
      console.log('\n✅ Setup validation passed! You can run:');
      console.log('   bun run generate-report.ts\n');
      process.exit(0);
    } else {
      console.log('\n❌ Setup validation failed! Please fix the errors above.');
      console.log('   Run the configuration wizard: bun run setup-wizard.ts\n');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Validation failed with unexpected error', { error });
    console.log('\n💥 Validation crashed! Check the logs above for details.\n');
    process.exit(1);
  }
}

main();