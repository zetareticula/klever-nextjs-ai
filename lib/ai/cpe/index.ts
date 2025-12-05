/**
 * ContextPulse Engine (CPE)
 *
 * Main engine that integrates RAG (Retrieval-Augmented Generation) with
 * FAISS-like vector retrieval for contextual chatbot responses.
 */

import { generateUUID } from '@/lib/utils';
import {
  type ContextEntry,
  type ContextRetrievalParams,
  type RetrievedContext,
  type ProactiveSuggestion,
  type InteractionHistoryEntry,
  type UserGoal,
  type BehavioralSignal,
  type TemporalContext,
  type CPEConfig,
  DEFAULT_CPE_CONFIG,
} from './types';
import { type VectorStore, getVectorStore, } from './vector-store';
import {
  getTemporalContext,
  extractTopics,
  detectSentiment,
  analyzeBehavioralSignals,
  extractGoals,
  generateProactiveSuggestions,
} from './signals';

/**
 * ContextPulse Engine class
 *
 * Provides RAG-based context retrieval and proactive suggestion generation.
 */
export class ContextPulseEngine {
  private vectorStore: VectorStore;
  private config: CPEConfig;
  private interactionHistory: InteractionHistoryEntry[];
  private behavioralSignals: BehavioralSignal[];
  private userGoals: UserGoal[];

  constructor(config: Partial<CPEConfig> = {}) {
    this.config = { ...DEFAULT_CPE_CONFIG, ...config };
    this.vectorStore = getVectorStore(this.config.embeddingDimension);
    this.interactionHistory = [];
    this.behavioralSignals = [];
    this.userGoals = [];
  }

  /**
   * Initialize the engine with knowledge base entries
   */
  initialize(knowledgeBase: Array<{ content: string; category: ContextEntry['category']; metadata?: Record<string, unknown> }>): void {
    for (const entry of knowledgeBase) {
      this.vectorStore.add({
        content: entry.content,
        category: entry.category,
        metadata: entry.metadata || {},
      });
    }
  }

  /**
   * Add a context entry to the knowledge base
   */
  addContext(
    content: string,
    category: ContextEntry['category'],
    metadata: Record<string, unknown> = {}
  ): ContextEntry {
    return this.vectorStore.add({
      content,
      category,
      metadata,
    });
  }

  /**
   * Record a user interaction for behavioral analysis
   */
  recordInteraction(
    userId: string,
    chatId: string,
    userMessage: string,
    assistantResponse: string
  ): InteractionHistoryEntry {
    const topics = extractTopics(userMessage);
    const sentiment = detectSentiment(userMessage);

    const interaction: InteractionHistoryEntry = {
      id: generateUUID(),
      userId,
      chatId,
      userMessage,
      assistantResponse,
      topics,
      sentiment,
      timestamp: new Date(),
    };

    this.interactionHistory.push(interaction);

    // Also add to vector store for context retrieval
    this.vectorStore.add({
      content: `User: ${userMessage}\nAssistant: ${assistantResponse}`,
      category: 'interaction_history',
      metadata: {
        userId,
        chatId,
        topics,
        sentiment,
      },
    });

    // Update behavioral signals periodically
    if (this.interactionHistory.length % 5 === 0) {
      this.updateBehavioralSignals(userId);
    }

    return interaction;
  }

  /**
   * Update behavioral signals based on interaction history
   */
  private updateBehavioralSignals(userId: string): void {
    const userInteractions = this.interactionHistory.filter(
      i => i.userId === userId
    );

    this.behavioralSignals = analyzeBehavioralSignals(userInteractions);
    this.userGoals = extractGoals(userInteractions);
  }

  /**
   * Retrieve context using RAG paradigm
   *
   * This method:
   * 1. Searches the vector store for relevant dense context
   * 2. Augments with sparse data from knowledge base
   * 3. Applies temporal and behavioral filtering
   * 4. Generates proactive suggestions
   */
  async retrieveContext(params: ContextRetrievalParams): Promise<RetrievedContext> {
    const startTime = Date.now();

    const {
      query,
      userId,
      temporalContext = getTemporalContext(),
      goals = this.userGoals,
      behavioralSignals = this.behavioralSignals,
      maxResults = this.config.defaultMaxResults,
      minScore = this.config.defaultMinScore,
      categories,
    } = params;

    // Perform vector similarity search
    const vectorResults = this.vectorStore.search(query, {
      maxResults: maxResults * 2, // Get extra for filtering
      minScore,
      categories,
      maxAge: this.config.maxContextAge,
    });

    // Apply behavioral and temporal boosting
    const boostedResults = this.applyContextBoosting(
      vectorResults,
      temporalContext,
      behavioralSignals
    );

    // Select top results after boosting
    const entries = boostedResults.slice(0, maxResults);

    // Generate aggregated context for prompt augmentation
    const aggregatedContext = this.aggregateContext(
      entries,
      temporalContext,
      goals
    );

    // Generate proactive suggestions
    const proactiveSuggestions = this.config.enableProactiveSuggestions
      ? generateProactiveSuggestions(temporalContext, behavioralSignals, goals)
      : [];

    const retrievalTimeMs = Date.now() - startTime;

    return {
      entries,
      aggregatedContext,
      proactiveSuggestions,
      metadata: {
        totalSearched: this.vectorStore.size,
        retrievalTimeMs,
        usedTemporalContext: true,
        usedBehavioralSignals: behavioralSignals.length > 0,
      },
    };
  }

