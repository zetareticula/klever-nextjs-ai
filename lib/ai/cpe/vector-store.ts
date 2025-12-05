/**
 * Vector Store for Context Retrieval
 *
 * Implements an in-memory vector store with FAISS-like similarity search
 * for efficient context retrieval in the ContextPulse Engine.
 */

import { generateUUID } from '@/lib/utils';
import type { ContextEntry, VectorEmbedding, } from './types';

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: VectorEmbedding, b: VectorEmbedding): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Compute Euclidean distance between two vectors
 */
export function euclideanDistance(a: VectorEmbedding, b: VectorEmbedding): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Simple text-to-embedding function using hash-based approach.
 * In production, this should be replaced with a proper embedding model.
 */
export function simpleTextEmbedding(
  text: string,
  dimension = 384
): VectorEmbedding {
  // Normalize text
  const normalizedText = text.toLowerCase().trim();

  // Create a deterministic embedding based on text content
  const embedding: VectorEmbedding = new Array(dimension).fill(0);

  // Use character codes and positions to create embedding
  for (let i = 0; i < normalizedText.length; i++) {
    const charCode = normalizedText.charCodeAt(i);
    // Distribute character influence across embedding dimensions
    const baseIndex = (charCode * (i + 1)) % dimension;

    // Apply influence to surrounding dimensions
    for (let j = -2; j <= 2; j++) {
      const idx = (baseIndex + j + dimension) % dimension;
      const weight = 1 / (1 + Math.abs(j));
      embedding[idx] += weight * Math.sin(charCode * (i + 1) * 0.01);
    }
  }

  // Normalize the embedding
  let magnitude = 0;
  for (let i = 0; i < dimension; i++) {
    magnitude += embedding[i] * embedding[i];
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude > 0) {
    for (let i = 0; i < dimension; i++) {
      embedding[i] /= magnitude;
    }
  }

  return embedding;
}

/**
 * In-memory Vector Store with FAISS-like functionality
 */
export class VectorStore {
  private entries: Map<string, ContextEntry>;
  private dimension: number;

  constructor(dimension = 384) {
    this.entries = new Map();
    this.dimension = dimension;
  }

  /**
   * Get the number of entries in the store
   */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Add a context entry to the store
   */
  add(entry: Omit<ContextEntry, 'id' | 'embedding' | 'createdAt' | 'updatedAt'>): ContextEntry {
    const id = generateUUID();
    const now = new Date();

    const embedding = simpleTextEmbedding(entry.content, this.dimension);

    const fullEntry: ContextEntry = {
      ...entry,
      id,
      embedding,
      createdAt: now,
      updatedAt: now,
    };

    this.entries.set(id, fullEntry);
    return fullEntry;
  }

  /**
   * Add an entry with a pre-computed embedding
   */
  addWithEmbedding(
    entry: Omit<ContextEntry, 'id' | 'createdAt' | 'updatedAt'>,
    embedding: VectorEmbedding
  ): ContextEntry {
    const id = generateUUID();
    const now = new Date();

    const fullEntry: ContextEntry = {
      ...entry,
      id,
      embedding,
      createdAt: now,
      updatedAt: now,
    };

    this.entries.set(id, fullEntry);
    return fullEntry;
  }

  /**
   * Get an entry by ID
   */
  get(id: string): ContextEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Update an existing entry
   */
  update(id: string, updates: Partial<Omit<ContextEntry, 'id' | 'createdAt'>>): ContextEntry | undefined {
    const existing = this.entries.get(id);
    if (!existing) return undefined;

    const updatedEntry: ContextEntry = {
      ...existing,
      ...updates,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    // Recompute embedding if content changed
    if (updates.content && updates.content !== existing.content) {
      updatedEntry.embedding = simpleTextEmbedding(updates.content, this.dimension);
    }

    this.entries.set(id, updatedEntry);
    return updatedEntry;
  }

  /**
   * Delete an entry by ID
   */
  delete(id: string): boolean {
    return this.entries.delete(id);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Search for similar entries using vector similarity
   */
  search(
    query: string | VectorEmbedding,
    options: {
      maxResults?: number;
      minScore?: number;
      categories?: ContextEntry['category'][];
      maxAge?: number;
    } = {}
  ): ContextEntry[] {
    const {
      maxResults = 5,
      minScore = 0,
      categories,
      maxAge,
    } = options;

    // Get query embedding
    const queryEmbedding = typeof query === 'string'
      ? simpleTextEmbedding(query, this.dimension)
      : query;

    const now = Date.now();
    const results: Array<{ entry: ContextEntry; score: number }> = [];

    for (const entry of Array.from(this.entries.values())) {
      // Filter by category if specified
      if (categories && !categories.includes(entry.category)) {
        continue;
      }

      // Filter by age if specified
      if (maxAge && now - entry.createdAt.getTime() > maxAge) {
        continue;
      }

      // Compute similarity
      if (!entry.embedding) continue;

      const score = cosineSimilarity(queryEmbedding, entry.embedding);

      if (score >= minScore) {
        results.push({ entry: { ...entry, score }, score });
      }
    }

    // Sort by score descending and return top results
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, maxResults).map(r => r.entry);
  }

  /**
   * Get all entries, optionally filtered
   */
  getAll(options: {
    categories?: ContextEntry['category'][];
    maxAge?: number;
  } = {}): ContextEntry[] {
    const { categories, maxAge } = options;
    const now = Date.now();
    const results: ContextEntry[] = [];

    for (const entry of Array.from(this.entries.values())) {
      if (categories && !categories.includes(entry.category)) {
        continue;
      }

      if (maxAge && now - entry.createdAt.getTime() > maxAge) {
        continue;
      }

      results.push(entry);
    }

    return results;
  }

  /**
   * Export all entries for persistence
   */
  export(): ContextEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Import entries from external source
   */
  import(entries: ContextEntry[]): void {
    for (const entry of entries) {
      // Ensure embedding exists
      if (!entry.embedding) {
        entry.embedding = simpleTextEmbedding(entry.content, this.dimension);
      }
      this.entries.set(entry.id, entry);
    }
  }
}

/**
 * Create a singleton vector store instance
 */
let vectorStoreInstance: VectorStore | null = null;

export function getVectorStore(dimension = 384): VectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStore(dimension);
  }
  return vectorStoreInstance;
}

/**
 * Reset the vector store (useful for testing)
 */
export function resetVectorStore(): void {
  vectorStoreInstance = null;
}
