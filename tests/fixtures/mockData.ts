// Mock data for testing
export const mockMercuryAccount = {
  id: "test-account-id",
  name: "Test Account",
  currentBalance: 150000.50,
  accountNumber: "123456789",
  routingNumber: "987654321"
};

export const mockMercuryTransactions = [
  {
    id: "tx-1",
    amount: -5000.00,
    description: "Software License",
    postedAt: "2024-12-01T10:00:00Z",
    category: "Software",
    counterpartyName: "Tech Vendor"
  },
  {
    id: "tx-2", 
    amount: 25000.00,
    description: "Customer Payment",
    postedAt: "2024-12-02T14:30:00Z",
    category: "Revenue",
    counterpartyName: "Customer A"
  },
  {
    id: "tx-3",
    amount: -3000.00,
    description: "Office Rent",
    postedAt: "2024-12-03T09:15:00Z",
    category: "Rent",
    counterpartyName: "Landlord LLC"
  }
];

export const mockEnvConfig = {
  MERCURY_API_TOKEN: "test-mercury-token",
  EVALOPS_MERCURY_ACCOUNT_ID: "test-account-id",
  SNOWFLAKE_ACCOUNT: "test-snowflake-account",
  SNOWFLAKE_USER: "test-user",
  SNOWFLAKE_PASSWORD: "test-password"
};

export const mockMetrics = {
  currentBalance: 150000.50,
  monthlyGrowthRate: 0.15,
  weeklyGrowthRate: 0.07,
  totalIncome: 25000.00,
  totalExpenses: 8000.00,
  netIncome: 17000.00,
  averageMonthlyBurn: 8000.00,
  runwayMonths: 18.75,
  primaryMetric: {
    name: "Monthly Recurring Revenue",
    value: 25000,
    growthRate: 0.15,
    target: 0.15,
    status: "on_track" as const
  },
  ycGrowthScore: 8.5
};