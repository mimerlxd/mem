import { describe, it, expect } from '@jest/globals';
import { VectorOperations } from '../../src/vector/operations';

describe('VectorOperations', () => {
  describe('serializeEmbedding and deserializeEmbedding', () => {
    it('should serialize and deserialize embeddings correctly', () => {
      const embedding = [0.1, -0.5, 0.8, 0.0, -1.0];
      const serialized = VectorOperations.serializeEmbedding(embedding);
      const deserialized = VectorOperations.deserializeEmbedding(serialized);
      
      expect(deserialized).toHaveLength(embedding.length);
      deserialized.forEach((value, index) => {
        expect(value).toBeCloseTo(embedding[index], 5);
      });
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const a = [1, 0, 0];
      const b = [1, 0, 0];
      expect(VectorOperations.cosineSimilarity(a, b)).toBeCloseTo(1, 5);

      const c = [1, 0, 0];
      const d = [0, 1, 0];
      expect(VectorOperations.cosineSimilarity(c, d)).toBeCloseTo(0, 5);

      const e = [1, 0, 0];
      const f = [-1, 0, 0];
      expect(VectorOperations.cosineSimilarity(e, f)).toBeCloseTo(-1, 5);
    });

    it('should handle zero vectors', () => {
      const zero = [0, 0, 0];
      const nonZero = [1, 2, 3];
      expect(VectorOperations.cosineSimilarity(zero, nonZero)).toBe(0);
    });

    it('should throw error for mismatched dimensions', () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      expect(() => VectorOperations.cosineSimilarity(a, b)).toThrow();
    });
  });

  describe('euclideanDistance', () => {
    it('should calculate euclidean distance correctly', () => {
      const a = [0, 0, 0];
      const b = [3, 4, 0];
      expect(VectorOperations.euclideanDistance(a, b)).toBeCloseTo(5, 5);

      const c = [1, 1, 1];
      const d = [1, 1, 1];
      expect(VectorOperations.euclideanDistance(c, d)).toBe(0);
    });
  });

  describe('dotProduct', () => {
    it('should calculate dot product correctly', () => {
      const a = [1, 2, 3];
      const b = [4, 5, 6];
      expect(VectorOperations.dotProduct(a, b)).toBe(32); // 1*4 + 2*5 + 3*6
    });
  });

  describe('magnitude', () => {
    it('should calculate vector magnitude correctly', () => {
      const a = [3, 4, 0];
      expect(VectorOperations.magnitude(a)).toBeCloseTo(5, 5);

      const b = [1, 1, 1];
      expect(VectorOperations.magnitude(b)).toBeCloseTo(Math.sqrt(3), 5);
    });
  });

  describe('normalize', () => {
    it('should normalize vectors correctly', () => {
      const a = [3, 4, 0];
      const normalized = VectorOperations.normalize(a);
      expect(VectorOperations.magnitude(normalized)).toBeCloseTo(1, 5);
      expect(normalized[0]).toBeCloseTo(0.6, 5);
      expect(normalized[1]).toBeCloseTo(0.8, 5);
    });

    it('should handle zero vectors', () => {
      const zero = [0, 0, 0];
      const normalized = VectorOperations.normalize(zero);
      expect(normalized).toEqual([0, 0, 0]);
    });
  });

  describe('add', () => {
    it('should add vectors correctly', () => {
      const a = [1, 2, 3];
      const b = [4, 5, 6];
      const result = VectorOperations.add(a, b);
      expect(result).toEqual([5, 7, 9]);
    });
  });

  describe('subtract', () => {
    it('should subtract vectors correctly', () => {
      const a = [4, 5, 6];
      const b = [1, 2, 3];
      const result = VectorOperations.subtract(a, b);
      expect(result).toEqual([3, 3, 3]);
    });
  });

  describe('scale', () => {
    it('should scale vectors correctly', () => {
      const a = [1, 2, 3];
      const result = VectorOperations.scale(a, 2);
      expect(result).toEqual([2, 4, 6]);
    });
  });

  describe('isValidEmbedding', () => {
    it('should validate embeddings correctly', () => {
      expect(VectorOperations.isValidEmbedding([1, 2, 3])).toBe(true);
      expect(VectorOperations.isValidEmbedding([1.5, -2.3, 0])).toBe(true);
      expect(VectorOperations.isValidEmbedding([])).toBe(true);
      
      expect(VectorOperations.isValidEmbedding([1, 'invalid', 3])).toBe(false);
      expect(VectorOperations.isValidEmbedding([1, 2, NaN])).toBe(false);
      expect(VectorOperations.isValidEmbedding('not an array')).toBe(false);
      expect(VectorOperations.isValidEmbedding(null)).toBe(false);
    });
  });

  describe('validateDimensions', () => {
    it('should validate dimensions correctly', () => {
      const embedding = [1, 2, 3];
      expect(() => VectorOperations.validateDimensions(embedding, 3)).not.toThrow();
      expect(() => VectorOperations.validateDimensions(embedding, 4)).toThrow();
    });
  });
});