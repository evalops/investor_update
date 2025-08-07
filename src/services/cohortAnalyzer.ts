import { format, parseISO, startOfMonth, addMonths, differenceInMonths } from 'date-fns';

import type { Transaction } from './mercuryClient';

export interface CustomerCohort {
  cohortMonth: string; // YYYY-MM format
  customersAcquired: number;
  totalRevenue: number;
  averageOrderValue: number;
  // Retention by month (0 = first month, 1 = second month, etc.)
  retentionByMonth: { [month: number]: number };
  // Revenue retention by month
  revenueRetentionByMonth: { [month: number]: number };
}

export interface CohortMetrics {
  cohorts: CustomerCohort[];
  overallRetentionRates: { [month: number]: number };
  netRevenueRetention: number; // NRR
  lifetimeValue: number; // LTV
  averageLifespanMonths: number;
  churnRate: number; // Monthly churn rate
  cohortTable: CohortTableData;
}

export interface CohortTableData {
  headers: string[]; // ['Cohort', 'Month 0', 'Month 1', 'Month 2', ...]
  rows: CohortTableRow[];
}

export interface CohortTableRow {
  cohortMonth: string;
  retentionRates: number[]; // Retention % for each month
  customerCounts: number[]; // Absolute customer counts for each month
}

export interface CustomerTransaction {
  customerId: string;
  amount: number;
  date: Date;
  isRecurring: boolean;
}

export class CohortAnalyzer {
  private transactions: Transaction[];
  private customerTransactions: CustomerTransaction[];

  constructor(transactions: Transaction[]) {
    this.transactions = transactions.filter(t => t.postedDate && t.amount > 0);
    this.customerTransactions = this.identifyCustomerTransactions();
  }

  private identifyCustomerTransactions(): CustomerTransaction[] {
    const customerTxns: CustomerTransaction[] = [];
    const customerPatterns = new Map<string, { amounts: number[], dates: Date[], totalTxns: number }>();

    // Group transactions by counterparty to identify customers
    this.transactions.forEach(txn => {
      if (!txn.counterpartyName || txn.amount <= 0) {return;}

      const customerKey = this.normalizeCustomerName(txn.counterpartyName);
      const txnDate = parseISO(txn.postedDate!);

      if (!customerPatterns.has(customerKey)) {
        customerPatterns.set(customerKey, { amounts: [], dates: [], totalTxns: 0 });
      }

      const pattern = customerPatterns.get(customerKey)!;
      pattern.amounts.push(txn.amount);
      pattern.dates.push(txnDate);
      pattern.totalTxns++;
    });

    // Convert to customer transactions with recurring detection
    customerPatterns.forEach((pattern, customerKey) => {
      const isRecurringCustomer = this.isRecurringCustomer(pattern);

      pattern.amounts.forEach((amount, index) => {
        customerTxns.push({
          customerId: customerKey,
          amount,
          date: pattern.dates[index],
          isRecurring: isRecurringCustomer
        });
      });
    });

    return customerTxns.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private normalizeCustomerName(name: string): string {
    // Normalize customer names to group similar entities
    return name.toLowerCase()
      .replace(/\b(inc|llc|corp|ltd|co|company)\b/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private isRecurringCustomer(pattern: { amounts: number[], dates: Date[], totalTxns: number }): boolean {
    // Consider a customer recurring if they have multiple transactions with similar amounts
    if (pattern.totalTxns < 2) {return false;}

    const amounts = pattern.amounts.sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];

    // Check if most transactions are within 20% of the median amount
    const similarAmounts = amounts.filter(amt =>
      Math.abs(amt - median) / median <= 0.2
    ).length;

    return similarAmounts / amounts.length >= 0.6; // 60% of transactions have similar amounts
  }

  generateCohortAnalysis(): CohortMetrics {
    if (this.customerTransactions.length === 0) {
      return this.createEmptyCohortMetrics();
    }

    const cohorts = this.buildCohorts();
    const overallRetentionRates = this.calculateOverallRetentionRates(cohorts);
    const netRevenueRetention = this.calculateNetRevenueRetention(cohorts);
    const lifetimeValue = this.calculateLifetimeValue(cohorts);
    const averageLifespanMonths = this.calculateAverageLifespan(cohorts);
    const churnRate = this.calculateChurnRate(cohorts);
    const cohortTable = this.buildCohortTable(cohorts);

    return {
      cohorts,
      overallRetentionRates,
      netRevenueRetention,
      lifetimeValue,
      averageLifespanMonths,
      churnRate,
      cohortTable
    };
  }

  private buildCohorts(): CustomerCohort[] {
    const cohortMap = new Map<string, CustomerCohort>();
    const customerFirstSeen = new Map<string, string>(); // customerId -> cohortMonth

    // Group customers by their first transaction month
    this.customerTransactions.forEach(txn => {
      const txnMonth = format(startOfMonth(txn.date), 'yyyy-MM');

      if (!customerFirstSeen.has(txn.customerId)) {
        customerFirstSeen.set(txn.customerId, txnMonth);

        if (!cohortMap.has(txnMonth)) {
          cohortMap.set(txnMonth, {
            cohortMonth: txnMonth,
            customersAcquired: 0,
            totalRevenue: 0,
            averageOrderValue: 0,
            retentionByMonth: {},
            revenueRetentionByMonth: {}
          });
        }

        cohortMap.get(txnMonth)!.customersAcquired++;
      }
    });

    // Calculate retention and revenue for each cohort
    cohortMap.forEach(cohort => {
      this.calculateCohortRetention(cohort, customerFirstSeen);
    });

    return Array.from(cohortMap.values()).sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth));
  }

