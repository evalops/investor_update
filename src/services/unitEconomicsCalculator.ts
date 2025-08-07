import { Transaction } from './mercuryClient';
import { CohortMetrics, CohortAnalyzer } from './cohortAnalyzer';
import { format, parseISO, startOfMonth, subMonths, isWithinInterval } from 'date-fns';

export interface UnitEconomics {
  // Core metrics
  lifetimeValue: number; // LTV
  customerAcquisitionCost: number; // CAC
  ltvToCacRatio: number; // LTV:CAC ratio
  paybackPeriodMonths: number; // Months to recover CAC

  // Advanced metrics
  marginalLTV: number; // LTV considering marginal costs
  blendedCAC: number; // Blended across all channels
  organicCAC: number; // CAC for organic/referral customers
  paidCAC: number; // CAC for paid marketing customers

  // Efficiency metrics
  cac3MonthTrend: number; // CAC change over last 3 months
  ltv6MonthTrend: number; // LTV change over last 6 months
  unitEconomicsScore: number; // 1-10 scale

  // Channel breakdown
  channelMetrics: ChannelMetrics[];

  // Time-based analysis
  monthlyCAC: { month: string; cac: number }[];
  monthlyLTV: { month: string; ltv: number }[];

  // Validation flags
  dataQuality: {
    hasReliableCAC: boolean;
    hasReliableLTV: boolean;
    sampleSize: number;
    confidenceLevel: 'high' | 'medium' | 'low';
  };
}

export interface ChannelMetrics {
  channel: string;
  customerCount: number;
  totalSpend: number;
  cac: number;
  ltv: number;
  ltvCacRatio: number;
  paybackMonths: number;
}

export class UnitEconomicsCalculator {
  private transactions: Transaction[];
  private cohortAnalyzer: CohortAnalyzer;
  private cohortMetrics: CohortMetrics;

  constructor(transactions: Transaction[]) {
    this.transactions = transactions;
    this.cohortAnalyzer = new CohortAnalyzer(transactions);
    this.cohortMetrics = this.cohortAnalyzer.generateCohortAnalysis();
  }

  calculateUnitEconomics(): UnitEconomics {
    const marketingSpend = this.identifyMarketingSpend();
    const customerCount = this.cohortMetrics.cohorts.reduce((sum, c) => sum + c.customersAcquired, 0);

    if (customerCount === 0 || marketingSpend.total === 0) {
      return this.createEmptyUnitEconomics();
    }

    const lifetimeValue = this.cohortMetrics.lifetimeValue;
    const customerAcquisitionCost = marketingSpend.total / customerCount;
    const ltvToCacRatio = customerAcquisitionCost > 0 ? lifetimeValue / customerAcquisitionCost : 0;
    const paybackPeriodMonths = this.calculatePaybackPeriod();

    const marginalLTV = this.calculateMarginalLTV(lifetimeValue);
    const blendedCAC = customerAcquisitionCost;
    const { organicCAC, paidCAC } = this.calculateChannelCAC(marketingSpend, customerCount);

    const cac3MonthTrend = this.calculateCACTrend(3);
    const ltv6MonthTrend = this.calculateLTVTrend(6);
    const unitEconomicsScore = this.calculateUnitEconomicsScore(ltvToCacRatio, paybackPeriodMonths);

    const channelMetrics = this.calculateChannelMetrics(marketingSpend);
    const monthlyCAC = this.calculateMonthlyCAC(marketingSpend);
    const monthlyLTV = this.calculateMonthlyLTV();

    const dataQuality = this.assessDataQuality(customerCount, marketingSpend.total);

    return {
      lifetimeValue,
      customerAcquisitionCost,
      ltvToCacRatio,
      paybackPeriodMonths,
      marginalLTV,
      blendedCAC,
      organicCAC,
      paidCAC,
      cac3MonthTrend,
      ltv6MonthTrend,
      unitEconomicsScore,
      channelMetrics,
      monthlyCAC,
      monthlyLTV,
      dataQuality
    };
  }

