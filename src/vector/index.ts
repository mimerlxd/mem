import type { Client } from '@libsql/client';
import { Logger } from 'pino';
import type { Embedding, SearchResult } from '../types';
import { VectorOperations } from './operations';

export interface VectorSearchOptions {
  limit?: number;
  threshold?: number;
  includeMetadata?: boolean;
}

export interface IndexedDocument {
  id: string;
  content: string;
  embedding: Embedding;
  metadata?: Record<string, unknown>;
  table: 'rules' | 'project_docs' | 'refs';
}

export class VectorIndex {
  private client: Client;
  private logger: Logger;
  private vectorDimensions: number;

  constructor(client: Client, logger: Logger, vectorDimensions = 1536) {
    this.client = client;
    this.logger = logger.child({ component: 'VectorIndex' });
    this.vectorDimensions = vectorDimensions;
  }

  async storeEmbedding(
    table: string,
    id: string,
    embedding: Embedding
  ): Promise<void> {
    VectorOperations.validateDimensions(embedding, this.vectorDimensions);
    
    const serialized = VectorOperations.serializeEmbedding(embedding);
    
    await this.client.execute({sql: `UPDATE ${table} SET embedding = ? WHERE id = ?`, args: [serialized, id]});
    
    this.logger.debug({ table, id }, 'Embedding stored');
  }

  async getEmbedding(table: string, id: string): Promise<Embedding | null> {
    const result = await this.client.execute({sql: `SELECT embedding FROM ${table} WHERE id = ? AND embedding IS NOT NULL`, args: [id]});

    if (result.rows.length === 0) {
      return null;
    }

    const buffer = Buffer.from(result.rows[0].embedding as ArrayBuffer);
    return VectorOperations.deserializeEmbedding(buffer);
  }

  async batchStoreEmbeddings(
    documents: Array<{ table: string; id: string; embedding: Embedding }>
  ): Promise<void> {
    await this.client.execute('BEGIN TRANSACTION');
    
    try {
      for (const doc of documents) {
        await this.storeEmbedding(doc.table, doc.id, doc.embedding);
      }
      
      await this.client.execute('COMMIT');
      this.logger.info({ count: documents.length }, 'Batch embeddings stored');
    } catch (error) {
      await this.client.execute('ROLLBACK');
      this.logger.error({ error }, 'Batch embedding storage failed');
      throw error;
    }
  }

  async semanticSearch(
    queryEmbedding: Embedding,
    options: VectorSearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      limit = 10,
      threshold = 0.7,
      includeMetadata = true
    } = options;

    VectorOperations.validateDimensions(queryEmbedding, this.vectorDimensions);

    const results: SearchResult[] = [];

    // Search across all tables with embeddings
    const tables = [
      { name: 'rules', type: 'rule' as const },
      { name: 'project_docs', type: 'project_doc' as const },
      { name: 'refs', type: 'ref' as const }
    ];

    for (const { name: tableName, type } of tables) {
      const metadataField = includeMetadata ? ', metadata' : '';
      const query = `
        SELECT id, content, embedding${metadataField}
        FROM ${tableName}
        WHERE embedding IS NOT NULL
      `;

      const result = await this.client.execute(query);

      for (const row of result.rows) {
        const embedding = VectorOperations.deserializeEmbedding(Buffer.from(row.embedding as ArrayBuffer));
        const similarity = VectorOperations.cosineSimilarity(queryEmbedding, embedding);

        if (similarity >= threshold) {
          results.push({
            id: row.id as string,
            content: row.content as string,
            similarity_score: similarity,
            type,
            metadata: includeMetadata && row.metadata 
              ? JSON.parse(row.metadata as string)
              : undefined
          });
        }
      }
    }

    // Sort by similarity score (highest first) and limit results
    return results
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit);
  }

  async findSimilar(
    table: string,
    targetId: string,
    options: VectorSearchOptions = {}
  ): Promise<SearchResult[]> {
    const embedding = await this.getEmbedding(table, targetId);
    
    if (!embedding) {
      throw new Error(`No embedding found for ${table}:${targetId}`);
    }

    const results = await this.semanticSearch(embedding, options);
    
    // Filter out the target document itself
    return results.filter(result => result.id !== targetId);
  }

  async searchInTable(
    table: string,
    queryEmbedding: Embedding,
    options: VectorSearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      limit = 10,
      threshold = 0.7,
      includeMetadata = true
    } = options;

    VectorOperations.validateDimensions(queryEmbedding, this.vectorDimensions);

    const results: SearchResult[] = [];
    const metadataField = includeMetadata ? ', metadata' : '';
    
    const query = `
      SELECT id, content, embedding${metadataField}
      FROM ${table}
      WHERE embedding IS NOT NULL
    `;

    const result = await this.client.execute(query);
    const type = this.getTableType(table);

    for (const row of result.rows) {
      const embedding = VectorOperations.deserializeEmbedding(Buffer.from(row.embedding as ArrayBuffer));
      const similarity = VectorOperations.cosineSimilarity(queryEmbedding, embedding);

      if (similarity >= threshold) {
        results.push({
          id: row.id as string,
          content: row.content as string,
          similarity_score: similarity,
          type,
          metadata: includeMetadata && row.metadata 
            ? JSON.parse(row.metadata as string)
            : undefined
        });
      }
    }

    return results
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit);
  }

  private getTableType(table: string): SearchResult['type'] {
    switch (table) {
      case 'rules': return 'rule';
      case 'project_docs': return 'project_doc';
      case 'refs': return 'ref';
      default: throw new Error(`Unknown table type: ${table}`);
    }
  }

  async getIndexStats(): Promise<{
    totalDocuments: number;
    embeddedDocuments: number;
    byTable: Record<string, { total: number; embedded: number }>;
  }> {
    const tables = ['rules', 'project_docs', 'refs'];
    const stats: Record<string, { total: number; embedded: number }> = {};
    
    let totalDocuments = 0;
    let embeddedDocuments = 0;

    for (const table of tables) {
      const [totalResult, embeddedResult] = await Promise.all([
        this.client.execute(`SELECT COUNT(*) as count FROM ${table}`),
        this.client.execute(`SELECT COUNT(*) as count FROM ${table} WHERE embedding IS NOT NULL`)
      ]);

      const total = Number(totalResult.rows[0].count);
      const embedded = Number(embeddedResult.rows[0].count);

      stats[table] = { total, embedded };
      totalDocuments += total;
      embeddedDocuments += embedded;
    }

    return {
      totalDocuments,
      embeddedDocuments,
      byTable: stats
    };
  }

  async clearEmbeddings(table?: string): Promise<void> {
    if (table) {
      await this.client.execute(`UPDATE ${table} SET embedding = NULL`);
      this.logger.info({ table }, 'Embeddings cleared for table');
    } else {
      const tables = ['rules', 'project_docs', 'refs'];
      for (const tableName of tables) {
        await this.client.execute(`UPDATE ${tableName} SET embedding = NULL`);
      }
      this.logger.info('All embeddings cleared');
    }
  }
}