  private calculateCohortRetention(cohort: CustomerCohort, customerFirstSeen: Map<string, string>) {
    const cohortStartDate = parseISO(cohort.cohortMonth + '-01');
    const cohortCustomers = Array.from(customerFirstSeen.entries())
      .filter(([_, firstMonth]) => firstMonth === cohort.cohortMonth)
      .map(([customerId, _]) => customerId);

    // Track customers and revenue by month for up to 12 months
    for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
      const currentMonth = format(addMonths(cohortStartDate, monthOffset), 'yyyy-MM');

      const activeCustomers = new Set<string>();
      let monthRevenue = 0;

      // Check which customers were active in this month
      this.customerTransactions.forEach(txn => {
        const txnMonth = format(startOfMonth(txn.date), 'yyyy-MM');
        if (txnMonth === currentMonth && cohortCustomers.includes(txn.customerId)) {
          activeCustomers.add(txn.customerId);
          monthRevenue += txn.amount;
        }
      });

      // Calculate retention rates
      const retentionRate = activeCustomers.size / cohort.customersAcquired;
      cohort.retentionByMonth[monthOffset] = retentionRate;

      // Calculate revenue retention (compared to first month revenue)
      if (monthOffset === 0) {
        cohort.totalRevenue = monthRevenue;
        cohort.revenueRetentionByMonth[monthOffset] = 1.0;
      } else {
        const revenueRetentionRate = cohort.totalRevenue > 0 ? monthRevenue / cohort.totalRevenue : 0;
        cohort.revenueRetentionByMonth[monthOffset] = revenueRetentionRate;
      }
    }

