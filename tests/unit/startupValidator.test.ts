import { describe, it, expect, beforeEach } from 'bun:test';
import { StartupValidator, type ValidationStatus } from '../../src/utils/startupValidator';

describe('StartupValidator', () => {
  let validator: StartupValidator;

  beforeEach(() => {
    validator = new StartupValidator();
    // Set up test environment
    process.env.MERCURY_API_TOKEN = 'test-token';
  });

  describe('Environment validation', () => {
    it('should validate environment variables correctly', async () => {
      const result = await validator.validateAll();
      
      expect(result).toBeDefined();
      expect(result.overall).toMatch(/healthy|warning|error/);
      expect(result.validations).toBeArray();
      expect(result.summary).toBeDefined();
      
      // Should have all expected services
      const services = result.validations.map(v => v.service);
      expect(services).toContain('Environment Variables');
      expect(services).toContain('Mercury Bank API');
      expect(services).toContain('Attio CRM API');
      expect(services).toContain('PostHog Analytics API');
    });

    it('should have proper validation status structure', async () => {
      const result = await validator.validateAll();
      
      result.validations.forEach((validation: ValidationStatus) => {
        expect(validation.service).toBeString();
        expect(validation.status).toMatch(/healthy|warning|error|disabled/);
        expect(validation.message).toBeString();
        
        if (validation.responseTime !== undefined) {
          expect(validation.responseTime).toBeNumber();
          expect(validation.responseTime).toBeGreaterThan(0);
        }
      });
    });

    it('should calculate summary correctly', async () => {
      const result = await validator.validateAll();
      
      const { summary } = result;
      const total = summary.healthy + summary.warnings + summary.errors + summary.disabled;
      
      expect(total).toBe(result.validations.length);
      expect(summary.healthy).toBeGreaterThanOrEqual(0);
      expect(summary.warnings).toBeGreaterThanOrEqual(0);
      expect(summary.errors).toBeGreaterThanOrEqual(0);
      expect(summary.disabled).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing Mercury token gracefully', async () => {
      delete process.env.MERCURY_API_TOKEN;
      
      const result = await validator.validateAll();
      
      // Should detect the missing token
      const envValidation = result.validations.find(v => v.service === 'Environment Variables');
      const mercuryValidation = result.validations.find(v => v.service === 'Mercury Bank API');
      
      expect(envValidation?.status).toBe('error');
      expect(mercuryValidation?.status).toBe('error');
      expect(result.overall).toBe('error');
      
      // Restore for other tests
      process.env.MERCURY_API_TOKEN = 'test-token';
    });

    it('should mark optional services as disabled when not configured', async () => {
      // Ensure optional services are not configured
      delete process.env.ATTIO_API_KEY;
      delete process.env.POSTHOG_API_KEY;
      
      const result = await validator.validateAll();
      
      const attioValidation = result.validations.find(v => v.service === 'Attio CRM API');
      const posthogValidation = result.validations.find(v => v.service === 'PostHog Analytics API');
      
      expect(attioValidation?.status).toBe('disabled');
      expect(posthogValidation?.status).toBe('disabled');
      expect(result.summary.disabled).toBeGreaterThanOrEqual(2);
    });
  });
});