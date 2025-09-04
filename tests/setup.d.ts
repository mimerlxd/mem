export declare const TEST_CONFIG: {
    database: {
        url: string;
        maxConnections: number;
        idleTimeout: number;
    };
    cache: {
        maxSize: number;
        ttl: number;
    };
    vectorDimensions: number;
    logLevel: "error";
};
export declare function generateEmbedding(dimensions?: number): number[];
export declare function createMockRule(overrides?: Partial<any>): {
    id: string;
    content: string;
    tags: string[];
    tier: number;
    embedding: number[];
};
export declare function createMockProjectDoc(overrides?: Partial<any>): {
    id: string;
    project_id: string;
    title: string;
    content: string;
    tags: string[];
    embedding: number[];
};
export declare function createMockRef(overrides?: Partial<any>): {
    id: string;
    name: string;
    content: string;
    embedding: number[];
};
//# sourceMappingURL=setup.d.ts.map