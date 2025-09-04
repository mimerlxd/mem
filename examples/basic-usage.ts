#!/usr/bin/env tsx

import { createMemoryService } from '../src';

async function basicUsageExample() {
  // Create and initialize the memory service
  const memoryService = createMemoryService({
    database: {
      url: 'file:example.db'
    },
    cache: {
      maxSize: 100,
      ttl: 60000, // 1 minute
    },
    vectorDimensions: 384, // Smaller for example
    logLevel: 'info'
  });

  try {
    await memoryService.initialize();
    console.log('✅ Memory service initialized');

    // Create some example rules
    const rule1 = await memoryService.createRule({
      id: 'rule-1',
      content: 'Always validate input data before processing',
      tags: ['security', 'validation'],
      tier: 1,
      embedding: Array.from({ length: 384 }, () => Math.random() * 2 - 1) // Random embedding
    });
    console.log('✅ Created rule:', rule1.id);

    const rule2 = await memoryService.createRule({
      id: 'rule-2', 
      content: 'Use proper error handling in all async operations',
      tags: ['error-handling', 'async'],
      tier: 2,
      embedding: Array.from({ length: 384 }, () => Math.random() * 2 - 1)
    });
    console.log('✅ Created rule:', rule2.id);

    // Create a project document
    const doc1 = await memoryService.createProjectDoc({
      id: 'doc-1',
      project_id: 'project-alpha',
      title: 'API Documentation',
      content: 'This document describes the REST API endpoints and their usage',
      tags: ['api', 'documentation'],
      embedding: Array.from({ length: 384 }, () => Math.random() * 2 - 1)
    });
    console.log('✅ Created project doc:', doc1.id);

    // Create a reference
    const ref1 = await memoryService.createRef({
      id: 'ref-1',
      name: 'coding-standards',
      content: 'Follow consistent naming conventions and code formatting',
      embedding: Array.from({ length: 384 }, () => Math.random() * 2 - 1)
    });
    console.log('✅ Created reference:', ref1.id);

    // Perform semantic search
    const queryEmbedding = Array.from({ length: 384 }, () => Math.random() * 2 - 1);
    const searchResults = await memoryService.semanticSearch(queryEmbedding, {
      limit: 5,
      threshold: 0.1
    });
    console.log('🔍 Search results:', searchResults.length);

    // Get service statistics
    const stats = await memoryService.getStats();
    console.log('📊 Service stats:', {
      totalDocuments: stats.database.totalDocuments,
      cacheSize: stats.cache.size,
      vectorStats: stats.vector
    });

    // List rules by tier
    const tier1Rules = await memoryService.listRules({ tier: 1 });
    console.log('📋 Tier 1 rules:', tier1Rules.length);

    console.log('✅ All operations completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await memoryService.shutdown();
    console.log('👋 Memory service shut down');
  }
}

if (require.main === module) {
  basicUsageExample().catch(console.error);
}