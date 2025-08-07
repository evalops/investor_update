import { AttioCollector } from '../collectors/attioCollector';
import { PostHogCollector } from '../collectors/posthogCollector';
import { MercuryClient } from '../services/mercuryClient';

import { validateEnvironment } from './envValidator';
import { logger } from './logger';

export interface ValidationStatus {
  service: string;
  status: 'healthy' | 'warning' | 'error' | 'disabled';
  message: string;
  responseTime?: number;
}

export interface StartupValidationResult {
  overall: 'healthy' | 'warning' | 'error';
  validations: ValidationStatus[];
  summary: {
    healthy: number;
    warnings: number;
    errors: number;
    disabled: number;
  };
}

export class StartupValidator {
  private readonly TIMEOUT_MS = 10000; // 10 second timeout for validation

  async validateAll(): Promise<StartupValidationResult> {
    logger.info('🔍 Running startup validation...');
    
    const validations: ValidationStatus[] = [];

    // 1. Environment variables
    validations.push(this.validateEnvironmentVariables());

    // 2. Required services (Mercury)
    validations.push(await this.validateMercury());

    // 3. Optional services
    validations.push(await this.validateAttio());
    validations.push(await this.validatePosthog());

    const summary = this.calculateSummary(validations);
    const overall = this.determineOverallHealth(summary);

    const result: StartupValidationResult = {
      overall,
      validations,
      summary
    };

    this.logResults(result);
    return result;
  }

  private validateEnvironmentVariables(): ValidationStatus {
    const envResult = validateEnvironment();
    
    if (!envResult.valid) {
      return {
        service: 'Environment Variables',
        status: 'error',
        message: `Missing required variables: ${envResult.missing.join(', ')}`
      };
    }

    if (envResult.warnings.length > 0) {
      return {
        service: 'Environment Variables',
        status: 'warning',
        message: `Optional variables not set: ${envResult.warnings.length} features disabled`
      };
    }

    return {
      service: 'Environment Variables',
      status: 'healthy',
      message: 'All required variables configured'
    };
  }

  private async validateMercury(): Promise<ValidationStatus> {
    const startTime = Date.now();

    try {
      const client = new MercuryClient();
      
      // Quick test - just get accounts (lightweight call)
      const accounts = await Promise.race([
        client.getAccounts(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), this.TIMEOUT_MS)
        )
      ]);

      const responseTime = Date.now() - startTime;

      if (!accounts || accounts.length === 0) {
        return {
          service: 'Mercury Bank API',
          status: 'warning',
          message: 'Connected but no accounts found',
          responseTime
        };
      }

      return {
        service: 'Mercury Bank API',
        status: 'healthy',
        message: `Connected successfully (${accounts.length} accounts)`,
        responseTime
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      if (error.message?.includes('MERCURY_API_TOKEN')) {
        return {
          service: 'Mercury Bank API',
          status: 'error',
          message: 'API token not configured',
          responseTime
        };
      }

      if (error.message?.includes('Timeout')) {
        return {
          service: 'Mercury Bank API',
          status: 'error',
          message: 'Connection timeout (>10s)',
          responseTime
        };
      }

      return {
        service: 'Mercury Bank API',
        status: 'error',
        message: error.response?.status ? `HTTP ${error.response.status}` : error.message || 'Connection failed',
        responseTime
      };
    }
  }

  private async validateAttio(): Promise<ValidationStatus> {
    const startTime = Date.now();

    try {
      const collector = new AttioCollector();
      
      if (!process.env.ATTIO_API_KEY) {
        return {
          service: 'Attio CRM API',
          status: 'disabled',
          message: 'API key not configured'
        };
      }

      // Quick test - get basic data
      const result = await Promise.race([
        collector.collect(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), this.TIMEOUT_MS)
        )
      ]);

      const responseTime = Date.now() - startTime;

      if (result.error) {
        return {
          service: 'Attio CRM API',
          status: 'warning',
          message: result.error,
          responseTime
        };
      }

      return {
        service: 'Attio CRM API',
        status: 'healthy',
        message: 'Connected successfully',
        responseTime
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'Attio CRM API',
        status: 'error',
        message: error.message?.includes('Timeout') ? 'Connection timeout' : error.message || 'Connection failed',
        responseTime
      };
    }
  }

  private async validatePosthog(): Promise<ValidationStatus> {
    const startTime = Date.now();

    try {
      const collector = new PostHogCollector();

      if (!process.env.POSTHOG_API_KEY || !process.env.POSTHOG_PROJECT_ID) {
        return {
          service: 'PostHog Analytics API',
          status: 'disabled',
          message: 'API credentials not configured'
        };
      }

      const result = await Promise.race([
        collector.collect(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), this.TIMEOUT_MS)
        )
      ]);

      const responseTime = Date.now() - startTime;

      if (result.error) {
        return {
          service: 'PostHog Analytics API',
          status: 'warning',
          message: result.error,
          responseTime
        };
      }

      return {
        service: 'PostHog Analytics API',
        status: 'healthy',
        message: 'Connected successfully',
        responseTime
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'PostHog Analytics API',
        status: 'error',
        message: error.message?.includes('Timeout') ? 'Connection timeout' : error.message || 'Connection failed',
        responseTime
      };
    }
  }

  private calculateSummary(validations: ValidationStatus[]) {
    return {
      healthy: validations.filter(v => v.status === 'healthy').length,
      warnings: validations.filter(v => v.status === 'warning').length,
      errors: validations.filter(v => v.status === 'error').length,
      disabled: validations.filter(v => v.status === 'disabled').length
    };
  }

  private determineOverallHealth(summary: { healthy: number; warnings: number; errors: number; disabled: number }): 'healthy' | 'warning' | 'error' {
    if (summary.errors > 0) {return 'error';}
    if (summary.warnings > 0) {return 'warning';}
    return 'healthy';
  }

  private logResults(result: StartupValidationResult) {
    const icon = result.overall === 'healthy' ? '✅' : result.overall === 'warning' ? '⚠️' : '❌';
    
    logger.info(`${icon} Startup validation ${result.overall.toUpperCase()}`, {
      summary: result.summary,
      totalChecks: result.validations.length
    });

    // Log each validation
    result.validations.forEach(validation => {
      const statusIcon = {
        healthy: '✅',
        warning: '⚠️',
        error: '❌',
        disabled: '⏸️'
      }[validation.status];

      const timeInfo = validation.responseTime ? ` (${validation.responseTime}ms)` : '';
      
      logger.info(`${statusIcon} ${validation.service}: ${validation.message}${timeInfo}`);
    });

    // Summary message
    if (result.overall === 'error') {
      logger.error('❌ Startup validation failed! Some required services are unavailable.');
    } else if (result.overall === 'warning') {
      logger.warn('⚠️ Startup validation passed with warnings. Some optional features may not work.');
    } else {
      logger.info('🎉 All systems healthy! Ready to generate investor updates.');
    }
  }
}

// Quick validation function for CLI usage
export async function validateStartup(): Promise<boolean> {
  const validator = new StartupValidator();
  const result = await validator.validateAll();
  return result.overall !== 'error';
}