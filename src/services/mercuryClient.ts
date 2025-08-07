import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';
import { z } from 'zod';
import { 
  MercuryAccountSchema, 
  MercuryTransactionSchema,
  MercuryAccountsResponseSchema,
  MercuryTransactionsResponseSchema,
  type MercuryAccount,
  type MercuryTransaction 
} from '../schemas/mercury';
import { Logger } from '../utils/logger';
import { rateLimiter, retryHandler } from '../utils/rateLimiter';
import { getRequiredEnvVar, getOptionalEnvVar } from '../utils/envValidator';

dotenv.config();

const logger = Logger.for('MercuryClient');

export interface Account {
  id: string;
  name: string;
  kind: string;
  status: string;
  accountNumber: string;
  routingNumber: string;
  availableBalance: number;
  currentBalance: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  status: string;
  kind: string;
  counterpartyName: string;
  counterpartyId: string;
  postedDate: string;
  createdAt: string;
  description: string;
  bankDescription: string;
  category: string;
  dashboardLink: string;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  hasMore: boolean;
}

export interface AccountBalance {
  availableBalance: number;
  currentBalance: number;
  pendingBalance: number;
}

export class MercuryClient {
  private client: AxiosInstance;

  constructor() {
    const apiToken = getRequiredEnvVar('MERCURY_API_TOKEN');
    const baseURL = getOptionalEnvVar('MERCURY_API_BASE_URL', 'https://api.mercury.com/api/v1');

    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async getAccounts(): Promise<Account[]> {
    await rateLimiter.waitForLimit('mercury');
    
    return retryHandler.withRetry(async () => {
      const response = await this.client.get('/accounts');
      
      // Validate response data
      const validated = MercuryAccountsResponseSchema.safeParse(response.data);
      if (!validated.success) {
        logger.error('Invalid Mercury accounts response', validated.error);
        throw new Error('Invalid response from Mercury API');
      }
      
      return validated.data.accounts as Account[];
    }, { maxRetries: 3 }, 'Mercury.getAccounts');
  }

  async getAccount(accountId: string): Promise<Account> {
    await rateLimiter.waitForLimit('mercury');
    
    return retryHandler.withRetry(async () => {
      const response = await this.client.get(`/account/${accountId}`);
      
      // Validate response data
      const validated = MercuryAccountSchema.safeParse(response.data);
      if (!validated.success) {
        logger.error(`Invalid Mercury account response for ${accountId}`, validated.error);
        throw new Error('Invalid response from Mercury API');
      }
      
      return validated.data as Account;
    }, { maxRetries: 3 }, `Mercury.getAccount(${accountId})`);
  }

  async getAccountBalance(accountId: string): Promise<AccountBalance> {
    await rateLimiter.waitForLimit('mercury');
    
    return retryHandler.withRetry(async () => {
      const response = await this.client.get(`/account/${accountId}/balance`);
      return response.data;
    }, { maxRetries: 3 }, `Mercury.getAccountBalance(${accountId})`);
  }

  async getTransactions(
    accountId: string,
    options: {
      offset?: number;
      limit?: number;
      search?: string;
      start?: string;
      end?: string;
    } = {}
  ): Promise<TransactionsResponse> {
    try {
      const params = new URLSearchParams();

      if (options.offset !== undefined) params.append('offset', options.offset.toString());
      if (options.limit !== undefined) params.append('limit', options.limit.toString());
      if (options.search) params.append('search', options.search);
      if (options.start) params.append('start', options.start);
      if (options.end) params.append('end', options.end);

      const response = await this.client.get(`/account/${accountId}/transactions`, { params });
      
      // Validate response data
      const validated = MercuryTransactionsResponseSchema.safeParse(response.data);
      if (!validated.success) {
        logger.error(`Invalid Mercury transactions response for ${accountId}`, validated.error);
        throw new Error('Invalid response from Mercury API');
      }
      
      return response.data;
    } catch (error) {
      logger.error(`Error fetching transactions for account ${accountId}:`, error as Error);
      throw error;
    }
  }

  async getAllTransactions(
    accountId: string,
    options: {
      search?: string;
      start?: string;
      end?: string;
    } = {}
  ): Promise<Transaction[]> {
    const allTransactions: Transaction[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getTransactions(accountId, {
        ...options,
        offset,
        limit,
      });

      allTransactions.push(...response.transactions);
      hasMore = response.hasMore;
      offset += limit;
    }

    return allTransactions;
  }

  async getTransaction(transactionId: string): Promise<Transaction> {
    try {
      const response = await this.client.get(`/transaction/${transactionId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error fetching transaction ${transactionId}:`, error as Error);
      throw error;
    }
  }
}