  private identifyMarketingSpend(): {
    total: number;
    channels: { [key: string]: number };
    organic: number;
    paid: number;
  } {
    const marketingKeywords = [
      'advertising', 'ads', 'adwords', 'google ads', 'facebook ads', 'linkedin ads',
      'marketing', 'campaign', 'promotion', 'seo', 'sem', 'social media',
      'influencer', 'affiliate', 'referral', 'lead gen', 'lead generation',
      'content marketing', 'email marketing', 'paid social', 'display',
      'retargeting', 'remarketing', 'ppc', 'cpc', 'cpm', 'ctr',
      'mailchimp', 'hubspot', 'salesforce', 'intercom', 'segment',
      'analytics', 'mixpanel', 'amplitude', 'hotjar'
    ];

    let totalSpend = 0;
    const channels: { [key: string]: number } = {};
    let organicSpend = 0;
    let paidSpend = 0;

    this.transactions
      .filter(t => t.amount < 0) // Expenses only
      .forEach(transaction => {
        const description = (transaction.description || transaction.bankDescription || '').toLowerCase();
        const counterparty = (transaction.counterpartyName || '').toLowerCase();
        const fullText = `${description} ${counterparty}`;

        // Check if this looks like marketing spend
        const isMarketing = marketingKeywords.some(keyword => fullText.includes(keyword));

        if (isMarketing) {
          const amount = Math.abs(transaction.amount);
          totalSpend += amount;

          // Categorize by channel
          let channel = this.categorizeMarketingChannel(fullText);
          channels[channel] = (channels[channel] || 0) + amount;

          // Split between organic and paid
          if (this.isPaidMarketing(fullText)) {
            paidSpend += amount;
          } else {
            organicSpend += amount;
          }
        }
      });

    return {
      total: totalSpend,
      channels,
      organic: organicSpend,
      paid: paidSpend
    };
  }

  private categorizeMarketingChannel(text: string): string {
    if (text.includes('google') || text.includes('adwords')) return 'Google Ads';
    if (text.includes('facebook') || text.includes('meta')) return 'Facebook Ads';
    if (text.includes('linkedin')) return 'LinkedIn Ads';
    if (text.includes('twitter') || text.includes('x.com')) return 'Twitter Ads';
    if (text.includes('email') || text.includes('mailchimp')) return 'Email Marketing';
    if (text.includes('content') || text.includes('blog')) return 'Content Marketing';
    if (text.includes('seo') || text.includes('search')) return 'SEO';
    if (text.includes('influencer') || text.includes('affiliate')) return 'Influencer/Affiliate';
    if (text.includes('event') || text.includes('conference')) return 'Events';
    if (text.includes('analytics') || text.includes('tracking')) return 'Analytics/Tools';
    return 'Other Marketing';
  }

  private isPaidMarketing(text: string): boolean {
    const paidKeywords = [
      'ads', 'advertising', 'adwords', 'campaign', 'sponsored', 'promoted',
      'ppc', 'cpc', 'cpm', 'paid', 'boost', 'promote'
    ];
    return paidKeywords.some(keyword => text.includes(keyword));
  }

  private calculatePaybackPeriod(): number {
    // Calculate based on cohort retention and average monthly revenue
    const cohorts = this.cohortMetrics.cohorts;
    if (cohorts.length === 0) return 0;

    let totalWeightedPayback = 0;
    let totalCustomers = 0;

    cohorts.forEach(cohort => {
      const monthlyRevenue = cohort.averageOrderValue;
      if (monthlyRevenue === 0) return;

      // Find when cumulative revenue exceeds CAC
      let cumulativeRevenue = 0;
      let paybackMonth = 0;

      for (let month = 0; month < 12; month++) {
        const retention = cohort.retentionByMonth[month] || 0;
        cumulativeRevenue += monthlyRevenue * retention;

        // This is a simplified calculation - in reality we'd need CAC per cohort
        const estimatedCAC = cohort.averageOrderValue * 2; // Rough estimate

        if (cumulativeRevenue >= estimatedCAC) {
          paybackMonth = month;
          break;
        }
      }

      totalWeightedPayback += paybackMonth * cohort.customersAcquired;
      totalCustomers += cohort.customersAcquired;
    });

    return totalCustomers > 0 ? totalWeightedPayback / totalCustomers : 0;
  }

