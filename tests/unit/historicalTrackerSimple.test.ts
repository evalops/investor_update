import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { HistoricalTracker } from '../../src/services/historicalTrackerSimple';
import { StartupMetrics } from '../../src/services/metricsCalculator';
import { format, subMonths } from 'date-fns';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('HistoricalTracker (File-based)', () => {
  let tracker: HistoricalTracker;
  let testDataDir: string;

  beforeEach(() => {
    // Use temporary directory for tests
    testDataDir = path.join(process.cwd(), 'test-history');
    tracker = new HistoricalTracker(testDataDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  });

  const createMockMetrics = (overrides: Partial<StartupMetrics> = {}): StartupMetrics => ({
    currentBalance: 50000,
    averageMonthlyBurn: 5000,
    averageMonthlyRevenue: 8000,
    runwayMonths: 10,
    monthOverMonthGrowth: 15,
    totalRevenue: 24000,
    totalExpenses: 15000,
    netCashFlow: 9000,
    monthlyMetrics: [],
    revenueGrowthRate: 20,
    expenseGrowthRate: 10,
    customersCount: 25,
    mrr: 8000,
    arr: 96000,
    cashEfficiency: 0.625,
    weeklyGrowthRate: 0.03,
    monthlyGrowthRate: 0.15,
    primaryMetric: {
      name: 'Revenue',
      value: 24000,
      growthRate: 0.15,
      weeklyGrowthRate: 0.03,
      target: 0.15,
      status: 'on-track' as const
    },
    ycGrowthScore: 7,
    weekOverWeekGrowth: [0.02, 0.03, 0.04],
    compoundGrowthRate: 0.18,
    foundingDate: new Date('2025-01-01'),
    daysSinceFounding: 200,
    timeToMilestones: {
      firstRevenue: { achieved: true, days: 30 },
      first1K: { achieved: true, days: 60 },
      first10K: { achieved: true, days: 120 }
    },
    aggressiveGrowthMetrics: {
      dailyGrowthRate: 0.001,
      weeklyVelocity: 400,
      monthlyTarget: 10000,
      burnMultiple: 1.6,
      velocityScore: 8
    },
    ...overrides
  });

  describe('Snapshot storage', () => {
    it('should save and retrieve metrics snapshots', async () => {
      const metrics = createMockMetrics();
      const month = '2025-08';

      await tracker.saveSnapshot(metrics, month);

      const retrieved = await tracker.getSnapshot(month);
      expect(retrieved).toBeDefined();
      expect(retrieved!.month).toBe(month);
      expect(retrieved!.summary.total_revenue).toBe(24000);
      expect(retrieved!.summary.mrr).toBe(8000);
      expect(retrieved!.summary.customers_count).toBe(25);
      expect(retrieved!.metrics.primaryMetric.name).toBe('Revenue');
    });

    it('should handle Infinity runway correctly', async () => {
      const metrics = createMockMetrics({ runwayMonths: Infinity });
      const month = '2025-08';

      await tracker.saveSnapshot(metrics, month);

      const retrieved = await tracker.getSnapshot(month);
      expect(retrieved!.summary.runway_months).toBe(Infinity);
      expect(retrieved!.metrics.runwayMonths).toBe(Infinity);
    });

    it('should return null for non-existent snapshots', async () => {
      const retrieved = await tracker.getSnapshot('2025-99');
      expect(retrieved).toBeNull();
    });
  });

  describe('Historical analysis', () => {
    it('should analyze trends across multiple months', async () => {
      const currentMonth = format(new Date(), 'yyyy-MM');
      const lastMonth = format(subMonths(new Date(), 1), 'yyyy-MM');

      // Save data for two months
      await tracker.saveSnapshot(createMockMetrics({ 
        totalRevenue: 20000, 
        mrr: 7000,
        customersCount: 20 
      }), lastMonth);

      await tracker.saveSnapshot(createMockMetrics({ 
        totalRevenue: 24000, 
        mrr: 8000,
        customersCount: 25 
      }), currentMonth);

      const trends = await tracker.analyzeTrends(6);
      expect(trends.length).toBeGreaterThan(0);

      const revenueTrend = trends.find(t => t.metric === 'Total Revenue');
      expect(revenueTrend).toBeDefined();
      expect(revenueTrend!.current_value).toBe(24000);
      expect(revenueTrend!.previous_value).toBe(20000);
      expect(revenueTrend!.change_percent).toBeCloseTo(20, 0);
      expect(revenueTrend!.trend).toBe('up');
    });

    it('should identify flat trends', async () => {
      const currentMonth = format(new Date(), 'yyyy-MM');
      const lastMonth = format(subMonths(new Date(), 1), 'yyyy-MM');

      // Save identical data for two months
      await tracker.saveSnapshot(createMockMetrics({ totalRevenue: 24000 }), lastMonth);
      await tracker.saveSnapshot(createMockMetrics({ totalRevenue: 24000 }), currentMonth);

      const trends = await tracker.analyzeTrends(6);
      const revenueTrend = trends.find(t => t.metric === 'Total Revenue');
      
      expect(revenueTrend!.trend).toBe('flat');
      expect(revenueTrend!.change_percent).toBeCloseTo(0, 1);
    });
  });

  describe('Milestone tracking', () => {
    it('should detect revenue milestones', async () => {
      // Save metrics that cross milestone thresholds
      await tracker.saveSnapshot(createMockMetrics({
        totalRevenue: 1500, // Above $1K threshold
        mrr: 1200,
        customersCount: 5
      }), '2025-07');

      await tracker.saveSnapshot(createMockMetrics({
        totalRevenue: 12000, // Above $10K threshold
        mrr: 2000,
        customersCount: 8
      }), '2025-08');

      const milestones = await tracker.getMilestones();
      expect(milestones.length).toBeGreaterThan(0);
      
      const milestoneNames = milestones.map(m => m.milestone_name);
      expect(milestoneNames).toContain('first_revenue');
      expect(milestoneNames).toContain('first_1k');
      expect(milestoneNames).toContain('first_10k');
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', async () => {
      await tracker.saveSnapshot(createMockMetrics(), '2025-07');
      await tracker.saveSnapshot(createMockMetrics(), '2025-08');

      const stats = await tracker.getStats();
      expect(stats.totalSnapshots).toBe(2);
      expect(stats.oldestSnapshot).toBe('2025-07');
      expect(stats.newestSnapshot).toBe('2025-08');
      expect(stats.dataSize).toBeGreaterThan(0);
    });

    it('should handle empty data directory', async () => {
      const stats = await tracker.getStats();
      expect(stats.totalSnapshots).toBe(0);
      expect(stats.oldestSnapshot).toBeUndefined();
      expect(stats.newestSnapshot).toBeUndefined();
    });
  });

  describe('Data export', () => {
    it('should export all historical data', async () => {
      await tracker.saveSnapshot(createMockMetrics({ totalRevenue: 20000 }), '2025-07');
      await tracker.saveSnapshot(createMockMetrics({ totalRevenue: 25000 }), '2025-08');

      const exported = await tracker.exportData();
      expect(exported.snapshots).toHaveLength(2);
      expect(exported.milestones).toBeArray();
      
      // Should be sorted newest first
      expect(exported.snapshots[0].month).toBe('2025-08');
      expect(exported.snapshots[1].month).toBe('2025-07');
    });
  });
});