import { z } from 'zod';

// Mercury Account Schema
export const MercuryAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  currentBalance: z.number(),
  availableBalance: z.number(),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
});

// Mercury Transaction Schema
export const MercuryTransactionSchema = z.object({
  id: z.string(),
  amount: z.number(),
  counterpartyName: z.string().nullable(),
  createdAt: z.string(), // ISO date string
  postedAt: z.string().nullable(),
  status: z.enum(['pending', 'completed', 'failed']).optional(),
  kind: z.string(),
  note: z.string().nullable().optional(),
  bankDescription: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  externalMemo: z.string().nullable().optional(),
  estimatedDeliveryDate: z.string().nullable().optional(),
  failedAt: z.string().nullable().optional(),
  sentAt: z.string().nullable().optional(),
  receivedAt: z.string().nullable().optional(),
  canceledAt: z.string().nullable().optional(),
  returnedAt: z.string().nullable().optional(),
});

// API Response Schemas
export const MercuryAccountsResponseSchema = z.object({
  accounts: z.array(MercuryAccountSchema),
});

export const MercuryTransactionsResponseSchema = z.object({
  transactions: z.array(MercuryTransactionSchema),
  total: z.number().optional(),
});

// Type exports
export type MercuryAccount = z.infer<typeof MercuryAccountSchema>;
export type MercuryTransaction = z.infer<typeof MercuryTransactionSchema>;
export type MercuryAccountsResponse = z.infer<typeof MercuryAccountsResponseSchema>;
export type MercuryTransactionsResponse = z.infer<typeof MercuryTransactionsResponseSchema>;