import { test, expect, beforeEach } from "bun:test";
import { MetricsCalculator, StartupMetrics, MonthlyMetrics } from "../../src/services/metricsCalculator";
import { Transaction } from "../../src/services/mercuryClient";
import { format, subMonths } from "date-fns";

// Generate test transactions with current dates
function generateMockTransactions(): Transaction[] {
  const now = new Date();
  const threeMonthsAgo = subMonths(now, 3); // Start earlier to cover full 3-month window
  const twoMonthsAgo = subMonths(now, 2);
  const oneMonthAgo = subMonths(now, 1);
  const currentMonth = now;

  return [
    // Revenue transactions
    {
      id: "rev-1",
      amount: 5000,
      description: "Customer Payment - Company A",
      postedDate: format(new Date(threeMonthsAgo.getFullYear(), threeMonthsAgo.getMonth(), 15), "yyyy-MM-dd'T'10:00:00'Z'"),
      createdAt: format(new Date(threeMonthsAgo.getFullYear(), threeMonthsAgo.getMonth(), 15), "yyyy-MM-dd'T'10:00:00'Z'"),
      kind: "ach",
      counterpartyName: "Company A",
      category: "Revenue"
    },
    {
      id: "rev-2",
      amount: 7500,
      description: "Subscription Payment - Company B",
      postedDate: format(new Date(oneMonthAgo.getFullYear(), oneMonthAgo.getMonth(), 15), "yyyy-MM-dd'T'10:00:00'Z'"),
      createdAt: format(new Date(oneMonthAgo.getFullYear(), oneMonthAgo.getMonth(), 15), "yyyy-MM-dd'T'10:00:00'Z'"),
      kind: "ach",
      counterpartyName: "Company B",
      category: "Revenue"
    },
    {
      id: "rev-3",
      amount: 8000,
      description: "Customer Payment - Company A",
      postedDate: format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 15), "yyyy-MM-dd'T'10:00:00'Z'"),
      createdAt: format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 15), "yyyy-MM-dd'T'10:00:00'Z'"),
      kind: "ach",
      counterpartyName: "Company A",
      category: "Revenue"
    },
    
    // Expense transactions
    {
      id: "exp-1",
      amount: -2000,
      description: "Office Rent",
      postedDate: format(new Date(threeMonthsAgo.getFullYear(), threeMonthsAgo.getMonth(), 1), "yyyy-MM-dd'T'09:00:00'Z'"),
      createdAt: format(new Date(threeMonthsAgo.getFullYear(), threeMonthsAgo.getMonth(), 1), "yyyy-MM-dd'T'09:00:00'Z'"),
      kind: "ach",
      counterpartyName: "Landlord LLC",
      category: "Rent"
    },
    {
      id: "exp-2",
      amount: -1500,
      description: "Software Licenses",
      postedDate: format(new Date(threeMonthsAgo.getFullYear(), threeMonthsAgo.getMonth(), 5), "yyyy-MM-dd'T'14:30:00'Z'"),
      createdAt: format(new Date(threeMonthsAgo.getFullYear(), threeMonthsAgo.getMonth(), 5), "yyyy-MM-dd'T'14:30:00'Z'"),
      kind: "card",
      counterpartyName: "TechVendor Inc",
      category: "Software"
    },
    {
      id: "exp-3",
      amount: -3000,
      description: "Marketing Campaign",
      postedDate: format(new Date(twoMonthsAgo.getFullYear(), twoMonthsAgo.getMonth(), 10), "yyyy-MM-dd'T'16:45:00'Z'"),
      createdAt: format(new Date(twoMonthsAgo.getFullYear(), twoMonthsAgo.getMonth(), 10), "yyyy-MM-dd'T'16:45:00'Z'"),
      kind: "card",
      counterpartyName: "AdPlatform LLC",
      category: "Marketing"
    },
    {
      id: "exp-4",
      amount: -2000,
      description: "Office Rent",
      postedDate: format(new Date(twoMonthsAgo.getFullYear(), twoMonthsAgo.getMonth(), 1), "yyyy-MM-dd'T'09:00:00'Z'"),
      createdAt: format(new Date(twoMonthsAgo.getFullYear(), twoMonthsAgo.getMonth(), 1), "yyyy-MM-dd'T'09:00:00'Z'"),
      kind: "ach",
      counterpartyName: "Landlord LLC",
      category: "Rent"
    },
    {
      id: "exp-5",
      amount: -2000,
      description: "Office Rent",
      postedDate: format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1), "yyyy-MM-dd'T'09:00:00'Z'"),
      createdAt: format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1), "yyyy-MM-dd'T'09:00:00'Z'"),
      kind: "ach",
      counterpartyName: "Landlord LLC",
      category: "Rent"
    },

    // Transfer (should be excluded)
    {
      id: "transfer-1",
      amount: 10000,
      description: "Account Transfer",
      postedDate: format(new Date(threeMonthsAgo.getFullYear(), threeMonthsAgo.getMonth(), 1), "yyyy-MM-dd'T'08:00:00'Z'"),
      createdAt: format(new Date(threeMonthsAgo.getFullYear(), threeMonthsAgo.getMonth(), 1), "yyyy-MM-dd'T'08:00:00'Z'"),
      kind: "transfer",
      counterpartyName: "Internal Account",
      category: "Transfer"
    }
  ];
}

