import { AttioCollector } from '../collectors/attioCollector';
import { PostHogCollector } from '../collectors/posthogCollector';
import { SnowflakeCollector } from '../collectors/snowflakeCollector';
import { DataCache } from '../utils/cache';
import { logger } from '../utils/logger';

import { MercuryClient } from './mercuryClient';

export interface DataCollectionResult {
  source: string;
  status: 'success' | 'error' | 'stale';
  data: any;
  timestamp: Date;
  responseTime?: number;
  error?: string;
  dataAge?: string; // Human readable: "2 minutes ago"
}

export interface CollectionSummary {
  totalSources: number;
  successful: number;
  failed: number;
  stale: number;
  oldestData?: Date;
  newestData?: Date;
  recommendations: string[];
}

export class DataCollectionService {
  private cache: DataCache;
  private collectors: Map<string, () => Promise<any>>;
  private isRunning: boolean = false;

  constructor() {
    this.cache = new DataCache('./.data-cache');
    this.collectors = new Map();
    this.initializeCollectors();
  }

  private initializeCollectors() {
    // Mercury (required)
    this.collectors.set('mercury', async () => {
      const client = new MercuryClient();
      const accounts = await client.getAccounts();
      
      if (accounts.length === 0) {
        throw new Error('No Mercury accounts found');
      }

      // Get transactions for the primary account (largest balance)
      const primaryAccount = accounts.reduce((prev, curr) => 
        curr.currentBalance > prev.currentBalance ? curr : prev
      );

      const transactions = await client.getAllTransactions(primaryAccount.id);
      
      return {
        accounts,
        primaryAccount,
        transactions,
        accountCount: accounts.length,
        transactionCount: transactions.length,
        totalBalance: accounts.reduce((sum, acc) => sum + acc.currentBalance, 0)
      };
    });

    // Attio (optional)
    if (process.env.ATTIO_API_KEY) {
      this.collectors.set('attio', async () => {
        const collector = new AttioCollector();
        const result = await collector.collect();
        if (result.error) {throw new Error(result.error);}
        return result.data;
      });
    }

    // PostHog (optional)
    if (process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID) {
      this.collectors.set('posthog', async () => {
        const collector = new PostHogCollector();
        const result = await collector.collect();
        if (result.error) {throw new Error(result.error);}
        return result.data;
      });
    }

    // Snowflake (optional)
    if (process.env.SNOWFLAKE_ACCOUNT && process.env.SNOWFLAKE_USER) {
      this.collectors.set('snowflake', async () => {
        const collector = new SnowflakeCollector();
        const result = await collector.collect();
        if (result.error) {throw new Error(result.error);}
        return result.data;
      });
    }
  }

