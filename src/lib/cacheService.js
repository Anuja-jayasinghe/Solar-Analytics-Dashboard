/**
 * Cache Service for Solar Analytics Dashboard
 * Provides localStorage and in-memory caching with TTL support
 */

class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.cachePrefix = 'solar_analytics_';
    this.defaultTTL = {
      live: 5 * 60 * 1000,      // 5 minutes for live data
      daily: 15 * 60 * 1000,    // 15 minutes for daily data
      monthly: 60 * 60 * 1000,  // 1 hour for monthly data
      yearly: 24 * 60 * 60 * 1000, // 24 hours for yearly data
      settings: 30 * 60 * 1000  // 30 minutes for settings
    };
  }

  /**
   * Generate cache key with type prefix
   */
  getCacheKey(type, key) {
    return `${this.cachePrefix}${type}_${key}`;
  }

  /**
   * Set data in both memory and localStorage
   */
  set(type, key, data, ttl = null) {
    const cacheKey = this.getCacheKey(type, key);
    const ttlMs = ttl || this.defaultTTL[type] || this.defaultTTL.daily;
    const expiry = Date.now() + ttlMs;
    
    const cacheData = {
      data,
      expiry,
      timestamp: Date.now()
    };

    // Store in memory cache
    this.memoryCache.set(cacheKey, cacheData);

    // Store in localStorage
    try {
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to store in localStorage:', error);
    }
  }

  /**
   * Get data from cache (memory first, then localStorage)
   */
  get(type, key) {
    const cacheKey = this.getCacheKey(type, key);
    
    // Try memory cache first
    let cacheData = this.memoryCache.get(cacheKey);
    
    if (!cacheData) {
      // Try localStorage
      try {
        const stored = localStorage.getItem(cacheKey);
        if (stored) {
          cacheData = JSON.parse(stored);
          // Restore to memory cache
          this.memoryCache.set(cacheKey, cacheData);
        }
      } catch (error) {
        console.warn('Failed to read from localStorage:', error);
        return null;
      }
    }

    if (!cacheData) return null;

    // Check if expired
    if (Date.now() > cacheData.expiry) {
      this.delete(type, key);
      return null;
    }

    return cacheData.data;
  }

  /**
   * Check if data exists and is not expired
   */
  has(type, key) {
    const data = this.get(type, key);
    return data !== null;
  }

  /**
   * Delete data from both caches
   */
  delete(type, key) {
    const cacheKey = this.getCacheKey(type, key);
    this.memoryCache.delete(cacheKey);
    try {
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
    }
  }

  /**
   * Clear all cache data
   */
  clear() {
    this.memoryCache.clear();
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.cachePrefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear localStorage cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const memorySize = this.memoryCache.size;
    let localStorageSize = 0;
    
    try {
      const keys = Object.keys(localStorage);
      localStorageSize = keys.filter(key => key.startsWith(this.cachePrefix)).length;
    } catch (error) {
      console.warn('Failed to get localStorage stats:', error);
    }

    return {
      memorySize,
      localStorageSize,
      totalSize: memorySize + localStorageSize
    };
  }

  /**
   * Clean expired entries from memory cache
   */
  cleanExpired() {
    const now = Date.now();
    for (const [key, value] of this.memoryCache.entries()) {
      if (now > value.expiry) {
        this.memoryCache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Clean expired entries every 5 minutes
setInterval(() => {
  cacheService.cleanExpired();
}, 5 * 60 * 1000);
