import type { Client } from '@libsql/client';
import { Logger } from 'pino';
import type { Rule, ProjectDoc, Ref, Metadata } from '../types';

export abstract class BaseStorage<T> {
  protected client: Client;
  protected logger: Logger;
  protected tableName: string;

  constructor(client: Client, logger: Logger, tableName: string) {
    this.client = client;
    this.logger = logger.child({ component: `${tableName}Storage` });
    this.tableName = tableName;
  }

  abstract create(item: Omit<T, 'created_at' | 'updated_at'>): Promise<T>;
  abstract findById(id: string): Promise<T | null>;
  abstract update(id: string, updates: Partial<T>): Promise<T | null>;
  abstract delete(id: string): Promise<boolean>;
  abstract list(options?: { limit?: number; offset?: number }): Promise<T[]>;
  abstract count(): Promise<number>;

  protected serializeMetadata(metadata?: Metadata): string | null {
    return metadata ? JSON.stringify(metadata) : null;
  }

  protected deserializeMetadata(metadata: string | null): Metadata | undefined {
    return metadata ? JSON.parse(metadata) : undefined;
  }

  protected serializeTags(tags: string[]): string {
    return JSON.stringify(tags);
  }

  protected deserializeTags(tags: string): string[] {
    return JSON.parse(tags);
  }
}

export class RuleStorage extends BaseStorage<Rule> {
  constructor(client: Client, logger: Logger) {
    super(client, logger, 'rules');
  }

