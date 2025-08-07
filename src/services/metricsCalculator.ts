import { Transaction } from './mercuryClient';
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  format,
  parseISO,
  isWithinInterval,
  differenceInDays,
  differenceInCalendarDays,
  addDays,
  startOfWeek
} from 'date-fns';
import * as fs from 'fs';
import * as path from 'path';

interface CategoryConfig {
  categories: {
    [key: string]: {
      keywords: string[];
      priority: number;
    };
  };
  defaultCategory: string;
  minimumMatchScore: number;
}

export interface MonthlyMetrics {
  month: string;
  revenue: number;
  expenses: number;
  netBurn: number;
  transactionCount: number;
  largestExpense: { amount: number; description: string } | null;
  topExpenseCategories: { category: string; amount: number }[];
}

export interface StartupMetrics {
  currentBalance: number;
  averageMonthlyBurn: number;
  averageMonthlyRevenue: number;
  runwayMonths: number;
  monthOverMonthGrowth: number;
  totalRevenue: number;
  totalExpenses: number;
  netCashFlow: number;
  monthlyMetrics: MonthlyMetrics[];
  revenueGrowthRate: number;
  expenseGrowthRate: number;
  customersCount: number;
  mrr: number;
  arr: number;
  cashEfficiency: number;

  // YC-focused growth metrics
  weeklyGrowthRate: number; // YC target: 7%
  monthlyGrowthRate: number; // YC target: 15%
  primaryMetric: {
    name: string;
    value: number;
    growthRate: number;
    weeklyGrowthRate: number;
    target: number;
    status: 'on-track' | 'behind' | 'ahead';
  };
  ycGrowthScore: number; // 1-10 scale based on YC benchmarks
  weekOverWeekGrowth: number[];
  compoundGrowthRate: number;

  // Founding and milestone metrics
  foundingDate: Date;
  daysSinceFounding: number;
  timeToMilestones: {
    firstRevenue?: { achieved: boolean; days?: number; target?: Date };
    first1K?: { achieved: boolean; days?: number; target?: Date };
    first10K?: { achieved: boolean; days?: number; target?: Date };
    first100K?: { achieved: boolean; days?: number; target?: Date };
    firstCustomer?: { achieved: boolean; days?: number; target?: Date };
    break_even?: { achieved: boolean; days?: number; target?: Date };
  };
  aggressiveGrowthMetrics: {
    dailyGrowthRate: number;
    weeklyVelocity: number;
    monthlyTarget: number;
    burnMultiple: number; // Revenue multiple of burn rate
    velocityScore: number; // 1-10 based on speed to milestones
  };
}

export interface EvalOpsMetrics extends StartupMetrics {
  // Core EvalOps KPIs
  evalRuns: number;
  evalRunsGrowth: number;
  activeWorkspaces: number;
  activeWorkspacesGrowth: number;

  // Compute metrics
  gpuComputeSpend: number;
  cpuComputeSpend: number;
  totalComputeSpend: number;
  computeSpendGrowth: number;

  // Business metrics
  grossMargin: number;
  averageEvalDuration: number; // in minutes
  costPerEvalRun: number;

  // Pipeline metrics
  pipelineArr: number;
  bookedArr: number;

  // Monthly breakdowns
  monthlyEvalRuns: { month: string; evalRuns: number }[];
  monthlyComputeSpend: { month: string; gpu: number; cpu: number }[];
}

export class MetricsCalculator {
  private transactions: Transaction[];
  private categoryConfig: CategoryConfig;

  constructor(transactions: Transaction[]) {
    this.transactions = transactions.filter(t => t.postedDate).sort((a, b) =>
      new Date(a.postedDate || a.createdAt).getTime() - new Date(b.postedDate || b.createdAt).getTime()
    );
    this.categoryConfig = this.loadCategoryConfig();
  }

  async calculateEvalOpsMetrics(currentBalance: number, months: number = 6): Promise<{ metrics: EvalOpsMetrics; dataSourceStatus: any }> {
    // First calculate base startup metrics
    const baseMetrics = this.calculateMetrics(currentBalance, months);

    // Then enhance with EvalOps-specific data
    const { MetricsAggregator } = await import('./metricsAggregator');
    const aggregator = new MetricsAggregator();

    return await aggregator.aggregateEvalOpsMetrics(baseMetrics);
  }

