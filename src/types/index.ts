import { z } from 'zod';

export const EmbeddingSchema = z.array(z.number());
export type Embedding = z.infer<typeof EmbeddingSchema>;

export const MetadataSchema = z.record(z.unknown());
export type Metadata = z.infer<typeof MetadataSchema>;

export const RuleSchema = z.object({
  id: z.string(),
  content: z.string(),
  embedding: EmbeddingSchema.optional(),
  tags: z.array(z.string()),
  tier: z.number().min(1).max(5),
  metadata: MetadataSchema.optional(),
  created_at: z.date(),
  updated_at: z.date(),
});
export type Rule = z.infer<typeof RuleSchema>;

export const ProjectDocSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  title: z.string(),
  content: z.string(),
  file_path: z.string().optional(),
  embedding: EmbeddingSchema.optional(),
  tags: z.array(z.string()),
  metadata: MetadataSchema.optional(),
  created_at: z.date(),
  updated_at: z.date(),
});
export type ProjectDoc = z.infer<typeof ProjectDocSchema>;

export const RefSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  embedding: EmbeddingSchema.optional(),
  channel_id: z.string().optional(),
  metadata: MetadataSchema.optional(),
  created_at: z.date(),
  updated_at: z.date(),
});
export type Ref = z.infer<typeof RefSchema>;

export const SearchResultSchema = z.object({
  id: z.string(),
  content: z.string(),
  similarity_score: z.number(),
  metadata: MetadataSchema.optional(),
  type: z.enum(['rule', 'project_doc', 'ref']),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const QueryOptionsSchema = z.object({
  limit: z.number().optional(),
  threshold: z.number().optional(),
  project_id: z.string().optional(),
  channel_id: z.string().optional(),
  tags: z.array(z.string()).optional(),
  tier: z.number().min(1).max(5).optional(),
});
export type QueryOptions = z.infer<typeof QueryOptionsSchema>;

export interface DatabaseConfig {
  url: string;
  authToken?: string;
  syncUrl?: string;
  encryptionKey?: string;
  maxConnections?: number;
  idleTimeout?: number;
}

export interface CacheConfig {
  maxSize: number;
  ttl: number;
  updateAgeOnGet?: boolean;
}

export interface MemoryConfig {
  database: DatabaseConfig;
  cache: CacheConfig;
  vectorDimensions: number;
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
}