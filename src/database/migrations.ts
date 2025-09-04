import type { Client } from '@libsql/client';
import { Logger } from 'pino';
import { INITIAL_SCHEMA, SCHEMA_VERSION } from './schema';

export interface Migration {
  version: number;
  description: string;
  up: string[];
  down: string[];
}

export class MigrationRunner {
  private client: Client;
  private logger: Logger;

  constructor(client: Client, logger: Logger) {
    this.client = client;
    this.logger = logger.child({ component: 'MigrationRunner' });
  }

  async getCurrentVersion(): Promise<number> {
    try {
      const result = await this.client.execute(
        'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1'
      );
      
      if (result.rows.length === 0) {
        return 0;
      }
      
      return Number(result.rows[0].version);
    } catch (error) {
      this.logger.debug('No migration table found, assuming version 0');
      return 0;
    }
  }

  async applyMigration(migration: Migration): Promise<void> {
    const { version, description, up } = migration;
    
    this.logger.info({ version, description }, 'Applying migration');
    
    try {
      await this.client.execute('BEGIN TRANSACTION');
      
      for (const statement of up) {
        await this.client.execute(statement);
      }
      
      await this.client.execute(
        'INSERT INTO schema_migrations (version, description) VALUES (?, ?)',
        { args: [version, description] }
      );
      
      await this.client.execute('COMMIT');
      
      this.logger.info({ version }, 'Migration applied successfully');
    } catch (error) {
      await this.client.execute('ROLLBACK');
      this.logger.error({ error, version }, 'Migration failed');
      throw error;
    }
  }

  async rollbackMigration(migration: Migration): Promise<void> {
    const { version, description, down } = migration;
    
    this.logger.info({ version, description }, 'Rolling back migration');
    
    try {
      await this.client.execute('BEGIN TRANSACTION');
      
      for (const statement of down) {
        await this.client.execute(statement);
      }
      
      await this.client.execute(
        'DELETE FROM schema_migrations WHERE version = ?',
        [version]
      );
      
      await this.client.execute('COMMIT');
      
      this.logger.info({ version }, 'Migration rolled back successfully');
    } catch (error) {
      await this.client.execute('ROLLBACK');
      this.logger.error({ error, version }, 'Migration rollback failed');
      throw error;
    }
  }

  async runMigrations(migrations: Migration[]): Promise<void> {
    const currentVersion = await this.getCurrentVersion();
    const pendingMigrations = migrations.filter(m => m.version > currentVersion);
    
    if (pendingMigrations.length === 0) {
      this.logger.info({ currentVersion }, 'Database schema is up to date');
      return;
    }
    
    this.logger.info(
      { 
        currentVersion, 
        targetVersion: Math.max(...pendingMigrations.map(m => m.version)),
        pendingCount: pendingMigrations.length 
      }, 
      'Running pending migrations'
    );
    
    for (const migration of pendingMigrations.sort((a, b) => a.version - b.version)) {
      await this.applyMigration(migration);
    }
    
    this.logger.info('All migrations completed successfully');
  }

  async initializeSchema(): Promise<void> {
    const currentVersion = await this.getCurrentVersion();
    
    if (currentVersion === 0) {
      this.logger.info('Initializing database schema');
      
      try {
        await this.client.execute('BEGIN TRANSACTION');
        
        for (const statement of INITIAL_SCHEMA) {
          await this.client.execute(statement);
        }
        
        await this.client.execute(
          'INSERT INTO schema_migrations (version, description) VALUES (?, ?)',
          [SCHEMA_VERSION, 'Initial schema']
        );
        
        await this.client.execute('COMMIT');
        
        this.logger.info('Database schema initialized successfully');
      } catch (error) {
        await this.client.execute('ROLLBACK');
        this.logger.error({ error }, 'Schema initialization failed');
        throw error;
      }
    } else {
      this.logger.info({ currentVersion }, 'Database schema already initialized');
    }
  }
}

export const migrations: Migration[] = [
  {
    version: 1,
    description: 'Initial schema',
    up: INITIAL_SCHEMA,
    down: [
      'DROP TABLE IF EXISTS refs;',
      'DROP TABLE IF EXISTS project_docs;',
      'DROP TABLE IF EXISTS rules;',
      'DROP TABLE IF EXISTS schema_migrations;',
    ],
  },
];