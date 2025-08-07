import { logger } from '../utils/logger';

export interface CollectorResult {
  source: string;
  data: Record<string, any>;
  timestamp: Date;
  error?: string;
}

export abstract class BaseCollector {
  protected timeoutMs: number;

  constructor(timeoutMs: number = 30000) {
    this.timeoutMs = timeoutMs;
  }

  abstract collect(): Promise<CollectorResult>;

  protected withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
    const timeout = timeoutMs || this.timeoutMs;

    return Promise.race([
      promise,
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
      )
    ]);
  }

  protected formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  protected getDateRange(months: number): { start: string; end: string } {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);

    return {
      start: this.formatDate(start),
      end: this.formatDate(end)
    };
  }

  protected async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 2,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          logger.warn(`Attempt ${attempt + 1} failed, retrying in ${delayMs}ms`, { attempt: attempt + 1, maxRetries, delayMs, error });
          await new Promise(resolve => setTimeout(resolve, delayMs));
          delayMs *= 2; // Exponential backoff
        }
      }
    }

    throw lastError!;
  }

  protected isTransientError(error: any): boolean {
    if (!error) {return false;}

    const message = error.message?.toLowerCase() || '';
    const code = error.code;

    // Network/timeout errors
    if (message.includes('timeout') ||
        message.includes('network') ||
        message.includes('connection') ||
        code === 'ECONNRESET' ||
        code === 'ECONNREFUSED' ||
        code === 'ETIMEDOUT') {
      return true;
    }

    // HTTP status codes that might be retryable
    if (error.status >= 500 || error.status === 429) {
      return true;
    }

    return false;
  }
}
