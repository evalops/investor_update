import { describe, it, expect, beforeEach, mock, jest, spyOn } from 'bun:test';
import { MercuryClient } from '../../src/services/mercuryClient';
import { MercuryAccountsResponseSchema, MercuryTransactionsResponseSchema } from '../../src/schemas/mercury';
import axios from 'axios';

// Mock the rate limiter and retry handler
jest.mock('../../src/utils/rateLimiter', () => ({
  rateLimiter: {
    waitForLimit: jest.fn().mockResolvedValue(undefined)
  },
  retryHandler: {
    withRetry: jest.fn((fn) => fn())
  }
}));

describe('MercuryClient', () => {
  let client: MercuryClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset environment
    process.env.MERCURY_API_TOKEN = 'test-token';
    
    // Create a fresh mock instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      defaults: { headers: { common: {} } }
    };
    
    // Mock axios.create using spyOn
    spyOn(axios, 'create').mockReturnValue(mockAxiosInstance);
    
    client = new MercuryClient();
  });

  describe('getAccounts', () => {
    it('should fetch and validate accounts successfully', async () => {
      const mockResponse = {
        data: {
          accounts: [
            {
              id: 'acc_123',
              name: 'Test Account',
              currentBalance: 10000,
              availableBalance: 10000,
              accountNumber: '123456',
              routingNumber: '987654'
            }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const accounts = await client.getAccounts();
      
      expect(accounts).toHaveLength(1);
      expect(accounts[0].id).toBe('acc_123');
      expect(accounts[0].name).toBe('Test Account');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/accounts');
    });

    it('should throw error on invalid response schema', async () => {
      const invalidResponse = {
        data: {
          accounts: [
            {
              // Missing required fields
              id: 'acc_123'
            }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(invalidResponse);

      expect(async () => await client.getAccounts()).toThrow('Invalid response from Mercury API');
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.get.mockRejectedValueOnce(error);

      expect(async () => await client.getAccounts()).toThrow('Network error');
    });
  });

  describe('getTransactions', () => {
    it('should fetch and validate transactions with parameters', async () => {
      const mockResponse = {
        data: {
          transactions: [
            {
              id: 'txn_123',
              amount: -500,
              counterpartyName: 'Test Vendor',
              createdAt: '2024-01-01T00:00:00Z',
              postedAt: '2024-01-01T00:00:00Z',
              kind: 'externalTransfer',
              status: 'completed'
            }
          ],
          total: 1
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const result = await client.getTransactions('acc_123', {
        limit: 10,
        offset: 0,
        start: '2024-01-01',
        end: '2024-01-31'
      });

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].id).toBe('txn_123');
      expect(result.total).toBe(1);
      
      // Verify params were passed correctly
      const callArgs = mockAxiosInstance.get.mock.calls[0];
      expect(callArgs[0]).toBe('/account/acc_123/transactions');
      expect(callArgs[1].params.toString()).toContain('limit=10');
    });

    it('should validate transaction data types', async () => {
      const mockResponse = {
        data: {
          transactions: [
            {
              id: 'txn_123',
              amount: 'invalid', // Should be number
              counterpartyName: 'Test',
              createdAt: '2024-01-01T00:00:00Z',
              kind: 'transfer'
            }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      expect(async () => 
        await client.getTransactions('acc_123')
      ).toThrow('Invalid response from Mercury API');
    });
  });

  describe('getAllTransactions', () => {
    it('should fetch all transactions with pagination', async () => {
      // First page
      const firstPage = {
        data: {
          transactions: Array(50).fill(null).map((_, i) => ({
            id: `txn_${i}`,
            amount: -100,
            counterpartyName: `Vendor ${i}`,
            createdAt: '2024-01-01T00:00:00Z',
            postedAt: null,
            kind: 'externalTransfer'
          })),
          total: 75
        }
      };

      // Second page
      const secondPage = {
        data: {
          transactions: Array(25).fill(null).map((_, i) => ({
            id: `txn_${i + 50}`,
            amount: -100,
            counterpartyName: `Vendor ${i + 50}`,
            createdAt: '2024-01-01T00:00:00Z',
            postedAt: null,
            kind: 'externalTransfer'
          })),
          total: 75
        }
      };

      mockAxiosInstance.get
        .mockResolvedValueOnce(firstPage)
        .mockResolvedValueOnce(secondPage);

      const transactions = await client.getAllTransactions('acc_123');

      expect(transactions).toHaveLength(75);
      expect(transactions[0].id).toBe('txn_0');
      expect(transactions[74].id).toBe('txn_74');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('should handle empty transaction list', async () => {
      const emptyResponse = {
        data: {
          transactions: [],
          total: 0
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(emptyResponse);

      const transactions = await client.getAllTransactions('acc_123');

      expect(transactions).toHaveLength(0);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should throw error when API token is missing', () => {
      delete process.env.MERCURY_API_TOKEN;
      
      expect(() => new MercuryClient()).toThrow('MERCURY_API_TOKEN is required');
    });

    it('should handle rate limiting with retry', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          headers: {
            'retry-after': '2'
          }
        }
      };

      mockAxiosInstance.get
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          data: { accounts: [] }
        });

      // This should retry after rate limit
      const accounts = await client.getAccounts();
      
      expect(accounts).toHaveLength(0);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('ETIMEDOUT');
      mockAxiosInstance.get.mockRejectedValueOnce(timeoutError);

      expect(async () => await client.getAccounts()).toThrow('ETIMEDOUT');
    });
  });
});