/**
 * ContextPulse Engine
 * Core engine for proactively initiating chatbot conversations
 * 
 * The ContextPulse Engine (CPE) monitors user context and activity
 * to intelligently trigger proactive messages and conversation starters.
 */

import { generateUUID } from '@/lib/utils';
import type {
  ContextPulseConfig,
  ContextPulseState,
  ProactiveMessage,
  Trigger,
  TriggerEvaluationResult,
  TriggerPriority,
  UserContext,
} from './types';
import { createDefaultTriggers, getTimeBasedGreeting, getTimeOfDay } from './triggers';

/**
 * Priority weights for sorting triggers
 */
const PRIORITY_WEIGHTS: Record<TriggerPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Default configuration for the ContextPulse Engine
 */
export const DEFAULT_CONFIG: ContextPulseConfig = {
  enabled: true,
  maxMessagesPerSession: 3,
  minIntervalMs: 60000, // 1 minute
  useAIGeneration: false,
};

/**
 * ContextPulse Engine class
 * Manages proactive conversation initiation based on user context
 */
export class ContextPulseEngine {
  private config: ContextPulseConfig;
  private state: ContextPulseState;
  private triggers: Trigger[];
  private lastMessageTime: Date | null = null;

  constructor(config: Partial<ContextPulseConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      isActive: this.config.enabled,
      currentContext: null,
      shownMessageIds: [],
      triggerCooldowns: new Map(),
      messageCount: 0,
    };
    this.triggers = [
      ...createDefaultTriggers(),
      ...(this.config.customTriggers || []),
    ];
  }

  /**
   * Initializes the engine with user context
   */
  initialize(context: Partial<UserContext> = {}): void {
    const now = new Date();
    const hour = now.getHours();

    this.state.currentContext = {
      userId: context.userId,
      timeOfDay: getTimeOfDay(hour),
      activityState: context.activityState || 'new',
      lastInteractionTime: context.lastInteractionTime,
      previousSessionCount: context.previousSessionCount || 0,
      previousTopics: context.previousTopics,
      timezoneOffset: context.timezoneOffset ?? now.getTimezoneOffset(),
      isFirstVisit: context.isFirstVisit ?? true,
    };

    this.state.isActive = this.config.enabled;
  }

  /**
   * Updates the user context
   */
  updateContext(updates: Partial<UserContext>): void {
    if (!this.state.currentContext) {
      this.initialize(updates);
      return;
    }

    this.state.currentContext = {
      ...this.state.currentContext,
      ...updates,
    };
  }

  /**
   * Records a user interaction
   */
  recordInteraction(): void {
    if (this.state.currentContext) {
      this.state.currentContext.lastInteractionTime = new Date();
      this.state.currentContext.activityState = 'active';
    }
  }

  /**
   * Marks the user as idle
   */
  markIdle(): void {
    if (this.state.currentContext) {
      this.state.currentContext.activityState = 'idle';
    }
  }

  /**
   * Adds a custom trigger to the engine
   */
  addTrigger(trigger: Trigger): void {
    this.triggers.push(trigger);
  }

  /**
   * Removes a trigger by ID
   */
  removeTrigger(triggerId: string): boolean {
    const index = this.triggers.findIndex((t) => t.id === triggerId);
    if (index !== -1) {
      this.triggers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Enables or disables a trigger by ID
   */
  setTriggerEnabled(triggerId: string, enabled: boolean): boolean {
    const trigger = this.triggers.find((t) => t.id === triggerId);
    if (trigger) {
      trigger.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Checks if a trigger is on cooldown
   */
  private isOnCooldown(trigger: Trigger): boolean {
    if (!trigger.cooldownMs) return false;

    const lastFired = this.state.triggerCooldowns.get(trigger.id);
    if (!lastFired) return false;

    const elapsed = Date.now() - lastFired.getTime();
    return elapsed < trigger.cooldownMs;
  }

  /**
   * Checks if the minimum interval between messages has passed
   */
  private canShowMessage(): boolean {
    if (!this.lastMessageTime) return true;

    const elapsed = Date.now() - this.lastMessageTime.getTime();
    return elapsed >= this.config.minIntervalMs;
  }

  /**
   * Evaluates all triggers and returns matching ones
   */
  evaluateTriggers(): TriggerEvaluationResult {
    if (!this.state.isActive || !this.state.currentContext) {
      return { matched: false, matchedTriggers: [] };
    }

    // Check if we've exceeded the max messages per session
    if (this.state.messageCount >= this.config.maxMessagesPerSession) {
      return { matched: false, matchedTriggers: [] };
    }

    // Check minimum interval
    if (!this.canShowMessage()) {
      return { matched: false, matchedTriggers: [] };
    }

    const matchedTriggers: Trigger[] = [];

    for (const trigger of this.triggers) {
      // Skip disabled triggers
      if (!trigger.enabled) continue;

      // Skip triggers on cooldown
      if (this.isOnCooldown(trigger)) continue;

      // Evaluate the trigger condition
      try {
        if (trigger.condition(this.state.currentContext)) {
          matchedTriggers.push(trigger);
        }
      } catch {
        // Skip triggers that throw errors during evaluation
        console.warn(`Trigger ${trigger.id} threw an error during evaluation`);
      }
    }

    // Sort by priority (highest first)
    matchedTriggers.sort(
      (a, b) => PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
    );

    if (matchedTriggers.length === 0) {
      return { matched: false, matchedTriggers: [] };
    }

    // Generate a proactive message from the highest priority trigger
    const topTrigger = matchedTriggers[0];
    const message = this.generateMessage(topTrigger);

    return {
      matched: true,
      matchedTriggers,
      message,
    };
  }

  /**
   * Generates a proactive message from a trigger
   */
  private generateMessage(trigger: Trigger): ProactiveMessage {
    let content = trigger.action.content;

    // Handle dynamic greeting for time-based trigger
    if (
      trigger.action.metadata?.dynamicGreeting &&
      this.state.currentContext
    ) {
      content = getTimeBasedGreeting(this.state.currentContext.timeOfDay);
    }

    const message: ProactiveMessage = {
      id: generateUUID(),
      triggerId: trigger.id,
      content,
      priority: trigger.priority,
      generatedAt: new Date(),
      type: this.getMessageType(trigger),
      suggestedResponses: this.getSuggestedResponses(trigger),
    };

    return message;
  }

  /**
   * Determines the message type based on the trigger
   */
  private getMessageType(
    trigger: Trigger
  ): 'greeting' | 'suggestion' | 'reminder' | 'prompt' {
    if (
      trigger.id.includes('welcome') ||
      trigger.id.includes('greeting')
    ) {
      return 'greeting';
    }
    if (trigger.id.includes('reminder')) {
      return 'reminder';
    }
    if (trigger.action.type === 'suggestion') {
      return 'suggestion';
    }
    return 'prompt';
  }

  /**
   * Gets suggested responses from a trigger's metadata
   */
  private getSuggestedResponses(trigger: Trigger): string[] | undefined {
    if (trigger.action.metadata?.suggestions) {
      return trigger.action.metadata.suggestions as string[];
    }
    return undefined;
  }

  /**
   * Marks a message as shown and updates state
   */
  markMessageShown(message: ProactiveMessage): void {
    this.state.shownMessageIds.push(message.id);
    this.state.messageCount++;
    this.lastMessageTime = new Date();

    // Record the trigger cooldown
    this.state.triggerCooldowns.set(message.triggerId, new Date());
  }

  /**
   * Gets a proactive message if conditions are met
   */
  getProactiveMessage(): ProactiveMessage | null {
    const result = this.evaluateTriggers();

    if (!result.matched || !result.message) {
      return null;
    }

    return result.message;
  }

  /**
   * Gets the current state of the engine
   */
  getState(): ContextPulseState {
    return { ...this.state };
  }

  /**
   * Gets the current configuration
   */
  getConfig(): ContextPulseConfig {
    return { ...this.config };
  }

  /**
   * Updates the configuration
   */
  updateConfig(updates: Partial<ContextPulseConfig>): void {
    this.config = { ...this.config, ...updates };
    this.state.isActive = this.config.enabled;
  }

  /**
   * Enables the engine
   */
  enable(): void {
    this.config.enabled = true;
    this.state.isActive = true;
  }

  /**
   * Disables the engine
   */
  disable(): void {
    this.config.enabled = false;
    this.state.isActive = false;
  }

  /**
   * Resets the engine state
   */
  reset(): void {
    this.state = {
      isActive: this.config.enabled,
      currentContext: null,
      shownMessageIds: [],
      triggerCooldowns: new Map(),
      messageCount: 0,
    };
    this.lastMessageTime = null;
  }
}

/**
 * Creates a new ContextPulse Engine instance with the given configuration
 */
export function createContextPulseEngine(
  config: Partial<ContextPulseConfig> = {}
): ContextPulseEngine {
  return new ContextPulseEngine(config);
}
