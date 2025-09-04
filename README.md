# Memory Subsystem

High-performance memory subsystem with vector search capabilities for managing rules, project documentation, and references.

## Features

- **Vector Storage & Search**: Store and search documents using embedding vectors with cosine similarity
- **Caching Layer**: LRU cache with TTL for optimal performance
- **Connection Pooling**: Efficient database connection management with health checks
- **Multiple Data Types**: Support for rules, project documents, and references
- **TypeScript**: Fully typed API with Zod validation
- **Database Migrations**: Automated schema management
- **Comprehensive Testing**: Unit and integration tests included

## Quick Start

```typescript
import { createMemoryService } from 'memory-subsystem';

// Initialize the service
const memoryService = createMemoryService({
  database: {
    url: 'file:memory.db' // or remote libSQL URL
  },
  vectorDimensions: 1536, // OpenAI embedding dimensions
});

await memoryService.initialize();

// Create a rule with embedding
await memoryService.createRule({
  id: 'rule-1',
  content: 'Always validate input data',
  tags: ['security', 'validation'],
  tier: 1,
  embedding: yourEmbeddingVector
});

// Semantic search
const results = await memoryService.semanticSearch(queryEmbedding, {
  limit: 10,
  threshold: 0.7
});

await memoryService.shutdown();
```

## Installation

```bash
npm install
npm run build
```

## Scripts

- `npm run build` - Build TypeScript
- `npm run test` - Run tests
- `npm run db:init` - Initialize database
- `npm run typecheck` - Type checking

## Architecture

The system consists of:

1. **Database Layer**: libSQL with vector support and WAL mode
2. **Vector Operations**: Embedding serialization and similarity search
3. **Connection Pool**: Managed database connections with health checks
4. **Cache Layer**: LRU cache for frequently accessed data
5. **Storage Services**: Type-safe CRUD operations for different data types
6. **Memory Service**: Main API that orchestrates all components

## Structure
- `src/` - Core memory subsystem implementation
- `tests/` - Unit and integration tests  
- `benchmarks/` - Performance testing suite
- `docs/` - Implementation-specific documentation
- `examples/` - Usage examples and integration demos

## Testing

Run the comprehensive test suite:

```bash
npm test
```

See the working example:

```bash
npx tsx examples/basic-usage.ts
```

## Integration with /home/ubuntu/mcp
This workspace develops the memory subsystem components that integrate with the main MCP service in `/home/ubuntu/mcp`.

Refer to `/home/ubuntu/mcp/docs/memory-design.md` for the complete design specification.