  async create(rule: Omit<Rule, 'created_at' | 'updated_at'>): Promise<Rule> {
    const now = new Date();
    const serializedTags = this.serializeTags(rule.tags);
    const serializedMetadata = this.serializeMetadata(rule.metadata);

    await this.client.execute({
      sql: `INSERT INTO rules (id, content, tags, tier, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [rule.id, rule.content, serializedTags, rule.tier, serializedMetadata, now.toISOString(), now.toISOString()]
    });

    this.logger.info({ id: rule.id }, 'Rule created');

    return {
      ...rule,
      created_at: now,
      updated_at: now
    };
  }

  async findById(id: string): Promise<Rule | null> {
    const result = await this.client.execute({sql: 'SELECT * FROM rules WHERE id = ?', args: [id]});

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id as string,
      content: row.content as string,
      tags: this.deserializeTags(row.tags as string),
      tier: row.tier as number,
      metadata: this.deserializeMetadata(row.metadata as string | null),
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    };
  }

  async findByTier(tier: number, options: { limit?: number; offset?: number } = {}): Promise<Rule[]> {
    const { limit = 50, offset = 0 } = options;
    
    const result = await this.client.execute({sql: 'SELECT * FROM rules WHERE tier = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?', args: [tier, limit, offset]});

    return result.rows.map(row => ({
      id: row.id as string,
      content: row.content as string,
      tags: this.deserializeTags(row.tags as string),
      tier: row.tier as number,
      metadata: this.deserializeMetadata(row.metadata as string | null),
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    }));
  }

  async findByTags(tags: string[], options: { limit?: number; offset?: number } = {}): Promise<Rule[]> {
    const { limit = 50, offset = 0 } = options;
    
    const placeholders = tags.map(() => '?').join(',');
    const result = await this.client.execute({sql: `SELECT * FROM rules WHERE id IN (
        SELECT id FROM rules WHERE ${tags.map(() => 'tags LIKE ?').join(' OR ')}
      ) ORDER BY updated_at DESC LIMIT ? OFFSET ?`, args: [...tags.map(tag => `%"${tag}"%`), limit, offset]});

    return result.rows.map(row => ({
      id: row.id as string,
      content: row.content as string,
      tags: this.deserializeTags(row.tags as string),
      tier: row.tier as number,
      metadata: this.deserializeMetadata(row.metadata as string | null),
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    }));
  }

  async update(id: string, updates: Partial<Rule>): Promise<Rule | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const updatedRule = { ...existing, ...updates, updated_at: new Date() };
    const serializedTags = this.serializeTags(updatedRule.tags);
    const serializedMetadata = this.serializeMetadata(updatedRule.metadata);

    await this.client.execute(
      'UPDATE rules SET content = ?, tags = ?, tier = ?, metadata = ?, updated_at = ? WHERE id = ?',
      [updatedRule.content, serializedTags, updatedRule.tier, serializedMetadata, updatedRule.updated_at.toISOString(), id]
    );

    this.logger.info({ id }, 'Rule updated');
    return updatedRule;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.client.execute({sql: 'DELETE FROM rules WHERE id = ?', args: [id]});
    const deleted = result.rowsAffected > 0;
    
    if (deleted) {
      this.logger.info({ id }, 'Rule deleted');
    }
    
    return deleted;
  }

  async list(options: { limit?: number; offset?: number } = {}): Promise<Rule[]> {
    const { limit = 50, offset = 0 } = options;
    
    const result = await this.client.execute({sql: 'SELECT * FROM rules ORDER BY updated_at DESC LIMIT ? OFFSET ?', args: [limit, offset]});

    return result.rows.map(row => ({
      id: row.id as string,
      content: row.content as string,
      tags: this.deserializeTags(row.tags as string),
      tier: row.tier as number,
      metadata: this.deserializeMetadata(row.metadata as string | null),
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    }));
  }

  async count(): Promise<number> {
    const result = await this.client.execute('SELECT COUNT(*) as count FROM rules');
    return Number(result.rows[0].count);
  }
}

export class ProjectDocStorage extends BaseStorage<ProjectDoc> {
  constructor(client: Client, logger: Logger) {
    super(client, logger, 'project_docs');
  }

  async create(doc: Omit<ProjectDoc, 'created_at' | 'updated_at'>): Promise<ProjectDoc> {
    const now = new Date();
    const serializedTags = this.serializeTags(doc.tags);
    const serializedMetadata = this.serializeMetadata(doc.metadata);

    await this.client.execute(
      `INSERT INTO project_docs (id, project_id, title, content, file_path, tags, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [doc.id, doc.project_id, doc.title, doc.content, doc.file_path, serializedTags, serializedMetadata, now.toISOString(), now.toISOString()]
    );

    this.logger.info({ id: doc.id, project_id: doc.project_id }, 'Project document created');

    return {
      ...doc,
      created_at: now,
      updated_at: now
    };
  }

  async findById(id: string): Promise<ProjectDoc | null> {
    const result = await this.client.execute({sql: 'SELECT * FROM project_docs WHERE id = ?', args: [id]});

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id as string,
      project_id: row.project_id as string,
      title: row.title as string,
      content: row.content as string,
      file_path: row.file_path as string | undefined,
      tags: this.deserializeTags(row.tags as string),
      metadata: this.deserializeMetadata(row.metadata as string | null),
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    };
  }

  async findByProjectId(projectId: string, options: { limit?: number; offset?: number } = {}): Promise<ProjectDoc[]> {
    const { limit = 50, offset = 0 } = options;
    
    const result = await this.client.execute({sql: 'SELECT * FROM project_docs WHERE project_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?', args: [projectId, limit, offset]});

    return result.rows.map(row => ({
      id: row.id as string,
      project_id: row.project_id as string,
      title: row.title as string,
      content: row.content as string,
      file_path: row.file_path as string | undefined,
      tags: this.deserializeTags(row.tags as string),
      metadata: this.deserializeMetadata(row.metadata as string | null),
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    }));
  }

  async update(id: string, updates: Partial<ProjectDoc>): Promise<ProjectDoc | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const updatedDoc = { ...existing, ...updates, updated_at: new Date() };
    const serializedTags = this.serializeTags(updatedDoc.tags);
    const serializedMetadata = this.serializeMetadata(updatedDoc.metadata);

    await this.client.execute(
      'UPDATE project_docs SET project_id = ?, title = ?, content = ?, file_path = ?, tags = ?, metadata = ?, updated_at = ? WHERE id = ?',
      [updatedDoc.project_id, updatedDoc.title, updatedDoc.content, updatedDoc.file_path, serializedTags, serializedMetadata, updatedDoc.updated_at.toISOString(), id]
    );

    this.logger.info({ id }, 'Project document updated');
    return updatedDoc;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.client.execute({sql: 'DELETE FROM project_docs WHERE id = ?', args: [id]});
    const deleted = result.rowsAffected > 0;
    
    if (deleted) {
      this.logger.info({ id }, 'Project document deleted');
    }
    
    return deleted;
  }

