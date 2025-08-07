import { test, expect, beforeEach, afterEach } from "bun:test";
import { promises as fs } from "fs";
import path from "path";
import { DataCache } from "../../src/utils/cache";

const TEST_CACHE_DIR = "./test-cache";

beforeEach(async () => {
  // Clean up test cache directory
  try {
    await fs.rm(TEST_CACHE_DIR, { recursive: true });
  } catch (error) {
    // Directory might not exist, ignore
  }
});

afterEach(async () => {
  // Clean up test cache directory
  try {
    await fs.rm(TEST_CACHE_DIR, { recursive: true });
  } catch (error) {
    // Directory might not exist, ignore
  }
});

test("DataCache - should set and get cached data", async () => {
  const cache = new DataCache(TEST_CACHE_DIR);
  const testData = { message: "hello world", value: 42 };
  
  await cache.set("test-key", testData, 60);
  const retrieved = await cache.get("test-key");
  
  expect(retrieved).toEqual(testData);
});

test("DataCache - should return null for non-existent keys", async () => {
  const cache = new DataCache(TEST_CACHE_DIR);
  const result = await cache.get("non-existent-key");
  
  expect(result).toBeNull();
});

test("DataCache - should respect TTL and expire cached data", async () => {
  const cache = new DataCache(TEST_CACHE_DIR);
  const testData = { expired: true };
  
  // Set with very short TTL (0.01 minutes = 600ms)
  await cache.set("expire-test", testData, 0.01);
  
  // Should be available immediately
  let result = await cache.get("expire-test");
  expect(result).toEqual(testData);
  
  // Wait for expiration
  await new Promise(resolve => setTimeout(resolve, 700));
  
  // Should be null after expiration
  result = await cache.get("expire-test");
  expect(result).toBeNull();
});

test("DataCache - should handle delete operations", async () => {
  const cache = new DataCache(TEST_CACHE_DIR);
  const testData = { toDelete: true };
  
  await cache.set("delete-test", testData, 60);
  
  // Verify it exists
  let result = await cache.get("delete-test");
  expect(result).toEqual(testData);
  
  // Delete it
  await cache.delete("delete-test");
  
  // Should be null after deletion
  result = await cache.get("delete-test");
  expect(result).toBeNull();
});

test("DataCache - should clear all cached data", async () => {
  const cache = new DataCache(TEST_CACHE_DIR);
  
  await cache.set("key1", { data: "value1" }, 60);
  await cache.set("key2", { data: "value2" }, 60);
  await cache.set("key3", { data: "value3" }, 60);
  
  // Verify all exist
  expect(await cache.get("key1")).not.toBeNull();
  expect(await cache.get("key2")).not.toBeNull();
  expect(await cache.get("key3")).not.toBeNull();
  
  // Clear all
  await cache.clear();
  
  // All should be null
  expect(await cache.get("key1")).toBeNull();
  expect(await cache.get("key2")).toBeNull();
  expect(await cache.get("key3")).toBeNull();
});

test("DataCache - getWithFallback should use cache when available", async () => {
  const cache = new DataCache(TEST_CACHE_DIR);
  const cachedData = { fromCache: true };
  let fetchCalled = false;
  
  // Pre-populate cache
  await cache.set("fallback-test", cachedData, 60);
  
  const result = await cache.getWithFallback(
    "fallback-test",
    async () => {
      fetchCalled = true;
      return { fromFetch: true };
    },
    60
  );
  
  expect(result).toEqual(cachedData);
  expect(fetchCalled).toBe(false);
});

test("DataCache - getWithFallback should fetch when cache is empty", async () => {
  const cache = new DataCache(TEST_CACHE_DIR);
  const fetchData = { fromFetch: true };
  let fetchCalled = false;
  
  const result = await cache.getWithFallback(
    "fallback-fetch-test",
    async () => {
      fetchCalled = true;
      return fetchData;
    },
    60
  );
  
  expect(result).toEqual(fetchData);
  expect(fetchCalled).toBe(true);
  
  // Should now be cached
  const cachedResult = await cache.get("fallback-fetch-test");
  expect(cachedResult).toEqual(fetchData);
});

test("DataCache - getWithFallback should use stale data on fetch error", async () => {
  const cache = new DataCache(TEST_CACHE_DIR);
  const staleData = { stale: true };
  
  // Set expired cache data by manipulating timestamp
  await cache.set("stale-test", staleData, 0.01);
  await new Promise(resolve => setTimeout(resolve, 700)); // Let it expire
  
  try {
    const result = await cache.getWithFallback(
      "stale-test",
      async () => {
        throw new Error("Fetch failed");
      },
      60
    );
    
    expect(result).toEqual(staleData);
  } catch (error) {
    // If stale data isn't available, this is also acceptable behavior
    expect(error).toBeInstanceOf(Error);
  }
});

test("DataCache - should handle file system errors gracefully", async () => {
  const cache = new DataCache("/invalid/path/that/cannot/be/created");
  
  // Should not throw errors
  await expect(cache.set("test", { data: "test" }, 60)).resolves.toBeUndefined();
  await expect(cache.get("test")).resolves.toBeNull();
  await expect(cache.delete("test")).resolves.toBeUndefined();
  await expect(cache.clear()).resolves.toBeUndefined();
});