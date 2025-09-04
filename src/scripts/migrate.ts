#!/usr/bin/env tsx

import { pino } from 'pino';
import { DatabaseConnection } from '../database/connection';
import { MigrationRunner, migrations } from '../database/migrations';
import type { DatabaseConfig } from '../types';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL || 'file:memory.db';
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  
  const config: DatabaseConfig = {
    url: databaseUrl,
    authToken,
    maxConnections: 5,
    idleTimeout: 30000,
  };

  const connection = new DatabaseConnection(config, logger);
  
  try {
    logger.info('Running database migrations...');
    
    await connection.connect();
    const client = connection.getClient();
    
    const migrationRunner = new MigrationRunner(client, logger);
    
    const currentVersion = await migrationRunner.getCurrentVersion();
    logger.info({ currentVersion }, 'Current database version');
    
    await migrationRunner.runMigrations(migrations);
    
    const newVersion = await migrationRunner.getCurrentVersion();
    logger.info({ newVersion }, 'Database migrations completed');
    
  } catch (error) {
    logger.error({ error }, 'Migration failed');
    process.exit(1);
  } finally {
    await connection.disconnect();
  }
}

if (require.main === module) {
  runMigrations().catch((error) => {
    logger.error({ error }, 'Fatal error during migration');
    process.exit(1);
  });
}

export { runMigrations };