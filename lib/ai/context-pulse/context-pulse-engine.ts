/**
 * ContextPulse Engine (CPE) - Main Service
 * Implements Retrieval-Augmented Generation (RAG) with FAISS for enhanced context understanding
 * 
 * Features:
 * - FAISS-based vectorized context retrieval
 * - Goal-aligned suggestions using ChatGPT/OpenAI
 * - Proactive conversation initiation with temporal triggers
 * - Domain-specific RAG augmentation
 */

import type {
  ContextEntry,
  ContextCategory,
  ContextSource,
  SearchResult,
  RetrievalOptions,
  UserGoal,
  RAGAugmentedResult,
  ProactiveSuggestion,
} from './types';
import { type FAISSService, getDefaultFAISSService, createFAISSService } from './faiss-service';
import {
  type TemporalTriggerService,
  getDefaultTemporalTriggerService,
  createTemporalTriggerService,
} from './temporal-trigger-service';
import { generateEmbedding, cosineSimilarity } from './embedding-service';
import { generateUUID } from '@/lib/utils';

/**
 * Configuration for the ContextPulse Engine
 */
export interface ContextPulseConfig {
  maxContextLength: number;
  defaultTopK: number;
  minSimilarityScore: number;
  enableProactiveTriggers: boolean;
  ragPromptTemplate: string;
}

// Default configuration
const DEFAULT_CONFIG: ContextPulseConfig = {
  maxContextLength: 4000,
  defaultTopK: 5,
  minSimilarityScore: 0.5,
  enableProactiveTriggers: true,
  ragPromptTemplate: `Based on the following relevant context from previous interactions:
{context}

Please respond to the user's query while considering this context:
{query}`,
};

/**
 * ContextPulseEngine class - Main entry point for RAG-enhanced context understanding
 */
export class ContextPulseEngine {
  private config: ContextPulseConfig;
  private faissService: FAISSService;
  private triggerService: TemporalTriggerService;
  private userGoals: Map<string, UserGoal[]> = new Map();

  constructor(
    config: Partial<ContextPulseConfig> = {},
    faissService?: FAISSService,
    triggerService?: TemporalTriggerService
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.faissService = faissService || getDefaultFAISSService();
    this.triggerService = triggerService || getDefaultTemporalTriggerService();
  }

  /**
   * Add context from a chat message
   * @param content - The message content
   * @param userId - The user ID
   * @param chatId - Optional chat ID
   * @param category - The context category
   * @param source - The context source
   * @param tags - Optional tags for categorization
   * @returns Promise<string> - The context entry ID
   */
  async addContext(
    content: string,
    userId: string,
    chatId?: string,
    category: ContextCategory = 'conversation_context',
    source: ContextSource = 'chat_message',
    tags?: string[]
  ): Promise<string> {
    const id = generateUUID();
    const entry: ContextEntry = {
      id,
      content,
      metadata: {
        userId,
        chatId,
        category,
        source,
        tags,
      },
      createdAt: new Date(),
    };

    await this.faissService.addEntry(entry);
    return id;
  }

