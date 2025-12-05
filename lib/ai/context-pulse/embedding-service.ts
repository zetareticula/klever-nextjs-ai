/**
 * Embedding Service for the ContextPulse Engine
 * Generates text embeddings using OpenAI's embedding models
 */

import { openai } from '@ai-sdk/openai';
import { embed, embedMany } from 'ai';
import { isTestEnvironment } from '@/lib/constants';

// Default embedding model - OpenAI's text-embedding-3-small
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate an embedding for a single text input
 * @param text - The text to embed
 * @returns Promise<number[]> - The embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (isTestEnvironment) {
    // Return a mock embedding for testing
    return generateMockEmbedding(text);
  }

  const { embedding } = await embed({
    model: openai.embedding(DEFAULT_EMBEDDING_MODEL),
    value: text,
  });

  return embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts - Array of texts to embed
 * @returns Promise<number[][]> - Array of embedding vectors
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  if (isTestEnvironment) {
    // Return mock embeddings for testing
    return texts.map((text) => generateMockEmbedding(text));
  }

  const { embeddings } = await embedMany({
    model: openai.embedding(DEFAULT_EMBEDDING_MODEL),
    values: texts,
  });

  return embeddings;
}

/**
 * Calculate cosine similarity between two embedding vectors
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns number - Cosine similarity score (0-1)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculate L2 (Euclidean) distance between two embedding vectors
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns number - L2 distance (lower is more similar)
 */
export function l2Distance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimensions');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Generate a deterministic mock embedding for testing
 * Uses a simple hash-based approach for consistency
 * @param text - The text to generate a mock embedding for
 * @returns number[] - A mock embedding vector
 */
function generateMockEmbedding(text: string): number[] {
  const embedding: number[] = new Array(EMBEDDING_DIMENSIONS).fill(0);
  
  // Generate deterministic values based on text content
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const idx = (i * 7 + charCode) % EMBEDDING_DIMENSIONS;
    embedding[idx] = (embedding[idx] + charCode / 255) % 1;
  }

  // Normalize the embedding
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (norm > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= norm;
    }
  }

  return embedding;
}

/**
 * Get the embedding dimensions for the current model
 * @returns number - The dimension count
 */
export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}
