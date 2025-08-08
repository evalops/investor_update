import { parseISO, differenceInDays } from 'date-fns';

import { Logger } from '../utils/logger';

import type { BusinessContext } from './businessIntelligenceAgents';
import type { Transaction } from './mercuryClient';
import type { StartupMetrics } from './metricsCalculator';
import type { RunwayPrediction } from './runwayIntelligence';

const logger = Logger.for('BusinessContextBuilder');

export class BusinessContextBuilder {
  private transactions: Transaction[];
  private metrics: StartupMetrics;
  private runway: RunwayPrediction;

  constructor(transactions: Transaction[], metrics: StartupMetrics, runway: RunwayPrediction) {
    this.transactions = transactions;
    this.metrics = metrics;
    this.runway = runway;
  }

  /**
   * Build comprehensive business context for AI agents
   */
  async buildBusinessContext(): Promise<BusinessContext> {
    logger.info('Building comprehensive business context for AI agents');

    const customerData = await this.analyzeCustomerTransactions();
    const industryInfo = this.inferIndustryInformation();
    const teamInfo = this.extractTeamInformation();
    const productMetrics = await this.extractProductMetrics();

    return {
      metrics: this.metrics,
      runway: this.runway,
      customerTransactions: customerData,
      industryInfo,
      teamInfo,
      productMetrics
    };
  }

  /**
   * Extract deep customer intelligence from transaction patterns
   */
  private async analyzeCustomerTransactions() {
    const customerMap = new Map<string, {
      customerName: string;
      transactions: Transaction[];
      totalRevenue: number;
      firstTransaction: Date;
      lastTransaction: Date;
    }>();

    // Group transactions by customer
    this.transactions
      .filter(t => t.amount > 0 && t.kind !== 'transfer' && t.counterpartyName)
      .forEach(transaction => {
        const customerName = transaction.counterpartyName!;
        
        if (!customerMap.has(customerName)) {
          customerMap.set(customerName, {
            customerName,
            transactions: [],
            totalRevenue: 0,
            firstTransaction: new Date(),
            lastTransaction: new Date(0)
          });
        }

        const customer = customerMap.get(customerName)!;
        customer.transactions.push(transaction);
        customer.totalRevenue += transaction.amount;

        const transactionDate = parseISO(transaction.postedDate || transaction.createdAt);
    if (transactionDate < customer.firstTransaction) {
      customer.firstTransaction = transactionDate;
    }
    if (transactionDate > customer.lastTransaction) {
      customer.lastTransaction = transactionDate;
    }
  });

    // Analyze patterns and create customer intelligence
    const customerAnalysis = Array.from(customerMap.values()).map(customer => {
      const frequency = this.determinePaymentFrequency(customer.transactions);
      const daysSinceFirst = differenceInDays(new Date(), customer.firstTransaction);
      const daysSinceLast = differenceInDays(new Date(), customer.lastTransaction);

      return {
        customerName: customer.customerName,
        revenue: customer.totalRevenue,
        frequency,
        firstTransaction: customer.firstTransaction,
        lastTransaction: customer.lastTransaction,
        totalTransactions: customer.transactions.length,
        // Additional intelligence
        averageTransactionSize: customer.totalRevenue / customer.transactions.length,
        customerLifetimeValue: customer.totalRevenue,
        revenuePercentage: (customer.totalRevenue / this.metrics.totalRevenue) * 100,
        customerAge: daysSinceFirst,
        daysSinceLastPayment: daysSinceLast,
        churnRisk: this.assessChurnRisk(customer, daysSinceLast, frequency),
        expansionPotential: this.assessExpansionPotential(customer)
      };
    });

    // Sort by revenue contribution
    return customerAnalysis
      .sort((a, b) => b.revenue - a.revenue)
      .map(c => ({
        customerName: c.customerName,
        revenue: c.revenue,
        frequency: c.frequency,
        firstTransaction: c.firstTransaction,
        lastTransaction: c.lastTransaction,
        totalTransactions: c.totalTransactions
      }));
  }

  private determinePaymentFrequency(transactions: Transaction[]): 'one-time' | 'monthly' | 'quarterly' | 'annual' {
    if (transactions.length <= 1) {
      return 'one-time';
    }

    // Calculate average days between transactions
    const dates = transactions
      .map(t => parseISO(t.postedDate || t.createdAt))
      .sort((a, b) => a.getTime() - b.getTime());

    let totalDaysBetween = 0;
    for (let i = 1; i < dates.length; i++) {
      totalDaysBetween += differenceInDays(dates[i], dates[i - 1]);
    }
    
    const avgDaysBetween = totalDaysBetween / (dates.length - 1);

    if (avgDaysBetween <= 35) {
      return 'monthly';
    }
    if (avgDaysBetween <= 100) {
      return 'quarterly';
    }
    if (avgDaysBetween <= 400) {
      return 'annual';
    }
    return 'one-time';
  }

