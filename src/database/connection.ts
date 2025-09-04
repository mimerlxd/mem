import { createClient, type Client } from '@libsql/client';
import { Logger } from 'pino';
import type { DatabaseConfig } from '../types';

export class DatabaseConnection {
  private client: Client | null = null;
  private config: DatabaseConfig;
  private logger: Logger;
  private connectionCount = 0;
  private maxConnections: number;

  constructor(config: DatabaseConfig, logger: Logger) {
    this.config = config;
    this.logger = logger.child({ component: 'DatabaseConnection' });
    this.maxConnections = config.maxConnections ?? 10;
  }

  async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    try {
      this.client = createClient({
        url: this.config.url,
        authToken: this.config.authToken,
        syncUrl: this.config.syncUrl,
        encryptionKey: this.config.encryptionKey,
      });

      await this.client.execute('PRAGMA journal_mode = WAL;');
      await this.client.execute('PRAGMA foreign_keys = ON;');
      await this.client.execute('PRAGMA synchronous = NORMAL;');
      await this.client.execute('PRAGMA cache_size = -64000;');
      await this.client.execute('PRAGMA temp_store = memory;');

      this.logger.info('Database connection established');
    } catch (error) {
      this.logger.error({ error }, 'Failed to connect to database');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.close();
      this.client = null;
      this.logger.info('Database connection closed');
    }
  }

  getClient(): Client {
    if (!this.client) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.client;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = this.getClient();
      await client.execute('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error({ error }, 'Database health check failed');
      return false;
    }
  }

  async beginTransaction(): Promise<void> {
    const client = this.getClient();
    await client.execute('BEGIN TRANSACTION');
    this.logger.debug('Transaction started');
  }

  async commitTransaction(): Promise<void> {
    const client = this.getClient();
    await client.execute('COMMIT');
    this.logger.debug('Transaction committed');
  }

  async rollbackTransaction(): Promise<void> {
    const client = this.getClient();
    await client.execute('ROLLBACK');
    this.logger.debug('Transaction rolled back');
  }

  async withTransaction<T>(operation: (client: Client) => Promise<T>): Promise<T> {
    const client = this.getClient();
    
    await this.beginTransaction();
    
    try {
      const result = await operation(client);
      await this.commitTransaction();
      return result;
    } catch (error) {
      await this.rollbackTransaction();
      throw error;
    }
  }

  getConnectionCount(): number {
    return this.connectionCount;
  }

  canAcceptConnection(): boolean {
    return this.connectionCount < this.maxConnections;
  }
}