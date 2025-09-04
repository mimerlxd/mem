import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MemoryService } from '../../src/services/memory-service';
import { TEST_CONFIG, createMockRule, createMockProjectDoc, createMockRef } from '../setup';

describe('MemoryService', () => {
  let memoryService: MemoryService;

  beforeEach(async () => {
    memoryService = new MemoryService(TEST_CONFIG);
    await memoryService.initialize();
  });

  afterEach(async () => {
    if (memoryService.isReady()) {
      await memoryService.shutdown();
    }
    // Add a small delay to ensure connections are fully closed
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      expect(memoryService.isReady()).toBe(true);
    });

    it('should perform health check', async () => {
      const healthy = await memoryService.healthCheck();
      expect(healthy).toBe(true);
    });

    it('should not allow double initialization', async () => {
      // Service is already initialized in beforeEach
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await memoryService.initialize(); // Should log warning
      consoleSpy.mockRestore();
    });
  });

  describe('rule operations', () => {
    it('should create and retrieve rules', async () => {
      const mockRule = createMockRule();
      
      const created = await memoryService.createRule(mockRule);
      expect(created.id).toBe(mockRule.id);
      expect(created.content).toBe(mockRule.content);
      expect(created.created_at).toBeInstanceOf(Date);

      const retrieved = await memoryService.getRule(mockRule.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(mockRule.id);
    });

    it('should update rules', async () => {
      const mockRule = createMockRule();
      await memoryService.createRule(mockRule);

      const updated = await memoryService.updateRule(mockRule.id, {
        content: 'Updated content',
        tier: 2,
      });

      expect(updated).toBeDefined();
      expect(updated!.content).toBe('Updated content');
      expect(updated!.tier).toBe(2);
      expect(updated!.updated_at.getTime()).toBeGreaterThan(updated!.created_at.getTime());
    });

    it('should delete rules', async () => {
      const mockRule = createMockRule();
      await memoryService.createRule(mockRule);

      const deleted = await memoryService.deleteRule(mockRule.id);
      expect(deleted).toBe(true);

      const retrieved = await memoryService.getRule(mockRule.id);
      expect(retrieved).toBeNull();
    });

    it('should list rules', async () => {
      const rule1 = createMockRule({ tier: 1 });
      const rule2 = createMockRule({ tier: 2 });
      
      await memoryService.createRule(rule1);
      await memoryService.createRule(rule2);

      const allRules = await memoryService.listRules();
      expect(allRules.length).toBeGreaterThanOrEqual(2);

      const tier1Rules = await memoryService.listRules({ tier: 1 });
      expect(tier1Rules.length).toBeGreaterThanOrEqual(1);
      expect(tier1Rules.every(rule => rule.tier === 1)).toBe(true);
    });

    it('should cache rule results', async () => {
      const mockRule = createMockRule();
      await memoryService.createRule(mockRule);

      // First call - from database
      const first = await memoryService.getRule(mockRule.id);
      
      // Second call - from cache (should be faster and same result)
      const second = await memoryService.getRule(mockRule.id);
      
      expect(first).toEqual(second);
    });
  });

  describe('project document operations', () => {
    it('should create and retrieve project documents', async () => {
      const mockDoc = createMockProjectDoc();
      
      const created = await memoryService.createProjectDoc(mockDoc);
      expect(created.id).toBe(mockDoc.id);
      expect(created.project_id).toBe(mockDoc.project_id);

      const retrieved = await memoryService.getProjectDoc(mockDoc.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(mockDoc.id);
    });

    it('should list project documents by project_id', async () => {
      const projectId = 'test-project-123';
      const doc1 = createMockProjectDoc({ project_id: projectId });
      const doc2 = createMockProjectDoc({ project_id: projectId });
      const doc3 = createMockProjectDoc({ project_id: 'different-project' });
      
      await memoryService.createProjectDoc(doc1);
      await memoryService.createProjectDoc(doc2);
      await memoryService.createProjectDoc(doc3);

      const projectDocs = await memoryService.listProjectDocs(projectId);
      expect(projectDocs.length).toBe(2);
      expect(projectDocs.every(doc => doc.project_id === projectId)).toBe(true);

      const allDocs = await memoryService.listProjectDocs();
      expect(allDocs.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('reference operations', () => {
    it('should create and retrieve references', async () => {
      const mockRef = createMockRef();
      
      const created = await memoryService.createRef(mockRef);
      expect(created.id).toBe(mockRef.id);
      expect(created.name).toBe(mockRef.name);

      const retrieved = await memoryService.getRef(mockRef.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(mockRef.id);
    });

    it('should retrieve references by name', async () => {
      const mockRef = createMockRef({ name: 'unique-ref-name' });
      await memoryService.createRef(mockRef);

      const retrieved = await memoryService.getRefByName('unique-ref-name');
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(mockRef.id);
      expect(retrieved!.name).toBe('unique-ref-name');
    });
  });

  describe('vector search operations', () => {
    it('should perform semantic search', async () => {
      const rule1 = createMockRule();
      const rule2 = createMockRule();
      
      await memoryService.createRule(rule1);
      await memoryService.createRule(rule2);

      // Search with a known embedding
      const results = await memoryService.semanticSearch(rule1.embedding, {
        limit: 10,
        threshold: 0.1
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe(rule1.id); // Should find itself as most similar
      expect(results[0].similarity_score).toBeCloseTo(1, 2);
    });

    it('should find similar documents', async () => {
      const rule1 = createMockRule();
      const rule2 = createMockRule();
      
      await memoryService.createRule(rule1);
      await memoryService.createRule(rule2);

      const similar = await memoryService.findSimilar('rules', rule1.id, {
        limit: 5,
        threshold: 0.1
      });

      // Should not include the target document itself
      expect(similar.every(result => result.id !== rule1.id)).toBe(true);
    });

    it('should handle batch embedding storage', async () => {
      const embedding1 = createMockRule().embedding!; // Get a valid embedding
      const embedding2 = createMockRule().embedding!; // Get a valid embedding
      
      const rule1 = createMockRule({ embedding: undefined });
      const rule2 = createMockRule({ embedding: undefined });
      
      await memoryService.createRule(rule1);
      await memoryService.createRule(rule2);

      const embeddings = [
        { table: 'rules', id: rule1.id, embedding: embedding1 },
        { table: 'rules', id: rule2.id, embedding: embedding2 },
      ];

      await memoryService.batchStoreEmbeddings(embeddings);

      // Verify embeddings were stored by searching
      const results = await memoryService.semanticSearch(embedding1, {
        limit: 2,
        threshold: 0.1
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('statistics and health', () => {
    it('should provide service statistics', async () => {
      const stats = await memoryService.getStats();
      
      expect(stats).toHaveProperty('database');
      expect(stats).toHaveProperty('cache');
      expect(stats).toHaveProperty('vector');
      
      expect(stats.database).toHaveProperty('connectionPool');
      expect(stats.database).toHaveProperty('totalDocuments');
      expect(typeof stats.database.totalDocuments).toBe('number');
    });

    it('should provide cache statistics', () => {
      const cacheStats = memoryService.getCacheStats();
      
      expect(cacheStats).toHaveProperty('size');
      expect(cacheStats).toHaveProperty('maxSize');
      expect(cacheStats).toHaveProperty('hitRate');
      expect(cacheStats).toHaveProperty('totalHits');
      expect(cacheStats).toHaveProperty('totalMisses');
    });

    it('should clear cache', async () => {
      const mockRule = createMockRule();
      await memoryService.createRule(mockRule);
      
      // Access to populate cache
      await memoryService.getRule(mockRule.id);
      
      memoryService.clearCache();
      
      const cacheStats = memoryService.getCacheStats();
      expect(cacheStats.size).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle operations on non-existent items', async () => {
      const nonExistentId = 'non-existent-id';
      
      const rule = await memoryService.getRule(nonExistentId);
      expect(rule).toBeNull();
      
      const updated = await memoryService.updateRule(nonExistentId, { content: 'test' });
      expect(updated).toBeNull();
      
      const deleted = await memoryService.deleteRule(nonExistentId);
      expect(deleted).toBe(false);
    });

    it('should throw error when not initialized', async () => {
      const uninitializedService = new MemoryService(TEST_CONFIG);
      
      await expect(uninitializedService.createRule(createMockRule())).rejects.toThrow();
      await expect(uninitializedService.getRule('test')).rejects.toThrow();
    });
  });
});