  private assessChurnRisk(customer: any, daysSinceLast: number, frequency: string): 'low' | 'medium' | 'high' {
    const expectedPaymentDays = {
      'monthly': 35,
      'quarterly': 100,
      'annual': 400,
      'one-time': 999
    };

    const expected = expectedPaymentDays[frequency as keyof typeof expectedPaymentDays];
    
    if (frequency === 'one-time') {
      return 'low';
    }
    if (daysSinceLast > expected * 1.5) {
      return 'high';
    }
    if (daysSinceLast > expected * 1.2) {
      return 'medium';
    }
    return 'low';
  }

  private assessExpansionPotential(customer: any): 'low' | 'medium' | 'high' {
    // Higher expansion potential for:
    // - Consistent payers
    // - Growing transaction amounts
    // - Frequent transactions
    
    const isConsistent = customer.transactions.length >= 3;
    const recentTransactions = customer.transactions.slice(-3);
    const isGrowing = recentTransactions.length >= 2 && 
      recentTransactions[recentTransactions.length - 1].amount > recentTransactions[0].amount;
    
    if (isConsistent && isGrowing) {
      return 'high';
    }
    if (isConsistent || isGrowing) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Infer industry and competitive information from business patterns
   */
  private inferIndustryInformation() {
    const revenue = this.metrics.totalRevenue;
    const customerCount = this.metrics.customersCount;
    const avgCustomerValue = revenue / customerCount;

    // Infer stage based on revenue and metrics
    let stage: 'pre-seed' | 'seed' | 'series-a' | 'series-b+' = 'pre-seed';
    if (revenue > 1000000) {
      stage = 'series-b+';
    } else if (revenue > 100000) {
      stage = 'series-a';
    } else if (revenue > 10000) {
      stage = 'seed';
    }

    // Infer sector based on customer patterns and transaction amounts
    let sector = 'B2B SaaS'; // Default assumption
    if (avgCustomerValue < 100) {
      sector = 'Consumer/B2C';
    } else if (avgCustomerValue > 5000) {
      sector = 'Enterprise B2B';
    } else if (avgCustomerValue > 1000) {
      sector = 'Mid-market B2B';
    }

    // Estimate market size based on sector
    const marketSizes = {
      'Consumer/B2C': '$50B+ TAM',
      'B2B SaaS': '$15B+ TAM',
      'Mid-market B2B': '$8B+ TAM',
      'Enterprise B2B': '$25B+ TAM'
    };

    return {
      sector,
      stage,
      competitors: this.inferCompetitors(sector),
      marketSize: marketSizes[sector as keyof typeof marketSizes]
    };
  }

  private inferCompetitors(sector: string): string[] {
    const competitorMap = {
      'B2B SaaS': ['Salesforce', 'HubSpot', 'Slack', 'Notion', 'Airtable'],
      'Enterprise B2B': ['Microsoft', 'Oracle', 'SAP', 'Workday', 'ServiceNow'],
      'Mid-market B2B': ['Mailchimp', 'Shopify', 'Square', 'Zoom', 'Dropbox'],
      'Consumer/B2C': ['Meta', 'Google', 'Apple', 'Netflix', 'Spotify']
    };
    
    return competitorMap[sector as keyof typeof competitorMap] || ['Various competitors'];
  }

  /**
   * Extract team information from expense patterns
   */
  private extractTeamInformation() {
    // Analyze payroll expenses to estimate team size and structure
    const payrollTransactions = this.transactions.filter(t => 
      t.amount < 0 && 
      (t.description?.toLowerCase().includes('payroll') || 
       t.bankDescription?.toLowerCase().includes('payroll') ||
       t.description?.toLowerCase().includes('salary') ||
       t.counterpartyName?.toLowerCase().includes('gusto') ||
       t.counterpartyName?.toLowerCase().includes('justworks'))
    );

    let estimatedTeamSize = 3; // Default assumption
    let monthlyPayrollCost = 0;

    if (payrollTransactions.length > 0) {
      // Calculate average monthly payroll
      const totalPayroll = payrollTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      monthlyPayrollCost = totalPayroll / Math.max(this.metrics.monthlyMetrics.length, 1);
      
      // Estimate team size (assuming $8K average fully-loaded cost per employee)
      estimatedTeamSize = Math.max(2, Math.round(monthlyPayrollCost / 8000));
    }

    // Infer roles based on stage and team size
    const roles = this.inferTeamRoles(estimatedTeamSize);

    // Identify recent hires from payroll increases
    const recentHires = this.identifyRecentHires();

    return {
      size: estimatedTeamSize,
      roles,
      recentHires,
      monthlyPayrollCost
    };
  }

  private inferTeamRoles(teamSize: number): string[] {
    const baseRoles = ['CEO/Founder', 'CTO/Technical Co-founder'];
    
    if (teamSize <= 3) {
      return [...baseRoles, 'Engineer'];
    } else if (teamSize <= 6) {
      return [...baseRoles, 'Senior Engineer', 'Product Manager', 'Sales/Marketing'];
    } else if (teamSize <= 10) {
      return [...baseRoles, 'Senior Engineer', 'Junior Engineer', 'Product Manager', 
              'Head of Sales', 'Marketing Manager', 'Customer Success'];
    } else {
      return [...baseRoles, 'Engineering Team (3-4)', 'Product Team (2)', 
              'Sales Team (2-3)', 'Marketing Team', 'Operations'];
    }
  }

  private identifyRecentHires(): Array<{ role: string; date: Date; cost: number }> {
    // Identify payroll increases that might indicate new hires
    const monthlyPayrolls = this.metrics.monthlyMetrics.map(m => {
      const monthTransactions = this.transactions.filter(t => {
        const tMonth = parseISO(t.postedDate || t.createdAt).toISOString().substring(0, 7);
        return tMonth === m.month && t.amount < 0 && 
               (t.description?.toLowerCase().includes('payroll') ||
                t.counterpartyName?.toLowerCase().includes('gusto'));
      });
      
      return {
        month: m.month,
        payroll: monthTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0)
      };
    });

    const recentHires: Array<{ role: string; date: Date; cost: number }> = [];
    
    for (let i = 1; i < monthlyPayrolls.length; i++) {
      const current = monthlyPayrolls[i];
      const previous = monthlyPayrolls[i - 1];
      
      if (current.payroll > previous.payroll + 5000) { // Significant increase
        const hireCost = current.payroll - previous.payroll;
        const inferredRole = this.inferRoleFromCost(hireCost);
        
        recentHires.push({
          role: inferredRole,
          date: parseISO(current.month + '-15'), // Mid-month estimate
          cost: hireCost
        });
      }
    }

    return recentHires;
  }