test("MetricsCalculator - should calculate basic startup metrics", () => {
  const mockTransactions = generateMockTransactions();
  const calculator = new MetricsCalculator(mockTransactions);
  const currentBalance = 150000;
  const metrics = calculator.calculateMetrics(currentBalance, 3);

  expect(metrics.currentBalance).toBe(150000);
  expect(metrics.totalRevenue).toBe(20500); // 5000 + 7500 + 8000
  expect(metrics.totalExpenses).toBe(10500); // 3500 (first) + 5000 (second) + 0 (third) + 2000 (current) = 10500
  expect(metrics.netCashFlow).toBe(10000); // 20500 - 10500
  expect(metrics.customersCount).toBe(2); // Company A and Company B
});

test("MetricsCalculator - should calculate monthly metrics correctly", () => {
  const mockTransactions = generateMockTransactions();
  const calculator = new MetricsCalculator(mockTransactions);
  const metrics = calculator.calculateMetrics(150000, 3);

  expect(metrics.monthlyMetrics).toHaveLength(4); // 3 months back from current = 4 months total
  
  // Should have metrics for 4 months (including month with no data)
  const monthlyMetrics = metrics.monthlyMetrics.sort((a, b) => a.month.localeCompare(b.month));
  
  // First month (3 months ago) - has data
  const firstMonth = monthlyMetrics[0];
  expect(firstMonth.revenue).toBe(5000);
  expect(firstMonth.expenses).toBe(3500); // 2000 + 1500
  expect(firstMonth.netBurn).toBe(-1500); // 3500 - 5000 (negative = profit)

  // Second month (2 months ago) - has marketing expense and rent but no revenue
  const secondMonth = monthlyMetrics[1];
  expect(secondMonth.revenue).toBe(0);
  expect(secondMonth.expenses).toBe(5000); // Marketing (3000) + Rent (2000)
  expect(secondMonth.netBurn).toBe(5000); // 5000 - 0 (positive = burn)

  // Third month (1 month ago) - has revenue but no expenses
  const thirdMonth = monthlyMetrics[2];
  expect(thirdMonth.revenue).toBe(7500);
  expect(thirdMonth.expenses).toBe(0);
  expect(thirdMonth.netBurn).toBe(-7500); // 0 - 7500 (negative = profit)

  // Fourth month (current month) - has revenue and rent expense  
  const fourthMonth = monthlyMetrics[3];
  expect(fourthMonth.revenue).toBe(8000);
  expect(fourthMonth.expenses).toBe(2000); // Current month rent
  expect(fourthMonth.netBurn).toBe(-6000); // 2000 - 8000 (negative = profit)
});

test("MetricsCalculator - should calculate runway correctly", () => {
  const mockTransactions = generateMockTransactions();
  const calculator = new MetricsCalculator(mockTransactions);
  const metrics = calculator.calculateMetrics(150000, 3);

  // Average monthly burn should be negative (profit)
  expect(metrics.averageMonthlyBurn).toBeLessThan(0);
  expect(metrics.runwayMonths).toBe(Infinity); // Company is profitable
});

test("MetricsCalculator - should identify recurring revenue (MRR)", () => {
  const mockTransactions = generateMockTransactions();
  const calculator = new MetricsCalculator(mockTransactions);
  const metrics = calculator.calculateMetrics(150000, 3);

  // Company A appears in multiple months = recurring
  expect(metrics.mrr).toBeGreaterThan(0);
  expect(metrics.arr).toBe(metrics.mrr * 12);
});

test("MetricsCalculator - should calculate growth rates", () => {
  const mockTransactions = generateMockTransactions();
  const calculator = new MetricsCalculator(mockTransactions);
  const metrics = calculator.calculateMetrics(150000, 3);

  expect(metrics.monthOverMonthGrowth).toBeGreaterThan(0); // Revenue grew from last to current
  expect(metrics.revenueGrowthRate).toBeGreaterThan(0);
});

test("MetricsCalculator - should calculate YC growth metrics", () => {
  const mockTransactions = generateMockTransactions();
  const calculator = new MetricsCalculator(mockTransactions);
  const metrics = calculator.calculateMetrics(150000, 3);

  expect(metrics.weeklyGrowthRate).toBeGreaterThanOrEqual(0);
  expect(metrics.monthlyGrowthRate).toBeGreaterThanOrEqual(0);
  expect(metrics.primaryMetric).toBeDefined();
  expect(metrics.primaryMetric.name).toBe("Revenue");
  expect(metrics.primaryMetric.value).toBe(20500);
  expect(metrics.ycGrowthScore).toBeGreaterThanOrEqual(1);
  expect(metrics.ycGrowthScore).toBeLessThanOrEqual(10);
});