  /**
   * Add a user goal for goal-aligned suggestions
   * @param userId - The user ID
   * @param description - The goal description
   * @param priority - The goal priority
   * @returns Promise<UserGoal> - The created goal
   */
  async addUserGoal(
    userId: string,
    description: string,
    priority: UserGoal['priority'] = 'medium'
  ): Promise<UserGoal> {
    const embedding = await generateEmbedding(description);
    const goal: UserGoal = {
      id: generateUUID(),
      userId,
      description,
      priority,
      status: 'active',
      embedding,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const userGoals = this.userGoals.get(userId) || [];
    userGoals.push(goal);
    this.userGoals.set(userId, userGoals);

    // Also add to FAISS for context retrieval
    await this.addContext(description, userId, undefined, 'goal', 'user_profile', [
      'goal',
      priority,
    ]);

    return goal;
  }

  /**
   * Get goals for a user
   * @param userId - The user ID
   * @returns UserGoal[] - Array of user goals
   */
  getUserGoals(userId: string): UserGoal[] {
    return this.userGoals.get(userId) || [];
  }

  /**
   * Update a user goal status
   * @param userId - The user ID
   * @param goalId - The goal ID
   * @param status - The new status
   * @returns boolean - Whether the update was successful
   */
  updateGoalStatus(
    userId: string,
    goalId: string,
    status: UserGoal['status']
  ): boolean {
    const userGoals = this.userGoals.get(userId);
    if (!userGoals) return false;

    const goal = userGoals.find((g) => g.id === goalId);
    if (!goal) return false;

    goal.status = status;
    goal.updatedAt = new Date();
    return true;
  }

  /**
   * Retrieve relevant context for a query
   * @param query - The search query
   * @param userId - The user ID
   * @param options - Optional retrieval options
   * @returns Promise<SearchResult[]> - Array of relevant context entries
   */
  async retrieveContext(
    query: string,
    userId: string,
    options?: Partial<RetrievalOptions>
  ): Promise<SearchResult[]> {
    const retrievalOptions: RetrievalOptions = {
      topK: options?.topK || this.config.defaultTopK,
      minScore: options?.minScore || this.config.minSimilarityScore,
      filters: {
        ...options?.filters,
        userId,
      },
      includeMetadata: options?.includeMetadata ?? true,
    };

    return this.faissService.search(query, retrievalOptions);
  }

  /**
   * Generate a RAG-augmented prompt for the LLM
   * @param query - The user's query
   * @param userId - The user ID
   * @param chatId - Optional chat ID for conversation-specific context
   * @returns Promise<RAGAugmentedResult> - The augmented result with context
   */
  async augmentWithRAG(
    query: string,
    userId: string,
    chatId?: string
  ): Promise<RAGAugmentedResult> {
    // Retrieve relevant context
    const contextResults = await this.retrieveContext(query, userId, {
      topK: this.config.defaultTopK,
      filters: chatId ? { chatId } : undefined,
    });

    // Calculate goal alignment score
    const goalAlignmentScore = await this.calculateGoalAlignment(query, userId);

    // Build the context string
    const contextParts: string[] = [];
    let totalLength = 0;

    for (const result of contextResults) {
      if (totalLength + result.entry.content.length > this.config.maxContextLength) {
        break;
      }
      contextParts.push(`[${result.entry.metadata.category}] ${result.entry.content}`);
      totalLength += result.entry.content.length;
    }

    const contextString = contextParts.join('\n\n');

    // Generate the augmented prompt
    const augmentedPrompt = this.config.ragPromptTemplate
      .replace('{context}', contextString || 'No relevant prior context found.')
      .replace('{query}', query);

    return {
      originalQuery: query,
      retrievedContexts: contextResults,
      augmentedPrompt,
      goalAlignmentScore,
    };
  }

  /**
   * Calculate how well a query aligns with user goals
   * @param query - The query to check
   * @param userId - The user ID
   * @returns Promise<number> - Alignment score (0-1)
   */
  async calculateGoalAlignment(query: string, userId: string): Promise<number> {
    const userGoals = this.getUserGoals(userId).filter((g) => g.status === 'active');
    if (userGoals.length === 0) return 0;

    const queryEmbedding = await generateEmbedding(query);
    let maxSimilarity = 0;

    for (const goal of userGoals) {
      if (!goal.embedding) continue;
      const similarity = cosineSimilarity(queryEmbedding, goal.embedding);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    return maxSimilarity;
  }

  /**
   * Get proactive suggestions for a user
   * @param userId - The user ID
   * @param currentContext - Optional current conversation context
   * @returns Promise<ProactiveSuggestion[]> - Array of proactive suggestions
   */
  async getProactiveSuggestions(
    userId: string,
    currentContext?: string
  ): Promise<ProactiveSuggestion[]> {
    if (!this.config.enableProactiveTriggers) {
      return [];
    }

    return this.triggerService.generateProactiveSuggestions(userId, currentContext);
  }

  /**
   * Add a scheduled trigger for proactive conversations
   * @param userId - The user ID
   * @param message - The message to send
   * @param schedule - The schedule configuration
   * @returns string - The trigger ID
   */
  addScheduledTrigger(
    userId: string,
    message: string,
    schedule: { type: 'daily' | 'weekly' | 'monthly'; time: string; dayOfWeek?: number; dayOfMonth?: number }
  ): string {
    return this.triggerService.addTemporalTrigger({
      userId,
      type: 'scheduled',
      schedule: {
        type: schedule.type,
        time: schedule.time,
        dayOfWeek: schedule.dayOfWeek,
        dayOfMonth: schedule.dayOfMonth,
      },
      message,
      enabled: true,
    });
  }

  /**
   * Add a contextual trigger for proactive conversations
   * @param userId - The user ID
   * @param condition - Description of when to trigger
   * @param contextQuery - Query to match against context
   * @param message - The message to send
   * @param threshold - Similarity threshold (0-1)
   * @returns string - The trigger ID
   */
  addContextualTrigger(
    userId: string,
    condition: string,
    contextQuery: string,
    message: string,
    threshold = 0.7
  ): string {
    return this.triggerService.addContextualTrigger({
      userId,
      condition,
      contextQuery,
      threshold,
      message,
      enabled: true,
    });
  }

  /**
   * Process a chat message and extract/store relevant context
   * @param message - The message content
   * @param role - The message role (user/assistant)
   * @param userId - The user ID
   * @param chatId - The chat ID
   * @returns Promise<void>
   */
  async processMessage(
    message: string,
    role: 'user' | 'assistant',
    userId: string,
    chatId: string
  ): Promise<void> {
    // Determine the appropriate category based on content analysis
    const category = this.categorizeContent(message, role);
    const source: ContextSource = 'chat_message';

    await this.addContext(message, userId, chatId, category, source);
  }

  /**
   * Categorize content based on its characteristics
   * @param content - The content to categorize
   * @param role - The message role
   * @returns ContextCategory
   */
  private categorizeContent(content: string, role: 'user' | 'assistant'): ContextCategory {
    const lowerContent = content.toLowerCase();

    // Check for goal-related content
    if (
      lowerContent.includes('goal') ||
      lowerContent.includes('want to') ||
      lowerContent.includes('plan to') ||
      lowerContent.includes('trying to')
    ) {
      return 'goal';
    }

    // Check for preference-related content
    if (
      lowerContent.includes('prefer') ||
      lowerContent.includes('like') ||
      lowerContent.includes('dislike') ||
      lowerContent.includes('favorite')
    ) {
      return 'user_preference';
    }

    // Check for temporal patterns
    if (
      lowerContent.includes('every day') ||
      lowerContent.includes('weekly') ||
      lowerContent.includes('monthly') ||
      lowerContent.includes('usually') ||
      lowerContent.includes('schedule')
    ) {
      return 'temporal_pattern';
    }

    // Default to conversation context
    return 'conversation_context';
  }

  /**
   * Get the FAISS service instance
   * @returns FAISSService
   */
  getFAISSService(): FAISSService {
    return this.faissService;
  }

  /**
   * Get the temporal trigger service instance
   * @returns TemporalTriggerService
   */
  getTriggerService(): TemporalTriggerService {
    return this.triggerService;
  }

  /**
   * Get index statistics
   * @returns Index statistics
   */
  getStats() {
    return this.faissService.getStats();
  }
}

// Singleton instance
let defaultInstance: ContextPulseEngine | null = null;

/**
 * Get the default ContextPulse Engine instance
 * @returns ContextPulseEngine
 */
export function getDefaultContextPulseEngine(): ContextPulseEngine {
  if (!defaultInstance) {
    defaultInstance = new ContextPulseEngine();
  }
  return defaultInstance;
}

/**
 * Create a new ContextPulse Engine instance
 * @param config - Custom configuration
 * @returns ContextPulseEngine
 */
export function createContextPulseEngine(
  config?: Partial<ContextPulseConfig>
): ContextPulseEngine {
  const faissService = createFAISSService();
  const triggerService = createTemporalTriggerService({}, faissService);
  return new ContextPulseEngine(config, faissService, triggerService);
}

// Export all types and services
export * from './types';
export * from './faiss-service';
export * from './embedding-service';
export * from './temporal-trigger-service';