  private inferRoleFromCost(monthlyCost: number): string {
    if (monthlyCost >= 15000) {
      return 'Senior Engineer/Executive';
    }
    if (monthlyCost >= 10000) {
      return 'Senior Role/Manager';
    }
    if (monthlyCost >= 7000) {
      return 'Mid-level Engineer/Specialist';
    }
    if (monthlyCost >= 4000) {
      return 'Junior Role/Contractor';
    }
    return 'Part-time/Intern';
  }

  /**
   * Extract product metrics from available data sources
   */
  private async extractProductMetrics() {
    // In a real implementation, this would pull from:
    // - Product analytics (PostHog, Mixpanel, etc.)
    // - Support tickets (Intercom, Zendesk)
    // - User feedback (surveys, reviews)
    
    // For now, we'll infer some basic product intelligence
    const transactionPatterns = this.analyzeTransactionPatterns();
    
    return {
      features: this.inferProductFeatures(),
      usage: transactionPatterns,
      feedback: this.extractImpliedFeedback()
    };
  }

  private analyzeTransactionPatterns(): Record<string, number> {
    // Analyze transaction descriptions to infer product usage
    const patterns: Record<string, number> = {};
    
    this.transactions
      .filter(t => t.amount > 0)
      .forEach(t => {
        const desc = (t.description || t.bankDescription || '').toLowerCase();
        
        if (desc.includes('subscription') || desc.includes('monthly')) {
          patterns['subscription_revenue'] = (patterns['subscription_revenue'] || 0) + t.amount;
        }
        if (desc.includes('setup') || desc.includes('onboarding')) {
          patterns['setup_fees'] = (patterns['setup_fees'] || 0) + t.amount;
        }
        if (desc.includes('usage') || desc.includes('overage')) {
          patterns['usage_based'] = (patterns['usage_based'] || 0) + t.amount;
        }
      });

    return patterns;
  }

  private inferProductFeatures(): string[] {
    const revenue = this.metrics.totalRevenue;
    const customerCount = this.metrics.customersCount;
    const avgRevenue = revenue / customerCount;

    // Infer product complexity based on revenue per customer
    if (avgRevenue > 5000) {
      return ['Enterprise Dashboard', 'Advanced Analytics', 'API Access', 
              'Custom Integrations', 'Dedicated Support', 'SSO/Security'];
    } else if (avgRevenue > 1000) {
      return ['Core Platform', 'Basic Analytics', 'Integrations', 
              'Team Collaboration', 'Standard Support'];
    } else {
      return ['Basic Features', 'Self-service', 'Community Support'];
    }
  }

  private extractImpliedFeedback(): string[] {
    // Infer customer satisfaction from retention and growth patterns
    const feedback: string[] = [];
    
    const growthRate = this.metrics.monthlyGrowthRate;
    if (growthRate > 0.15) {
      feedback.push('Customers are seeing strong value, driving referrals and expansion');
    } else if (growthRate > 0.05) {
      feedback.push('Product-market fit is emerging, some customers expanding usage');
    } else {
      feedback.push('Need to improve customer value delivery and retention');
    }

    const cashEfficiency = this.metrics.cashEfficiency;
    if (cashEfficiency > 0.5) {
      feedback.push('Strong unit economics indicate good product-market fit');
    } else {
      feedback.push('Customer acquisition costs are high relative to value delivered');
    }

    return feedback;
  }
}
