import { promises as fs } from 'fs';
import path from 'path';

import { format, parseISO, startOfMonth, subMonths } from 'date-fns';

import { logger } from '../utils/logger';

import type { StartupMetrics, EvalOpsMetrics } from './metricsCalculator';

export interface MetricsSnapshot {
  month: string; // YYYY-MM format
  recorded_at: string; // ISO timestamp
  metrics: StartupMetrics | EvalOpsMetrics;
  
  // Extracted key metrics for easy analysis
  summary: {
    total_revenue: number;
    mrr: number;
    customers_count: number;
    monthly_burn: number;
    yc_growth_score: number;
    primary_metric_value: number;
    runway_months: number;
  };
}

export interface TrendAnalysis {
  metric: string;
  current_value: number;
  previous_value?: number;
  change_percent?: number;
  change_absolute?: number;
  trend: 'up' | 'down' | 'flat' | 'new';
  months_of_data: number;
  best_month?: { month: string; value: number };
  worst_month?: { month: string; value: number };
}

export class HistoricalTracker {
  private dataDir: string;

  constructor(dataDir: string = './data/history') {
    this.dataDir = path.resolve(dataDir);
    this.ensureDataDirectory();
    logger.info('Historical tracker initialized', { dataDir: this.dataDir });
  }

  private async ensureDataDirectory() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create data directory', { error, dataDir: this.dataDir });
      throw error;
    }
  }

  private getSnapshotPath(month: string): string {
    return path.join(this.dataDir, `${month}.json`);
  }

  /**
   * Store a monthly metrics snapshot
   */
  async saveSnapshot(metrics: StartupMetrics | EvalOpsMetrics, month?: string): Promise<void> {
    const snapshotMonth = month || format(startOfMonth(new Date()), 'yyyy-MM');
    const recordedAt = new Date().toISOString();

    const snapshot: MetricsSnapshot = {
      month: snapshotMonth,
      recorded_at: recordedAt,
      metrics,
      summary: {
        total_revenue: metrics.totalRevenue,
        mrr: metrics.mrr,
        customers_count: metrics.customersCount,
        monthly_burn: metrics.averageMonthlyBurn,
        yc_growth_score: metrics.ycGrowthScore,
        primary_metric_value: metrics.primaryMetric.value,
        runway_months: metrics.runwayMonths === Infinity ? -1 : metrics.runwayMonths
      }
    };

    const snapshotPath = this.getSnapshotPath(snapshotMonth);
    
    try {
      await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
      logger.info('Metrics snapshot saved', { month: snapshotMonth, recordedAt });
    } catch (error) {
      logger.error('Failed to save snapshot', { error, month: snapshotMonth });
      throw error;
    }
  }

  /**
   * Get snapshot for specific month
   */
  async getSnapshot(month: string): Promise<MetricsSnapshot | null> {
    const snapshotPath = this.getSnapshotPath(month);
    
    try {
      const data = await fs.readFile(snapshotPath, 'utf-8');
      const snapshot = JSON.parse(data) as MetricsSnapshot;
      
      // Convert runway back from storage format
      if (snapshot.summary.runway_months === -1) {
        snapshot.summary.runway_months = Infinity;
        snapshot.metrics.runwayMonths = Infinity;
      }
      
      return snapshot;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      logger.error('Failed to read snapshot', { error, month });
      throw error;
    }
  }

  /**
   * Get historical snapshots for trend analysis
   */
  async getSnapshots(months: number = 12): Promise<MetricsSnapshot[]> {
    const snapshots: MetricsSnapshot[] = [];
    
    // Generate list of months to check (going backwards from current month)
    const currentDate = startOfMonth(new Date());
    const monthsToCheck: string[] = [];
    
    for (let i = 0; i < months; i++) {
      const monthDate = subMonths(currentDate, i);
      monthsToCheck.push(format(monthDate, 'yyyy-MM'));
    }

    // Load existing snapshots
    for (const month of monthsToCheck) {
      const snapshot = await this.getSnapshot(month);
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }

    // Sort by month descending (newest first)
    return snapshots.sort((a, b) => b.month.localeCompare(a.month));
  }

  /**
   * Analyze trends for key metrics
   */
  async analyzeTrends(months: number = 6): Promise<TrendAnalysis[]> {
    const snapshots = await this.getSnapshots(months);
    if (snapshots.length === 0) {
      return [];
    }

    const current = snapshots[0]; // Most recent
    const previous = snapshots.length > 1 ? snapshots[1] : null;
    
    const trends: TrendAnalysis[] = [];

    // Define metrics to analyze
    const metricsToAnalyze = [
      { key: 'total_revenue', name: 'Total Revenue' },
      { key: 'mrr', name: 'Monthly Recurring Revenue' },
      { key: 'customers_count', name: 'Customer Count' },
      { key: 'monthly_burn', name: 'Monthly Burn Rate' },
      { key: 'yc_growth_score', name: 'YC Growth Score' }
    ];

    for (const metric of metricsToAnalyze) {
      const currentValue = current.summary[metric.key as keyof typeof current.summary] as number;
      const previousValue = previous ? previous.summary[metric.key as keyof typeof previous.summary] as number : undefined;
      
      // Calculate change
      let changePercent: number | undefined;
      let changeAbsolute: number | undefined;
      let trend: TrendAnalysis['trend'] = 'new';

      if (previousValue !== undefined && previousValue !== 0) {
        changeAbsolute = currentValue - previousValue;
        changePercent = (changeAbsolute / previousValue) * 100;
        
        if (Math.abs(changePercent) < 1) {trend = 'flat';}
        else {trend = changePercent > 0 ? 'up' : 'down';}
      }

      // Find best and worst months
      const values = snapshots.map(s => ({
        month: s.month,
        value: s.summary[metric.key as keyof typeof s.summary] as number
      }));
      
      const bestMonth = values.reduce((best, curr) => curr.value > best.value ? curr : best);
      const worstMonth = values.reduce((worst, curr) => curr.value < worst.value ? curr : worst);

      trends.push({
        metric: metric.name,
        current_value: currentValue,
        previous_value: previousValue,
        change_percent: changePercent,
        change_absolute: changeAbsolute,
        trend,
        months_of_data: snapshots.length,
        best_month: bestMonth.value !== currentValue ? bestMonth : undefined,
        worst_month: worstMonth.value !== currentValue ? worstMonth : undefined
      });
    }

    return trends;
  }

  /**
   * Get milestones achieved (simplified version)
   */
  async getMilestones(): Promise<Array<{ milestone_name: string; achieved_month: string; value: number }>> {
    const snapshots = await this.getSnapshots(12);
    const milestones: Array<{ milestone_name: string; achieved_month: string; value: number }> = [];
    
    // Check for revenue milestones
    const revenueThresholds = [
      { name: 'first_revenue', threshold: 1 },
      { name: 'first_1k', threshold: 1000 },
      { name: 'first_10k', threshold: 10000 },
      { name: 'first_100k', threshold: 100000 }
    ];

    for (const threshold of revenueThresholds) {
      const achievedSnapshot = snapshots
        .reverse() // Oldest first
        .find(s => s.summary.total_revenue >= threshold.threshold);
      
      if (achievedSnapshot) {
        milestones.push({
          milestone_name: threshold.name,
          achieved_month: achievedSnapshot.month,
          value: achievedSnapshot.summary.total_revenue
        });
      }
    }

    return milestones.reverse(); // Most recent first
  }

  /**
   * Get statistics about historical data
   */
  async getStats(): Promise<{
    totalSnapshots: number;
    oldestSnapshot?: string;
    newestSnapshot?: string;
    totalMilestones: number;
    dataSize: number;
  }> {
    const snapshots = await this.getSnapshots(999); // Get all
    const milestones = await this.getMilestones();
    
    // Calculate total data size
    let totalSize = 0;
    try {
      const files = await fs.readdir(this.dataDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const stats = await fs.stat(path.join(this.dataDir, file));
          totalSize += stats.size;
        }
      }
    } catch (error) {
      logger.warn('Failed to calculate data size', { error });
    }

    return {
      totalSnapshots: snapshots.length,
      oldestSnapshot: snapshots.length > 0 ? snapshots[snapshots.length - 1].month : undefined,
      newestSnapshot: snapshots.length > 0 ? snapshots[0].month : undefined,
      totalMilestones: milestones.length,
      dataSize: totalSize
    };
  }

  /**
   * Export all historical data
   */
  async exportData(): Promise<{ snapshots: MetricsSnapshot[]; milestones: any[] }> {
    const snapshots = await this.getSnapshots(999); // Get all
    const milestones = await this.getMilestones();
    
    return { snapshots, milestones };
  }
}