    cohort.averageOrderValue = cohort.customersAcquired > 0 ? cohort.totalRevenue / cohort.customersAcquired : 0;
  }

  private calculateOverallRetentionRates(cohorts: CustomerCohort[]): { [month: number]: number } {
    const overallRates: { [month: number]: number } = {};

    for (let month = 0; month < 12; month++) {
      const cohortsWithData = cohorts.filter(c => c.retentionByMonth[month] !== undefined);
      if (cohortsWithData.length === 0) {continue;}

      const weightedSum = cohortsWithData.reduce((sum, cohort) => {
        return sum + (cohort.retentionByMonth[month] * cohort.customersAcquired);
      }, 0);

      const totalCustomers = cohortsWithData.reduce((sum, cohort) => sum + cohort.customersAcquired, 0);

      overallRates[month] = totalCustomers > 0 ? weightedSum / totalCustomers : 0;
    }

    return overallRates;
  }

  private calculateNetRevenueRetention(cohorts: CustomerCohort[]): number {
    // Calculate 12-month NRR across all cohorts
    const cohortsWithFullYear = cohorts.filter(c => c.revenueRetentionByMonth[11] !== undefined);
    if (cohortsWithFullYear.length === 0) {return 0;}

    const weightedNRR = cohortsWithFullYear.reduce((sum, cohort) => {
      return sum + (cohort.revenueRetentionByMonth[11] * cohort.totalRevenue);
    }, 0);

    const totalRevenue = cohortsWithFullYear.reduce((sum, cohort) => sum + cohort.totalRevenue, 0);

    return totalRevenue > 0 ? (weightedNRR / totalRevenue) * 100 : 0;
  }

  private calculateLifetimeValue(cohorts: CustomerCohort[]): number {
    if (cohorts.length === 0) {return 0;}

    // Use average revenue per customer across all cohorts
    const totalRevenue = cohorts.reduce((sum, cohort) => sum + cohort.totalRevenue, 0);
    const totalCustomers = cohorts.reduce((sum, cohort) => sum + cohort.customersAcquired, 0);

    return totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
  }

  private calculateAverageLifespan(cohorts: CustomerCohort[]): number {
    if (cohorts.length === 0) {return 0;}

    let totalWeightedLifespan = 0;
    let totalCustomers = 0;

    cohorts.forEach(cohort => {
      // Calculate average lifespan based on retention curve
      let lifespan = 0;
      for (let month = 0; month < 12; month++) {
        if (cohort.retentionByMonth[month] !== undefined) {
          lifespan += cohort.retentionByMonth[month];
        }
      }

      totalWeightedLifespan += lifespan * cohort.customersAcquired;
      totalCustomers += cohort.customersAcquired;
    });

    return totalCustomers > 0 ? totalWeightedLifespan / totalCustomers : 0;
  }

  private calculateChurnRate(cohorts: CustomerCohort[]): number {
    // Calculate average monthly churn rate
    if (cohorts.length === 0) {return 0;}

    let totalChurn = 0;
    let monthsWithData = 0;

    cohorts.forEach(cohort => {
      for (let month = 1; month < 12; month++) {
        const currentRetention = cohort.retentionByMonth[month];
        const previousRetention = cohort.retentionByMonth[month - 1];

        if (currentRetention !== undefined && previousRetention !== undefined && previousRetention > 0) {
          const churnRate = (previousRetention - currentRetention) / previousRetention;
          totalChurn += churnRate;
          monthsWithData++;
        }
      }
    });

    return monthsWithData > 0 ? (totalChurn / monthsWithData) * 100 : 0;
  }

  private buildCohortTable(cohorts: CustomerCohort[]): CohortTableData {
    if (cohorts.length === 0) {
      return { headers: ['Cohort'], rows: [] };
    }

    // Build headers (up to 12 months)
    const maxMonths = Math.max(...cohorts.map(c => Math.max(...Object.keys(c.retentionByMonth).map(Number)))) + 1;
    const headers = ['Cohort', ...Array.from({ length: Math.min(maxMonths, 12) }, (_, i) => `Month ${i}`)];

    // Build rows
    const rows: CohortTableRow[] = cohorts.map(cohort => {
      const retentionRates: number[] = [];
      const customerCounts: number[] = [];

      for (let month = 0; month < Math.min(maxMonths, 12); month++) {
        const retention = cohort.retentionByMonth[month] || 0;
        retentionRates.push(retention * 100); // Convert to percentage
        customerCounts.push(Math.round(retention * cohort.customersAcquired));
      }

      return {
        cohortMonth: cohort.cohortMonth,
        retentionRates,
        customerCounts
      };
    });

    return { headers, rows };
  }

  private createEmptyCohortMetrics(): CohortMetrics {
    return {
      cohorts: [],
      overallRetentionRates: {},
      netRevenueRetention: 0,
      lifetimeValue: 0,
      averageLifespanMonths: 0,
      churnRate: 0,
      cohortTable: { headers: ['Cohort'], rows: [] }
    };
  }
}