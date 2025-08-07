import { test, expect, beforeEach, jest } from "bun:test";
import { AttioCollector, AttioMetrics } from "../../src/collectors/attioCollector";

// Mock fetch globally
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.ATTIO_API_KEY;
});

test("AttioCollector - should return zero metrics when API key not configured", async () => {
  const collector = new AttioCollector();
  const result = await collector.collect();

  expect(result.source).toBe("attio");
  expect(result.error).toBe("Attio API key not configured");
  expect(result.data.totalCustomers).toBe(0);
  expect(result.data.totalDeals).toBe(0);
});

test("AttioCollector - should collect customer metrics successfully", async () => {
  process.env.ATTIO_API_KEY = "test-api-key";
  
  // Mock API responses
  const mockPeopleResponse = {
    data: [
      { id: "1", attributes: {}, created_at: "2025-07-01T10:00:00Z" },
      { id: "2", attributes: {}, created_at: "2025-08-01T10:00:00Z" }
    ]
  };

  const mockCompaniesResponse = {
    data: [
      { id: "1", attributes: {}, created_at: "2025-07-01T10:00:00Z" }
    ]
  };

  const mockDealsResponse = {
    data: [
      { 
        id: "1", 
        attributes: { 
          status: { value: "won" },
          value: { value: 5000 }
        }, 
        created_at: "2025-07-01T10:00:00Z" 
      },
      { 
        id: "2", 
        attributes: { 
          status: { value: "open" },
          value: { value: 3000 }
        }, 
        created_at: "2025-08-01T10:00:00Z" 
      }
    ]
  };

  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => mockPeopleResponse
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => mockCompaniesResponse
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => mockDealsResponse
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => mockPeopleResponse
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => mockPeopleResponse
    });

  const collector = new AttioCollector();
  const result = await collector.collect();

  expect(result.source).toBe("attio");
  expect(result.error).toBeUndefined();
  expect(result.data.totalCustomers).toBe(2);
  expect(result.data.totalCompanies).toBe(1);
  expect(result.data.totalDeals).toBe(2);
  expect(result.data.wonDeals).toBe(1);
  expect(result.data.openDeals).toBe(1);
  expect(result.data.totalDealValue).toBe(8000);
  expect(result.data.salesPipelineValue).toBe(3000); // Only open deal
});

test("AttioCollector - should handle API errors gracefully", async () => {
  process.env.ATTIO_API_KEY = "test-api-key";
  
  // Mock a fetch error for individual methods (they catch errors gracefully)
  mockFetch.mockRejectedValue(new Error("Network error"));

  const collector = new AttioCollector();
  const result = await collector.collect();

  expect(result.source).toBe("attio");
  // Individual methods catch errors gracefully and return 0s, no main error is set
  expect(result.error).toBeUndefined();
  expect(result.data.totalCustomers).toBe(0);
  expect(result.data.totalCompanies).toBe(0);
  expect(result.data.totalDeals).toBe(0);
});

test("AttioCollector - should calculate monthly new customers correctly", async () => {
  process.env.ATTIO_API_KEY = "test-api-key";
  
  const now = new Date();
  const recentDate = new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000)); // 15 days ago
  const oldDate = new Date(now.getTime() - (45 * 24 * 60 * 60 * 1000)); // 45 days ago
  
  const mockResponse = {
    data: [
      { id: "1", attributes: {}, created_at: recentDate.toISOString() },
      { id: "2", attributes: {}, created_at: oldDate.toISOString() }
    ]
  };

  // Mock all the API calls needed
  mockFetch
    .mockResolvedValueOnce({ ok: true, json: async () => mockResponse }) // getCustomerCount
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }) // getCompanyCount
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }) // getDealMetrics
    .mockResolvedValueOnce({ ok: true, json: async () => mockResponse }) // getMonthlyNewCustomers
    .mockResolvedValueOnce({ ok: true, json: async () => mockResponse }); // getCustomerGrowthRate

  const collector = new AttioCollector();
  const result = await collector.collect();

  expect(result.data.monthlyNewCustomers).toBe(1); // Only the recent customer
});

test("AttioCollector - should calculate average deal size correctly", async () => {
  process.env.ATTIO_API_KEY = "test-api-key";
  
  const mockDealsResponse = {
    data: [
      { 
        id: "1", 
        attributes: { 
          status: { value: "won" },
          value: { value: 10000 }
        }, 
        created_at: "2025-07-01T10:00:00Z" 
      },
      { 
        id: "2", 
        attributes: { 
          status: { value: "open" },
          value: { value: 5000 }
        }, 
        created_at: "2025-08-01T10:00:00Z" 
      }
    ]
  };

  // Mock all required API calls
  mockFetch
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }) // customers
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }) // companies  
    .mockResolvedValueOnce({ ok: true, json: async () => mockDealsResponse }) // deals
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }) // monthly new customers
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }); // growth rate

  const collector = new AttioCollector();
  const result = await collector.collect();

  expect(result.data.avgDealSize).toBe(7500); // (10000 + 5000) / 2
});

test("AttioCollector - should handle different deal status formats", async () => {
  process.env.ATTIO_API_KEY = "test-api-key";
  
  const mockDealsResponse = {
    data: [
      { 
        id: "1", 
        attributes: { 
          status: { value: "Closed Won" },
          value: { value: 1000 }
        }, 
        created_at: "2025-07-01T10:00:00Z" 
      },
      { 
        id: "2", 
        attributes: { 
          status: { value: "closed lost" },
          value: { value: 2000 }
        }, 
        created_at: "2025-08-01T10:00:00Z" 
      },
      { 
        id: "3", 
        attributes: { 
          status: { value: "in progress" },
          value: { value: 3000 }
        }, 
        created_at: "2025-08-01T10:00:00Z" 
      }
    ]
  };

  // Mock API calls
  mockFetch
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => mockDealsResponse })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

  const collector = new AttioCollector();
  const result = await collector.collect();

  expect(result.data.wonDeals).toBe(1);
  expect(result.data.lostDeals).toBe(1);
  expect(result.data.openDeals).toBe(1);
  expect(result.data.closedDeals).toBe(2); // won + lost
  expect(result.data.salesPipelineValue).toBe(3000); // Only open deal value
});