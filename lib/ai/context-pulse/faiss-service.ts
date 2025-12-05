/**
 * FAISS Service for the ContextPulse Engine
 * Provides vectorized context retrieval using an in-memory similarity search index
 * 
 * This implementation provides FAISS-like functionality in pure TypeScript,
 * suitable for serverless and Node.js environments without native dependencies.
 */

import type {
  ContextEntry,
  SearchResult,
  FAISSConfig,
  RetrievalOptions,
  ContextFilter,
  IndexStats,
  AddResult,
} from './types';
import {
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  l2Distance,
  getEmbeddingDimensions,
} from './embedding-service';

// Default configuration for the FAISS-like index
const DEFAULT_CONFIG: FAISSConfig = {
  dimensions: 1536, // OpenAI text-embedding-3-small dimensions
  indexType: 'flat',
};

/**
 * FAISSService class - Provides vector similarity search functionality
 */
export class FAISSService {
  private entries: Map<string, ContextEntry> = new Map();
  private config: FAISSConfig;
  private lastUpdated: Date = new Date();

  constructor(config: Partial<FAISSConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add a single context entry to the index
   * @param entry - The context entry to add
   * @returns Promise<boolean> - Success status
   */
  async addEntry(entry: ContextEntry): Promise<boolean> {
    try {
      // Generate embedding if not provided
      if (!entry.embedding) {
        entry.embedding = await generateEmbedding(entry.content);
      }

      this.entries.set(entry.id, entry);
      this.lastUpdated = new Date();
      return true;
    } catch (error) {
      console.error('Failed to add entry to FAISS index:', error);
      return false;
    }
  }

  /**
   * Add multiple context entries to the index in batch
   * @param entries - Array of context entries to add
   * @returns Promise<AddResult> - Result with success/failure counts
   */
  async addEntries(entries: ContextEntry[]): Promise<AddResult> {
    const result: AddResult = {
      success: true,
      addedCount: 0,
      failedCount: 0,
      errors: [],
    };

    // Generate embeddings for entries that don't have them
    const entriesNeedingEmbeddings = entries.filter((e) => !e.embedding);
    if (entriesNeedingEmbeddings.length > 0) {
      try {
        const texts = entriesNeedingEmbeddings.map((e) => e.content);
        const embeddings = await generateEmbeddings(texts);
        
        entriesNeedingEmbeddings.forEach((entry, idx) => {
          entry.embedding = embeddings[idx];
        });
      } catch (error) {
        result.success = false;
        result.errors?.push(`Failed to generate embeddings: ${error}`);
        return result;
      }
    }

    // Add entries to the index
    for (const entry of entries) {
      try {
        this.entries.set(entry.id, entry);
        result.addedCount++;
      } catch (error) {
        result.failedCount++;
        result.errors?.push(`Failed to add entry ${entry.id}: ${error}`);
      }
    }

    this.lastUpdated = new Date();
    result.success = result.failedCount === 0;
    return result;
  }

  /**
   * Search for similar contexts using a query string
   * @param query - The search query
   * @param options - Retrieval options
   * @returns Promise<SearchResult[]> - Array of search results sorted by similarity
   */
  async search(
    query: string,
    options: RetrievalOptions = { topK: 5 }
  ): Promise<SearchResult[]> {
    const queryEmbedding = await generateEmbedding(query);
    return this.searchByEmbedding(queryEmbedding, options);
  }

  /**
   * Search for similar contexts using an embedding vector
   * @param queryEmbedding - The query embedding vector
   * @param options - Retrieval options
   * @returns SearchResult[] - Array of search results sorted by similarity
   */
  searchByEmbedding(
    queryEmbedding: number[],
    options: RetrievalOptions = { topK: 5 }
  ): SearchResult[] {
    const results: SearchResult[] = [];
    const { topK, minScore, filters } = options;

    const entriesArray = Array.from(this.entries.values());
    for (const entry of entriesArray) {
      // Apply filters if provided
      if (filters && !this.matchesFilter(entry, filters)) {
        continue;
      }

      if (!entry.embedding) {
        continue;
      }

      const score = cosineSimilarity(queryEmbedding, entry.embedding);
      const distance = l2Distance(queryEmbedding, entry.embedding);

      // Skip if below minimum score threshold
      if (minScore !== undefined && score < minScore) {
        continue;
      }

      results.push({
        entry,
        score,
        distance,
      });
    }

    // Sort by similarity score (descending) and take top K
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Get a context entry by ID
   * @param id - The entry ID
   * @returns ContextEntry | undefined
   */
  getEntry(id: string): ContextEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Remove a context entry from the index
   * @param id - The entry ID to remove
   * @returns boolean - Whether the entry was removed
   */
  removeEntry(id: string): boolean {
    const deleted = this.entries.delete(id);
    if (deleted) {
      this.lastUpdated = new Date();
    }
    return deleted;
  }

  /**
   * Update an existing context entry
   * @param id - The entry ID
   * @param updates - Partial updates to apply
   * @returns Promise<boolean> - Success status
   */
  async updateEntry(
    id: string,
    updates: Partial<Omit<ContextEntry, 'id'>>
  ): Promise<boolean> {
    const existing = this.entries.get(id);
    if (!existing) {
      return false;
    }

    const updated = { ...existing, ...updates };

    // Regenerate embedding if content changed
    if (updates.content && updates.content !== existing.content) {
      updated.embedding = await generateEmbedding(updates.content);
    }

    this.entries.set(id, updated);
    this.lastUpdated = new Date();
    return true;
  }

  /**
   * Clear all entries from the index
   */
  clear(): void {
    this.entries.clear();
    this.lastUpdated = new Date();
  }

  /**
   * Get index statistics
   * @returns IndexStats
   */
  getStats(): IndexStats {
    return {
      totalEntries: this.entries.size,
      dimensions: this.config.dimensions,
      indexType: this.config.indexType,
      lastUpdated: this.lastUpdated,
    };
  }

  /**
   * Export the index data for persistence
   * @returns Object containing serializable index data
   */
  export(): { entries: ContextEntry[]; config: FAISSConfig } {
    return {
      entries: Array.from(this.entries.values()),
      config: this.config,
    };
  }

  /**
   * Import index data from a previously exported state
   * @param data - The exported index data
   */
  import(data: { entries: ContextEntry[]; config: FAISSConfig }): void {
    this.config = data.config;
    this.entries.clear();
    for (const entry of data.entries) {
      // Restore Date objects from JSON serialization
      entry.createdAt = new Date(entry.createdAt);
      this.entries.set(entry.id, entry);
    }
    this.lastUpdated = new Date();
  }

  /**
   * Check if an entry matches the given filter criteria
   * @param entry - The entry to check
   * @param filter - The filter criteria
   * @returns boolean - Whether the entry matches
   */
  private matchesFilter(entry: ContextEntry, filter: ContextFilter): boolean {
    const { metadata } = entry;

    if (filter.userId && metadata.userId !== filter.userId) {
      return false;
    }

    if (filter.chatId && metadata.chatId !== filter.chatId) {
      return false;
    }

    if (filter.categories && filter.categories.length > 0) {
      if (!filter.categories.includes(metadata.category)) {
        return false;
      }
    }

    if (filter.sources && filter.sources.length > 0) {
      if (!filter.sources.includes(metadata.source)) {
        return false;
      }
    }

    if (filter.dateRange) {
      const entryDate = entry.createdAt;
      if (entryDate < filter.dateRange.start || entryDate > filter.dateRange.end) {
        return false;
      }
    }

    if (filter.tags && filter.tags.length > 0) {
      if (!metadata.tags || !filter.tags.some((tag) => metadata.tags?.includes(tag))) {
        return false;
      }
    }

    return true;
  }
}

// Singleton instance for the default FAISS service
let defaultInstance: FAISSService | null = null;

/**
 * Get the default FAISS service instance
 * @returns FAISSService
 */
export function getDefaultFAISSService(): FAISSService {
  if (!defaultInstance) {
    defaultInstance = new FAISSService({
      dimensions: getEmbeddingDimensions(),
    });
  }
  return defaultInstance;
}

/**
 * Create a new FAISS service instance with custom configuration
 * @param config - Custom configuration
 * @returns FAISSService
 */
export function createFAISSService(config?: Partial<FAISSConfig>): FAISSService {
  return new FAISSService(config);
}
