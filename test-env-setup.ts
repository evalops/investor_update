#!/usr/bin/env bun

import 'dotenv/config';

console.log('🔧 Environment Configuration Test');
console.log('=================================\n');

// Test if environment variables are loaded
const requiredVars = [
  'OPENAI_API_KEY',
  'EVALOPS_MERCURY_ACCOUNT_ID',
  'MERCURY_API_TOKEN'
];

const optionalVars = [
  'STRIPE_SECRET_KEY',
  'ATTIO_API_KEY', 
  'POSTHOG_API_KEY',
  'SNOWFLAKE_OAUTH_TOKEN'
];

console.log('📋 Required Environment Variables:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  const displayValue = value ? `${value.substring(0, 10)}...` : 'NOT SET';
  console.log(`   ${status} ${varName}: ${displayValue}`);
});

console.log('\n📋 Optional Environment Variables:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '⚠️';
  const displayValue = value ? `${value.substring(0, 10)}...` : 'NOT SET';
  console.log(`   ${status} ${varName}: ${displayValue}`);
});

console.log('\n🎯 AI Chief of Staff Readiness:');
const openaiKey = process.env.OPENAI_API_KEY;
if (openaiKey && openaiKey.startsWith('sk-')) {
  console.log('   ✅ OpenAI API key is properly configured');
  console.log('   🤖 Multi-agent AI Chief of Staff: READY');
} else {
  console.log('   ❌ OpenAI API key missing or invalid');
  console.log('   🤖 Multi-agent AI Chief of Staff: NOT READY');
}

const mercuryToken = process.env.MERCURY_API_TOKEN;
if (mercuryToken) {
  console.log('   ✅ Mercury API configured for financial data');
} else {
  console.log('   ⚠️ Mercury API not configured (financial data limited)');
}

console.log('\n💡 Next Steps:');
if (!openaiKey) {
  console.log('   1. Add OPENAI_API_KEY to .env file');
}
if (!mercuryToken) {
  console.log('   2. Add MERCURY_API_TOKEN for real financial data');
}
console.log('   3. Run: bun run ai-chief-agents.ts');
console.log('   4. Run: bun run generate-report.ts');