test("MetricsCalculator - should handle milestone calculations", () => {
  const mockTransactions = generateMockTransactions();
  const calculator = new MetricsCalculator(mockTransactions);
  const metrics = calculator.calculateMetrics(150000, 3);

  expect(metrics.timeToMilestones).toBeDefined();
  expect(metrics.timeToMilestones.firstRevenue?.achieved).toBe(true);
  expect(metrics.timeToMilestones.first1K?.achieved).toBe(true);
  expect(metrics.timeToMilestones.first10K?.achieved).toBe(true);
  expect(metrics.timeToMilestones.firstCustomer?.achieved).toBe(true);
});

test("MetricsCalculator - should calculate aggressive growth metrics", () => {
  const mockTransactions = generateMockTransactions();
  const calculator = new MetricsCalculator(mockTransactions);
  const metrics = calculator.calculateMetrics(150000, 3);

  expect(metrics.aggressiveGrowthMetrics).toBeDefined();
  expect(metrics.aggressiveGrowthMetrics.dailyGrowthRate).toBeGreaterThanOrEqual(0);
  expect(metrics.aggressiveGrowthMetrics.weeklyVelocity).toBeGreaterThan(0);
  expect(metrics.aggressiveGrowthMetrics.monthlyTarget).toBeGreaterThan(0);
  expect(metrics.aggressiveGrowthMetrics.velocityScore).toBeGreaterThanOrEqual(1);
  expect(metrics.aggressiveGrowthMetrics.velocityScore).toBeLessThanOrEqual(10);
});

test("MetricsCalculator - should handle empty transactions", () => {
  const calculator = new MetricsCalculator([]);
  const metrics = calculator.calculateMetrics(50000, 6);

  expect(metrics.totalRevenue).toBe(0);
  expect(metrics.totalExpenses).toBe(0);
  expect(metrics.customersCount).toBe(0);
  expect(metrics.mrr).toBe(0);
  expect(metrics.runwayMonths).toBe(Infinity);
});

test("MetricsCalculator - should filter out transfer transactions", () => {
  const mockTransactions = generateMockTransactions();
  const calculator = new MetricsCalculator(mockTransactions);
  const metrics = calculator.calculateMetrics(150000, 3);

  // Should not count the 10000 transfer as revenue
  expect(metrics.totalRevenue).toBe(20500); // Actual revenue only
});

test("MetricsCalculator - should find largest expenses correctly", () => {
  const mockTransactions = generateMockTransactions();
  const calculator = new MetricsCalculator(mockTransactions);
  const metrics = calculator.calculateMetrics(150000, 3);

  // Find the month with marketing campaign (second month)
  const monthlyMetrics = metrics.monthlyMetrics.sort((a, b) => a.month.localeCompare(b.month));
  const secondMonth = monthlyMetrics[1]; // Month with marketing campaign
  expect(secondMonth?.largestExpense?.amount).toBe(3000); // Marketing Campaign (larger than rent)
  expect(secondMonth?.largestExpense?.description).toContain("Marketing");
});

test("MetricsCalculator - should categorize expenses correctly", () => {
  const mockTransactions = generateMockTransactions();
  const calculator = new MetricsCalculator(mockTransactions);
  const metrics = calculator.calculateMetrics(150000, 3);

  // Find the first month (with rent and software expenses)
  const monthlyMetrics = metrics.monthlyMetrics.sort((a, b) => a.month.localeCompare(b.month));
  const firstMonth = monthlyMetrics[0];
  expect(firstMonth?.topExpenseCategories).toContainEqual({
    category: "Rent",
    amount: 2000
  });
  expect(firstMonth?.topExpenseCategories).toContainEqual({
    category: "Software", 
    amount: 1500
  });
});

test("MetricsCalculator - should handle burn rate calculations for loss-making company", () => {
  // Create scenario where company loses money using current month
  const now = new Date();
  const currentMonth = format(now, "yyyy-MM-dd");
  
  const lossTransactions: Transaction[] = [
    {
      id: "rev-small",
      amount: 1000,
      description: "Small payment",
      postedDate: `${currentMonth}T10:00:00Z`,
      createdAt: `${currentMonth}T10:00:00Z`, 
      kind: "ach",
      counterpartyName: "Customer",
      category: "Revenue"
    },
    {
      id: "exp-large",
      amount: -5000,
      description: "Large expense",
      postedDate: `${currentMonth}T10:00:00Z`,
      createdAt: `${currentMonth}T10:00:00Z`,
      kind: "card", 
      counterpartyName: "Vendor",
      category: "Operations"
    }
  ];

  const calculator = new MetricsCalculator(lossTransactions);
  const metrics = calculator.calculateMetrics(20000, 1);

  expect(metrics.averageMonthlyBurn).toBeGreaterThan(0); // Positive burn = losing money
  expect(metrics.runwayMonths).toBeGreaterThan(0);
  expect(metrics.runwayMonths).toBeLessThan(Infinity);
});