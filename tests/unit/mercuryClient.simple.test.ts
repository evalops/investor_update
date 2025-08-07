import { describe, it, expect } from 'bun:test';
import { MercuryAccountSchema, MercuryTransactionSchema } from '../../src/schemas/mercury';

describe('Mercury Schemas', () => {
  describe('MercuryAccountSchema', () => {
    it('should validate valid account data', () => {
      const validAccount = {
        id: 'acc_123',
        name: 'Test Account',
        currentBalance: 10000,
        availableBalance: 10000,
        accountNumber: '123456',
        routingNumber: '987654'
      };

      const result = MercuryAccountSchema.safeParse(validAccount);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('acc_123');
      }
    });

    it('should reject invalid account data', () => {
      const invalidAccount = {
        id: 'acc_123',
        // Missing required fields
      };

      const result = MercuryAccountSchema.safeParse(invalidAccount);
      expect(result.success).toBe(false);
    });
  });

  describe('MercuryTransactionSchema', () => {
    it('should validate valid transaction data', () => {
      const validTransaction = {
        id: 'txn_123',
        amount: -500,
        counterpartyName: 'Test Vendor',
        createdAt: '2024-01-01T00:00:00Z',
        postedAt: '2024-01-01T00:00:00Z',
        kind: 'externalTransfer',
        status: 'completed'
      };

      const result = MercuryTransactionSchema.safeParse(validTransaction);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(-500);
      }
    });

    it('should handle null values appropriately', () => {
      const transactionWithNulls = {
        id: 'txn_124',
        amount: 1000,
        counterpartyName: null,
        createdAt: '2024-01-01T00:00:00Z',
        postedAt: null,
        kind: 'deposit'
      };

      const result = MercuryTransactionSchema.safeParse(transactionWithNulls);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.counterpartyName).toBe(null);
        expect(result.data.postedAt).toBe(null);
      }
    });
  });
});