  private loadCategoryConfig(): CategoryConfig {
    try {
      const configPath = path.join(process.cwd(), 'src', 'config', 'categories.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.warn('Could not load category config, using defaults:', error);
      return {
        categories: {},
        defaultCategory: 'Other',
        minimumMatchScore: 0.7
      };
    }
  }

  calculateMetrics(currentBalance: number, monthsToAnalyze: number = 6): StartupMetrics {
    const now = new Date();
    const startDate = subMonths(now, monthsToAnalyze);

    // Calculate founding date (Monday of this week)
    const foundingDate = this.getFoundingDate();
    const daysSinceFounding = differenceInCalendarDays(now, foundingDate);

    const monthlyMetrics = this.calculateMonthlyMetrics(startDate, now);
    const recentMonths = monthlyMetrics.slice(-3);

    const averageMonthlyBurn = this.calculateAverageMonthlyBurn(recentMonths);
    const averageMonthlyRevenue = this.calculateAverageMonthlyRevenue(recentMonths);
    const runwayMonths = this.calculateRunway(currentBalance, averageMonthlyBurn);
    const monthOverMonthGrowth = this.calculateMonthOverMonthGrowth(monthlyMetrics);

    const totalRevenue = monthlyMetrics.reduce((sum, m) => sum + m.revenue, 0);
    const totalExpenses = monthlyMetrics.reduce((sum, m) => sum + m.expenses, 0);
    const netCashFlow = totalRevenue - totalExpenses;

    const revenueGrowthRate = this.calculateGrowthRate(monthlyMetrics, 'revenue');
    const expenseGrowthRate = this.calculateGrowthRate(monthlyMetrics, 'expenses');

    const customersCount = this.estimateCustomerCount();
    const mrr = this.calculateMRR(recentMonths);
    const arr = mrr * 12;
    const cashEfficiency = averageMonthlyRevenue > 0 ? averageMonthlyBurn / averageMonthlyRevenue : 0;

    // Calculate YC-focused growth metrics
    const ycMetrics = this.calculateYCGrowthMetrics(monthlyMetrics, mrr, totalRevenue);

    // Calculate milestone and aggressive growth metrics
    const timeToMilestones = this.calculateTimeToMilestones(foundingDate, totalRevenue, customersCount, averageMonthlyRevenue, averageMonthlyBurn);
    const aggressiveGrowthMetrics = this.calculateAggressiveGrowthMetrics(daysSinceFounding, totalRevenue, mrr, averageMonthlyBurn, monthlyMetrics);

    return {
      currentBalance,
      averageMonthlyBurn,
      averageMonthlyRevenue,
      runwayMonths,
      monthOverMonthGrowth,
      totalRevenue,
      totalExpenses,
      netCashFlow,
      monthlyMetrics,
      revenueGrowthRate,
      expenseGrowthRate,
      customersCount,
      mrr,
      arr,
      cashEfficiency,
      foundingDate,
      daysSinceFounding,
      timeToMilestones,
      aggressiveGrowthMetrics,
      ...ycMetrics
    };
  }

  private calculateMonthlyMetrics(startDate: Date, endDate: Date): MonthlyMetrics[] {
    const metrics: MonthlyMetrics[] = [];
    let currentDate = startOfMonth(startDate);

    while (currentDate <= endDate) {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);

      const monthTransactions = this.transactions.filter(t => {
        const dateStr = t.postedDate || t.createdAt;
        if (!dateStr) return false;
        const transactionDate = parseISO(dateStr);
        return isWithinInterval(transactionDate, { start: monthStart, end: monthEnd });
      });

      const revenue = monthTransactions
        .filter(t => t.amount > 0 && t.kind !== 'transfer')
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = Math.abs(monthTransactions
        .filter(t => t.amount < 0 && t.kind !== 'transfer')
        .reduce((sum, t) => sum + t.amount, 0));

      const netBurn = expenses - revenue;

      const largestExpense = this.findLargestExpense(monthTransactions);
      const topExpenseCategories = this.getTopExpenseCategories(monthTransactions);

      metrics.push({
        month: format(currentDate, 'yyyy-MM'),
        revenue,
        expenses,
        netBurn,
        transactionCount: monthTransactions.length,
        largestExpense,
        topExpenseCategories
      });

      currentDate = addMonths(currentDate, 1);
    }

    return metrics;
  }

