import { describe, it, expect, beforeEach } from 'bun:test';
import { MetricsCalculator } from '../../src/services/metricsCalculator';
import { Transaction } from '../../src/services/mercuryClient';
import { subMonths, format } from 'date-fns';

describe('MetricsCalculator - Advanced Tests', () => {
  let calculator: MetricsCalculator;
  let transactions: Transaction[];
  const now = new Date();

  beforeEach(() => {
    transactions = [];
  });

  describe('Edge Cases', () => {
    it('should handle zero transactions', async () => {
      calculator = new MetricsCalculator([]);
      const result = await calculator.calculateMetrics(10000, 6);

      expect(result.metrics.totalRevenue).toBe(0);
      expect(result.metrics.totalExpenses).toBe(0);
      expect(result.metrics.averageMonthlyBurn).toBe(0);
      expect(result.metrics.runwayMonths).toBe(Infinity);
    });

    it('should handle only income transactions', async () => {
      transactions = [
        createTransaction('txn_1', 5000, 'Customer A', subMonths(now, 1)),
        createTransaction('txn_2', 3000, 'Customer B', subMonths(now, 0))
      ];

      calculator = new MetricsCalculator(transactions);
      const result = await calculator.calculateMetrics(10000, 6);

      expect(result.metrics.totalRevenue).toBe(8000);
      expect(result.metrics.totalExpenses).toBe(0);
      expect(result.metrics.averageMonthlyBurn).toBe(0);
      expect(result.metrics.runwayMonths).toBe(Infinity);
    });

    it('should handle only expense transactions', async () => {
      transactions = [
        createTransaction('txn_1', -2000, 'Vendor A', subMonths(now, 1)),
        createTransaction('txn_2', -3000, 'Vendor B', subMonths(now, 0))
      ];

      calculator = new MetricsCalculator(transactions);
      const result = await calculator.calculateMetrics(10000, 6);

      expect(result.metrics.totalRevenue).toBe(0);
      expect(result.metrics.totalExpenses).toBe(5000);
      expect(result.metrics.averageMonthlyBurn).toBeGreaterThan(0);
    });

    it('should handle large transaction volumes efficiently', async () => {
      // Generate 10,000 transactions
      transactions = Array.from({ length: 10000 }, (_, i) => 
        createTransaction(
          `txn_${i}`,
          Math.random() > 0.5 ? Math.random() * 1000 : -Math.random() * 1000,
          `Party ${i}`,
          subMonths(now, Math.floor(Math.random() * 12))
        )
      );

      calculator = new MetricsCalculator(transactions);
      const startTime = Date.now();
      const result = await calculator.calculateMetrics(10000, 12);
      const endTime = Date.now();

      // Should process in under 1 second
      expect(endTime - startTime).toBeLessThan(1000);
      expect(result.metrics.monthlyMetrics).toHaveLength(12);
    });
  });

  describe('MRR Calculation', () => {
    it('should identify recurring revenue correctly', async () => {
      // Create recurring subscription pattern
      const customer = 'SaaS Customer';
      transactions = [
        createTransaction('txn_1', 1000, customer, subMonths(now, 3)),
        createTransaction('txn_2', 1000, customer, subMonths(now, 2)),
        createTransaction('txn_3', 1000, customer, subMonths(now, 1)),
        createTransaction('txn_4', 1000, customer, now)
      ];

      calculator = new MetricsCalculator(transactions);
      const result = await calculator.calculateMetrics(10000, 6);

      expect(result.metrics.mrr).toBe(1000);
      expect(result.metrics.arr).toBe(12000);
    });

    it('should handle multiple recurring customers', async () => {
      transactions = [
        // Customer A - $500/month
        createTransaction('txn_1', 500, 'Customer A', subMonths(now, 2)),
        createTransaction('txn_2', 500, 'Customer A', subMonths(now, 1)),
        createTransaction('txn_3', 500, 'Customer A', now),
        // Customer B - $1500/month
        createTransaction('txn_4', 1500, 'Customer B', subMonths(now, 2)),
        createTransaction('txn_5', 1500, 'Customer B', subMonths(now, 1)),
        createTransaction('txn_6', 1500, 'Customer B', now),
        // Customer C - One-time payment (not recurring)
        createTransaction('txn_7', 5000, 'Customer C', subMonths(now, 1))
      ];

      calculator = new MetricsCalculator(transactions);
      const result = await calculator.calculateMetrics(10000, 6);

      expect(result.metrics.mrr).toBe(2000); // 500 + 1500
      expect(result.metrics.customersCount).toBe(2); // Only recurring customers
    });

    it('should detect churned customers', async () => {
      transactions = [
        // Customer A - Active
        createTransaction('txn_1', 1000, 'Customer A', subMonths(now, 1)),
        createTransaction('txn_2', 1000, 'Customer A', now),
        // Customer B - Churned (no recent payment)
        createTransaction('txn_3', 1000, 'Customer B', subMonths(now, 4)),
        createTransaction('txn_4', 1000, 'Customer B', subMonths(now, 3))
      ];

      calculator = new MetricsCalculator(transactions);
      const result = await calculator.calculateMetrics(10000, 6);

      expect(result.metrics.mrr).toBe(1000); // Only Customer A
      expect(result.metrics.customersCount).toBe(1);
    });
  });

  describe('Growth Metrics', () => {
    it('should calculate month-over-month growth correctly', async () => {
      transactions = [
        // Month 1: $1000 revenue
        createTransaction('txn_1', 1000, 'Customer A', subMonths(now, 2)),
        // Month 2: $1500 revenue (50% growth)
        createTransaction('txn_2', 1500, 'Customer B', subMonths(now, 1)),
        // Month 3: $2250 revenue (50% growth)
        createTransaction('txn_3', 2250, 'Customer C', now)
      ];

      calculator = new MetricsCalculator(transactions);
      const result = await calculator.calculateMetrics(10000, 3);

      expect(result.metrics.monthOverMonthGrowth).toBeCloseTo(50, 0);
    });

    it('should handle negative growth', async () => {
      transactions = [
        createTransaction('txn_1', 2000, 'Customer A', subMonths(now, 2)),
        createTransaction('txn_2', 1500, 'Customer B', subMonths(now, 1)),
        createTransaction('txn_3', 1000, 'Customer C', now)
      ];

      calculator = new MetricsCalculator(transactions);
      const result = await calculator.calculateMetrics(10000, 3);

      expect(result.metrics.monthOverMonthGrowth).toBeLessThan(0);
    });
  });

  describe('Burn Rate and Runway', () => {
    it('should calculate runway with current burn rate', async () => {
      transactions = [
        // Consistent $5000/month expenses
        createTransaction('txn_1', -5000, 'Expenses', subMonths(now, 2)),
        createTransaction('txn_2', -5000, 'Expenses', subMonths(now, 1)),
        createTransaction('txn_3', -5000, 'Expenses', now),
        // Some revenue
        createTransaction('txn_4', 1000, 'Revenue', subMonths(now, 1)),
        createTransaction('txn_5', 1000, 'Revenue', now)
      ];

      calculator = new MetricsCalculator(transactions);
      const balance = 20000;
      const result = await calculator.calculateMetrics(balance, 3);

      // Net burn = $5000 - $1000 = $4000/month
      // Runway = $20000 / $4000 = 5 months
      expect(result.metrics.averageMonthlyBurn).toBeCloseTo(4000, -2);
      expect(result.metrics.runwayMonths).toBeCloseTo(5, 0);
    });

    it('should handle variable burn rates', async () => {
      transactions = [
        createTransaction('txn_1', -3000, 'Expenses', subMonths(now, 2)),
        createTransaction('txn_2', -5000, 'Expenses', subMonths(now, 1)),
        createTransaction('txn_3', -7000, 'Expenses', now)
      ];

      calculator = new MetricsCalculator(transactions);
      const result = await calculator.calculateMetrics(30000, 3);

      // Average burn = (3000 + 5000 + 7000) / 3 = 5000
      expect(result.metrics.averageMonthlyBurn).toBeCloseTo(5000, -2);
      expect(result.metrics.runwayMonths).toBeCloseTo(6, 0);
    });
  });

  describe('Category Analysis', () => {
    it('should categorize expenses correctly', async () => {
      transactions = [
        createTransaction('txn_1', -5000, 'Google Cloud Platform', now, 'Cloud Services'),
        createTransaction('txn_2', -3000, 'AWS', now, 'Cloud Services'),
        createTransaction('txn_3', -10000, 'Employee Salary', now, 'Payroll'),
        createTransaction('txn_4', -2000, 'Office Rent', now, 'Operations')
      ];

      calculator = new MetricsCalculator(transactions);
      const result = await calculator.calculateMetrics(10000, 1);

      const lastMonth = result.metrics.monthlyMetrics[0];
      expect(lastMonth.topExpenseCategories).toBeDefined();
      
      const categories = lastMonth.topExpenseCategories;
      expect(categories[0].category).toBe('Payroll');
      expect(categories[0].amount).toBe(10000);
      
      // Cloud Services should be combined
      const cloudCategory = categories.find(c => c.category === 'Cloud Services');
      expect(cloudCategory?.amount).toBe(8000);
    });
  });

  describe('YC Growth Score', () => {
    it('should calculate high score for strong growth', async () => {
      // 20% week-over-week growth pattern
      const weeks = 4;
      transactions = [];
      for (let week = 0; week < weeks; week++) {
        const amount = 1000 * Math.pow(1.2, week);
        const date = new Date(now.getTime() - (weeks - week - 1) * 7 * 24 * 60 * 60 * 1000);
        transactions.push(createTransaction(`txn_${week}`, amount, 'Customer', date));
      }

      calculator = new MetricsCalculator(transactions);
      const result = await calculator.calculateMetrics(50000, 1);

      expect(result.metrics.ycGrowthScore).toBeGreaterThanOrEqual(8);
      expect(result.metrics.weeklyGrowthRate).toBeGreaterThan(0.15);
    });

    it('should calculate low score for declining metrics', async () => {
      transactions = [
        createTransaction('txn_1', 5000, 'Customer A', subMonths(now, 2)),
        createTransaction('txn_2', 3000, 'Customer B', subMonths(now, 1)),
        createTransaction('txn_3', 1000, 'Customer C', now),
        // High burn
        createTransaction('txn_4', -10000, 'Expenses', now)
      ];

      calculator = new MetricsCalculator(transactions);
      const result = await calculator.calculateMetrics(15000, 3);

      expect(result.metrics.ycGrowthScore).toBeLessThanOrEqual(5);
    });
  });
});

// Helper function to create test transactions
function createTransaction(
  id: string,
  amount: number,
  counterparty: string,
  date: Date,
  category?: string
): Transaction {
  return {
    id,
    accountId: 'test_account',
    amount,
    status: 'completed',
    kind: amount > 0 ? 'deposit' : 'externalTransfer',
    counterpartyName: counterparty,
    counterpartyId: `cp_${counterparty.replace(/\s/g, '_')}`,
    postedDate: format(date, 'yyyy-MM-dd'),
    createdAt: date.toISOString(),
    description: `Transaction with ${counterparty}`,
    bankDescription: `Bank: ${counterparty}`,
    category: category || (amount > 0 ? 'Income' : 'Expense')
  };
}