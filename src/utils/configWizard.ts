import { promises as fs } from 'fs';
import path from 'path';

import { Logger } from './logger';

const logger = Logger.for('ConfigWizard');

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  envVar: string;
  required: boolean;
  type: 'text' | 'password' | 'url' | 'number' | 'boolean';
  placeholder?: string;
  validation?: (value: string) => boolean | string;
  instructions?: string;
  testFunction?: (value: string) => Promise<boolean>;
}

const CONFIGURATION_STEPS: WizardStep[] = [
  {
    id: 'mercury_token',
    title: 'Mercury Banking API Token',
    description: 'Required for fetching banking transactions and account data',
    envVar: 'MERCURY_API_TOKEN',
    required: true,
    type: 'password',
    placeholder: 'mer_live_...',
    instructions: `
1. Log into your Mercury account
2. Go to Settings > Developers > API Keys
3. Create a new API key with read permissions
4. Copy the token (starts with 'mer_live_' or 'mer_sandbox_')`,
    validation: (value: string) => {
      if (!value) {return 'API token is required';}
      if (!value.startsWith('mer_')) {return 'Token should start with "mer_"';}
      if (value.length < 20) {return 'Token seems too short';}
      return true;
    }
  },
  {
    id: 'mercury_account',
    title: 'Mercury Account ID (Optional)',
    description: 'Specific account ID to analyze (if you have multiple accounts)',
    envVar: 'EVALOPS_MERCURY_ACCOUNT_ID',
    required: false,
    type: 'text',
    placeholder: 'account-uuid-here',
    instructions: 'You can find this in your Mercury dashboard URL or leave blank to use default account'
  },
  {
    id: 'snowflake_setup',
    title: 'Snowflake Data Warehouse (Optional)',
    description: 'Analytics and custom metrics from your data warehouse',
    envVar: 'SNOWFLAKE_ACCOUNT',
    required: false,
    type: 'text',
    placeholder: 'your-account.snowflakecomputing.com',
    instructions: `
1. Get your Snowflake account URL
2. Create a user with read permissions
3. Note your warehouse, database, and schema names`
  },
  {
    id: 'snowflake_user',
    title: 'Snowflake Username',
    description: 'Username for Snowflake connection',
    envVar: 'SNOWFLAKE_USER',
    required: false,
    type: 'text',
    placeholder: 'your_username'
  },
  {
    id: 'snowflake_password',
    title: 'Snowflake Password',
    description: 'Password for Snowflake connection',
    envVar: 'SNOWFLAKE_PASSWORD',
    required: false,
    type: 'password',
    placeholder: '••••••••'
  },
  {
    id: 'stripe_key',
    title: 'Stripe API Key (Optional)',
    description: 'For advanced revenue analytics and subscription metrics',
    envVar: 'STRIPE_API_KEY',
    required: false,
    type: 'password',
    placeholder: 'sk_live_... or sk_test_...',
    instructions: `
1. Log into Stripe Dashboard
2. Go to Developers > API Keys
3. Copy your Secret Key (not Publishable Key)`,
    validation: (value: string) => {
      if (!value) {return true;} // Optional
      if (!value.startsWith('sk_')) {return 'Stripe secret key should start with "sk_"';}
      return true;
    }
  },
  {
    id: 'posthog_key',
    title: 'PostHog API Key (Optional)',
    description: 'Product analytics and user behavior insights',
    envVar: 'POSTHOG_API_KEY',
    required: false,
    type: 'password',
    placeholder: 'phx_...',
    instructions: `
1. Log into PostHog
2. Go to Settings > Project > API Keys
3. Copy your Personal API Key`
  },
  {
    id: 'posthog_project',
    title: 'PostHog Project ID',
    description: 'Your PostHog project identifier',
    envVar: 'POSTHOG_PROJECT_ID',
    required: false,
    type: 'number',
    placeholder: '12345'
  },
  {
    id: 'github_token',
    title: 'GitHub Token (Optional)',
    description: 'Development activity and repository insights',
    envVar: 'GITHUB_TOKEN',
    required: false,
    type: 'password',
    placeholder: 'ghp_...',
    instructions: `
1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate new token (classic)
3. Select 'repo' and 'read:org' scopes`
  },
  {
    id: 'attio_key',
    title: 'Attio CRM API Key (Optional)',
    description: 'Customer relationship and pipeline data',
    envVar: 'ATTIO_API_KEY',
    required: false,
    type: 'password',
    placeholder: 'at_...',
    instructions: `
1. Log into Attio
2. Go to Settings > Developers > API Keys
3. Create new API key with read permissions`
  }
];

