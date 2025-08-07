import * as dotenv from 'dotenv';

import { cacheManager } from '../utils/cache.enhanced';
import { Logger } from '../utils/logger';

import { MercuryClient } from './mercuryClient';
import { MetricsAggregator } from './metricsAggregator';


dotenv.config();

const logger = Logger.for('HealthCheck');

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    [service: string]: {
      status: 'up' | 'down' | 'degraded';
      responseTime?: number;
      error?: string;
      lastChecked: string;
    };
  };
  metrics: {
    cacheHitRate: number;
    apiCallsLastHour: number;
    errorsLastHour: number;
    averageResponseTime: number;
  };
}

export class HealthCheckService {
  private startTime: Date;
  private apiCalls: Map<string, number[]> = new Map();
  private errors: Map<string, number[]> = new Map();
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor() {
    this.startTime = new Date();
  }

  /**
   * Perform comprehensive health check
   */
  async checkHealth(): Promise<HealthStatus> {
    const checks: HealthStatus['checks'] = {};
    
    // Check Mercury API
    checks.mercury = await this.checkMercury();
    
    // Check data sources
    const aggregator = new MetricsAggregator();
    const collectorHealth = await aggregator.checkCollectorHealth();
    
    for (const [name, isHealthy] of Object.entries(collectorHealth)) {
      checks[name] = {
        status: isHealthy ? 'up' : 'down',
        lastChecked: new Date().toISOString()
      };
    }
    
    // Check cache
    checks.cache = await this.checkCache();
    
    // Check disk space
    checks.disk = await this.checkDiskSpace();
    
    // Check memory usage
    checks.memory = await this.checkMemory();
    
    // Calculate overall status
    const criticalServices = ['mercury', 'cache', 'memory', 'disk'];
    const criticalDown = criticalServices.some(s => checks[s]?.status === 'down');
    const anyDown = Object.values(checks).some(c => c.status === 'down');
    const anyDegraded = Object.values(checks).some(c => c.status === 'degraded');
    
    let status: HealthStatus['status'] = 'healthy';
    if (criticalDown) {
      status = 'unhealthy';
    } else if (anyDown || anyDegraded) {
      status = 'degraded';
    }
    
    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime.getTime(),
      checks,
      metrics: this.getMetrics()
    };
  }

  /**
   * Check Mercury API health
   */
  private async checkMercury(): Promise<HealthStatus['checks'][string]> {
    const start = Date.now();
    
    try {
      const client = new MercuryClient();
      const accounts = await client.getAccounts();
      
      const responseTime = Date.now() - start;
      this.recordApiCall('mercury', responseTime);
      
      return {
        status: responseTime < 2000 ? 'up' : 'degraded',
        responseTime,
        lastChecked: new Date().toISOString()
      };
    } catch (error: any) {
      this.recordError('mercury');
      
      return {
        status: 'down',
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check cache health
   */
  private async checkCache(): Promise<HealthStatus['checks'][string]> {
    try {
      const stats = await cacheManager.getStats();
      
      // Test cache operations
      const testKey = 'health-check-test';
      await cacheManager.set(testKey, { test: true }, { ttl: 1000 });
      const retrieved = await cacheManager.get(testKey);
      await cacheManager.delete(testKey);
      
      if (!retrieved) {
        throw new Error('Cache read/write test failed');
      }
      
      return {
        status: 'up',
        lastChecked: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        status: 'down',
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check disk space
   */
  private async checkDiskSpace(): Promise<HealthStatus['checks'][string]> {
    try {
      const { execSync } = await import('child_process');
      const output = execSync('df -k /').toString();
      const lines = output.trim().split('\n');
      const parts = lines[1].split(/\s+/);
      
      const totalKB = parseInt(parts[1]);
      const usedKB = parseInt(parts[2]);
      const percentUsed = (usedKB / totalKB) * 100;
      
      let status: 'up' | 'degraded' | 'down' = 'up';
      if (percentUsed > 90) {
        status = 'down';
      } else if (percentUsed > 80) {
        status = 'degraded';
      }
      
      return {
        status,
        lastChecked: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        status: 'degraded',
        error: 'Unable to check disk space',
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<HealthStatus['checks'][string]> {
    const used = process.memoryUsage();
    const heapUsedPercent = (used.heapUsed / used.heapTotal) * 100;
    
    let status: 'up' | 'degraded' | 'down' = 'up';
    if (heapUsedPercent > 90) {
      status = 'down';
    } else if (heapUsedPercent > 75) {
      status = 'degraded';
    }
    
    return {
      status,
      lastChecked: new Date().toISOString()
    };
  }

  /**
   * Record API call for metrics
   */
  recordApiCall(service: string, responseTime: number): void {
    const now = Date.now();
    const calls = this.apiCalls.get(service) || [];
    
    // Keep only last hour
    const oneHourAgo = now - 3600000;
    const recentCalls = calls.filter(time => time > oneHourAgo);
    recentCalls.push(responseTime);
    
    this.apiCalls.set(service, recentCalls);
  }

  /**
   * Record error for metrics
   */
  recordError(service: string): void {
    const now = Date.now();
    const errors = this.errors.get(service) || [];
    
    // Keep only last hour
    const oneHourAgo = now - 3600000;
    const recentErrors = errors.filter(time => time > oneHourAgo);
    recentErrors.push(now);
    
    this.errors.set(service, recentErrors);
  }

  /**
   * Record cache hit/miss
   */
  recordCacheHit(hit: boolean): void {
    if (hit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
  }

  /**
   * Get current metrics
   */
  private getMetrics(): HealthStatus['metrics'] {
    // Calculate cache hit rate
    const totalCacheRequests = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 
      ? this.cacheHits / totalCacheRequests 
      : 0;
    
    // Count API calls in last hour
    let totalApiCalls = 0;
    let totalResponseTime = 0;
    for (const calls of this.apiCalls.values()) {
      totalApiCalls += calls.length;
      totalResponseTime += calls.reduce((sum, time) => sum + time, 0);
    }
    
    // Count errors in last hour
    let totalErrors = 0;
    for (const errors of this.errors.values()) {
      totalErrors += errors.length;
    }
    
    return {
      cacheHitRate,
      apiCallsLastHour: totalApiCalls,
      errorsLastHour: totalErrors,
      averageResponseTime: totalApiCalls > 0 
        ? totalResponseTime / totalApiCalls 
        : 0
    };
  }

  /**
   * Express middleware for health endpoint
   */
  async handleHealthCheck(req: any, res: any): Promise<void> {
    try {
      const health = await this.checkHealth();
      const statusCode = health.status === 'healthy' ? 200 
        : health.status === 'degraded' ? 503 
        : 503;
      
      res.status(statusCode).json(health);
    } catch (error: any) {
      logger.error('Health check failed', error);
      res.status(503).json({
        status: 'unhealthy',
        error: error.message
      });
    }
  }
}

// Singleton instance
export const healthCheckService = new HealthCheckService();