  async list(options: { limit?: number; offset?: number } = {}): Promise<ProjectDoc[]> {
    const { limit = 50, offset = 0 } = options;
    
    const result = await this.client.execute({sql: 'SELECT * FROM project_docs ORDER BY updated_at DESC LIMIT ? OFFSET ?', args: [limit, offset]});

    return result.rows.map(row => ({
      id: row.id as string,
      project_id: row.project_id as string,
      title: row.title as string,
      content: row.content as string,
      file_path: row.file_path as string | undefined,
      tags: this.deserializeTags(row.tags as string),
      metadata: this.deserializeMetadata(row.metadata as string | null),
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    }));
  }

  async count(): Promise<number> {
    const result = await this.client.execute('SELECT COUNT(*) as count FROM project_docs');
    return Number(result.rows[0].count);
  }
}

export class RefStorage extends BaseStorage<Ref> {
  constructor(client: Client, logger: Logger) {
    super(client, logger, 'refs');
  }

  async create(ref: Omit<Ref, 'created_at' | 'updated_at'>): Promise<Ref> {
    const now = new Date();
    const serializedMetadata = this.serializeMetadata(ref.metadata);

    await this.client.execute(
      `INSERT INTO refs (id, name, content, channel_id, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ref.id, ref.name, ref.content, ref.channel_id, serializedMetadata, now.toISOString(), now.toISOString()]
    );

    this.logger.info({ id: ref.id, name: ref.name }, 'Reference created');

    return {
      ...ref,
      created_at: now,
      updated_at: now
    };
  }

  async findById(id: string): Promise<Ref | null> {
    const result = await this.client.execute({sql: 'SELECT * FROM refs WHERE id = ?', args: [id]});

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id as string,
      name: row.name as string,
      content: row.content as string,
      channel_id: row.channel_id as string | undefined,
      metadata: this.deserializeMetadata(row.metadata as string | null),
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    };
  }

  async findByName(name: string): Promise<Ref | null> {
    const result = await this.client.execute({sql: 'SELECT * FROM refs WHERE name = ?', args: [name]});

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id as string,
      name: row.name as string,
      content: row.content as string,
      channel_id: row.channel_id as string | undefined,
      metadata: this.deserializeMetadata(row.metadata as string | null),
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    };
  }

  async findByChannelId(channelId: string, options: { limit?: number; offset?: number } = {}): Promise<Ref[]> {
    const { limit = 50, offset = 0 } = options;
    
    const result = await this.client.execute({sql: 'SELECT * FROM refs WHERE channel_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?', args: [channelId, limit, offset]});

    return result.rows.map(row => ({
      id: row.id as string,
      name: row.name as string,
      content: row.content as string,
      channel_id: row.channel_id as string | undefined,
      metadata: this.deserializeMetadata(row.metadata as string | null),
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    }));
  }

  async update(id: string, updates: Partial<Ref>): Promise<Ref | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const updatedRef = { ...existing, ...updates, updated_at: new Date() };
    const serializedMetadata = this.serializeMetadata(updatedRef.metadata);

    await this.client.execute(
      'UPDATE refs SET name = ?, content = ?, channel_id = ?, metadata = ?, updated_at = ? WHERE id = ?',
      [updatedRef.name, updatedRef.content, updatedRef.channel_id, serializedMetadata, updatedRef.updated_at.toISOString(), id]
    );

    this.logger.info({ id }, 'Reference updated');
    return updatedRef;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.client.execute({sql: 'DELETE FROM refs WHERE id = ?', args: [id]});
    const deleted = result.rowsAffected > 0;
    
    if (deleted) {
      this.logger.info({ id }, 'Reference deleted');
    }
    
    return deleted;
  }

  async list(options: { limit?: number; offset?: number } = {}): Promise<Ref[]> {
    const { limit = 50, offset = 0 } = options;
    
    const result = await this.client.execute({sql: 'SELECT * FROM refs ORDER BY updated_at DESC LIMIT ? OFFSET ?', args: [limit, offset]});

    return result.rows.map(row => ({
      id: row.id as string,
      name: row.name as string,
      content: row.content as string,
      channel_id: row.channel_id as string | undefined,
      metadata: this.deserializeMetadata(row.metadata as string | null),
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    }));
  }

  async count(): Promise<number> {
    const result = await this.client.execute('SELECT COUNT(*) as count FROM refs');
    return Number(result.rows[0].count);
  }
}