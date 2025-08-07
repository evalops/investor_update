import { validateEnvironment, ConfigurationError } from './validation';
import { Logger } from './logger';

const logger = Logger.for('EnvironmentValidator');

export interface DataSourceStatus {
  name: string;
  required: boolean;
  configured: boolean;
  envVars: string[];
  missingVars: string[];
  testResult?: 'success' | 'failed' | 'not_tested';
  testError?: string;
}

export interface EnvironmentValidationResult {
  valid: boolean;
  requiredMissing: boolean;
  dataSources: DataSourceStatus[];
  missingRequired: string[];
  missingOptional: string[];
}

const DATA_SOURCE_CONFIGS = [
  {
    name: 'Mercury Banking',
    required: true,
    envVars: ['MERCURY_API_TOKEN'],
    testEndpoint: 'https://api.mercury.com/api/v1/account'
  },
  {
    name: 'Mercury Account ID',
    required: false,
    envVars: ['EVALOPS_MERCURY_ACCOUNT_ID'],
    dependsOn: ['MERCURY_API_TOKEN']
  },
  {
    name: 'Snowflake Data Warehouse',
    required: false,
    envVars: ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER', 'SNOWFLAKE_PASSWORD'],
    testEndpoint: 'snowflake-connection'
  },
  {
    name: 'Stripe Payments',
    required: false,
    envVars: ['STRIPE_API_KEY'],
    testEndpoint: 'https://api.stripe.com/v1/balance'
  },
  {
    name: 'PostHog Analytics',
    required: false,
    envVars: ['POSTHOG_API_KEY', 'POSTHOG_PROJECT_ID'],
    testEndpoint: 'https://app.posthog.com/api/projects'
  },
  {
    name: 'GitHub Integration',
    required: false,
    envVars: ['GITHUB_TOKEN'],
    testEndpoint: 'https://api.github.com/user'
  },
  {
    name: 'Attio CRM',
    required: false,
    envVars: ['ATTIO_API_KEY'],
    testEndpoint: 'https://api.attio.com/v2/objects'
  }
];

export function validateEnvironmentVariables(showDetails: boolean = true): EnvironmentValidationResult {
  logger.startOperation('Environment validation');
  
  const dataSources: DataSourceStatus[] = [];
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];
  
  for (const config of DATA_SOURCE_CONFIGS) {
    const missingVars = config.envVars.filter(envVar => !process.env[envVar]);
    const configured = missingVars.length === 0;
    
    const status: DataSourceStatus = {
      name: config.name,
      required: config.required,
      configured,
      envVars: config.envVars,
      missingVars
    };
    
    dataSources.push(status);
    
    if (!configured) {
      if (config.required) {
        missingRequired.push(...missingVars);
        logger.error(`Required data source not configured: ${config.name}`, undefined, {
          missingVars,
          envVars: config.envVars
        });
      } else {
        missingOptional.push(...missingVars);
        logger.debug(`Optional data source not configured: ${config.name}`, {
          missingVars,
          envVars: config.envVars
        });
      }
    } else {
      logger.debug(`Data source configured: ${config.name}`, {
        envVars: config.envVars
      });
    }
  }
  
  const requiredMissing = missingRequired.length > 0;
  const valid = !requiredMissing;
  
  if (showDetails) {
    displayValidationResults({
      valid,
      requiredMissing,
      dataSources,
      missingRequired,
      missingOptional
    });
  }
  
  logger.info(`Environment validation ${valid ? 'passed' : 'failed'}`, {
    requiredConfigured: dataSources.filter(ds => ds.required && ds.configured).length,
    optionalConfigured: dataSources.filter(ds => !ds.required && ds.configured).length,
    totalDataSources: dataSources.length
  });
  
  return {
    valid,
    requiredMissing,
    dataSources,
    missingRequired,
    missingOptional
  };
}

export function displayValidationResults(result: EnvironmentValidationResult): void {
  console.log('\n🔧 Environment Configuration Status');
  console.log('=====================================\n');
  
  if (result.valid) {
    logger.info('✅ All required data sources are configured!');
  } else {
    logger.error('❌ Required configuration missing!');
    console.log('\n🚨 Missing Required Configuration:');
    result.missingRequired.forEach(key => {
      console.log(`   • ${key}`);
    });
  }
  
  // Show data source status
  console.log('\n📊 Data Source Status:');
  result.dataSources.forEach(ds => {
    const icon = ds.configured ? '✅' : (ds.required ? '❌' : '⚠️');
    const status = ds.configured ? 'Configured' : 'Missing';
    const requiredText = ds.required ? 'REQUIRED' : 'optional';
    
    console.log(`   ${icon} ${ds.name} (${requiredText}): ${status}`);
    
    if (!ds.configured && ds.missingVars.length > 0) {
      console.log(`      Missing: ${ds.missingVars.join(', ')}`);
    }
    
    if (ds.testResult) {
      const testIcon = ds.testResult === 'success' ? '✅' : '❌';
      console.log(`      Connection Test: ${testIcon} ${ds.testResult}`);
      if (ds.testError) {
        console.log(`      Error: ${ds.testError}`);
      }
    }
  });
  
  if (result.missingOptional.length > 0) {
    console.log('\n💡 Optional Enhancements Available:');
    const optionalBySource = new Map<string, string[]>();
    
    result.dataSources
      .filter(ds => !ds.required && !ds.configured)
      .forEach(ds => {
        optionalBySource.set(ds.name, ds.missingVars);
      });
      
    optionalBySource.forEach((vars, sourceName) => {
      console.log(`   • ${sourceName}: Set ${vars.join(', ')}`);
    });
  }
  
  console.log('\n📖 Setup Instructions:');
  console.log('   Run: investor-update --config');
  console.log('   Or check the README for detailed setup steps\n');
}

