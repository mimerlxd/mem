import { describe, it, expect, beforeEach } from '@jest/globals';
import { pino } from 'pino';
import { MemoryCache } from '../../src/cache/lru-cache';

describe('MemoryCache', () => {
  let cache: MemoryCache<string>;
  let logger: any;

  beforeEach(() => {
    logger = pino({ level: 'silent' }); // Silent logger for tests
    cache = new MemoryCache<string>(
      {
        maxSize: 3,
        ttl: 100,
        updateAgeOnGet: true,
      },
      logger
    );
  });

  describe('basic operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('non-existent')).toBeUndefined();
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should delete entries', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      
      const deleted = cache.delete('key1');
      expect(deleted).toBe(true);
      expect(cache.has('key1')).toBe(false);
      
      const notDeleted = cache.delete('non-existent');
      expect(notDeleted).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.getStats().size).toBe(2);
      
      cache.clear();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('LRU behavior', () => {
    it('should evict least recently used items when capacity is exceeded', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // All should be present
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
      
      // Adding one more should evict the oldest (key1)
      cache.set('key4', 'value4');
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });

    it('should update access order when getting items', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Access key1 to make it most recently used
      cache.get('key1');
      
      // Adding key4 should evict key2 (now oldest)
      cache.set('key4', 'value4');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });
  });

  describe('TTL behavior', () => {
    it('should expire entries after TTL', (done) => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
      
      setTimeout(() => {
        expect(cache.get('key1')).toBeUndefined();
        done();
      }, 150); // Wait longer than TTL (100ms)
    });

    it('should return remaining TTL', () => {
      cache.set('key1', 'value1');
      const remainingTTL = cache.getRemainingTTL('key1');
      expect(remainingTTL).toBeGreaterThan(0);
      expect(remainingTTL).toBeLessThanOrEqual(100);
    });
  });

  describe('metadata operations', () => {
    it('should return value with metadata', () => {
      cache.set('key1', 'value1');
      
      const result = cache.getWithMetadata('key1');
      expect(result).toBeDefined();
      expect(result!.value).toBe('value1');
      expect(result!.metadata.hitCount).toBe(1);
      expect(typeof result!.metadata.timestamp).toBe('number');
      
      // Second access should increment hit count
      const result2 = cache.getWithMetadata('key1');
      expect(result2!.metadata.hitCount).toBe(2);
    });

    it('should peek without updating access order', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Peek at key1 (should not update access order)
      expect(cache.peek('key1')).toBe('value1');
      
      // Adding key4 should still evict key1
      cache.set('key4', 'value4');
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('iteration', () => {
    it('should iterate over keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const keys = Array.from(cache.keys());
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys.length).toBe(2);
    });

    it('should iterate over values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const values = Array.from(cache.values());
      expect(values).toContain('value1');
      expect(values).toContain('value2');
      expect(values.length).toBe(2);
    });

    it('should iterate over entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const entries = Array.from(cache.entries());
      expect(entries).toContainEqual(['key1', 'value1']);
      expect(entries).toContainEqual(['key2', 'value2']);
      expect(entries.length).toBe(2);
    });
  });

  describe('statistics', () => {
    it('should track hit/miss statistics', () => {
      cache.set('key1', 'value1');
      
      // Hit
      cache.get('key1');
      
      // Miss
      cache.get('non-existent');
      
      const stats = cache.getStats();
      expect(stats.totalHits).toBe(1);
      expect(stats.totalMisses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.5);
      expect(stats.totalSets).toBe(1);
    });

    it('should reset statistics', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('non-existent');
      
      cache.resetStats();
      
      const stats = cache.getStats();
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.totalSets).toBe(0);
    });

    it('should return top hit entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Access key1 multiple times
      cache.get('key1');
      cache.get('key1');
      cache.get('key1');
      
      // Access key2 once
      cache.get('key2');
      
      const topHits = cache.getTopHitEntries(2);
      expect(topHits.length).toBe(2);
      expect(topHits[0].key).toBe('key1');
      expect(topHits[0].hitCount).toBe(3);
      expect(topHits[1].key).toBe('key2');
      expect(topHits[1].hitCount).toBe(1);
    });
  });

  describe('maintenance operations', () => {
    it('should prune stale entries', (done) => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      setTimeout(() => {
        const pruned = cache.prune();
        expect(pruned).toBe(2); // Both entries should be stale
        expect(cache.getStats().size).toBe(0);
        done();
      }, 150);
    });

    it('should warm up cache', () => {
      const entries: Array<[string, string]> = [
        ['key1', 'value1'],
        ['key2', 'value2'],
        ['key3', 'value3'],
      ];
      
      cache.warmUp(entries);
      
      expect(cache.getStats().size).toBe(3);
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
    });

    it('should dump and load cache contents', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const dump = cache.dump();
      expect(dump.length).toBe(2);
      
      cache.clear();
      expect(cache.getStats().size).toBe(0);
      
      cache.load(dump);
      expect(cache.getStats().size).toBe(2);
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
    });
  });
});