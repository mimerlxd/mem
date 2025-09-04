import { beforeAll, afterAll, afterEach } from '@jest/globals';
import { rmSync, existsSync } from 'fs';

const testDbPath = './test.db';

beforeAll(() => {
  // Clean up any existing test database
  if (existsSync(testDbPath)) {
    rmSync(testDbPath);
  }
});

afterEach(() => {
  // Clean up test database after each test
  if (existsSync(testDbPath)) {
    rmSync(testDbPath);
  }
});

afterAll(() => {
  // Final cleanup
  if (existsSync(testDbPath)) {
    rmSync(testDbPath);
  }
});

export const TEST_CONFIG = {
  database: {
    url: `file:${testDbPath}`,
    maxConnections: 3,
    idleTimeout: 1000,
  },
  cache: {
    maxSize: 100,
    ttl: 1000,
  },
  vectorDimensions: 384, // Smaller for testing
  logLevel: 'error' as const,
};

export function generateEmbedding(dimensions = 384): number[] {
  return Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
}

export function createMockRule(overrides: Partial<any> = {}) {
  return {
    id: `rule-${Math.random().toString(36).substr(2, 9)}`,
    content: `Test rule content ${Math.random()}`,
    tags: ['test', 'mock'],
    tier: 1,
    embedding: generateEmbedding(),
    ...overrides,
  };
}

export function createMockProjectDoc(overrides: Partial<any> = {}) {
  return {
    id: `doc-${Math.random().toString(36).substr(2, 9)}`,
    project_id: `project-${Math.random().toString(36).substr(2, 9)}`,
    title: `Test Document ${Math.random()}`,
    content: `Test document content ${Math.random()}`,
    tags: ['test', 'mock'],
    embedding: generateEmbedding(),
    ...overrides,
  };
}

export function createMockRef(overrides: Partial<any> = {}) {
  return {
    id: `ref-${Math.random().toString(36).substr(2, 9)}`,
    name: `test-ref-${Math.random().toString(36).substr(2, 9)}`,
    content: `Test reference content ${Math.random()}`,
    embedding: generateEmbedding(),
    ...overrides,
  };
}