  /**
   * Collect data from all sources in parallel with graceful failure handling
   */
  async collectAllData(maxAgeMinutes: number = 30): Promise<DataCollectionResult[]> {
    if (this.isRunning) {
      logger.warn('Data collection already in progress, using cached results');
      return await this.getCachedResults();
    }

    this.isRunning = true;
    const results: DataCollectionResult[] = [];

    try {
      logger.info('🔄 Starting background data collection', { sources: this.collectors.size });

      // Collect from all sources in parallel
      const promises = Array.from(this.collectors.entries()).map(async ([source, collector]) => {
        const startTime = Date.now();
        const cacheKey = `data-${source}`;

        try {
          // Check if we have fresh cached data first
          const cached = await this.cache.get(cacheKey);
          if (cached && this.isFresh(cached.timestamp, maxAgeMinutes)) {
            const age = this.getDataAge(new Date(cached.timestamp));
            logger.debug(`Using cached ${source} data`, { age });
            
            return {
              source,
              status: 'success' as const,
              data: cached.data,
              timestamp: new Date(cached.timestamp),
              responseTime: 0,
              dataAge: age
            };
          }

          // Fetch fresh data with timeout
          const data = await Promise.race([
            collector(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout after 60s')), 60000)
            )
          ]);

          const responseTime = Date.now() - startTime;
          const timestamp = new Date();

          // Cache the result
          await this.cache.set(cacheKey, { data, timestamp: timestamp.toISOString() }, 120); // 2 hour TTL

          logger.info(`✅ Collected ${source} data`, { responseTime, dataSize: JSON.stringify(data).length });

          return {
            source,
            status: 'success' as const,
            data,
            timestamp,
            responseTime,
            dataAge: 'just now'
          };

        } catch (error: any) {
          const responseTime = Date.now() - startTime;
          logger.warn(`❌ Failed to collect ${source} data`, { error: error.message, responseTime });

          // Try to use stale cached data as fallback
          const staleData = await this.cache.get(cacheKey);
          if (staleData) {
            const age = this.getDataAge(new Date(staleData.timestamp));
            logger.info(`🕐 Using stale ${source} data as fallback`, { age });

            return {
              source,
              status: 'stale' as const,
              data: staleData.data,
              timestamp: new Date(staleData.timestamp),
              responseTime,
              error: error.message,
              dataAge: age
            };
          }

          return {
            source,
            status: 'error' as const,
            data: null,
            timestamp: new Date(),
            responseTime,
            error: error.message,
            dataAge: 'never'
          };
        }
      });

      results.push(...await Promise.all(promises));

      logger.info('✅ Data collection completed', {
        successful: results.filter(r => r.status === 'success').length,
        stale: results.filter(r => r.status === 'stale').length,
        failed: results.filter(r => r.status === 'error').length
      });

      return results;

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get cached results without triggering new collection
   */
  async getCachedResults(): Promise<DataCollectionResult[]> {
    const results: DataCollectionResult[] = [];

    for (const source of this.collectors.keys()) {
      const cached = await this.cache.get(`data-${source}`);
      
      if (cached) {
        const age = this.getDataAge(new Date(cached.timestamp));
        results.push({
          source,
          status: 'success',
          data: cached.data,
          timestamp: new Date(cached.timestamp),
          dataAge: age
        });
      } else {
        results.push({
          source,
          status: 'error',
          data: null,
          timestamp: new Date(),
          error: 'No cached data available',
          dataAge: 'never'
        });
      }
    }

    return results;
  }

  /**
   * Get collection summary with recommendations
   */
  generateSummary(results: DataCollectionResult[]): CollectionSummary {
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'error');
    const stale = results.filter(r => r.status === 'stale');
    
    const timestamps = results.filter(r => r.timestamp).map(r => r.timestamp);
    const oldestData = timestamps.length ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : undefined;
    const newestData = timestamps.length ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : undefined;

    const recommendations: string[] = [];

    if (failed.length > 0) {
      recommendations.push(`${failed.length} data sources failed - check API credentials and connectivity`);
    }

    if (stale.length > 0) {
      recommendations.push(`${stale.length} data sources using stale data - recent API issues detected`);
    }

    if (successful.length === 0) {
      recommendations.push('⚠️ No fresh data available - report quality will be severely impacted');
    } else if (successful.length < results.length / 2) {
      recommendations.push('⚠️ Less than half of data sources are healthy - report may be incomplete');
    }

    if (oldestData && this.getMinutesOld(oldestData) > 60) {
      recommendations.push('Some data is over 1 hour old - consider running data collection more frequently');
    }

    return {
      totalSources: results.length,
      successful: successful.length,
      failed: failed.length,
      stale: stale.length,
      oldestData,
      newestData,
      recommendations
    };
  }

  private isFresh(timestamp: string, maxAgeMinutes: number): boolean {
    const age = new Date().getTime() - new Date(timestamp).getTime();
    return age < (maxAgeMinutes * 60 * 1000);
  }

  private getDataAge(timestamp: Date): string {
    const minutes = this.getMinutesOld(timestamp);
    
    if (minutes < 1) {return 'just now';}
    if (minutes < 60) {return `${Math.round(minutes)} minutes ago`;}
    if (minutes < 1440) {return `${Math.round(minutes / 60)} hours ago`;}
    return `${Math.round(minutes / 1440)} days ago`;
  }

  private getMinutesOld(timestamp: Date): number {
    return (new Date().getTime() - timestamp.getTime()) / (1000 * 60);
  }

  /**
   * Health check for data collection system
   */
  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      const results = await this.getCachedResults();
      const summary = this.generateSummary(results);

      if (summary.failed === summary.totalSources) {
        issues.push('All data sources failed');
      }

      if (summary.successful === 0) {
        issues.push('No fresh data available');
      }

      if (summary.oldestData && this.getMinutesOld(summary.oldestData) > 120) {
        issues.push('Data is over 2 hours old');
      }

    } catch (error) {
      issues.push(`Health check failed: ${error}`);
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }
}