  private calculateMarginalLTV(baseLTV: number): number {
    // Estimate marginal LTV by subtracting estimated marginal costs
    // This is a simplified calculation - in practice you'd have detailed cost structure
    const estimatedMarginalCostRatio = 0.3; // 30% marginal costs
    return baseLTV * (1 - estimatedMarginalCostRatio);
  }

  private calculateChannelCAC(marketingSpend: any, totalCustomers: number): { organicCAC: number; paidCAC: number } {
    // Estimate customer split between organic and paid (simplified approach)
    const paidRatio = marketingSpend.paid / marketingSpend.total;
    const organicRatio = 1 - paidRatio;

    const paidCustomers = Math.round(totalCustomers * paidRatio);
    const organicCustomers = totalCustomers - paidCustomers;

    const organicCAC = organicCustomers > 0 ? marketingSpend.organic / organicCustomers : 0;
    const paidCAC = paidCustomers > 0 ? marketingSpend.paid / paidCustomers : 0;

    return { organicCAC, paidCAC };
  }

  private calculateCACTrend(months: number): number {
    // Calculate CAC trend over specified months
    const today = new Date();
    const startDate = subMonths(today, months);

    const recentTransactions = this.transactions.filter(t => {
      if (!t.postedDate) return false;
      const date = parseISO(t.postedDate);
      return isWithinInterval(date, { start: startDate, end: today });
    });

    const recentSpend = this.identifyMarketingSpend.call({ transactions: recentTransactions });
    const recentCohorts = this.cohortMetrics.cohorts.filter(c => c.cohortMonth >= format(startDate, 'yyyy-MM'));
    const recentCustomers = recentCohorts.reduce((sum, c) => sum + c.customersAcquired, 0);

    const recentCAC = recentCustomers > 0 ? recentSpend.total / recentCustomers : 0;
    const overallCAC = this.identifyMarketingSpend().total /
      this.cohortMetrics.cohorts.reduce((sum, c) => sum + c.customersAcquired, 0);

    return overallCAC > 0 ? ((recentCAC - overallCAC) / overallCAC) * 100 : 0;
  }

  private calculateLTVTrend(months: number): number {
    // Calculate LTV trend based on recent cohorts
    const cutoffDate = format(subMonths(new Date(), months), 'yyyy-MM');
    const recentCohorts = this.cohortMetrics.cohorts.filter(c => c.cohortMonth >= cutoffDate);
    const olderCohorts = this.cohortMetrics.cohorts.filter(c => c.cohortMonth < cutoffDate);

    if (recentCohorts.length === 0 || olderCohorts.length === 0) return 0;

    const recentLTV = recentCohorts.reduce((sum, c) => sum + c.totalRevenue, 0) /
      recentCohorts.reduce((sum, c) => sum + c.customersAcquired, 0);

    const olderLTV = olderCohorts.reduce((sum, c) => sum + c.totalRevenue, 0) /
      olderCohorts.reduce((sum, c) => sum + c.customersAcquired, 0);

    return olderLTV > 0 ? ((recentLTV - olderLTV) / olderLTV) * 100 : 0;
  }

  private calculateUnitEconomicsScore(ltvCacRatio: number, paybackMonths: number): number {
    let score = 1;

    // LTV:CAC ratio scoring (70% of score)
    if (ltvCacRatio >= 5) score += 7; // Excellent (5:1 or better)
    else if (ltvCacRatio >= 3) score += 5; // Good (3:1)
    else if (ltvCacRatio >= 2) score += 3; // Acceptable (2:1)
    else if (ltvCacRatio >= 1) score += 1; // Break-even

    // Payback period scoring (30% of score)
    if (paybackMonths <= 6) score += 2; // Excellent
    else if (paybackMonths <= 12) score += 1.5; // Good
    else if (paybackMonths <= 18) score += 0.5; // Acceptable

    return Math.min(score, 10);
  }

