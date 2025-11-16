/**
 * Enhanced Cache Service for Solar Analytics Dashboard
 * Provides localStorage and in-memory caching with TTL support and detailed statistics
 */

class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.cachePrefix = 'solar_analytics_';
    this.defaultTTL = {
      live: 5 * 60 * 1000,
      daily: 15 * 60 * 1000,
      monthly: 60 * 60 * 1000,
      yearly: 24 * 60 * 60 * 1000,
      settings: 30 * 60 * 1000
    };
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      errors: 0
    };
  }

  getCacheKey(type, key) {
    return `${this.cachePrefix}${type}_${key}`;
  }

  set(type, key, data, ttl = null) {
    const cacheKey = this.getCacheKey(type, key);
    const ttlMs = ttl || this.defaultTTL[type] || this.defaultTTL.daily;
    const expiry = Date.now() + ttlMs;
    const cacheData = { data, expiry, timestamp: Date.now() };
    this.memoryCache.set(cacheKey, cacheData);
    this.stats.sets++;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to store in localStorage:', error);
      this.stats.errors++;
    }
  }

  get(type, key) {
    const cacheKey = this.getCacheKey(type, key);
    let cacheData = this.memoryCache.get(cacheKey);
    if (!cacheData) {
      try {
        const stored = localStorage.getItem(cacheKey);
        if (stored) {
          cacheData = JSON.parse(stored);
          this.memoryCache.set(cacheKey, cacheData);
        }
      } catch (error) {
        console.warn('Failed to read from localStorage:', error);
        this.stats.errors++;
        return null;
      }
    }
    if (!cacheData) {
      this.stats.misses++;
      return null;
    }
    if (Date.now() > cacheData.expiry) {
      this.delete(type, key);
      this.stats.evictions++;
      this.stats.misses++;
      return null;
    }
    this.stats.hits++;
    return cacheData.data;
  }

  has(type, key) {
    return this.get(type, key) !== null;
  }

  delete(type, key) {
    const cacheKey = this.getCacheKey(type, key);
    this.memoryCache.delete(cacheKey);
    this.stats.deletes++;
    try {
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
      this.stats.errors++;
    }
  }

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
      this.stats.errors++;
    }
  }

  getStats() {
    const memorySize = this.memoryCache.size;
    let localStorageSize = 0;
    let totalBytes = 0;
    const entries = [];
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(key => key.startsWith(this.cachePrefix));
      localStorageSize = cacheKeys.length;
      cacheKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          const bytes = new Blob([value]).size;
          totalBytes += bytes;
          try {
            const parsed = JSON.parse(value);
            const age = Date.now() - (parsed.timestamp || 0);
            const ttl = (parsed.expiry || 0) - Date.now();
            entries.push({
              key: key.replace(this.cachePrefix, ''),
              bytes,
              age: Math.floor(age / 1000),
              ttl: Math.floor(ttl / 1000),
              expired: ttl < 0
            });
          } catch (e) {}
        }
      });
    } catch (error) {
      console.warn('Failed to get localStorage stats:', error);
      this.stats.errors++;
    }
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;
    return {
      memorySize,
      localStorageSize,
      totalSize: memorySize + localStorageSize,
      totalBytes,
      totalKB: (totalBytes / 1024).toFixed(2),
      totalMB: (totalBytes / 1024 / 1024).toFixed(2),
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: `${hitRate}%`,
      hitRateNumeric: parseFloat(hitRate),
      sets: this.stats.sets,
      deletes: this.stats.deletes,
      evictions: this.stats.evictions,
      errors: this.stats.errors,
      entries: entries.sort((a, b) => b.bytes - a.bytes)
    };
  }

  cleanExpired() {
    const now = Date.now();
    for (const [key, value] of this.memoryCache.entries()) {
      if (now > value.expiry) {
        this.memoryCache.delete(key);
        this.stats.evictions++;
      }
    }
  }
}

export const cacheService = new CacheService();
setInterval(() => { cacheService.cleanExpired(); }, 5 * 60 * 1000);
