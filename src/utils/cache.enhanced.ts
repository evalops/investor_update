import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Logger } from './logger';

const logger = Logger.for('Cache');

export interface CacheOptions {
  ttl?: number;           // Time to live in milliseconds
  namespace?: string;      // Cache namespace for organization
  serialize?: boolean;     // Whether to JSON serialize the data
  compress?: boolean;      // Whether to compress large data
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hash?: string;
}

/**
 * Enhanced cache manager with TTL, namespacing, and memory/disk hybrid storage
 */
export class CacheManager {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private cacheDir: string;
  private maxMemorySize: number = 100 * 1024 * 1024; // 100MB default
  private currentMemorySize: number = 0;
  private defaultTTL: number = 15 * 60 * 1000; // 15 minutes default

  constructor(cacheDir: string = '.cache') {
    this.cacheDir = cacheDir;
    this.initializeCache();
    this.startCleanupInterval();
  }

  /**
   * Initialize cache directory
   */
  private async initializeCache(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to initialize cache directory', error as Error);
    }
  }

  /**
   * Get item from cache
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const fullKey = this.getFullKey(key, options?.namespace);
    
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(fullKey);
    if (memoryEntry && this.isValid(memoryEntry)) {
      logger.debug(`Cache hit (memory): ${fullKey}`);
      return memoryEntry.data;
    }

    // Check disk cache
    try {
      const filePath = this.getFilePath(fullKey);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(fileContent);
      
      if (this.isValid(entry)) {
        logger.debug(`Cache hit (disk): ${fullKey}`);
        
        // Promote to memory cache if small enough
        if (this.getSize(entry.data) < 1024 * 1024) { // 1MB threshold
          this.setMemory(fullKey, entry);
        }
        
        return entry.data;
      }
      
      // Clean up expired entry
      await this.delete(key, options);
    } catch (error) {
      // Cache miss
    }
    
    logger.debug(`Cache miss: ${fullKey}`);
    return null;
  }

  /**
   * Set item in cache
   */
  async set<T>(key: string, data: T, options?: CacheOptions): Promise<void> {
    const fullKey = this.getFullKey(key, options?.namespace);
    const ttl = options?.ttl || this.defaultTTL;
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      hash: this.generateHash(data)
    };

    // Store in memory if small
    const size = this.getSize(data);
    if (size < 1024 * 1024) { // 1MB threshold
      this.setMemory(fullKey, entry);
    }

    // Always store on disk for persistence
    try {
      const filePath = this.getFilePath(fullKey);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(entry, null, 2));
      logger.debug(`Cache set: ${fullKey} (TTL: ${ttl}ms)`);
    } catch (error) {
      logger.error(`Failed to write cache: ${fullKey}`, error as Error);
    }
  }

  /**
   * Delete item from cache
   */
  async delete(key: string, options?: CacheOptions): Promise<void> {
    const fullKey = this.getFullKey(key, options?.namespace);
    
    // Remove from memory
    this.memoryCache.delete(fullKey);
    
    // Remove from disk
    try {
      const filePath = this.getFilePath(fullKey);
      await fs.unlink(filePath);
      logger.debug(`Cache deleted: ${fullKey}`);
    } catch (error) {
      // File might not exist
    }
  }

  /**
   * Clear entire cache or namespace
   */
  async clear(namespace?: string): Promise<void> {
    if (namespace) {
      // Clear specific namespace
      const prefix = `${namespace}:`;
      
      // Clear memory
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(prefix)) {
          this.memoryCache.delete(key);
        }
      }
      
      // Clear disk
      const namespaceDir = path.join(this.cacheDir, namespace);
      try {
        await fs.rm(namespaceDir, { recursive: true, force: true });
      } catch (error) {
        // Directory might not exist
      }
    } else {
      // Clear everything
      this.memoryCache.clear();
      this.currentMemorySize = 0;
      
      try {
        await fs.rm(this.cacheDir, { recursive: true, force: true });
        await this.initializeCache();
      } catch (error) {
        logger.error('Failed to clear cache', error as Error);
      }
    }
    
    logger.info(`Cache cleared${namespace ? ` for namespace: ${namespace}` : ''}`);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    memoryEntries: number;
    memorySize: number;
    diskEntries: number;
    diskSize: number;
  }> {
    let diskEntries = 0;
    let diskSize = 0;

    try {
      const files = await this.getAllCacheFiles();
      diskEntries = files.length;
      
      for (const file of files) {
        const stats = await fs.stat(file);
        diskSize += stats.size;
      }
    } catch (error) {
      // Ignore errors
    }

    return {
      memoryEntries: this.memoryCache.size,
      memorySize: this.currentMemorySize,
      diskEntries,
      diskSize
    };
  }

  /**
   * Invalidate cache based on pattern
   */
  async invalidate(pattern: string | RegExp): Promise<number> {
    let invalidated = 0;
    
    // Invalidate memory cache
    for (const key of this.memoryCache.keys()) {
      if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
        this.memoryCache.delete(key);
        invalidated++;
      }
    }
    
    // Invalidate disk cache
    const files = await this.getAllCacheFiles();
    for (const file of files) {
      const filename = path.basename(file, '.json');
      if (typeof pattern === 'string' ? filename.includes(pattern) : pattern.test(filename)) {
        try {
          await fs.unlink(file);
          invalidated++;
        } catch (error) {
          // Ignore errors
        }
      }
    }
    
    logger.info(`Invalidated ${invalidated} cache entries matching pattern`);
    return invalidated;
  }

  /**
   * Wrapper for caching async functions
   */
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }
    
    // Execute function and cache result
    const result = await fn();
    await this.set(key, result, options);
    return result;
  }

  // Private methods

  private getFullKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }

  private getFilePath(fullKey: string): string {
    const hash = crypto.createHash('md5').update(fullKey).digest('hex');
    const dir = hash.substring(0, 2);
    return path.join(this.cacheDir, dir, `${hash}.json`);
  }

  private isValid<T>(entry: CacheEntry<T>): boolean {
    const now = Date.now();
    return now - entry.timestamp < entry.ttl;
  }

  private generateHash(data: any): string {
    const str = JSON.stringify(data);
    return crypto.createHash('md5').update(str).digest('hex');
  }

  private getSize(data: any): number {
    const str = JSON.stringify(data);
    return Buffer.byteLength(str, 'utf8');
  }

  private setMemory<T>(key: string, entry: CacheEntry<T>): void {
    const size = this.getSize(entry.data);
    
    // Evict old entries if needed
    while (this.currentMemorySize + size > this.maxMemorySize && this.memoryCache.size > 0) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        const evicted = this.memoryCache.get(firstKey);
        if (evicted) {
          this.currentMemorySize -= this.getSize(evicted.data);
          this.memoryCache.delete(firstKey);
        }
      } else {
        break;
      }
    }
    
    this.memoryCache.set(key, entry);
    this.currentMemorySize += size;
  }

  private async getAllCacheFiles(): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const dirs = await fs.readdir(this.cacheDir);
      for (const dir of dirs) {
        const dirPath = path.join(this.cacheDir, dir);
        const stats = await fs.stat(dirPath);
        if (stats.isDirectory()) {
          const dirFiles = await fs.readdir(dirPath);
          files.push(...dirFiles.map(f => path.join(dirPath, f)));
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return files;
  }

  private startCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    setInterval(async () => {
      let cleaned = 0;
      
      // Clean memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (!this.isValid(entry)) {
          this.memoryCache.delete(key);
          this.currentMemorySize -= this.getSize(entry.data);
          cleaned++;
        }
      }
      
      // Clean disk cache
      const files = await this.getAllCacheFiles();
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const entry = JSON.parse(content);
          if (!this.isValid(entry)) {
            await fs.unlink(file);
            cleaned++;
          }
        } catch (error) {
          // Ignore errors
        }
      }
      
      if (cleaned > 0) {
        logger.debug(`Cleaned up ${cleaned} expired cache entries`);
      }
    }, 5 * 60 * 1000);
  }
}

// Singleton instance
export const cacheManager = new CacheManager();