/**
 * ContextPulse Engine (CPE) Types
 *
 * This module defines the core types and interfaces for the Context Pulse Engine,
 * which uses RAG (Retrieval-Augmented Generation) and vector-based context retrieval.
 */

/** Represents a vector embedding for context retrieval */
export type VectorEmbedding = number[];

/** Represents temporal context signals */
export interface TemporalContext {
  /** Current timestamp */
  timestamp: Date;
  /** Time of day category */
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  /** Day of week */
  dayOfWeek: string;
  /** Whether it's a weekend */
  isWeekend: boolean;
  /** User's timezone offset in minutes */
  timezoneOffset?: number;
}

/** Represents behavioral signals from user interactions */
export interface BehavioralSignal {
  /** Type of behavior detected */
  type:
    | 'frequent_topic'
    | 'time_pattern'
    | 'interaction_style'
    | 'preference'
    | 'goal';
  /** The specific value or pattern detected */
  value: string;
  /** Confidence score between 0 and 1 */
  confidence: number;
  /** When this signal was last observed */
  lastObserved: Date;
  /** Number of times this pattern was observed */
  frequency: number;
}

/** Represents user goals extracted from interactions */
export interface UserGoal {
  /** Unique identifier for the goal */
  id: string;
  /** Description of the goal */
  description: string;
  /** Category of the goal */
  category: string;
  /** Priority level */
  priority: 'low' | 'medium' | 'high';
  /** Whether the goal is currently active */
  isActive: boolean;
  /** When the goal was identified */
  createdAt: Date;
  /** Progress towards the goal (0-100) */
  progress?: number;
}

/** Represents a context entry in the knowledge base */
export interface ContextEntry {
  /** Unique identifier */
  id: string;
  /** The content of this context entry */
  content: string;
  /** Vector embedding of the content */
  embedding?: VectorEmbedding;
  /** Category/type of context */
  category:
    | 'user_preference'
    | 'interaction_history'
    | 'knowledge'
    | 'temporal'
    | 'goal';
  /** Metadata associated with this entry */
  metadata: Record<string, unknown>;
  /** Relevance score (computed during retrieval) */
  score?: number;
  /** When this entry was created */
  createdAt: Date;
  /** When this entry was last updated */
  updatedAt: Date;
}

/** User interaction history entry */
export interface InteractionHistoryEntry {
  /** Unique identifier */
  id: string;
  /** User ID */
  userId: string;
  /** Chat ID */
  chatId: string;
  /** The user's message content */
  userMessage: string;
  /** The assistant's response */
  assistantResponse: string;
  /** Topics identified in this interaction */
  topics: string[];
  /** Sentiment of the interaction */
  sentiment?: 'positive' | 'neutral' | 'negative';
  /** When this interaction occurred */
  timestamp: Date;
}

/** Parameters for context retrieval */
export interface ContextRetrievalParams {
  /** The query to retrieve context for */
  query: string;
  /** User ID for personalized context */
  userId?: string;
  /** Current temporal context */
  temporalContext?: TemporalContext;
  /** User's goals to consider */
  goals?: UserGoal[];
  /** Behavioral signals to consider */
  behavioralSignals?: BehavioralSignal[];
  /** Maximum number of context entries to retrieve */
  maxResults?: number;
  /** Minimum similarity score threshold */
  minScore?: number;
  /** Categories to filter by */
  categories?: ContextEntry['category'][];
}

/** Result of context retrieval */
export interface RetrievedContext {
  /** Retrieved context entries */
  entries: ContextEntry[];
  /** Aggregated context as a single string for prompt augmentation */
  aggregatedContext: string;
  /** Proactive suggestions based on context */
  proactiveSuggestions: ProactiveSuggestion[];
  /** Metadata about the retrieval */
  metadata: {
    /** Total entries searched */
    totalSearched: number;
    /** Time taken for retrieval in ms */
    retrievalTimeMs: number;
    /** Whether temporal context was used */
    usedTemporalContext: boolean;
    /** Whether behavioral signals were used */
    usedBehavioralSignals: boolean;
  };
}

/** A proactive suggestion for conversation initiation */
export interface ProactiveSuggestion {
  /** Unique identifier */
  id: string;
  /** The suggested message or prompt */
  message: string;
  /** Why this suggestion is being made */
  reason: string;
  /** Type of suggestion */
  type: 'reminder' | 'follow_up' | 'recommendation' | 'goal_progress' | 'check_in';
  /** Priority level */
  priority: 'low' | 'medium' | 'high';
  /** Confidence score */
  confidence: number;
  /** Related context entries */
  relatedContextIds: string[];
  /** When to trigger this suggestion */
  triggerTime?: Date;
}

/** Configuration for the CPE */
export interface CPEConfig {
  /** Dimension of vector embeddings */
  embeddingDimension: number;
  /** Default number of results to retrieve */
  defaultMaxResults: number;
  /** Default minimum score threshold */
  defaultMinScore: number;
  /** Whether to enable proactive suggestions */
  enableProactiveSuggestions: boolean;
  /** Interval for checking proactive triggers (in ms) */
  proactiveCheckInterval: number;
  /** Maximum age of context entries to consider (in ms) */
  maxContextAge: number;
}

/** Default CPE configuration */
export const DEFAULT_CPE_CONFIG: CPEConfig = {
  embeddingDimension: 384, // Common dimension for small embedding models
  defaultMaxResults: 5,
  defaultMinScore: 0.5,
  enableProactiveSuggestions: true,
  proactiveCheckInterval: 60000, // 1 minute
  maxContextAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
