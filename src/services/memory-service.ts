import { pino, Logger } from 'pino';
import { ConnectionPool } from '../database/pool';
import { MigrationRunner } from '../database/migrations';
import { VectorIndex } from '../vector/index';
import { MemoryCache } from '../cache/lru-cache';
import { RuleStorage, ProjectDocStorage, RefStorage } from './storage';
import type { 
  MemoryConfig, 
  Rule, 
  ProjectDoc, 
  Ref, 
  SearchResult, 
  QueryOptions,
  Embedding 
} from '../types';

export interface MemoryServiceStats {
  database: {
    connectionPool: any;
    totalDocuments: number;
  };
  cache: any;
  vector: any;
}

export class MemoryService {
  private config: MemoryConfig;
  private logger: Logger;
  private pool: ConnectionPool;
  private vectorIndex: VectorIndex;
  private cache: MemoryCache<any>;
  private ruleStorage: RuleStorage;
  private projectDocStorage: ProjectDocStorage;
  private refStorage: RefStorage;
  private isInitialized = false;

  constructor(config: MemoryConfig) {
    this.config = config;
    this.logger = pino({
      level: config.logLevel,
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: { colorize: true }
      } : undefined
    }).child({ component: 'MemoryService' });

    this.pool = new ConnectionPool(config.database, this.logger);
    this.cache = new MemoryCache(config.cache, this.logger);
    
