"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEST_CONFIG = void 0;
exports.generateEmbedding = generateEmbedding;
exports.createMockRule = createMockRule;
exports.createMockProjectDoc = createMockProjectDoc;
exports.createMockRef = createMockRef;
const globals_1 = require("@jest/globals");
const fs_1 = require("fs");
const testDbPath = './test.db';
(0, globals_1.beforeAll)(() => {
    // Clean up any existing test database
    if ((0, fs_1.existsSync)(testDbPath)) {
        (0, fs_1.rmSync)(testDbPath);
    }
});
(0, globals_1.afterEach)(() => {
    // Clean up test database after each test
    if ((0, fs_1.existsSync)(testDbPath)) {
        (0, fs_1.rmSync)(testDbPath);
    }
});
(0, globals_1.afterAll)(() => {
    // Final cleanup
    if ((0, fs_1.existsSync)(testDbPath)) {
        (0, fs_1.rmSync)(testDbPath);
    }
});
exports.TEST_CONFIG = {
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
    logLevel: 'error',
};
function generateEmbedding(dimensions = 384) {
    return Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
}
function createMockRule(overrides = {}) {
    return {
        id: `rule-${Math.random().toString(36).substr(2, 9)}`,
        content: `Test rule content ${Math.random()}`,
        tags: ['test', 'mock'],
        tier: 1,
        embedding: generateEmbedding(),
        ...overrides,
    };
}
function createMockProjectDoc(overrides = {}) {
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
function createMockRef(overrides = {}) {
    return {
        id: `ref-${Math.random().toString(36).substr(2, 9)}`,
        name: `test-ref-${Math.random().toString(36).substr(2, 9)}`,
        content: `Test reference content ${Math.random()}`,
        embedding: generateEmbedding(),
        ...overrides,
    };
}
//# sourceMappingURL=setup.js.map