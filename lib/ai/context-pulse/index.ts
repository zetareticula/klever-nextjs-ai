/**
 * ContextPulse Engine (CPE) Module
 * 
 * The ContextPulse Engine proactively initiates chatbot conversations
 * based on user context, time, activity patterns, and other signals.
 * 
 * @module context-pulse
 */

// Export types
export type {
  ContextPulseConfig,
  ContextPulseState,
  ProactiveMessage,
  TimeOfDay,
  Trigger,
  TriggerAction,
  TriggerEvaluationResult,
  TriggerPriority,
  UserActivityState,
  UserContext,
} from './types';

// Export engine
export {
  ContextPulseEngine,
  createContextPulseEngine,
  DEFAULT_CONFIG,
} from './engine';

// Export triggers
export {
  conversationStarters,
  createDefaultTriggers,
  getTimeBasedGreeting,
  getTimeOfDay,
  greetingsByTimeOfDay,
  idleUserMessages,
  newUserMessages,
  returningUserMessages,
} from './triggers';
