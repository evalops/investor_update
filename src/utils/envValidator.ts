import { logger } from './logger';

interface EnvConfig {
  name: string;
  required: boolean;
  description: string;
  example?: string;
}

const ENV_CONFIGS: EnvConfig[] = [
  {
    name: 'MERCURY_API_TOKEN',
    required: true,
    description: 'Mercury API token for bank transaction data',
    example: 'mercury_sk_...'
  },
  {
    name: 'ATTIO_API_KEY',
    required: false,
    description: 'Attio API key for CRM data',
    example: 'attio_sk_...'
  },
  {
    name: 'POSTHOG_API_KEY',
    required: false,
    description: 'PostHog API key for product analytics',
    example: 'phc_...'
  },
  {
    name: 'POSTHOG_PROJECT_ID',
    required: false,
    description: 'PostHog project ID',
    example: '12345'
  },
  {
    name: 'GITHUB_TOKEN',
    required: false,
    description: 'GitHub personal access token',
    example: 'ghp_...'
  },
  {
    name: 'NODE_ENV',
    required: false,
    description: 'Environment (development, production, test)',
    example: 'production'
  }
];

export interface ValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

export function validateEnvironment(): ValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const config of ENV_CONFIGS) {
    const value = process.env[config.name];

    if (!value || value.trim() === '') {
      if (config.required) {
        missing.push(config.name);
        logger.error(`Missing required environment variable: ${config.name}`, {
          description: config.description,
          example: config.example
        });
      } else {
        warnings.push(config.name);
        logger.warn(`Optional environment variable not set: ${config.name}`, {
          description: config.description,
          impact: 'Some features may be disabled'
        });
      }
    } else {
      logger.debug(`Environment variable validated: ${config.name}`);
    }
  }

  const valid = missing.length === 0;

  if (valid) {
    logger.info('Environment validation passed', {
      requiredConfigured: ENV_CONFIGS.filter(c => c.required && process.env[c.name]).length,
      totalRequired: ENV_CONFIGS.filter(c => c.required).length,
      optionalConfigured: ENV_CONFIGS.filter(c => !c.required && process.env[c.name]).length,
      warnings: warnings.length
    });
  } else {
    logger.error('Environment validation failed', {
      missingRequired: missing,
      totalMissing: missing.length
    });
  }

  return { valid, missing, warnings };
}

export function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

export function getOptionalEnvVar(name: string, defaultValue: string = ''): string {
  return process.env[name] || defaultValue;
}