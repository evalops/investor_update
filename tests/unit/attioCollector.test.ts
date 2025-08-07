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
      { 
        id: {
          workspace_id: "ws1",
          object_id: "people",
          record_id: "1"
        },
        values: {
          name: [{ value: "John Doe", active_until: null, attribute_type: "text" }],
          email_addresses: [{ email_address: "john@example.com", active_until: null, attribute_type: "email-address" }]
        },
        created_at: "2025-07-01T10:00:00Z",
        web_url: "https://attio.com/1" 
      },
      { 
        id: {
          workspace_id: "ws1",
          object_id: "people",
          record_id: "2"
        },
        values: {
          name: [{ value: "Jane Smith", active_until: null, attribute_type: "text" }],
          email_addresses: [{ email_address: "jane@example.com", active_until: null, attribute_type: "email-address" }]
        },
        created_at: "2025-08-01T10:00:00Z",
        web_url: "https://attio.com/2" 
      }
    ]
  };

  const mockCompaniesResponse = {
    data: [
      { 
        id: {
          workspace_id: "ws1",
          object_id: "companies",
          record_id: "1"
        },
        values: {
          name: [{ value: "Acme Corp", active_until: null, attribute_type: "text" }],
          domains: [{ domain: "acme.com", active_until: null, attribute_type: "domain" }]
        },
        created_at: "2025-07-01T10:00:00Z",
        web_url: "https://attio.com/company1" 
      }
    ]
  };

  const mockDealsResponse = {
    data: [
      { 
        id: {
          workspace_id: "ws1",
          object_id: "deals",
          record_id: "1"
        },
        values: { 
          status: [{ option: { title: "won" }, active_until: null, attribute_type: "select" }],
          value: [{ currency_value: 5000, active_until: null, attribute_type: "currency" }]
        }, 
        created_at: "2025-07-01T10:00:00Z",
        web_url: "https://attio.com/deal1" 
      },
      { 
        id: {
          workspace_id: "ws1",
          object_id: "deals",
          record_id: "2"
        },
        values: { 
          status: [{ option: { title: "open" }, active_until: null, attribute_type: "select" }],
          value: [{ currency_value: 3000, active_until: null, attribute_type: "currency" }]
        }, 
        created_at: "2025-08-01T10:00:00Z",
        web_url: "https://attio.com/deal2" 
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
  expect(result.data.totalCustomers).toBe(1); // totalCustomers is based on wonDeals
  expect(result.data.totalContacts).toBe(2); // totalContacts should be 2
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
      { 
        id: {
          workspace_id: "ws1",
          object_id: "obj1",
          record_id: "1"
        },
        values: {
          name: [{ value: "Customer 1", active_until: null, attribute_type: "text" }]
        },
        created_at: recentDate.toISOString(),
        web_url: "https://attio.com/1"
      },
      { 
        id: {
          workspace_id: "ws1",
          object_id: "obj1",
          record_id: "2"
        },
        values: {
          name: [{ value: "Customer 2", active_until: null, attribute_type: "text" }]
        },
        created_at: oldDate.toISOString(),
        web_url: "https://attio.com/2"
      }
    ]
  };

  // Mock all the API calls needed
  // The collect method makes these calls in parallel:
  // 1. getContactData -> queryRecords('people')
  // 2. getCompanyData -> queryRecords('companies')
  // 3. getDealMetrics -> queryRecords('deals')
  // 4. getMonthlyNewContacts -> queryRecords('people')
  // 5. getContactGrowthRate -> queryRecords('people')
  mockFetch
    .mockResolvedValueOnce({ ok: true, json: async () => mockResponse }) // getContactData (people)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }) // getCompanyData (companies)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }) // getDealMetrics (deals)
    .mockResolvedValueOnce({ ok: true, json: async () => mockResponse }) // getMonthlyNewContacts (people)
    .mockResolvedValueOnce({ ok: true, json: async () => mockResponse }); // getContactGrowthRate (people)

  const collector = new AttioCollector();
  const result = await collector.collect();

  expect(result.data.monthlyNewContacts).toBe(1); // Only the recent customer
});

test("AttioCollector - should calculate average deal size correctly", async () => {
  process.env.ATTIO_API_KEY = "test-api-key";
  
  const mockDealsResponse = {
    data: [
      { 
        id: {
          workspace_id: "ws1",
          object_id: "deals",
          record_id: "1"
        },
        values: { 
          status: [{ option: { title: "won" }, active_until: null, attribute_type: "select" }],
          value: [{ currency_value: 10000, active_until: null, attribute_type: "currency" }]
        }, 
        created_at: "2025-07-01T10:00:00Z",
        web_url: "https://attio.com/deal1" 
      },
      { 
        id: {
          workspace_id: "ws1",
          object_id: "deals",
          record_id: "2"
        },
        values: { 
          status: [{ option: { title: "open" }, active_until: null, attribute_type: "select" }],
          value: [{ currency_value: 5000, active_until: null, attribute_type: "currency" }]
        }, 
        created_at: "2025-08-01T10:00:00Z",
        web_url: "https://attio.com/deal2" 
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
        id: {
          workspace_id: "ws1",
          object_id: "deals",
          record_id: "1"
        },
        values: { 
          status: [{ option: { title: "Closed Won" }, active_until: null, attribute_type: "select" }],
          value: [{ currency_value: 1000, active_until: null, attribute_type: "currency" }]
        }, 
        created_at: "2025-07-01T10:00:00Z",
        web_url: "https://attio.com/deal1" 
      },
      { 
        id: {
          workspace_id: "ws1",
          object_id: "deals",
          record_id: "2"
        },
        values: { 
          status: [{ option: { title: "closed lost" }, active_until: null, attribute_type: "select" }],
          value: [{ currency_value: 2000, active_until: null, attribute_type: "currency" }]
        }, 
        created_at: "2025-08-01T10:00:00Z",
        web_url: "https://attio.com/deal2" 
      },
      { 
        id: {
          workspace_id: "ws1",
          object_id: "deals",
          record_id: "3"
        },
        values: { 
          status: [{ option: { title: "in progress" }, active_until: null, attribute_type: "select" }],
          value: [{ currency_value: 3000, active_until: null, attribute_type: "currency" }]
        }, 
        created_at: "2025-08-01T10:00:00Z",
        web_url: "https://attio.com/deal3" 
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