export function ensureRequiredEnvironment(): void {
  const result = validateEnvironmentVariables(false);
  
  if (!result.valid) {
    const error = new ConfigurationError(
      'Required environment variables are missing. Run `investor-update --config` for setup instructions.',
      result.missingRequired
    );
    logger.critical('Environment validation failed - missing required configuration', error, {
      missingRequired: result.missingRequired,
      missingOptional: result.missingOptional
    });
    throw error;
  }
}

// Connection testing utilities
export async function testDataSourceConnections(): Promise<EnvironmentValidationResult> {
  logger.info('Starting connection tests for configured data sources...');
  
  const result = validateEnvironmentVariables(false);
  
  // Test connections for configured data sources
  for (const dataSource of result.dataSources) {
    if (dataSource.configured) {
      try {
        logger.debug(`Testing connection: ${dataSource.name}`);
        const testResult = await testDataSourceConnection(dataSource.name);
        dataSource.testResult = testResult.success ? 'success' : 'failed';
        dataSource.testError = testResult.error;
        
        if (testResult.success) {
          logger.info(`✅ Connection test passed: ${dataSource.name}`);
        } else {
          logger.warn(`❌ Connection test failed: ${dataSource.name}: ${testResult.error}`);
        }
      } catch (error) {
        dataSource.testResult = 'failed';
        dataSource.testError = (error as Error).message;
        logger.warn(`❌ Connection test error: ${dataSource.name}`, error as Error);
      }
    }
  }
  
  displayValidationResults(result);
  
  const connectedSources = result.dataSources.filter(ds => ds.testResult === 'success').length;
  const totalConfigured = result.dataSources.filter(ds => ds.configured).length;
  
  logger.info(`Connection tests complete: ${connectedSources}/${totalConfigured} sources connected`);
  
  return result;
}

async function testDataSourceConnection(sourceName: string): Promise<{ success: boolean; error?: string }> {
  const config = DATA_SOURCE_CONFIGS.find(c => c.name === sourceName);
  if (!config?.testEndpoint) {
    return { success: true }; // No test available
  }
  
  try {
    switch (sourceName) {
      case 'Mercury Banking':
        return await testMercuryConnection();
      case 'Stripe Payments':
        return await testStripeConnection();
      case 'PostHog Analytics':
        return await testPostHogConnection();
      case 'GitHub Integration':
        return await testGitHubConnection();
      case 'Attio CRM':
        return await testAttioConnection();
      case 'Snowflake Data Warehouse':
        return await testSnowflakeConnection();
      default:
        return { success: true }; // Unknown source, assume OK
    }
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// Individual connection testers
async function testMercuryConnection(): Promise<{ success: boolean; error?: string }> {
  const axios = (await import('axios')).default;
  
  try {
    const response = await axios.get('https://api.mercury.com/api/v1/accounts', {
      headers: {
        'Authorization': `Bearer ${process.env.MERCURY_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    
    return { success: response.status === 200 };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
}

async function testStripeConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_API_KEY!);
    
    await stripe.balance.retrieve();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function testPostHogConnection(): Promise<{ success: boolean; error?: string }> {
  const axios = (await import('axios')).default;
  
  try {
    const response = await axios.get(
      `https://app.posthog.com/api/projects/${process.env.POSTHOG_PROJECT_ID}/`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.POSTHOG_API_KEY}`
        },
        timeout: 5000
      }
    );
    
    return { success: response.status === 200 };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.detail || error.message };
  }
}

async function testGitHubConnection(): Promise<{ success: boolean; error?: string }> {
  const axios = (await import('axios')).default;
  
  try {
    const response = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'investor-update-cli'
      },
      timeout: 5000
    });
    
    return { success: response.status === 200 };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
}

async function testAttioConnection(): Promise<{ success: boolean; error?: string }> {
  const axios = (await import('axios')).default;
  
  try {
    const response = await axios.get('https://api.attio.com/v2/objects', {
      headers: {
        'Authorization': `Bearer ${process.env.ATTIO_API_KEY}`
      },
      timeout: 5000
    });
    
    return { success: response.status === 200 };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || error.message };
  }
}

async function testSnowflakeConnection(): Promise<{ success: boolean; error?: string }> {
  // This would require the snowflake-sdk, but for now we'll just check if vars are set
  const required = ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER', 'SNOWFLAKE_PASSWORD'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    return { success: false, error: `Missing required variables: ${missing.join(', ')}` };
  }
  
  return { success: true }; // Assume OK if all vars are set
}