import { Logger } from 'pino';
import type { DatabaseConfig } from '../types';
import { DatabaseConnection } from './connection';

export interface PoolStats {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  maxConnections: number;
  waitingRequests: number;
}

export class ConnectionPool {
  private connections: DatabaseConnection[] = [];
  private availableConnections: DatabaseConnection[] = [];
  private activeConnections = new Set<DatabaseConnection>();
  private waitingQueue: Array<{
    resolve: (connection: DatabaseConnection) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  
  private config: DatabaseConfig;
  private logger: Logger;
  private maxConnections: number;
  private idleTimeout: number;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(config: DatabaseConfig, logger: Logger) {
    this.config = config;
    this.logger = logger.child({ component: 'ConnectionPool' });
    this.maxConnections = config.maxConnections ?? 10;
    this.idleTimeout = config.idleTimeout ?? 30000; // 30 seconds
    
    this.startCleanupTimer();
  }

  async initialize(): Promise<void> {
    this.logger.info({ maxConnections: this.maxConnections }, 'Initializing connection pool');
    
    // Pre-create minimum connections
    const minConnections = Math.min(2, this.maxConnections);
    const promises = [];
    
    for (let i = 0; i < minConnections; i++) {
      promises.push(this.createConnection());
    }
    
    await Promise.all(promises);
    this.logger.info({ connectionCount: this.connections.length }, 'Connection pool initialized');
  }

  private async createConnection(): Promise<DatabaseConnection> {
    if (this.connections.length >= this.maxConnections) {
      throw new Error('Maximum connections reached');
    }

    const connection = new DatabaseConnection(this.config, this.logger);
    await connection.connect();
    
    this.connections.push(connection);
    this.availableConnections.push(connection);
    
    this.logger.debug('New database connection created');
    return connection;
  }

  async getConnection(timeoutMs = 10000): Promise<DatabaseConnection> {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }

    // Try to get an available connection
    if (this.availableConnections.length > 0) {
      const connection = this.availableConnections.pop()!;
      this.activeConnections.add(connection);
      
      // Verify connection health
      if (await connection.healthCheck()) {
        return connection;
      } else {
        // Connection is unhealthy, remove it and create a new one
        await this.removeConnection(connection);
        return this.getConnection(timeoutMs);
      }
    }

    // Try to create a new connection if under limit
    if (this.connections.length < this.maxConnections) {
      try {
        const connection = await this.createConnection();
        this.availableConnections.pop(); // Remove from available since we're returning it
        this.activeConnections.add(connection);
        return connection;
      } catch (error) {
        this.logger.error({ error }, 'Failed to create new connection');
      }
    }

    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error(`Connection timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.waitingQueue.push({ resolve, reject, timeout });
    });
  }

  releaseConnection(connection: DatabaseConnection): void {
    if (!this.activeConnections.has(connection)) {
      this.logger.warn('Attempted to release connection that was not active');
      return;
    }

    this.activeConnections.delete(connection);

    // Serve waiting requests first
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift()!;
      clearTimeout(waiter.timeout);
      this.activeConnections.add(connection);
      waiter.resolve(connection);
      return;
    }

    // Return to available pool
    this.availableConnections.push(connection);
    this.logger.debug('Connection released back to pool');
  }

  private async removeConnection(connection: DatabaseConnection): Promise<void> {
    // Remove from all tracking sets/arrays
    this.activeConnections.delete(connection);
    const availableIndex = this.availableConnections.indexOf(connection);
    if (availableIndex !== -1) {
      this.availableConnections.splice(availableIndex, 1);
    }
    const connectionIndex = this.connections.indexOf(connection);
    if (connectionIndex !== -1) {
      this.connections.splice(connectionIndex, 1);
    }

    await connection.disconnect();
    this.logger.debug('Connection removed from pool');
  }

  async withConnection<T>(
    operation: (connection: DatabaseConnection) => Promise<T>,
    timeoutMs = 10000
  ): Promise<T> {
    const connection = await this.getConnection(timeoutMs);
    
    try {
      return await operation(connection);
    } finally {
      this.releaseConnection(connection);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, this.idleTimeout / 2);
  }

  private async cleanupIdleConnections(): Promise<void> {
    if (this.isShuttingDown || this.availableConnections.length <= 2) {
      return; // Keep minimum connections
    }

    // Remove excess idle connections
    const excessConnections = this.availableConnections.length - 2;
    const connectionsToRemove = this.availableConnections.splice(0, excessConnections);
    
    for (const connection of connectionsToRemove) {
      await this.removeConnection(connection);
    }

    if (connectionsToRemove.length > 0) {
      this.logger.debug(
        { removedCount: connectionsToRemove.length },
        'Cleaned up idle connections'
      );
    }
  }

  getStats(): PoolStats {
    return {
      activeConnections: this.activeConnections.size,
      idleConnections: this.availableConnections.length,
      totalConnections: this.connections.length,
      maxConnections: this.maxConnections,
      waitingRequests: this.waitingQueue.length,
    };
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Reject all waiting requests
    for (const waiter of this.waitingQueue) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('Connection pool is shutting down'));
    }
    this.waitingQueue.length = 0;

    // Close all connections
    const closePromises = this.connections.map(conn => conn.disconnect());
    await Promise.all(closePromises);
    
    this.connections.length = 0;
    this.availableConnections.length = 0;
    this.activeConnections.clear();
    
    this.logger.info('Connection pool shutdown complete');
  }
}