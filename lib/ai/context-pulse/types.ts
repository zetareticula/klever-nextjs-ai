/**
 * Type definitions for the ContextPulse Engine (CPE)
 * This module provides RAG-enhanced context retrieval using FAISS
 */

/**
 * Represents a context entry stored in the FAISS index
 */
export interface ContextEntry {
  id: string;
  content: string;
  embedding?: number[];
  metadata: ContextMetadata;
  createdAt: Date;
}

/**
 * Metadata associated with a context entry
 */
export interface ContextMetadata {
  userId: string;
  chatId?: string;
  category: ContextCategory;
  source: ContextSource;
  temporalMarkers?: TemporalMarker[];
  goalAlignment?: number; // 0-1 score indicating alignment with user goals
  tags?: string[];
}

/**
 * Categories for context classification
 */
export type ContextCategory =
  | 'user_preference'
  | 'interaction_history'
  | 'goal'
  | 'domain_knowledge'
  | 'temporal_pattern'
  | 'conversation_context';

/**
 * Sources from which context can be derived
 */
export type ContextSource =
  | 'chat_message'
  | 'user_profile'
  | 'system_inference'
  | 'external_data'
  | 'temporal_trigger';

/**
 * Temporal markers for time-based context
 */
export interface TemporalMarker {
  type: 'daily' | 'weekly' | 'monthly' | 'event_based';
  time?: string; // ISO time string for daily triggers (e.g., "09:00")
  dayOfWeek?: number; // 0-6 for weekly triggers
  dayOfMonth?: number; // 1-31 for monthly triggers
  eventType?: string; // Custom event identifier
}

/**
 * Result from a FAISS similarity search
 */
export interface SearchResult {
  entry: ContextEntry;
  score: number; // Similarity score (higher is better, cosine similarity)
  distance: number; // L2 distance (lower is better)
}

/**
 * Configuration for the FAISS service
 */
export interface FAISSConfig {
  dimensions: number; // Embedding vector dimensions (e.g., 1536 for OpenAI ada-002)
  indexType: 'flat' | 'ivf' | 'hnsw';
  numClusters?: number; // For IVF index
  efConstruction?: number; // For HNSW index
  efSearch?: number; // For HNSW index
}

/**
 * Options for context retrieval
 */
export interface RetrievalOptions {
  topK: number;
  minScore?: number; // Minimum similarity score threshold
  filters?: ContextFilter;
  includeMetadata?: boolean;
}

/**
 * Filters for context retrieval
 */
export interface ContextFilter {
  userId?: string;
  chatId?: string;
  categories?: ContextCategory[];
  sources?: ContextSource[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
}

/**
 * User goal representation for goal-aligned suggestions
 */
export interface UserGoal {
  id: string;
  userId: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'completed' | 'paused';
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Configuration for proactive conversation triggers
 */
export interface ProactiveTriggerConfig {
  enabled: boolean;
  checkIntervalMs: number;
  temporalTriggers: TemporalTrigger[];
  contextualTriggers: ContextualTrigger[];
}

/**
 * Time-based trigger for proactive conversations
 */
export interface TemporalTrigger {
  id: string;
  userId: string;
  type: 'scheduled' | 'pattern_based';
  schedule?: TemporalMarker;
  patternDescription?: string;
  message: string;
  enabled: boolean;
}

/**
 * Context-based trigger for proactive conversations
 */
export interface ContextualTrigger {
  id: string;
  userId: string;
  condition: string; // Description of the condition
  contextQuery: string; // Query to match against context
  threshold: number; // Similarity threshold to trigger
  message: string;
  enabled: boolean;
}

/**
 * Result from the ContextPulse Engine RAG augmentation
 */
export interface RAGAugmentedResult {
  originalQuery: string;
  retrievedContexts: SearchResult[];
  augmentedPrompt: string;
  goalAlignmentScore: number;
  suggestedResponse?: string;
}

/**
 * Proactive conversation suggestion
 */
export interface ProactiveSuggestion {
  triggerId: string;
  triggerType: 'temporal' | 'contextual';
  userId: string;
  message: string;
  relevantContext: SearchResult[];
  confidence: number;
  timestamp: Date;
}

/**
 * Statistics for the FAISS index
 */
export interface IndexStats {
  totalEntries: number;
  dimensions: number;
  indexType: string;
  memoryUsageBytes?: number;
  lastUpdated: Date;
}

/**
 * Result of adding entries to the index
 */
export interface AddResult {
  success: boolean;
  addedCount: number;
  failedCount: number;
  errors?: string[];
}
