import type { Embedding } from '../types';

export class VectorOperations {
  static serializeEmbedding(embedding: Embedding): Buffer {
    const buffer = Buffer.allocUnsafe(embedding.length * 4); // 4 bytes per float32
    let offset = 0;
    
    for (const value of embedding) {
      buffer.writeFloatLE(value, offset);
      offset += 4;
    }
    
    return buffer;
  }

  static deserializeEmbedding(buffer: Buffer): Embedding {
    const embedding: Embedding = [];
    const length = buffer.length / 4; // 4 bytes per float32
    
    for (let i = 0; i < length; i++) {
      const offset = i * 4;
      embedding.push(buffer.readFloatLE(offset));
    }
    
    return embedding;
  }

  static cosineSimilarity(a: Embedding, b: Embedding): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimensions must match: ${a.length} !== ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  static euclideanDistance(a: Embedding, b: Embedding): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimensions must match: ${a.length} !== ${b.length}`);
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  static dotProduct(a: Embedding, b: Embedding): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimensions must match: ${a.length} !== ${b.length}`);
    }

    let product = 0;
    for (let i = 0; i < a.length; i++) {
      product += a[i] * b[i];
    }

    return product;
  }

  static magnitude(vector: Embedding): number {
    let sum = 0;
    for (const value of vector) {
      sum += value * value;
    }
    return Math.sqrt(sum);
  }

  static normalize(vector: Embedding): Embedding {
    const mag = this.magnitude(vector);
    if (mag === 0) {
      return vector.slice(); // Return copy of zero vector
    }

    return vector.map(value => value / mag);
  }

  static add(a: Embedding, b: Embedding): Embedding {
    if (a.length !== b.length) {
      throw new Error(`Vector dimensions must match: ${a.length} !== ${b.length}`);
    }

    return a.map((value, index) => value + b[index]);
  }

  static subtract(a: Embedding, b: Embedding): Embedding {
    if (a.length !== b.length) {
      throw new Error(`Vector dimensions must match: ${a.length} !== ${b.length}`);
    }

    return a.map((value, index) => value - b[index]);
  }

  static scale(vector: Embedding, scalar: number): Embedding {
    return vector.map(value => value * scalar);
  }

  static isValidEmbedding(embedding: unknown): embedding is Embedding {
    return Array.isArray(embedding) && 
           embedding.every(value => typeof value === 'number' && !isNaN(value));
  }

  static validateDimensions(embedding: Embedding, expectedDimensions: number): void {
    if (embedding.length !== expectedDimensions) {
      throw new Error(
        `Embedding has ${embedding.length} dimensions, expected ${expectedDimensions}`
      );
    }
  }
}