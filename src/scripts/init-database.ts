#!/usr/bin/env tsx

import { pino } from 'pino';
import { DatabaseConnection } from '../database/connection';
import { MigrationRunner } from '../database/migrations';
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

async function initDatabase(): Promise<void> {
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
    logger.info('Initializing database...');
    
    await connection.connect();
    const client = connection.getClient();
    
    const migrationRunner = new MigrationRunner(client, logger);
    await migrationRunner.initializeSchema();
    
    logger.info('Database initialization completed successfully');
    
    // Verify the setup
    const healthCheck = await connection.healthCheck();
    if (healthCheck) {
      logger.info('Database health check passed');
    } else {
      logger.error('Database health check failed');
      process.exit(1);
    }
    
    // Show table information
    const result = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    
    logger.info({ 
      tables: result.rows.map(row => row.name) 
    }, 'Database tables created');
    
  } catch (error) {
    logger.error({ error }, 'Database initialization failed');
    process.exit(1);
  } finally {
    await connection.disconnect();
  }
}

if (require.main === module) {
  initDatabase().catch((error) => {
    logger.error({ error }, 'Fatal error during database initialization');
    process.exit(1);
  });
}

export { initDatabase };