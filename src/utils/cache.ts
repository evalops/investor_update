import { promises as fs } from 'fs';
import path from 'path';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class DataCache {
  private cacheDir: string;

  constructor(cacheDir: string = './.cache') {
    this.cacheDir = cacheDir;
  }

  private getCacheFilePath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }

  async set<T>(key: string, data: T, ttlMinutes: number = 60): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlMinutes * 60 * 1000
      };

      await fs.writeFile(this.getCacheFilePath(key), JSON.stringify(entry));
    } catch (error) {
      console.warn('Failed to write cache:', error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const filePath = this.getCacheFilePath(key);
      const content = await fs.readFile(filePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(content);

      // Check if cache is still valid
      if (Date.now() - entry.timestamp > entry.ttl) {
        await this.delete(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.getCacheFilePath(key));
    } catch (error) {
      // Ignore errors when deleting cache files
    }
  }

  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files
          .filter(file => file.endsWith('.json'))
          .map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  async getWithFallback<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttlMinutes: number = 60
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      console.log(`📦 Using cached data for ${key}`);
      return cached;
    }

    // Fetch fresh data
    try {
      const data = await fetchFunction();
      await this.set(key, data, ttlMinutes);
      return data;
    } catch (error) {
      // If fetch fails, try to get stale cache data
      const staleData = await this.getStale<T>(key);
      if (staleData !== null) {
        console.warn(`⚠️  Using stale cached data for ${key} due to fetch error:`, error);
        return staleData;
      }
      throw error;
    }
  }

  private async getStale<T>(key: string): Promise<T | null> {
    try {
      const filePath = this.getCacheFilePath(key);
      const content = await fs.readFile(filePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(content);
      return entry.data;
    } catch (error) {
      return null;
    }
  }
}
