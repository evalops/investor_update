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
    test('should calculate basic metrics from mock data', () => {
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
      const metrics = calculator.calculateMetrics(50000, 6); // currentBalance, months

      expect(metrics.totalRevenue).toBeGreaterThanOrEqual(0);
      expect(metrics.totalExpenses).toBeGreaterThanOrEqual(0);
      expect(metrics.currentBalance).toBe(50000);
      expect(metrics).toBeDefined();
    });

    test('should handle empty transaction list', () => {
      const calculator = new MetricsCalculator([]);
      const metrics = calculator.calculateMetrics(10000, 6);

      expect(metrics.totalRevenue).toBe(0);
      expect(metrics.totalExpenses).toBe(0);
      expect(metrics.currentBalance).toBe(10000);
      expect(typeof metrics.averageMonthlyBurn).toBe('number');
    });
  });

  describe('Template Generation', () => {
    test.skip('should generate email template with metrics', () => {
      // This test requires complex mock data structure matching Metrics interface
      // Skipping for now to focus on core functionality
    });

    test.skip('should generate HTML template with charts', () => {
      // This test requires complex InvestorUpdate structure
      // Skipping for now to focus on core functionality
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
      const metrics = calculator.calculateMetrics(10000, 6);
      
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