  private findLargestExpense(transactions: Transaction[]): { amount: number; description: string } | null {
    const expenses = transactions.filter(t => t.amount < 0);
    if (expenses.length === 0) return null;

    const largest = expenses.reduce((max, t) =>
      Math.abs(t.amount) > Math.abs(max.amount) ? t : max
    );

    return {
      amount: Math.abs(largest.amount),
      description: largest.description || largest.bankDescription || 'Unknown'
    };
  }

  private getTopExpenseCategories(transactions: Transaction[]): { category: string; amount: number }[] {
    const categoryMap = new Map<string, number>();

    transactions
      .filter(t => t.amount < 0)
      .forEach(t => {
        const category = t.category || this.inferCategory(t);
        const currentAmount = categoryMap.get(category) || 0;
        categoryMap.set(category, currentAmount + Math.abs(t.amount));
      });

    return Array.from(categoryMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }

  private inferCategory(transaction: Transaction): string {
    const description = (transaction.description || transaction.bankDescription || '').toLowerCase();

    let bestMatch = { category: this.categoryConfig.defaultCategory, score: 0 };

    for (const [categoryName, config] of Object.entries(this.categoryConfig.categories)) {
      const matchCount = config.keywords.filter(keyword =>
        description.includes(keyword.toLowerCase())
      ).length;

      if (matchCount > 0) {
        const score = matchCount / config.keywords.length;
        if (score > bestMatch.score && score >= this.categoryConfig.minimumMatchScore) {
          bestMatch = { category: categoryName, score };
        }
      }
    }

    return bestMatch.category;
  }

  private calculateAverageMonthlyBurn(recentMonths: MonthlyMetrics[]): number {
    if (recentMonths.length === 0) return 0;
    const totalBurn = recentMonths.reduce((sum, m) => sum + m.netBurn, 0);
    return totalBurn / recentMonths.length;
  }

  private calculateAverageMonthlyRevenue(recentMonths: MonthlyMetrics[]): number {
    if (recentMonths.length === 0) return 0;
    const totalRevenue = recentMonths.reduce((sum, m) => sum + m.revenue, 0);
    return totalRevenue / recentMonths.length;
  }

  private calculateRunway(currentBalance: number, monthlyBurn: number): number {
    if (monthlyBurn <= 0) return Infinity;
    return Math.floor(currentBalance / monthlyBurn);
  }

  private calculateMonthOverMonthGrowth(monthlyMetrics: MonthlyMetrics[]): number {
    if (monthlyMetrics.length < 2) return 0;

    const lastMonth = monthlyMetrics[monthlyMetrics.length - 1];
    const previousMonth = monthlyMetrics[monthlyMetrics.length - 2];

    if (previousMonth.revenue === 0) return lastMonth.revenue > 0 ? 100 : 0;

    return ((lastMonth.revenue - previousMonth.revenue) / previousMonth.revenue) * 100;
  }

  private calculateGrowthRate(monthlyMetrics: MonthlyMetrics[], metric: 'revenue' | 'expenses'): number {
    if (monthlyMetrics.length < 2) return 0;

    const values = monthlyMetrics.map(m => m[metric]);
    const firstNonZeroIndex = values.findIndex(v => v > 0);

    if (firstNonZeroIndex === -1 || firstNonZeroIndex === values.length - 1) return 0;

    const firstValue = values[firstNonZeroIndex];
    const lastValue = values[values.length - 1];
    const months = values.length - firstNonZeroIndex - 1;

    if (firstValue === 0 || months === 0) return 0;

    return (Math.pow(lastValue / firstValue, 1 / months) - 1) * 100;
  }

  private estimateCustomerCount(): number {
    const revenueTransactions = this.transactions.filter(t =>
      t.amount > 0 && t.kind !== 'transfer'
    );

    const uniqueCounterparties = new Set(
      revenueTransactions
        .map(t => t.counterpartyName)
        .filter(name => name && name.length > 0)
    );

    return uniqueCounterparties.size;
  }

  private calculateMRR(recentMonths: MonthlyMetrics[]): number {
    if (recentMonths.length === 0) return 0;

    const lastMonth = recentMonths[recentMonths.length - 1];
    const recurringRevenue = this.identifyRecurringRevenue(lastMonth.month);

    return recurringRevenue;
  }

  private identifyRecurringRevenue(month: string): number {
    const monthStart = startOfMonth(parseISO(month + '-01'));
    const monthEnd = endOfMonth(monthStart);

    const monthTransactions = this.transactions.filter(t => {
      const dateStr = t.postedDate || t.createdAt;
      if (!dateStr) return false;
      const transactionDate = parseISO(dateStr);
      return isWithinInterval(transactionDate, { start: monthStart, end: monthEnd }) &&
             t.amount > 0 &&
             t.kind !== 'transfer';
    });

    const recurringPatterns = new Map<string, number>();

    monthTransactions.forEach(t => {
      const counterparty = t.counterpartyName || 'Unknown';
      const similarTransactions = this.transactions.filter(other =>
        other.counterpartyName === counterparty &&
        other.amount > 0 &&
        other.id !== t.id
      );

      if (similarTransactions.length >= 1) { // Changed from >= 2 to >= 1 (total 2+ transactions = recurring)
        const currentAmount = recurringPatterns.get(counterparty) || 0;
        recurringPatterns.set(counterparty, Math.max(currentAmount, t.amount));
      }
    });

    return Array.from(recurringPatterns.values()).reduce((sum, amount) => sum + amount, 0);
  }

  private calculateYCGrowthMetrics(monthlyMetrics: MonthlyMetrics[], mrr: number, totalRevenue: number) {
    // Calculate weekly growth rate (YC target: 7%)
    const weeklyGrowthRate = this.calculateWeeklyGrowth(monthlyMetrics);

    // Calculate monthly growth rate (YC target: 15%)
    const monthlyGrowthRate = this.calculateMonthlyGrowth(monthlyMetrics);

    // Determine primary metric (YC philosophy: focus on ONE key metric)
    const primaryMetric = this.determinePrimaryMetric(monthlyMetrics, mrr, totalRevenue);

    // Calculate YC growth score (1-10 scale)
    const ycGrowthScore = this.calculateYCGrowthScore(monthlyGrowthRate, weeklyGrowthRate);

    // Calculate week-over-week growth array for trending
    const weekOverWeekGrowth = this.calculateWeekOverWeekGrowth(monthlyMetrics);

    // Calculate compound growth rate
    const compoundGrowthRate = this.calculateCompoundGrowthRate(monthlyMetrics);

    return {
      weeklyGrowthRate,
      monthlyGrowthRate,
      primaryMetric,
      ycGrowthScore,
      weekOverWeekGrowth,
      compoundGrowthRate
    };
  }

  private calculateWeeklyGrowth(monthlyMetrics: MonthlyMetrics[]): number {
    if (monthlyMetrics.length < 2) return 0;

    // Convert monthly growth to weekly (approximate)
    const latestRevenue = monthlyMetrics[monthlyMetrics.length - 1]?.revenue || 0;
    const previousRevenue = monthlyMetrics[monthlyMetrics.length - 2]?.revenue || 0;

    if (previousRevenue === 0) return 0;

    const monthlyGrowth = (latestRevenue - previousRevenue) / previousRevenue;
    // Convert to weekly: (1 + monthly)^(1/4) - 1
    return monthlyGrowth > 0 ? Math.pow(1 + monthlyGrowth, 0.25) - 1 : 0;
  }

  private calculateMonthlyGrowth(monthlyMetrics: MonthlyMetrics[]): number {
    if (monthlyMetrics.length < 2) return 0;

    const latestRevenue = monthlyMetrics[monthlyMetrics.length - 1]?.revenue || 0;
    const previousRevenue = monthlyMetrics[monthlyMetrics.length - 2]?.revenue || 0;

    if (previousRevenue === 0) return 0;

    return (latestRevenue - previousRevenue) / previousRevenue;
  }

  private determinePrimaryMetric(monthlyMetrics: MonthlyMetrics[], mrr: number, totalRevenue: number) {
    // YC philosophy: Choose ONE primary metric to focus on
    let primaryMetricName = 'Revenue';
    let primaryMetricValue = totalRevenue;
    let target = 0.15; // 15% MoM growth target

    // For early stage: focus on revenue if present, otherwise user metrics
    if (totalRevenue > 0) {
      primaryMetricName = 'Revenue';
      primaryMetricValue = totalRevenue;
      target = 0.15; // 15% MoM
    } else if (mrr > 0) {
      primaryMetricName = 'MRR';
      primaryMetricValue = mrr;
      target = 0.20; // 20% MoM for MRR
    } else {
      // For pre-revenue companies, focus on activity
      const latestTransactions = monthlyMetrics[monthlyMetrics.length - 1]?.transactionCount || 0;
      primaryMetricName = 'Transaction Volume';
      primaryMetricValue = latestTransactions;
      target = 0.30; // 30% MoM for early activity metrics
    }

    const growthRate = this.calculateMonthlyGrowth(monthlyMetrics);
    const weeklyGrowthRate = this.calculateWeeklyGrowth(monthlyMetrics);

    let status: 'on-track' | 'behind' | 'ahead' = 'behind';
    if (growthRate >= target) status = 'ahead';
    else if (growthRate >= target * 0.8) status = 'on-track';

    return {
      name: primaryMetricName,
      value: primaryMetricValue,
      growthRate,
      weeklyGrowthRate,
      target,
      status
    };
  }

  private calculateYCGrowthScore(monthlyGrowthRate: number, weeklyGrowthRate: number): number {
    // YC growth scoring (1-10 scale)
    // Based on YC benchmarks: 7% weekly = excellent, 15% monthly = good

    let score = 1;

    // Weekly growth scoring (worth 60% of total score)
    if (weeklyGrowthRate >= 0.07) score += 6; // 7% weekly = excellent
    else if (weeklyGrowthRate >= 0.05) score += 4; // 5% weekly = good
    else if (weeklyGrowthRate >= 0.03) score += 2; // 3% weekly = okay
    else if (weeklyGrowthRate >= 0.01) score += 1; // 1% weekly = minimal

    // Monthly growth scoring (worth 40% of total score)
    if (monthlyGrowthRate >= 0.15) score += 3; // 15% monthly = good
    else if (monthlyGrowthRate >= 0.10) score += 2; // 10% monthly = okay
    else if (monthlyGrowthRate >= 0.05) score += 1; // 5% monthly = minimal

    return Math.min(score, 10);
  }

  private calculateWeekOverWeekGrowth(monthlyMetrics: MonthlyMetrics[]): number[] {
    // Approximate week-over-week from monthly data
    const weeklyGrowth: number[] = [];

    for (let i = 1; i < monthlyMetrics.length; i++) {
      const current = monthlyMetrics[i].revenue;
      const previous = monthlyMetrics[i - 1].revenue;

      if (previous > 0) {
        const monthlyRate = (current - previous) / previous;
        // Convert to approximate weekly rate
        const weeklyRate = Math.pow(1 + monthlyRate, 0.25) - 1;
        weeklyGrowth.push(weeklyRate);
      }
    }

    return weeklyGrowth;
  }

  private calculateCompoundGrowthRate(monthlyMetrics: MonthlyMetrics[]): number {
    if (monthlyMetrics.length < 2) return 0;

    const firstRevenue = monthlyMetrics[0]?.revenue || 0;
    const lastRevenue = monthlyMetrics[monthlyMetrics.length - 1]?.revenue || 0;
    const periods = monthlyMetrics.length - 1;

    if (firstRevenue === 0 || periods === 0) return 0;

    // CAGR formula: (Ending/Beginning)^(1/periods) - 1
    return Math.pow(lastRevenue / firstRevenue, 1 / periods) - 1;
  }

  private getFoundingDate(): Date {
    // Founding date is Monday of this week (user said "founded on monday")
    const now = new Date();
    const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 }); // Monday = 1
    return startOfThisWeek;
  }

  private calculateTimeToMilestones(foundingDate: Date, totalRevenue: number, customersCount: number, monthlyRevenue: number, monthlyBurn: number) {
    const now = new Date();
    const daysSinceFounding = differenceInCalendarDays(now, foundingDate);

    // Helper function to find when milestone was achieved
    const findMilestoneAchievement = (targetRevenue: number) => {
      if (totalRevenue >= targetRevenue) {
        // Find approximately when this milestone was hit (simplified)
        const achievementDays = Math.min(daysSinceFounding, Math.floor(daysSinceFounding * (targetRevenue / totalRevenue)));
        return { achieved: true, days: achievementDays };
      }
      // Calculate target date based on current growth rate
      const remainingRevenue = targetRevenue - totalRevenue;
      const monthsToTarget = monthlyRevenue > 0 ? remainingRevenue / monthlyRevenue : 12;
      const targetDate = addDays(now, Math.floor(monthsToTarget * 30));
      return { achieved: false, target: targetDate };
    };

    return {
      firstRevenue: totalRevenue > 0
        ? { achieved: true, days: Math.min(1, daysSinceFounding) }
        : { achieved: false, target: addDays(foundingDate, 30) },
      first1K: findMilestoneAchievement(1000),
      first10K: findMilestoneAchievement(10000),
      first100K: findMilestoneAchievement(100000),
      firstCustomer: customersCount > 0
        ? { achieved: true, days: Math.min(1, daysSinceFounding) }
        : { achieved: false, target: addDays(foundingDate, 14) },
      break_even: monthlyRevenue >= monthlyBurn
        ? { achieved: true, days: daysSinceFounding }
        : { achieved: false, target: addDays(foundingDate, 180) } // 6 month target
    };
  }

  private calculateAggressiveGrowthMetrics(daysSinceFounding: number, totalRevenue: number, mrr: number, monthlyBurn: number, monthlyMetrics: MonthlyMetrics[]) {
    const dailyGrowthRate = daysSinceFounding > 0 ? Math.pow(1 + (totalRevenue / 1000), 1 / daysSinceFounding) - 1 : 0;

    // Weekly velocity = how fast we're moving toward goals
    const weeklyVelocity = daysSinceFounding > 0 ? (totalRevenue / daysSinceFounding) * 7 : 0;

    // Monthly target based on aggressive YC-style growth
    const currentMRR = mrr || 0;
    const monthlyTarget = Math.max(currentMRR * 1.15, 1000); // 15% growth or $1K minimum

    // Burn multiple = how many times revenue covers burn
    const burnMultiple = monthlyBurn > 0 ? (mrr || 0) / monthlyBurn : 0;

    // Velocity score: 1-10 based on speed to milestones
    let velocityScore = 1;
    if (daysSinceFounding <= 7) {
      // First week scoring
      if (totalRevenue >= 1000) velocityScore = 10;
      else if (totalRevenue >= 500) velocityScore = 8;
      else if (totalRevenue >= 100) velocityScore = 6;
      else if (totalRevenue > 0) velocityScore = 4;
    } else if (daysSinceFounding <= 30) {
      // First month scoring
      if (totalRevenue >= 10000) velocityScore = 10;
      else if (totalRevenue >= 5000) velocityScore = 8;
      else if (totalRevenue >= 1000) velocityScore = 6;
      else if (totalRevenue >= 100) velocityScore = 3;
    } else {
      // Beyond first month
      const monthlyGrowthRate = monthlyMetrics.length > 1 ? this.calculateGrowthRate(monthlyMetrics, 'revenue') : 0;
      if (monthlyGrowthRate >= 0.20) velocityScore = 10; // 20%+ growth
      else if (monthlyGrowthRate >= 0.15) velocityScore = 8; // 15%+ growth
      else if (monthlyGrowthRate >= 0.10) velocityScore = 6; // 10%+ growth
      else if (monthlyGrowthRate > 0) velocityScore = 3; // Any growth
    }

    return {
      dailyGrowthRate,
      weeklyVelocity,
      monthlyTarget,
      burnMultiple,
      velocityScore
    };
  }
}