import { Logger } from './logger';

const logger = Logger.for('RateLimiter');

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  retryAfterMs?: number;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Rate limiter with sliding window algorithm
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();

  constructor() {
    // Default rate limits for different services
    this.configs.set('mercury', { maxRequests: 60, windowMs: 60000 }); // 60 req/min
    this.configs.set('stripe', { maxRequests: 100, windowMs: 1000 });   // 100 req/sec
    this.configs.set('attio', { maxRequests: 10, windowMs: 1000 });     // 10 req/sec
    this.configs.set('github', { maxRequests: 5000, windowMs: 3600000 }); // 5000 req/hour
    this.configs.set('posthog', { maxRequests: 100, windowMs: 1000 });   // 100 req/sec
    this.configs.set('snowflake', { maxRequests: 100, windowMs: 60000 }); // 100 req/min
  }

  /**
   * Check if request can proceed or should be rate limited
   */
  async checkLimit(service: string): Promise<boolean> {
    const config = this.configs.get(service);
    if (!config) {
      logger.warn(`No rate limit config for service: ${service}`);
      return true; // Allow if no config
    }

    const now = Date.now();
    const requests = this.requests.get(service) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(
      timestamp => now - timestamp < config.windowMs
    );

    if (validRequests.length >= config.maxRequests) {
      const oldestRequest = validRequests[0];
      const waitTime = config.windowMs - (now - oldestRequest);
      
      logger.warn(`Rate limit reached for ${service}. Wait ${waitTime}ms`);
      
      if (config.retryAfterMs) {
        await this.sleep(config.retryAfterMs);
        return this.checkLimit(service); // Recursive retry
      }
      
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(service, validRequests);
    
    return true;
  }

  /**
   * Wait for rate limit to clear
   */
  async waitForLimit(service: string): Promise<void> {
    const config = this.configs.get(service);
    if (!config) {return;}

    while (!(await this.checkLimit(service))) {
      await this.sleep(100); // Check every 100ms
    }
  }

  /**
   * Update rate limit config for a service
   */
  setConfig(service: string, config: RateLimitConfig): void {
    this.configs.set(service, config);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Exponential backoff retry mechanism
 */
export class RetryHandler {
  private defaultConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2
  };

  /**
   * Execute function with exponential backoff retry
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    config?: Partial<RetryConfig>,
    context?: string
  ): Promise<T> {
    const retryConfig = { ...this.defaultConfig, ...config };
    let lastError: Error | undefined;
    let delay = retryConfig.initialDelayMs;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Check if error is retryable
        if (!this.isRetryable(error)) {
          throw error;
        }

        if (attempt < retryConfig.maxRetries) {
          // Check for rate limit headers
          const retryAfter = this.getRetryAfter(error);
          const waitTime = retryAfter || delay;
          
          logger.info(
            `Retry attempt ${attempt + 1}/${retryConfig.maxRetries} for ${context || 'operation'} after ${waitTime}ms`,
            { error: error.message }
          );
          
          await this.sleep(waitTime);
          
          // Exponential backoff
          delay = Math.min(delay * retryConfig.backoffMultiplier, retryConfig.maxDelayMs);
        }
      }
    }

    logger.error(`All retry attempts failed for ${context || 'operation'}`, lastError);
    throw lastError;
  }

  /**
   * Determine if error is retryable
   */
  private isRetryable(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ENOTFOUND') {
      return true;
    }

    // HTTP status codes that are retryable
    const status = error.response?.status;
    if (status === 429 || // Rate limited
        status === 502 || // Bad gateway
        status === 503 || // Service unavailable
        status === 504) { // Gateway timeout
      return true;
    }

    // Specific error messages
    if (error.message?.includes('ETIMEDOUT') ||
        error.message?.includes('socket hang up') ||
        error.message?.includes('ECONNREFUSED')) {
      return true;
    }

    return false;
  }

  /**
   * Extract retry-after header from error response
   */
  private getRetryAfter(error: any): number | null {
    const retryAfter = error.response?.headers?.['retry-after'];
    
    if (retryAfter) {
      // If it's a number, it's in seconds
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return seconds * 1000;
      }
      
      // If it's a date, calculate the difference
      const retryDate = new Date(retryAfter);
      if (!isNaN(retryDate.getTime())) {
        return Math.max(0, retryDate.getTime() - Date.now());
      }
    }
    
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instances
export const rateLimiter = new RateLimiter();
export const retryHandler = new RetryHandler();