  /**
   * Apply boosting to results based on temporal and behavioral signals
   */
  private applyContextBoosting(
    results: ContextEntry[],
    temporalContext: TemporalContext,
    behavioralSignals: BehavioralSignal[]
  ): ContextEntry[] {
    // Create a map of topic boosts from behavioral signals
    const topicBoosts: Record<string, number> = {};
    for (const signal of behavioralSignals) {
      if (signal.type === 'frequent_topic') {
        topicBoosts[signal.value] = 1 + signal.confidence * 0.5;
      }
    }

    return results.map(entry => {
      let boostedScore = entry.score || 0;

      // Boost by recency
      const ageMs = Date.now() - entry.createdAt.getTime();
      const ageHours = ageMs / (1000 * 60 * 60);
      if (ageHours < 24) {
        boostedScore *= 1.2; // 20% boost for content from last 24 hours
      } else if (ageHours < 168) { // 1 week
        boostedScore *= 1.1; // 10% boost for content from last week
      }

      // Boost by topic relevance
      const topics = (entry.metadata?.topics as string[]) || [];
      for (const topic of topics) {
        if (topicBoosts[topic]) {
          boostedScore *= topicBoosts[topic];
        }
      }

      // Boost user preferences
      if (entry.category === 'user_preference') {
        boostedScore *= 1.3;
      }

      return { ...entry, score: boostedScore };
    }).sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /**
   * Aggregate retrieved context into a prompt-ready format
   */
  private aggregateContext(
    entries: ContextEntry[],
    temporalContext: TemporalContext,
    goals: UserGoal[]
  ): string {
    const sections: string[] = [];

    // Add temporal context
    sections.push(
      `Current Context: It is ${temporalContext.timeOfDay} on ${temporalContext.dayOfWeek}${temporalContext.isWeekend ? ' (weekend)' : ''}.`
    );

    // Add user goals if any
    const activeGoals = goals.filter(g => g.isActive);
    if (activeGoals.length > 0) {
      const goalsList = activeGoals
        .slice(0, 3)
        .map(g => `- ${g.description} (${g.priority} priority)`)
        .join('\n');
      sections.push(`User's Active Goals:\n${goalsList}`);
    }

    // Add relevant context from vector search
    if (entries.length > 0) {
      const contextList = entries
        .slice(0, 5)
        .map((entry, i) => `${i + 1}. [${entry.category}] ${entry.content.slice(0, 200)}${entry.content.length > 200 ? '...' : ''}`)
        .join('\n');
      sections.push(`Relevant Context:\n${contextList}`);
    }

    return sections.join('\n\n');
  }

  /**
   * Get proactive suggestions without a specific query
   */
  getProactiveSuggestions(
    userId?: string,
    temporalContext?: TemporalContext
  ): ProactiveSuggestion[] {
    if (!this.config.enableProactiveSuggestions) {
      return [];
    }

    const context = temporalContext || getTemporalContext();

    // Update behavioral signals if we have a user ID
    if (userId) {
      this.updateBehavioralSignals(userId);
    }

    return generateProactiveSuggestions(
      context,
      this.behavioralSignals,
      this.userGoals
    );
  }

  /**
   * Get suggested actions based on context
   */
  getSuggestedActions(
    userId?: string,
    currentContext?: string
  ): Array<{ label: string; action: string; reason: string }> {
    const suggestions: Array<{ label: string; action: string; reason: string }> = [];
    const temporalContext = getTemporalContext();

    // Time-based suggestions
    if (temporalContext.timeOfDay === 'morning') {
      suggestions.push({
        label: 'Plan My Day',
        action: 'Help me plan my day and set priorities',
        reason: 'Morning is a great time for planning',
      });
    }

    if (temporalContext.timeOfDay === 'evening') {
      suggestions.push({
        label: 'Daily Review',
        action: 'Let\'s review what I accomplished today',
        reason: 'Evening is a good time for reflection',
      });
    }

    // Behavioral-based suggestions
    for (const signal of this.behavioralSignals.slice(0, 2)) {
      if (signal.type === 'frequent_topic' && signal.confidence > 0.5) {
        suggestions.push({
          label: `${signal.value.charAt(0).toUpperCase() + signal.value.slice(1)} Tips`,
          action: `Give me some tips about ${signal.value}`,
          reason: `You often ask about ${signal.value}`,
        });
      }
    }

    // Goal-based suggestions
    for (const goal of this.userGoals.slice(0, 2)) {
      if (goal.isActive && goal.priority !== 'low') {
        suggestions.push({
          label: 'Goal Progress',
          action: `Help me make progress on: ${goal.description}`,
          reason: 'This is one of your active goals',
        });
      }
    }

    // Current context suggestions if provided
    if (currentContext) {
      const topics = extractTopics(currentContext);
      for (const topic of topics.slice(0, 1)) {
        suggestions.push({
          label: `More on ${topic}`,
          action: `Tell me more about ${topic}`,
          reason: 'Related to your current conversation',
        });
      }
    }

    return suggestions.slice(0, 4); // Return max 4 suggestions
  }

  /**
   * Clear all stored data (useful for testing or reset)
   */
  reset(): void {
    this.interactionHistory = [];
    this.behavioralSignals = [];
    this.userGoals = [];
    this.vectorStore.clear();
  }

  /**
   * Export engine state for persistence
   */
  exportState(): {
    contextEntries: ContextEntry[];
    interactionHistory: InteractionHistoryEntry[];
    behavioralSignals: BehavioralSignal[];
    userGoals: UserGoal[];
  } {
    return {
      contextEntries: this.vectorStore.export(),
      interactionHistory: this.interactionHistory,
      behavioralSignals: this.behavioralSignals,
      userGoals: this.userGoals,
    };
  }

  /**
   * Import engine state from persistence
   */
  importState(state: {
    contextEntries?: ContextEntry[];
    interactionHistory?: InteractionHistoryEntry[];
    behavioralSignals?: BehavioralSignal[];
    userGoals?: UserGoal[];
  }): void {
    if (state.contextEntries) {
      this.vectorStore.import(state.contextEntries);
    }
    if (state.interactionHistory) {
      this.interactionHistory = state.interactionHistory;
    }
    if (state.behavioralSignals) {
      this.behavioralSignals = state.behavioralSignals;
    }
    if (state.userGoals) {
      this.userGoals = state.userGoals;
    }
  }
}

/**
 * Singleton instance of the CPE
 */
let cpeInstance: ContextPulseEngine | null = null;

/**
 * Get the global CPE instance
 */
export function getCPE(config?: Partial<CPEConfig>): ContextPulseEngine {
  if (!cpeInstance) {
    cpeInstance = new ContextPulseEngine(config);

    // Initialize with default knowledge base
    cpeInstance.initialize([
      {
        content: 'For senior users, provide clear and simple explanations. Avoid jargon and use friendly, patient language.',
        category: 'knowledge',
        metadata: { topic: 'accessibility' },
      },
      {
        content: 'When suggesting activities, consider physical limitations and provide alternatives when appropriate.',
        category: 'knowledge',
        metadata: { topic: 'accessibility' },
      },
      {
        content: 'Morning is a good time for planning and setting daily goals.',
        category: 'temporal',
        metadata: { timeOfDay: 'morning' },
      },
      {
        content: 'Evening is suitable for reflection, relaxation activities, and reviewing accomplishments.',
        category: 'temporal',
        metadata: { timeOfDay: 'evening' },
      },
      {
        content: 'Weekends are great for leisure activities, hobbies, and social connections.',
        category: 'temporal',
        metadata: { dayType: 'weekend' },
      },
    ]);
  }
  return cpeInstance;
}

/**
 * Reset the global CPE instance (useful for testing)
 */
export function resetCPE(): void {
  if (cpeInstance) {
    cpeInstance.reset();
  }
  cpeInstance = null;
}

// Re-export types and utilities
export {
  getTemporalContext,
  extractTopics,
  detectSentiment,
  generateProactiveSuggestions,
} from './signals';

export type {
  ContextEntry,
  ContextRetrievalParams,
  RetrievedContext,
  ProactiveSuggestion,
  InteractionHistoryEntry,
  UserGoal,
  BehavioralSignal,
  TemporalContext,
  CPEConfig,
} from './types';

export { DEFAULT_CPE_CONFIG } from './types';