    // These will be initialized in init()
    this.vectorIndex = null as any;
    this.ruleStorage = null as any;
    this.projectDocStorage = null as any;
    this.refStorage = null as any;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Memory service already initialized');
      return;
    }

    this.logger.info('Initializing memory service...');

    try {
      await this.pool.initialize();
      
      // Initialize storage services
      await this.pool.withConnection(async (connection) => {
        const client = connection.getClient();
        
        // Run migrations
        const migrationRunner = new MigrationRunner(client, this.logger);
        await migrationRunner.initializeSchema();
        
        // Initialize vector index and storage services
        this.vectorIndex = new VectorIndex(client, this.logger, this.config.vectorDimensions);
        this.ruleStorage = new RuleStorage(client, this.logger);
        this.projectDocStorage = new ProjectDocStorage(client, this.logger);
        this.refStorage = new RefStorage(client, this.logger);
      });

      this.isInitialized = true;
      this.logger.info('Memory service initialized successfully');
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize memory service');
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down memory service...');
    await this.pool.shutdown();
    this.isInitialized = false;
    this.logger.info('Memory service shut down');
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Memory service not initialized. Call initialize() first.');
    }
  }

  // Rule operations
  async createRule(rule: Omit<Rule, 'created_at' | 'updated_at'>): Promise<Rule> {
    this.ensureInitialized();
    
    return this.pool.withConnection(async (connection) => {
      const client = connection.getClient();
      const ruleStorage = new RuleStorage(client, this.logger);
      
      const created = await ruleStorage.create(rule);
      
      // Store embedding if provided
      if (rule.embedding) {
        const vectorIndex = new VectorIndex(client, this.logger, this.config.vectorDimensions);
        await vectorIndex.storeEmbedding('rules', rule.id, rule.embedding);
      }
      
      // Cache the result
      this.cache.set(`rule:${rule.id}`, created);
      
      return created;
    });
  }

  async getRule(id: string): Promise<Rule | null> {
    this.ensureInitialized();
    
    // Check cache first
    const cached = this.cache.get(`rule:${id}`);
    if (cached) {
      return cached;
    }
    
    return this.pool.withConnection(async (connection) => {
      const client = connection.getClient();
      const ruleStorage = new RuleStorage(client, this.logger);
      
      const rule = await ruleStorage.findById(id);
      
      if (rule) {
        this.cache.set(`rule:${id}`, rule);
      }
      
      return rule;
    });
  }

  async updateRule(id: string, updates: Partial<Rule>): Promise<Rule | null> {
    this.ensureInitialized();
    
    return this.pool.withConnection(async (connection) => {
      const client = connection.getClient();
      const ruleStorage = new RuleStorage(client, this.logger);
      
      const updated = await ruleStorage.update(id, updates);
      
      if (updated) {
        // Update embedding if provided
        if (updates.embedding) {
          const vectorIndex = new VectorIndex(client, this.logger, this.config.vectorDimensions);
          await vectorIndex.storeEmbedding('rules', id, updates.embedding);
        }
        
        // Update cache
        this.cache.set(`rule:${id}`, updated);
      }
      
      return updated;
    });
  }

  async deleteRule(id: string): Promise<boolean> {
    this.ensureInitialized();
    
    return this.pool.withConnection(async (connection) => {
      const client = connection.getClient();
      const ruleStorage = new RuleStorage(client, this.logger);
      
      const deleted = await ruleStorage.delete(id);
      
      if (deleted) {
        this.cache.delete(`rule:${id}`);
      }
      
      return deleted;
    });
  }

  async listRules(options?: { limit?: number; offset?: number; tier?: number }): Promise<Rule[]> {
    this.ensureInitialized();
    
    return this.pool.withConnection(async (connection) => {
      const client = connection.getClient();
      const ruleStorage = new RuleStorage(client, this.logger);
      
      if (options?.tier) {
        return ruleStorage.findByTier(options.tier, options);
      } else {
        return ruleStorage.list(options);
      }
    });
  }

  // Project Document operations
  async createProjectDoc(doc: Omit<ProjectDoc, 'created_at' | 'updated_at'>): Promise<ProjectDoc> {
    this.ensureInitialized();
    
    return this.pool.withConnection(async (connection) => {
      const client = connection.getClient();
      const docStorage = new ProjectDocStorage(client, this.logger);
      
      const created = await docStorage.create(doc);
      
      // Store embedding if provided
      if (doc.embedding) {
        const vectorIndex = new VectorIndex(client, this.logger, this.config.vectorDimensions);
        await vectorIndex.storeEmbedding('project_docs', doc.id, doc.embedding);
      }
      
      // Cache the result
      this.cache.set(`project_doc:${doc.id}`, created);
      
      return created;
    });
  }

  async getProjectDoc(id: string): Promise<ProjectDoc | null> {
    this.ensureInitialized();
    
    // Check cache first
    const cached = this.cache.get(`project_doc:${id}`);
    if (cached) {
      return cached;
    }
    
    return this.pool.withConnection(async (connection) => {
      const client = connection.getClient();
      const docStorage = new ProjectDocStorage(client, this.logger);
      
      const doc = await docStorage.findById(id);
      
      if (doc) {
        this.cache.set(`project_doc:${id}`, doc);
      }
      
      return doc;
    });
  }

  async listProjectDocs(projectId?: string, options?: { limit?: number; offset?: number }): Promise<ProjectDoc[]> {
    this.ensureInitialized();
    
    return this.pool.withConnection(async (connection) => {
      const client = connection.getClient();
      const docStorage = new ProjectDocStorage(client, this.logger);
      
      if (projectId) {
        return docStorage.findByProjectId(projectId, options);
      } else {
        return docStorage.list(options);
      }
    });
  }

  // Reference operations
  async createRef(ref: Omit<Ref, 'created_at' | 'updated_at'>): Promise<Ref> {
    this.ensureInitialized();
    
    return this.pool.withConnection(async (connection) => {
      const client = connection.getClient();
      const refStorage = new RefStorage(client, this.logger);
      
      const created = await refStorage.create(ref);
      
      // Store embedding if provided
      if (ref.embedding) {
        const vectorIndex = new VectorIndex(client, this.logger, this.config.vectorDimensions);
        await vectorIndex.storeEmbedding('refs', ref.id, ref.embedding);
      }
      
      // Cache the result
      this.cache.set(`ref:${ref.id}`, created);
      this.cache.set(`ref:name:${ref.name}`, created);
      
      return created;
    });
  }

  async getRef(id: string): Promise<Ref | null> {
    this.ensureInitialized();
    
    // Check cache first
    const cached = this.cache.get(`ref:${id}`);
    if (cached) {
      return cached;
    }
    
    return this.pool.withConnection(async (connection) => {
      const client = connection.getClient();
      const refStorage = new RefStorage(client, this.logger);
      
      const ref = await refStorage.findById(id);
      
      if (ref) {
        this.cache.set(`ref:${id}`, ref);
        this.cache.set(`ref:name:${ref.name}`, ref);
      }
      
      return ref;
    });
  }

  async getRefByName(name: string): Promise<Ref | null> {
    this.ensureInitialized();
    
    // Check cache first
    const cached = this.cache.get(`ref:name:${name}`);
    if (cached) {
      return cached;
    }
    
    return this.pool.withConnection(async (connection) => {
      const client = connection.getClient();
      const refStorage = new RefStorage(client, this.logger);
      
      const ref = await refStorage.findByName(name);
      
      if (ref) {
        this.cache.set(`ref:${ref.id}`, ref);
        this.cache.set(`ref:name:${name}`, ref);
      }
      
      return ref;
    });
  }

  // Search operations
  async semanticSearch(
    queryEmbedding: Embedding,
    options: QueryOptions = {}
  ): Promise<SearchResult[]> {
    this.ensureInitialized();
    
    const cacheKey = `search:${JSON.stringify({ embedding: queryEmbedding.slice(0, 5), options })}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    return this.pool.withConnection(async (connection) => {
      const client = connection.getClient();
      const vectorIndex = new VectorIndex(client, this.logger, this.config.vectorDimensions);
      
      const results = await vectorIndex.semanticSearch(queryEmbedding, {
        limit: options.limit || 10,
        threshold: options.threshold || 0.7,
        includeMetadata: true
      });
      
      // Cache results for a shorter time since they may change frequently
      this.cache.set(cacheKey, results);
      
      return results;
    });
  }

  async findSimilar(
    table: string,
    id: string,
    options: QueryOptions = {}
  ): Promise<SearchResult[]> {
    this.ensureInitialized();
    
    return this.pool.withConnection(async (connection) => {
      const client = connection.getClient();
      const vectorIndex = new VectorIndex(client, this.logger, this.config.vectorDimensions);
      
      return vectorIndex.findSimilar(table, id, {
        limit: options.limit || 10,
        threshold: options.threshold || 0.7,
        includeMetadata: true
      });
    });
  }

  // Batch operations
  async batchStoreEmbeddings(
    documents: Array<{ table: string; id: string; embedding: Embedding }>
  ): Promise<void> {
    this.ensureInitialized();
    
    return this.pool.withConnection(async (connection) => {
      const client = connection.getClient();
      const vectorIndex = new VectorIndex(client, this.logger, this.config.vectorDimensions);
      
      await vectorIndex.batchStoreEmbeddings(documents);
      
      // Clear relevant cache entries
      for (const doc of documents) {
        this.cache.delete(`${doc.table.slice(0, -1)}:${doc.id}`);
      }
    });
  }

  // Health and statistics
  async getStats(): Promise<MemoryServiceStats> {
    this.ensureInitialized();
    
    return this.pool.withConnection(async (connection) => {
      const client = connection.getClient();
      const vectorIndex = new VectorIndex(client, this.logger, this.config.vectorDimensions);
      
      const [poolStats, cacheStats, vectorStats] = await Promise.all([
        this.pool.getStats(),
        this.cache.getStats(),
        vectorIndex.getIndexStats()
      ]);
      
      return {
        database: {
          connectionPool: poolStats,
          totalDocuments: vectorStats.totalDocuments
        },
        cache: cacheStats,
        vector: vectorStats
      };
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      this.ensureInitialized();
      
      return this.pool.withConnection(async (connection) => {
        return connection.healthCheck();
      });
    } catch (error) {
      this.logger.error({ error }, 'Health check failed');
      return false;
    }
  }

  // Cache management
  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  // Utility methods
  getLogger(): Logger {
    return this.logger;
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}