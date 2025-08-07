import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { MercuryClient } from '../../src/services/mercuryClient';
import { MetricsCalculator } from '../../src/services/metricsCalculator';
import { MetricsAggregator } from '../../src/services/metricsAggregator';
import { generateEmailUpdate } from '../../src/templates/template';
import { generateProfessionalHTML } from '../../src/templates/htmlTemplate';
// import { generateMarkdownUpdate } from '../../src/templates/markdownTemplate';
import { DataCache } from '../../src/utils/cache';

describe('End-to-End Integration Tests', () => {
  let cache: DataCache;

  beforeAll(() => {
    // Set up test environment variables
    process.env.NODE_ENV = 'test';
    process.env.MERCURY_API_TOKEN = process.env.MERCURY_API_TOKEN || 'test-token';
    
    // Initialize cache
    cache = new DataCache('./.cache-test');
  });

  afterAll(async () => {
    // Clean up
    await cache.clear();
  });

  describe('Metrics Calculation Pipeline', () => {
    test('should calculate basic metrics from mock data', async () => {
      const mockTransactions = [
        {
          id: 'tx1',
          amount: 5000,
          counterpartyName: 'Customer A',
          createdAt: '2025-07-01T10:00:00Z',
          postedAt: '2025-07-01T10:00:00Z',
          status: 'completed' as const,
          kind: 'credit',
          note: null,
          bankDescription: 'Payment received'
        },
        {
          id: 'tx2',
          amount: -2000,
          counterpartyName: 'Vendor B',
          createdAt: '2025-07-15T10:00:00Z',
          postedAt: '2025-07-15T10:00:00Z',
          status: 'completed' as const,
          kind: 'debit',
          note: null,
          bankDescription: 'Office supplies'
        }
      ];

      const calculator = new MetricsCalculator(mockTransactions);
      const metrics = calculator.calculateStartupMetrics();

      expect(metrics.totalRevenue).toBe(5000);
      expect(metrics.totalExpenses).toBe(2000);
      expect(metrics.netIncome).toBe(3000);
      expect(metrics.grossMargin).toBeGreaterThan(0);
    });

    test('should handle empty transaction list', async () => {
      const calculator = new MetricsCalculator([]);
      const metrics = calculator.calculateStartupMetrics();

      expect(metrics.totalRevenue).toBe(0);
      expect(metrics.totalExpenses).toBe(0);
      expect(metrics.netIncome).toBe(0);
      expect(metrics.burnRate).toBe(0);
    });
  });

  describe('Template Generation', () => {
    test('should generate email template with metrics', () => {
      const mockUpdate = {
        period: '2025-07',
        highlights: ['Launched new feature', 'Closed Series A'],
        challenges: ['Hiring senior engineers'],
        nextSteps: ['Expand to new markets']
      };

      const mockMetrics = {
        mrr: 50000,
        arr: 600000,
        totalRevenue: 150000,
        totalExpenses: 100000,
        netIncome: 50000,
        burnRate: 25000,
        runway: 12,
        customerCount: 100,
        grossMargin: 65,
        averageMonthlyRevenue: 50000,
        evalRuns: 0,
        evalRunsGrowth: 0,
        activeWorkspaces: 0,
        activeWorkspacesGrowth: 0,
        averageEvalDuration: 0,
        monthlyEvalRuns: [],
        gpuComputeSpend: 0,
        cpuComputeSpend: 0,
        totalComputeSpend: 0,
        computeSpendGrowth: 0,
        costPerEvalRun: 0,
        monthlyComputeSpend: [],
        pipelineArr: 0,
        bookedArr: 0
      };

      const emailContent = generateEmailUpdate(mockUpdate, mockMetrics);
      
      expect(emailContent).toContain('Monthly Investor Update');
      expect(emailContent).toContain('$50,000');
      expect(emailContent).toContain('100 customers');
      expect(emailContent).toContain('Launched new feature');
    });

    test('should generate HTML template with charts', () => {
      const mockUpdate = {
        period: '2025-07',
        highlights: ['Growth milestone achieved'],
        challenges: [],
        nextSteps: ['Scale operations']
      };

      const mockMetrics = {
        mrr: 75000,
        arr: 900000,
        totalRevenue: 200000,
        totalExpenses: 120000,
        netIncome: 80000,
        burnRate: 30000,
        runway: 15,
        customerCount: 150,
        grossMargin: 70,
        averageMonthlyRevenue: 75000,
        evalRuns: 1000,
        evalRunsGrowth: 25,
        activeWorkspaces: 50,
        activeWorkspacesGrowth: 15,
        averageEvalDuration: 120,
        monthlyEvalRuns: [],
        gpuComputeSpend: 5000,
        cpuComputeSpend: 3000,
        totalComputeSpend: 8000,
        computeSpendGrowth: 10,
        costPerEvalRun: 8,
        monthlyComputeSpend: [],
        pipelineArr: 100000,
        bookedArr: 950000
      };

      const htmlContent = generateProfessionalHTML(mockUpdate);
      
      expect(htmlContent).toContain('<!DOCTYPE html>');
      expect(htmlContent).toContain('<canvas');
      expect(htmlContent).toContain('$75,000');
      expect(htmlContent).toContain('Growth milestone achieved');
    });

    // Markdown template test disabled - template doesn't exist yet
    test.skip('should generate Markdown template', () => {
      // Test implementation when markdownTemplate.ts is created
    });
  });

  describe('Cache Integration', () => {
    test('should cache and retrieve data correctly', async () => {
      const testData = { 
        metrics: { mrr: 100000 },
        timestamp: new Date().toISOString()
      };

      await cache.set('test-key', testData, 1); // 1 minute TTL
      const retrieved = await cache.get('test-key');
      
      expect(retrieved).toEqual(testData);
    });

    test('should handle cache misses', async () => {
      const result = await cache.get('non-existent-key');
      expect(result).toBeNull();
    });

    test('should respect TTL', async () => {
      await cache.set('ttl-test', { value: 'test' }, 0.001); // Very short TTL
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = await cache.get('ttl-test');
      expect(result).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid Mercury API token gracefully', () => {
      delete process.env.MERCURY_API_TOKEN;
      
      expect(() => new MercuryClient()).toThrow('MERCURY_API_TOKEN not found');
      
      // Restore for other tests
      process.env.MERCURY_API_TOKEN = 'test-token';
    });

    test('should handle metrics calculation with invalid data', () => {
      const invalidTransactions = [
        { 
          id: 'invalid',
          // Missing required fields
        } as any
      ];

      const calculator = new MetricsCalculator(invalidTransactions);
      const metrics = calculator.calculateStartupMetrics();
      
      // Should return safe defaults
      expect(metrics.totalRevenue).toBe(0);
      expect(metrics.totalExpenses).toBe(0);
    });
  });

  describe('Metrics Aggregation', () => {
    test('should aggregate metrics from multiple sources', async () => {
      const aggregator = new MetricsAggregator();
      
      const baseMetrics = {
        mrr: 50000,
        arr: 600000,
        totalRevenue: 150000,
        totalExpenses: 100000,
        netIncome: 50000,
        burnRate: 25000,
        runway: 12,
        customerCount: 100,
        grossMargin: 65,
        averageMonthlyRevenue: 50000
      };

      // This will fail with real API calls, but tests the structure
      const result = await aggregator.aggregateEvalOpsMetrics(baseMetrics);
      
      expect(result.metrics).toBeDefined();
      expect(result.dataSourceStatus).toBeDefined();
      expect(result.metrics.mrr).toBe(50000);
    });
  });
});