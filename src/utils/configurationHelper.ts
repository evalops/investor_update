export interface DataSourceConfig {
  name: string;
  required: boolean;
  envVars: string[];
  setupInstructions: string;
  testCommand?: string;
}

export const DATA_SOURCE_CONFIGS: DataSourceConfig[] = [
  {
    name: 'Mercury Banking',
    required: true,
    envVars: ['MERCURY_API_TOKEN', 'EVALOPS_MERCURY_ACCOUNT_ID'],
    setupInstructions: 'Get API token from Mercury dashboard and set your account ID',
    testCommand: 'curl -H "Authorization: Bearer $MERCURY_API_TOKEN" https://api.mercury.com/api/v1/accounts'
  },
  {
    name: 'Stripe Revenue',
    required: false,
    envVars: ['STRIPE_API_KEY'],
    setupInstructions: 'Get API key from Stripe dashboard (sk_live_... or sk_test_...)',
    testCommand: 'curl -u $STRIPE_API_KEY: https://api.stripe.com/v1/customers'
  },
  {
    name: 'Snowflake Analytics',
    required: false,
    envVars: [
      'SNOWFLAKE_ACCOUNT',
      'SNOWFLAKE_USER',
      'SNOWFLAKE_PASSWORD',
      'SNOWFLAKE_TOKEN',
      'SNOWFLAKE_AUTHENTICATOR',
      'SNOWFLAKE_WAREHOUSE',
      'SNOWFLAKE_DATABASE',
      'SNOWFLAKE_SCHEMA'
    ],
    setupInstructions: 'Configure Snowflake connection with account, user, and password or use SNOWFLAKE_AUTHENTICATOR=externalbrowser'
  },
  {
    name: 'GCP Billing',
    required: false,
    envVars: ['GCP_PROJECT_ID', 'GOOGLE_APPLICATION_CREDENTIALS'],
    setupInstructions: 'Set up service account and enable BigQuery billing export'
  },
  {
    name: 'GitHub Engineering',
    required: false,
    envVars: ['GITHUB_TOKEN', 'GITHUB_ORG', 'GITHUB_REPOS'],
    setupInstructions: 'Create GitHub personal access token with repo access, set your org and comma-separated repo list',
    testCommand: 'curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user'
  },
  {
    name: 'PostHog Product Analytics',
    required: false,
    envVars: ['POSTHOG_API_KEY', 'POSTHOG_PROJECT_ID'],
    setupInstructions: 'Get Personal API key from PostHog settings and your project ID',
    testCommand: 'curl -H "Authorization: Bearer $POSTHOG_API_KEY" https://app.posthog.com/api/projects/$POSTHOG_PROJECT_ID/events'
  },
  {
    name: 'Attio CRM',
    required: false,
    envVars: ['ATTIO_API_KEY'],
    setupInstructions: 'Get API key from Attio dashboard developer settings',
    testCommand: 'curl -H "Authorization: Bearer $ATTIO_API_KEY" https://api.attio.com/v2/objects'
  }
];

export function validateConfiguration(environment: string = 'production'): {
  valid: boolean;
  missing: DataSourceConfig[];
  warnings: string[];
} {
  const missing: DataSourceConfig[] = [];
  const warnings: string[] = [];

  for (const config of DATA_SOURCE_CONFIGS) {
    const hasAllEnvVars = config.envVars.every(envVar => process.env[envVar]);

    if (!hasAllEnvVars) {
      // In development, all sources are optional for easier testing
      if (config.required && environment === 'production') {
        missing.push(config);
      } else {
        warnings.push(`${config.name} not configured - some metrics will be unavailable`);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings
  };
}

export function printConfigurationHelp(): void {
  console.log('🔧 Data Source Configuration Guide');
  console.log('=====================================');
  console.log('');

  const validation = validateConfiguration();

  if (validation.valid) {
    console.log('✅ All required data sources are configured!');
  } else {
    console.log('❌ Missing required configuration:');
    validation.missing.forEach(config => {
      console.log(`\n📍 ${config.name} (REQUIRED)`);
      console.log(`   Environment variables: ${config.envVars.join(', ')}`);
      console.log(`   Setup: ${config.setupInstructions}`);
      if (config.testCommand) {
        console.log(`   Test: ${config.testCommand}`);
      }
    });
  }

  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Optional configurations:');
    validation.warnings.forEach(warning => console.log(`   • ${warning}`));

    console.log('\n📖 Optional data source setup:');
    DATA_SOURCE_CONFIGS.filter(c => !c.required).forEach(config => {
      const hasConfig = config.envVars.every(envVar => process.env[envVar]);
      if (!hasConfig) {
        console.log(`\n📍 ${config.name} (OPTIONAL)`);
        console.log(`   Environment variables: ${config.envVars.join(', ')}`);
        console.log(`   Setup: ${config.setupInstructions}`);
        if (config.testCommand) {
          console.log(`   Test: ${config.testCommand}`);
        }
      }
    });
  }

  console.log('\n💡 Pro tip: Create a .env file in your project root with these variables');
  console.log('   Example: MERCURY_API_TOKEN=your_token_here');
}
