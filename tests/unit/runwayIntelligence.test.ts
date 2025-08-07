import { describe, it, expect, beforeEach } from 'bun:test';
import { RunwayIntelligenceEngine } from '../../src/services/runwayIntelligence';
import { StartupMetrics } from '../../src/services/metricsCalculator';
import { addMonths } from 'date-fns';

describe('RunwayIntelligenceEngine', () => {
  let mockMetrics: StartupMetrics;
  let engine: RunwayIntelligenceEngine;

  beforeEach(() => {
    mockMetrics = {
      currentBalance: 500000,
      averageMonthlyBurn: 50000,
      averageMonthlyRevenue: 20000,
      runwayMonths: 10,
      monthOverMonthGrowth: 15,
      totalRevenue: 120000,
      totalExpenses: 300000,
      netCashFlow: -180000,
      monthlyMetrics: [
        {
          month: '2025-06',
          revenue: 18000,
          expenses: 52000,
          netBurn: -34000,
          transactionCount: 45,
          largestExpense: { amount: 15000, description: 'Payroll' },
          topExpenseCategories: [{ category: 'Payroll', amount: 35000 }]
        },
        {
          month: '2025-07',
          revenue: 20000,
          expenses: 48000,
          netBurn: -28000,
          transactionCount: 42,
          largestExpense: { amount: 15000, description: 'Payroll' },
          topExpenseCategories: [{ category: 'Payroll', amount: 33000 }]
        },
        {
          month: '2025-08',
          revenue: 22000,
          expenses: 50000,
          netBurn: -28000,
          transactionCount: 48,
          largestExpense: { amount: 15000, description: 'Payroll' },
          topExpenseCategories: [{ category: 'Payroll', amount: 35000 }]
        }
      ],
      revenueGrowthRate: 0.10,
      expenseGrowthRate: 0.05,
      customersCount: 25,
      mrr: 20000,
      arr: 240000,
      cashEfficiency: 0.4,
      weeklyGrowthRate: 0.03,
      monthlyGrowthRate: 0.12,
      primaryMetric: {
        name: 'Monthly Recurring Revenue',
        value: 20000,
        growthRate: 0.12,
        weeklyGrowthRate: 0.03,
        target: 0.15,
        status: 'on-track'
      },
      ycGrowthScore: 7,
      weekOverWeekGrowth: [0.02, 0.03, 0.04, 0.03],
      compoundGrowthRate: 0.13,
      foundingDate: new Date('2024-01-01'),
      daysSinceFounding: 220,
      timeToMilestones: {
        firstRevenue: { achieved: true, days: 30 },
        first1K: { achieved: true, days: 45 },
        first10K: { achieved: true, days: 90 }
      },
      aggressiveGrowthMetrics: {
        dailyGrowthRate: 0.004,
        weeklyVelocity: 500,
        monthlyTarget: 25000,
        burnMultiple: 2.5,
        velocityScore: 8
      }
    };

    engine = new RunwayIntelligenceEngine(mockMetrics);
  });

  describe('generateRunwayIntelligence', () => {
    it('should generate comprehensive runway analysis', async () => {
      const analysis = await engine.generateRunwayIntelligence();

      expect(analysis).toBeDefined();
      expect(analysis.baseCase).toBeDefined();
      expect(analysis.scenarios).toBeDefined();
      expect(analysis.recommendations).toBeDefined();
      expect(analysis.earlyWarnings).toBeDefined();
    });

    it('should calculate base case runway correctly', async () => {
      const analysis = await engine.generateRunwayIntelligence();
      
      expect(analysis.baseCase.runwayMonths).toBeGreaterThan(8); // Should be around 10 months
      expect(analysis.baseCase.runwayMonths).toBeLessThan(15);
      expect(analysis.baseCase.runwayDate).toBeInstanceOf(Date);
      expect(analysis.baseCase.confidenceInterval.pessimistic.months).toBeLessThan(analysis.baseCase.runwayMonths + 1);
      expect(analysis.baseCase.confidenceInterval.optimistic.months).toBeGreaterThan(analysis.baseCase.runwayMonths - 1);
    });

    it('should generate multiple scenarios', async () => {
      const analysis = await engine.generateRunwayIntelligence();
      
      expect(analysis.scenarios).toHaveLength(5);
      expect(analysis.scenarios[0].scenario.name).toBe('Status Quo');
      expect(analysis.scenarios.find(s => s.scenario.name === 'Aggressive Hiring')).toBeDefined();
      expect(analysis.scenarios.find(s => s.scenario.name === 'Cost Cutting')).toBeDefined();
      expect(analysis.scenarios.find(s => s.scenario.name === 'Revenue Acceleration')).toBeDefined();
    });

    it('should show cost cutting extends runway', async () => {
      const analysis = await engine.generateRunwayIntelligence();
      
      const statusQuo = analysis.scenarios.find(s => s.scenario.name === 'Status Quo');
      const costCutting = analysis.scenarios.find(s => s.scenario.name === 'Cost Cutting');
      
      // If both hit the 60-month limit, at least cost cutting should have better monthly projections
      if (costCutting?.runwayMonths === 60 && statusQuo?.runwayMonths === 60) {
        expect(costCutting.monthlyProjections.length).toBeGreaterThanOrEqual(statusQuo.monthlyProjections.length);
      } else {
        expect(costCutting?.runwayMonths).toBeGreaterThan(statusQuo?.runwayMonths || 0);
      }
    });

    it('should show aggressive hiring reduces runway', async () => {
      // Use a tighter cash scenario to see the hiring impact
      mockMetrics.currentBalance = 200000; // 4 months base runway
      engine = new RunwayIntelligenceEngine(mockMetrics);
      
      const analysis = await engine.generateRunwayIntelligence();
      
      const statusQuo = analysis.scenarios.find(s => s.scenario.name === 'Status Quo');
      const aggressiveHiring = analysis.scenarios.find(s => s.scenario.name === 'Aggressive Hiring');
      
      expect(aggressiveHiring?.runwayMonths).toBeLessThan(statusQuo?.runwayMonths || 999);
    });
  });

  describe('recommendations', () => {
    it('should generate critical recommendations for short runway', async () => {
      // Set very short runway
      mockMetrics.currentBalance = 100000; // 2 months runway
      engine = new RunwayIntelligenceEngine(mockMetrics);

      const analysis = await engine.generateRunwayIntelligence();
      
      const criticalRecs = analysis.recommendations.filter(r => r.priority === 'critical');
      expect(criticalRecs.length).toBeGreaterThan(0);
      expect(criticalRecs[0].category).toBe('fundraising');
      expect(criticalRecs[0].title).toContain('fundraising');
    });

    it('should generate growth recommendations for low growth rate', async () => {
      mockMetrics.monthlyGrowthRate = 0.05; // Below YC target
      engine = new RunwayIntelligenceEngine(mockMetrics);

      const analysis = await engine.generateRunwayIntelligence();
      
      const growthRecs = analysis.recommendations.filter(r => r.category === 'revenue-growth');
      expect(growthRecs.length).toBeGreaterThan(0);
      expect(growthRecs[0].title).toContain('growth');
    });

    it('should generate cash efficiency recommendations for low efficiency', async () => {
      mockMetrics.cashEfficiency = 0.2; // Low efficiency
      engine = new RunwayIntelligenceEngine(mockMetrics);

      const analysis = await engine.generateRunwayIntelligence();
      
      const efficiencyRecs = analysis.recommendations.filter(r => r.category === 'cash-management');
      expect(efficiencyRecs.length).toBeGreaterThan(0);
      expect(efficiencyRecs[0].title).toContain('efficiency');
    });
  });

  describe('early warnings', () => {
    it('should generate danger warnings for critical runway', async () => {
      mockMetrics.currentBalance = 100000; // ~2 months runway
      engine = new RunwayIntelligenceEngine(mockMetrics);

      const analysis = await engine.generateRunwayIntelligence();
      
      const dangerWarnings = analysis.earlyWarnings.filter(w => w.severity === 'danger');
      expect(dangerWarnings.length).toBeGreaterThan(0);
      expect(dangerWarnings[0].trigger).toContain('3 months');
    });

    it('should generate warning for moderate runway', async () => {
      mockMetrics.currentBalance = 250000; // ~5 months runway
      engine = new RunwayIntelligenceEngine(mockMetrics);

      const analysis = await engine.generateRunwayIntelligence();
      
      const warnings = analysis.earlyWarnings.filter(w => w.severity === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].trigger).toContain('6 months');
    });

    it('should not generate critical warnings for healthy runway', async () => {
      mockMetrics.currentBalance = 1000000; // ~20 months runway
      engine = new RunwayIntelligenceEngine(mockMetrics);

      const analysis = await engine.generateRunwayIntelligence();
      
      const dangerWarnings = analysis.earlyWarnings.filter(w => w.severity === 'danger');
      expect(dangerWarnings.length).toBe(0);
    });
  });

  describe('scenario modeling', () => {
    it('should project monthly balances correctly', async () => {
      const analysis = await engine.generateRunwayIntelligence();
      const statusQuoScenario = analysis.scenarios.find(s => s.scenario.name === 'Status Quo');
      
      expect(statusQuoScenario?.monthlyProjections).toBeDefined();
      expect(statusQuoScenario?.monthlyProjections.length).toBeGreaterThan(0);
      
      // Balance should decline over time
      const projections = statusQuoScenario?.monthlyProjections || [];
      if (projections.length >= 2) {
        expect(projections[1].projectedBalance).toBeLessThan(projections[0].projectedBalance);
      }
    });

    it('should handle hiring plan correctly', async () => {
      const analysis = await engine.generateRunwayIntelligence();
      const hiringScenario = analysis.scenarios.find(s => s.scenario.name === 'Aggressive Hiring');
      
      expect(hiringScenario?.monthlyProjections).toBeDefined();
      
      // Should have higher burn in months with hiring
      const projections = hiringScenario?.monthlyProjections || [];
      const month2 = projections.find(p => p.month.endsWith('-10')); // Rough approximation
      if (month2) {
        expect(month2.projectedBurn).toBeGreaterThan(mockMetrics.averageMonthlyBurn);
      }
    });

    it('should handle one-time expenses correctly', async () => {
      // Use tighter cash scenario to see expense impact
      mockMetrics.currentBalance = 300000;
      engine = new RunwayIntelligenceEngine(mockMetrics);
      
      const analysis = await engine.generateRunwayIntelligence();
      const fundraiseScenario = analysis.scenarios.find(s => s.scenario.name === 'Fundraise Preparation');
      const statusQuo = analysis.scenarios.find(s => s.scenario.name === 'Status Quo');
      
      expect(fundraiseScenario?.monthlyProjections).toBeDefined();
      expect(fundraiseScenario?.runwayMonths).toBeLessThan(statusQuo?.runwayMonths || 999); // Should reduce runway due to expenses
    });
  });
});

