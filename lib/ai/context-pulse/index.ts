/**
 * ContextPulse Engine (CPE) Module
 * 
 * A RAG-enhanced context understanding system using FAISS for vector similarity search.
 * 
 * Features:
 * - FAISS-based vectorized context retrieval
 * - Goal-aligned suggestions using embeddings
 * - Proactive conversation initiation with temporal triggers
 * - Integration with OpenAI for embeddings and LLM responses
 * 
 * Usage:
 * ```typescript
 * import { getDefaultContextPulseEngine } from '@/lib/ai/context-pulse';
 * 
 * const cpe = getDefaultContextPulseEngine();
 * 
 * // Add context
 * await cpe.addContext('User mentioned they like hiking', userId, chatId);
 * 
 * // Retrieve context with RAG augmentation
 * const result = await cpe.augmentWithRAG('What outdoor activities would you recommend?', userId);
 * console.log(result.augmentedPrompt);
 * ```
 */

export {
  ContextPulseEngine,
  getDefaultContextPulseEngine,
  createContextPulseEngine,
  type ContextPulseConfig,
} from './context-pulse-engine';

export {
  FAISSService,
  getDefaultFAISSService,
  createFAISSService,
} from './faiss-service';

export {
  TemporalTriggerService,
  getDefaultTemporalTriggerService,
  createTemporalTriggerService,
} from './temporal-trigger-service';

export {
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  l2Distance,
  getEmbeddingDimensions,
} from './embedding-service';

export type {
  ContextEntry,
  ContextMetadata,
  ContextCategory,
  ContextSource,
  TemporalMarker,
  SearchResult,
  FAISSConfig,
  RetrievalOptions,
  ContextFilter,
  UserGoal,
  ProactiveTriggerConfig,
  TemporalTrigger,
  ContextualTrigger,
  RAGAugmentedResult,
  ProactiveSuggestion,
  IndexStats,
  AddResult,
} from './types';