  private calculateChannelMetrics(marketingSpend: any): ChannelMetrics[] {
    const metrics: ChannelMetrics[] = [];
    const totalCustomers = this.cohortMetrics.cohorts.reduce((sum, c) => sum + c.customersAcquired, 0);
    const totalLTV = this.cohortMetrics.lifetimeValue;

    Object.entries(marketingSpend.channels).forEach(([channel, spend]) => {
      // Estimate customers per channel (simplified - equal distribution)
      const channelCustomers = Math.round((spend as number / marketingSpend.total) * totalCustomers);
      const channelCAC = channelCustomers > 0 ? (spend as number) / channelCustomers : 0;
      const channelLTV = totalLTV; // Assuming same LTV across channels
      const ltvCacRatio = channelCAC > 0 ? channelLTV / channelCAC : 0;
      const paybackMonths = this.paybackPeriodMonths; // Simplified

      metrics.push({
        channel,
        customerCount: channelCustomers,
        totalSpend: spend as number,
        cac: channelCAC,
        ltv: channelLTV,
        ltvCacRatio,
        paybackMonths
      });
    });

    return metrics.sort((a, b) => b.ltvCacRatio - a.ltvCacRatio);
  }

  private calculateMonthlyCAC(marketingSpend: any): { month: string; cac: number }[] {
    const monthlyData: { [month: string]: { spend: number; customers: number } } = {};

    // Group marketing spend by month
    this.transactions
      .filter(t => t.amount < 0 && t.postedDate)
      .forEach(transaction => {
        const month = format(startOfMonth(parseISO(transaction.postedDate!)), 'yyyy-MM');
        const description = (transaction.description || transaction.bankDescription || '').toLowerCase();
        const counterparty = (transaction.counterpartyName || '').toLowerCase();

        // Check if it's marketing spend (simplified check)
        if (description.includes('ads') || description.includes('marketing') || counterparty.includes('google')) {
          if (!monthlyData[month]) monthlyData[month] = { spend: 0, customers: 0 };
          monthlyData[month].spend += Math.abs(transaction.amount);
        }
      });

    // Add customer counts from cohorts
    this.cohortMetrics.cohorts.forEach(cohort => {
      if (monthlyData[cohort.cohortMonth]) {
        monthlyData[cohort.cohortMonth].customers = cohort.customersAcquired;
      }
    });

    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        cac: data.customers > 0 ? data.spend / data.customers : 0
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private calculateMonthlyLTV(): { month: string; ltv: number }[] {
    return this.cohortMetrics.cohorts.map(cohort => ({
      month: cohort.cohortMonth,
      ltv: cohort.averageOrderValue * this.cohortMetrics.averageLifespanMonths
    }));
  }

  private assessDataQuality(customerCount: number, marketingSpend: number): UnitEconomics['dataQuality'] {
    const hasReliableCAC = customerCount >= 10 && marketingSpend > 1000;
    const hasReliableLTV = this.cohortMetrics.cohorts.length >= 3;
    const sampleSize = customerCount;

    let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
    if (hasReliableCAC && hasReliableLTV && sampleSize >= 50) {
      confidenceLevel = 'high';
    } else if ((hasReliableCAC || hasReliableLTV) && sampleSize >= 20) {
      confidenceLevel = 'medium';
    }

    return {
      hasReliableCAC,
      hasReliableLTV,
      sampleSize,
      confidenceLevel
    };
  }

  private createEmptyUnitEconomics(): UnitEconomics {
    return {
      lifetimeValue: 0,
      customerAcquisitionCost: 0,
      ltvToCacRatio: 0,
      paybackPeriodMonths: 0,
      marginalLTV: 0,
      blendedCAC: 0,
      organicCAC: 0,
      paidCAC: 0,
      cac3MonthTrend: 0,
      ltv6MonthTrend: 0,
      unitEconomicsScore: 1,
      channelMetrics: [],
      monthlyCAC: [],
      monthlyLTV: [],
      dataQuality: {
        hasReliableCAC: false,
        hasReliableLTV: false,
        sampleSize: 0,
        confidenceLevel: 'low'
      }
    };
  }
}