export async function runConfigurationWizard(existingEnvPath?: string): Promise<void> {
  logger.info('Starting interactive configuration wizard...');
  
  console.log('\n🧙‍♂️ EvalOps Investor Update Configuration Wizard');
  console.log('==================================================\n');
  
  console.log('This wizard will help you set up data source connections for comprehensive investor updates.\n');
  console.log('💡 Tips:');
  console.log('   • Required fields are marked with *');
  console.log('   • Press Enter to skip optional fields');
  console.log('   • Your API keys will be stored securely in .env\n');
  
  const envValues = new Map<string, string>();
  
  // Load existing .env if it exists
  if (existingEnvPath) {
    try {
      const existing = await loadExistingEnv(existingEnvPath);
      logger.debug(`Loaded ${existing.size} existing environment variables`);
      
      if (existing.size > 0) {
        console.log(`📁 Found existing .env file with ${existing.size} variables`);
        const shouldMerge = await promptBoolean('Keep existing values and add new ones?', true);
        
        if (shouldMerge) {
          existing.forEach((value, key) => envValues.set(key, value));
          console.log('✅ Existing configuration preserved\n');
        }
      }
    } catch (error) {
      logger.debug('No existing .env file found or error reading it');
    }
  }
  
  // Walk through each configuration step
  for (const step of CONFIGURATION_STEPS) {
    await processConfigurationStep(step, envValues);
  }
  
  // Summary
  console.log('\n📋 Configuration Summary');
  console.log('========================');
  
  const requiredConfigured = CONFIGURATION_STEPS.filter(s => s.required && envValues.has(s.envVar)).length;
  const totalRequired = CONFIGURATION_STEPS.filter(s => s.required).length;
  const optionalConfigured = CONFIGURATION_STEPS.filter(s => !s.required && envValues.has(s.envVar)).length;
  
  console.log(`✅ Required: ${requiredConfigured}/${totalRequired} configured`);
  console.log(`⚡ Optional: ${optionalConfigured} additional integrations enabled`);
  console.log(`📊 Total: ${envValues.size} environment variables set\n`);
  
  if (requiredConfigured < totalRequired) {
    console.log('⚠️  Some required configuration is missing. The tool may not work properly.\n');
  }
  
  // Save configuration
  const envPath = existingEnvPath || '.env';
  await saveEnvFile(envPath, envValues);
  
  console.log(`💾 Configuration saved to ${envPath}`);
  console.log('\n🎉 Setup complete! You can now run:');
  console.log('   bun run generate-report.ts');
  console.log('   investor-update --health-check  # Test your connections\n');
  
  logger.info('Configuration wizard completed successfully', {
    configuredSources: envValues.size,
    requiredConfigured,
    optionalConfigured
  });
}

async function processConfigurationStep(step: WizardStep, envValues: Map<string, string>): Promise<void> {
  console.log(`\n📝 ${step.title}${step.required ? ' *' : ''}`);
  console.log(`   ${step.description}\n`);
  
  if (step.instructions) {
    console.log('💡 Setup instructions:');
    console.log(step.instructions.trim().split('\n').map(line => `   ${line}`).join('\n'));
    console.log('');
  }
  
  // Check if we already have this value
  const existing = envValues.get(step.envVar);
  if (existing) {
    const masked = step.type === 'password' ? '••••••••' : existing;
    console.log(`   Current value: ${masked}`);
    
    const shouldUpdate = await promptBoolean('Update this value?', false);
    if (!shouldUpdate) {
      return;
    }
  }
  
  let value = '';
  let valid = false;
  
  while (!valid) {
    value = await promptInput(`Enter ${step.title}:`, step.placeholder);
    
    // Handle optional fields
    if (!value && !step.required) {
      console.log('   ⏭️  Skipped (optional)\n');
      return;
    }
    
    // Validate input
    if (step.validation) {
      const validationResult = step.validation(value);
      if (validationResult === true) {
        valid = true;
      } else {
        console.log(`   ❌ ${validationResult}`);
        continue;
      }
    } else {
      valid = true;
    }
    
    // Test connection if available
    if (step.testFunction && value) {
      console.log('   🔄 Testing connection...');
      try {
        const testResult = await step.testFunction(value);
        if (testResult) {
          console.log('   ✅ Connection test passed!');
        } else {
          console.log('   ⚠️  Connection test failed, but value saved');
        }
      } catch (error) {
        console.log('   ⚠️  Connection test error:', (error as Error).message);
      }
    }
  }
  
  envValues.set(step.envVar, value);
  console.log(`   ✅ ${step.envVar} configured\n`);
}

async function promptInput(question: string, placeholder?: string): Promise<string> {
  // Simple input prompt (in a real implementation, you'd use a library like inquirer)
  process.stdout.write(`${question}`);
  if (placeholder) {
    process.stdout.write(` (${placeholder})`);
  }
  process.stdout.write(': ');
  
  // For demo purposes, we'll simulate user input
  // In a real implementation, you'd use process.stdin
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    rl.question('', (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function promptBoolean(question: string, defaultValue: boolean = false): Promise<boolean> {
  const defaultText = defaultValue ? 'Y/n' : 'y/N';
  const answer = await promptInput(`${question} (${defaultText})`);
  
  if (!answer) {return defaultValue;}
  
  return answer.toLowerCase().startsWith('y');
}

async function loadExistingEnv(filePath: string): Promise<Map<string, string>> {
  const envValues = new Map<string, string>();
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          envValues.set(key, value);
        }
      }
    }
  } catch (error) {
    // File doesn't exist or can't be read
  }
  
  return envValues;
}

async function saveEnvFile(filePath: string, envValues: Map<string, string>): Promise<void> {
  const lines: string[] = [
    '# EvalOps Investor Update Configuration',
    '# Generated by configuration wizard',
    `# Created: ${new Date().toISOString()}`,
    '',
    '# =================================',
    '# REQUIRED CONFIGURATION',
    '# =================================',
    ''
  ];
  
  // Add required variables
  const required = CONFIGURATION_STEPS.filter(s => s.required);
  for (const step of required) {
    const value = envValues.get(step.envVar) || '';
    lines.push(`# ${step.title}`);
    lines.push(`${step.envVar}=${value}`);
    lines.push('');
  }
  
  lines.push('# =================================');
  lines.push('# OPTIONAL INTEGRATIONS');
  lines.push('# =================================');
  lines.push('');
  
  // Add optional variables
  const optional = CONFIGURATION_STEPS.filter(s => !s.required);
  for (const step of optional) {
    const value = envValues.get(step.envVar);
    if (value) {
      lines.push(`# ${step.title}`);
      lines.push(`${step.envVar}=${value}`);
      lines.push('');
    }
  }
  
  await fs.writeFile(filePath, lines.join('\n'));
}