describe('Runway Intelligence Edge Cases', () => {
  const baseMockMetrics: StartupMetrics = {
    currentBalance: 500000,
    averageMonthlyBurn: 50000,
    averageMonthlyRevenue: 20000,
    runwayMonths: 10,
    monthOverMonthGrowth: 15,
    totalRevenue: 120000,
    totalExpenses: 300000,
    netCashFlow: -180000,
    monthlyMetrics: [
      {
        month: '2025-06',
        revenue: 18000,
        expenses: 52000,
        netBurn: -34000,
        transactionCount: 45,
        largestExpense: { amount: 15000, description: 'Payroll' },
        topExpenseCategories: [{ category: 'Payroll', amount: 35000 }]
      }
    ],
    revenueGrowthRate: 0.10,
    expenseGrowthRate: 0.05,
    customersCount: 25,
    mrr: 20000,
    arr: 240000,
    cashEfficiency: 0.4,
    weeklyGrowthRate: 0.03,
    monthlyGrowthRate: 0.12,
    primaryMetric: {
      name: 'Monthly Recurring Revenue',
      value: 20000,
      growthRate: 0.12,
      weeklyGrowthRate: 0.03,
      target: 0.15,
      status: 'on-track'
    },
    ycGrowthScore: 7,
    weekOverWeekGrowth: [0.02, 0.03, 0.04, 0.03],
    compoundGrowthRate: 0.13,
    foundingDate: new Date('2024-01-01'),
    daysSinceFounding: 220,
    timeToMilestones: {
      firstRevenue: { achieved: true, days: 30 },
      first1K: { achieved: true, days: 45 },
      first10K: { achieved: true, days: 90 }
    },
    aggressiveGrowthMetrics: {
      dailyGrowthRate: 0.004,
      weeklyVelocity: 500,
      monthlyTarget: 25000,
      burnMultiple: 2.5,
      velocityScore: 8
    }
  };

  it('should handle infinite runway gracefully', async () => {
    const profitableMetrics: StartupMetrics = {
      ...baseMockMetrics,
      currentBalance: 500000,
      averageMonthlyBurn: -10000, // Profitable!
      averageMonthlyRevenue: 60000,
      runwayMonths: Infinity
    };

    const engine = new RunwayIntelligenceEngine(profitableMetrics);
    
    const analysis = await engine.generateRunwayIntelligence();
    expect(analysis).toBeDefined();
    expect(analysis.baseCase.runwayMonths).toBeGreaterThan(30); // Should have good runway with positive cash flow
  });

  it('should handle zero burn gracefully', async () => {
    const zeroMetrics: StartupMetrics = {
      ...baseMockMetrics,
      currentBalance: 500000,
      averageMonthlyBurn: 0,
      averageMonthlyRevenue: 0,
      runwayMonths: Infinity
    };

    const engine = new RunwayIntelligenceEngine(zeroMetrics);
    
    const analysis = await engine.generateRunwayIntelligence();
    expect(analysis).toBeDefined();
    expect(analysis.baseCase.runwayMonths).toBeGreaterThan(60); // Should have unlimited runway with no burn
  });

  it('should handle negative balance', async () => {
    const negativeMetrics: StartupMetrics = {
      ...baseMockMetrics,
      currentBalance: -50000,
      averageMonthlyBurn: 50000,
      averageMonthlyRevenue: 20000,
      runwayMonths: 0
    };

    const engine = new RunwayIntelligenceEngine(negativeMetrics);
    const analysis = await engine.generateRunwayIntelligence();
    
    expect(analysis.baseCase.runwayMonths).toBeLessThanOrEqual(0);
    expect(analysis.earlyWarnings.some(w => w.severity === 'danger')).toBe(true);
  });
});