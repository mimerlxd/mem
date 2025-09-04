import { LRUCache } from 'lru-cache';
import { Logger } from 'pino';
import type { CacheConfig } from '../types';

export interface CacheEntry<T = unknown> {
  value: T;
  timestamp: number;
  hitCount: number;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  totalSets: number;
  totalDeletes: number;
}

export class MemoryCache<T = unknown> {
  private cache: LRUCache<string, CacheEntry<T>>;
  private logger: Logger;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0
  };

  constructor(config: CacheConfig, logger: Logger) {
    this.logger = logger.child({ component: 'MemoryCache' });
    
    this.cache = new LRUCache<string, CacheEntry<T>>({
      max: config.maxSize,
      ttl: config.ttl,
      updateAgeOnGet: config.updateAgeOnGet ?? true,
      dispose: (value, key) => {
        this.logger.debug({ key }, 'Cache entry disposed');
      },
    });

    this.logger.info({ 
      maxSize: config.maxSize, 
      ttl: config.ttl 
    }, 'Memory cache initialized');
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (entry) {
      entry.hitCount++;
      this.stats.hits++;
      this.logger.debug({ key, hitCount: entry.hitCount }, 'Cache hit');
      return entry.value;
    } else {
      this.stats.misses++;
      this.logger.debug({ key }, 'Cache miss');
      return undefined;
    }
  }

  set(key: string, value: T): void {
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      hitCount: 0
    };
    
    this.cache.set(key, entry);
    this.stats.sets++;
    this.logger.debug({ key }, 'Cache entry set');
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
      this.logger.debug({ key }, 'Cache entry deleted');
    }
    return deleted;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.info({ clearedEntries: size }, 'Cache cleared');
  }

  keys(): IterableIterator<string> {
    return this.cache.keys();
  }

  values(): IterableIterator<T> {
    return Array.from(this.cache.values()).map(entry => entry.value)[Symbol.iterator]();
  }

  entries(): IterableIterator<[string, T]> {
    const entries: [string, T][] = [];
    for (const [key, entry] of this.cache) {
      entries.push([key, entry.value]);
    }
    return entries[Symbol.iterator]();
  }

  getWithMetadata(key: string): { value: T; metadata: Omit<CacheEntry<T>, 'value'> } | undefined {
    const entry = this.cache.get(key);
    
    if (entry) {
      entry.hitCount++;
      this.stats.hits++;
      return {
        value: entry.value,
        metadata: {
          timestamp: entry.timestamp,
          hitCount: entry.hitCount
        }
      };
    } else {
      this.stats.misses++;
      return undefined;
    }
  }

  peek(key: string): T | undefined {
    const entry = this.cache.peek(key);
    return entry?.value;
  }

  getRemainingTTL(key: string): number {
    return this.cache.getRemainingTTL(key);
  }

  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      hitRate,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      totalSets: this.stats.sets,
      totalDeletes: this.stats.deletes
    };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
    this.logger.info('Cache stats reset');
  }

  getTopHitEntries(limit = 10): Array<{ key: string; hitCount: number; value: T }> {
    const entries: Array<{ key: string; hitCount: number; value: T }> = [];
    
    for (const [key, entry] of this.cache) {
      entries.push({
        key,
        hitCount: entry.hitCount,
        value: entry.value
      });
    }
    
    return entries
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, limit);
  }

  prune(): number {
    const initialSize = this.cache.size;
    this.cache.purgeStale();
    const finalSize = this.cache.size;
    const pruned = initialSize - finalSize;
    
    if (pruned > 0) {
      this.logger.info({ pruned }, 'Cache entries pruned');
    }
    
    return pruned;
  }

  warmUp(entries: Array<[string, T]>): void {
    this.logger.info({ count: entries.length }, 'Warming up cache');
    
    for (const [key, value] of entries) {
      this.set(key, value);
    }
  }

  dump(): Array<[string, T, number]> {
    const dump: Array<[string, T, number]> = [];
    
    for (const [key, entry] of this.cache) {
      dump.push([key, entry.value, entry.timestamp]);
    }
    
    return dump;
  }

  load(dump: Array<[string, T, number]>): void {
    this.logger.info({ count: dump.length }, 'Loading cache from dump');
    
    for (const [key, value, timestamp] of dump) {
      const entry: CacheEntry<T> = {
        value,
        timestamp,
        hitCount: 0
      };
      this.cache.set(key, entry);
    }
  }
}