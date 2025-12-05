/**
 * Temporal Trigger Service for the ContextPulse Engine
 * Manages time-based and contextual triggers for proactive conversation initiation
 */

import type {
  TemporalTrigger,
  ContextualTrigger,
  ProactiveSuggestion,
  ProactiveTriggerConfig,
  SearchResult,
} from './types';
import { type FAISSService, getDefaultFAISSService } from './faiss-service';
import { generateUUID } from '@/lib/utils';

// Default configuration for proactive triggers
const DEFAULT_TRIGGER_CONFIG: ProactiveTriggerConfig = {
  enabled: true,
  checkIntervalMs: 60000, // Check every minute
  temporalTriggers: [],
  contextualTriggers: [],
};

/**
 * TemporalTriggerService class - Manages proactive conversation triggers
 */
export class TemporalTriggerService {
  private config: ProactiveTriggerConfig;
  private temporalTriggers: Map<string, TemporalTrigger> = new Map();
  private contextualTriggers: Map<string, ContextualTrigger> = new Map();
  private faissService: FAISSService;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    config: Partial<ProactiveTriggerConfig> = {},
    faissService?: FAISSService
  ) {
    this.config = { ...DEFAULT_TRIGGER_CONFIG, ...config };
    this.faissService = faissService || getDefaultFAISSService();

    // Initialize triggers from config
    for (const trigger of this.config.temporalTriggers) {
      this.temporalTriggers.set(trigger.id, trigger);
    }
    for (const trigger of this.config.contextualTriggers) {
      this.contextualTriggers.set(trigger.id, trigger);
    }
  }

  /**
   * Add a temporal trigger for scheduled proactive conversations
   * @param trigger - The temporal trigger to add
   * @returns string - The trigger ID
   */
  addTemporalTrigger(trigger: Omit<TemporalTrigger, 'id'>): string {
    const id = generateUUID();
    const fullTrigger: TemporalTrigger = { ...trigger, id };
    this.temporalTriggers.set(id, fullTrigger);
    return id;
  }

  /**
   * Add a contextual trigger for context-based proactive conversations
   * @param trigger - The contextual trigger to add
   * @returns string - The trigger ID
   */
  addContextualTrigger(trigger: Omit<ContextualTrigger, 'id'>): string {
    const id = generateUUID();
    const fullTrigger: ContextualTrigger = { ...trigger, id };
    this.contextualTriggers.set(id, fullTrigger);
    return id;
  }

  /**
   * Remove a temporal trigger
   * @param id - The trigger ID to remove
   * @returns boolean - Whether the trigger was removed
   */
  removeTemporalTrigger(id: string): boolean {
    return this.temporalTriggers.delete(id);
  }

  /**
   * Remove a contextual trigger
   * @param id - The trigger ID to remove
   * @returns boolean - Whether the trigger was removed
   */
  removeContextualTrigger(id: string): boolean {
    return this.contextualTriggers.delete(id);
  }

  /**
   * Enable or disable a temporal trigger
   * @param id - The trigger ID
   * @param enabled - Whether to enable the trigger
   * @returns boolean - Whether the update was successful
   */
  setTemporalTriggerEnabled(id: string, enabled: boolean): boolean {
    const trigger = this.temporalTriggers.get(id);
    if (!trigger) return false;
    trigger.enabled = enabled;
    return true;
  }

  /**
   * Enable or disable a contextual trigger
   * @param id - The trigger ID
   * @param enabled - Whether to enable the trigger
   * @returns boolean - Whether the update was successful
   */
  setContextualTriggerEnabled(id: string, enabled: boolean): boolean {
    const trigger = this.contextualTriggers.get(id);
    if (!trigger) return false;
    trigger.enabled = enabled;
    return true;
  }

  /**
   * Check all temporal triggers and return any that should fire now
   * @returns TemporalTrigger[] - Array of triggers that should fire
   */
  checkTemporalTriggers(): TemporalTrigger[] {
    const now = new Date();
    const activeTriggers: TemporalTrigger[] = [];

    const triggersArray = Array.from(this.temporalTriggers.values());
    for (const trigger of triggersArray) {
      if (!trigger.enabled) continue;

      if (trigger.type === 'scheduled' && trigger.schedule) {
        if (this.shouldTriggerFire(trigger.schedule, now)) {
          activeTriggers.push(trigger);
        }
      }
    }

    return activeTriggers;
  }

  /**
   * Check contextual triggers against current context
   * @param userId - The user ID to check triggers for
   * @returns Promise<ProactiveSuggestion[]> - Array of proactive suggestions
   */
  async checkContextualTriggers(userId: string): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];

    const triggersArray = Array.from(this.contextualTriggers.values());
    for (const trigger of triggersArray) {
      if (!trigger.enabled || trigger.userId !== userId) continue;

      // Search for matching context
      const results = await this.faissService.search(trigger.contextQuery, {
        topK: 5,
        minScore: trigger.threshold,
        filters: { userId },
      });

      if (results.length > 0) {
        suggestions.push({
          triggerId: trigger.id,
          triggerType: 'contextual',
          userId,
          message: trigger.message,
          relevantContext: results,
          confidence: results[0].score,
          timestamp: new Date(),
        });
      }
    }

    return suggestions;
  }

  /**
   * Generate proactive suggestions based on user context and goals
   * @param userId - The user ID
   * @param currentContext - Optional current conversation context
   * @returns Promise<ProactiveSuggestion[]> - Array of proactive suggestions
   */
  async generateProactiveSuggestions(
    userId: string,
    currentContext?: string
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];

    // Check temporal triggers
    const temporalTriggers = this.checkTemporalTriggers();
    for (const trigger of temporalTriggers) {
      if (trigger.userId !== userId) continue;

      // Get relevant context for the trigger
      const relevantContext = await this.faissService.search(trigger.message, {
        topK: 3,
        filters: { userId },
      });

      suggestions.push({
        triggerId: trigger.id,
        triggerType: 'temporal',
        userId,
        message: trigger.message,
        relevantContext,
        confidence: 1.0, // Temporal triggers are always confident
        timestamp: new Date(),
      });
    }

    // Check contextual triggers
    const contextualSuggestions = await this.checkContextualTriggers(userId);
    suggestions.push(...contextualSuggestions);

    // If current context is provided, find related suggestions
    if (currentContext) {
      const contextResults = await this.faissService.search(currentContext, {
        topK: 3,
        filters: { userId },
        minScore: 0.7,
      });

      if (contextResults.length > 0) {
        suggestions.push({
          triggerId: 'context-based',
          triggerType: 'contextual',
          userId,
          message: this.generateContextualMessage(contextResults),
          relevantContext: contextResults,
          confidence: contextResults[0].score,
          timestamp: new Date(),
        });
      }
    }

    return suggestions;
  }

  /**
   * Check if a temporal marker should trigger at the given time
   * @param marker - The temporal marker configuration
   * @param now - The current time
   * @returns boolean - Whether the trigger should fire
   */
  private shouldTriggerFire(
    marker: TemporalTrigger['schedule'],
    now: Date
  ): boolean {
    if (!marker) return false;

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDayOfWeek = now.getDay();
    const currentDayOfMonth = now.getDate();

    switch (marker.type) {
      case 'daily':
        if (marker.time) {
          const [hour, minute] = marker.time.split(':').map(Number);
          // Allow a 1-minute window for the trigger
          return currentHour === hour && currentMinute === minute;
        }
        return false;

      case 'weekly':
        if (marker.dayOfWeek !== undefined && marker.time) {
          if (currentDayOfWeek !== marker.dayOfWeek) return false;
          const [hour, minute] = marker.time.split(':').map(Number);
          return currentHour === hour && currentMinute === minute;
        }
        return false;

      case 'monthly':
        if (marker.dayOfMonth !== undefined && marker.time) {
          if (currentDayOfMonth !== marker.dayOfMonth) return false;
          const [hour, minute] = marker.time.split(':').map(Number);
          return currentHour === hour && currentMinute === minute;
        }
        return false;

      case 'event_based':
        // Event-based triggers are handled separately
        return false;

      default:
        return false;
    }
  }

  /**
   * Generate a contextual message based on search results
   * @param results - The search results
   * @returns string - A generated message
   */
  private generateContextualMessage(results: SearchResult[]): string {
    if (results.length === 0) {
      return 'I noticed something that might be relevant to our previous conversations.';
    }

    const topResult = results[0];
    const category = topResult.entry.metadata.category;

    switch (category) {
      case 'goal':
        return 'I wanted to check in on your progress with your goals.';
      case 'user_preference':
        return 'Based on your preferences, I have a suggestion for you.';
      case 'interaction_history':
        return 'Following up on something we discussed earlier.';
      case 'temporal_pattern':
        return 'This seems like a good time to discuss something.';
      default:
        return 'I have some relevant information that might interest you.';
    }
  }

  /**
   * Get all temporal triggers for a user
   * @param userId - The user ID
   * @returns TemporalTrigger[] - Array of temporal triggers
   */
  getTemporalTriggersForUser(userId: string): TemporalTrigger[] {
    return Array.from(this.temporalTriggers.values()).filter(
      (t) => t.userId === userId
    );
  }

  /**
   * Get all contextual triggers for a user
   * @param userId - The user ID
   * @returns ContextualTrigger[] - Array of contextual triggers
   */
  getContextualTriggersForUser(userId: string): ContextualTrigger[] {
    return Array.from(this.contextualTriggers.values()).filter(
      (t) => t.userId === userId
    );
  }

  /**
   * Start the automatic trigger checking loop
   */
  startTriggerLoop(): void {
    if (this.checkInterval) {
      return; // Already running
    }

    this.checkInterval = setInterval(() => {
      this.checkTemporalTriggers();
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop the automatic trigger checking loop
   */
  stopTriggerLoop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

// Singleton instance
let defaultInstance: TemporalTriggerService | null = null;

/**
 * Get the default temporal trigger service instance
 * @returns TemporalTriggerService
 */
export function getDefaultTemporalTriggerService(): TemporalTriggerService {
  if (!defaultInstance) {
    defaultInstance = new TemporalTriggerService();
  }
  return defaultInstance;
}

/**
 * Create a new temporal trigger service instance
 * @param config - Custom configuration
 * @param faissService - Optional FAISS service instance
 * @returns TemporalTriggerService
 */
export function createTemporalTriggerService(
  config?: Partial<ProactiveTriggerConfig>,
  faissService?: FAISSService
): TemporalTriggerService {
  return new TemporalTriggerService(config, faissService);
}
