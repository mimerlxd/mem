// Main exports
export { MemoryService } from './services/memory-service';
export type { MemoryServiceStats } from './services/memory-service';

// Storage services
export { RuleStorage, ProjectDocStorage, RefStorage } from './services/storage';

// Database layer
export { DatabaseConnection } from './database/connection';
export { ConnectionPool } from './database/pool';
export type { PoolStats } from './database/pool';
export { MigrationRunner, migrations } from './database/migrations';

// Vector operations
export { VectorOperations } from './vector/operations';
export { VectorIndex } from './vector/index';
export type { VectorSearchOptions, IndexedDocument } from './vector/index';

// Cache
export { MemoryCache } from './cache/lru-cache';
export type { CacheEntry, CacheStats } from './cache/lru-cache';

// Types
export type {
  MemoryConfig,
  DatabaseConfig,
  CacheConfig,
  Rule,
  ProjectDoc,
  Ref,
  SearchResult,
  QueryOptions,
  Embedding,
  Metadata,
} from './types';

// Schemas for validation
export {
  RuleSchema,
  ProjectDocSchema,
  RefSchema,
  SearchResultSchema,
  QueryOptionsSchema,
  EmbeddingSchema,
  MetadataSchema,
} from './types';

// Utilities
export { initDatabase } from './scripts/init-database';
export { runMigrations } from './scripts/migrate';

// Create a convenience function to initialize the memory service with sensible defaults
export function createMemoryService(overrides: Partial<MemoryConfig> = {}) {
  const defaultConfig: MemoryConfig = {
    database: {
      url: process.env.DATABASE_URL || 'file:memory.db',
      authToken: process.env.DATABASE_AUTH_TOKEN,
      maxConnections: 10,
      idleTimeout: 30000,
    },
    cache: {
      maxSize: 1000,
      ttl: 5 * 60 * 1000, // 5 minutes
      updateAgeOnGet: true,
    },
    vectorDimensions: 1536, // OpenAI embedding dimensions
    logLevel: (process.env.LOG_LEVEL as any) || 'info',
  };

  // Deep merge configuration
  const config: MemoryConfig = {
    ...defaultConfig,
    ...overrides,
    database: {
      ...defaultConfig.database,
      ...overrides.database,
    },
    cache: {
      ...defaultConfig.cache,
      ...overrides.cache,
    },
  };

  return new MemoryService(config);
}