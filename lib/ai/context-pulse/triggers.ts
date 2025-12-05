/**
 * ContextPulse Engine Triggers
 * Predefined triggers for proactive conversation initiation
 */

import type { Trigger, TimeOfDay, UserContext } from './types';

/**
 * Determines the current time of day based on the hour
 */
export function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Default greeting messages based on time of day
 */
export const greetingsByTimeOfDay: Record<TimeOfDay, string[]> = {
  morning: [
    'Good morning! How can I help you start your day?',
    'Rise and shine! Ready to tackle anything today?',
    'Morning! What would you like to explore today?',
  ],
  afternoon: [
    'Good afternoon! How can I assist you?',
    'Hope your day is going well! Need any help?',
    'Afternoon! What can I help you with?',
  ],
  evening: [
    'Good evening! How can I help you wind down?',
    'Evening! Anything I can assist with before the day ends?',
    'Hope you had a great day! Need any help?',
  ],
  night: [
    'Burning the midnight oil? How can I help?',
    'Late night session? I\'m here to assist!',
    'Still awake? Let me know if you need anything!',
  ],
};

/**
 * Welcome messages for new users
 */
export const newUserMessages = [
  'Welcome! I\'m your AI assistant. Feel free to ask me anything!',
  'Hello and welcome! I\'m here to help you with any questions.',
  'Hi there! This is your first visit - let me know how I can help!',
];

/**
 * Messages for returning users
 */
export const returningUserMessages = [
  'Welcome back! Great to see you again.',
  'Good to have you back! How can I help today?',
  'Hey, welcome back! Ready to continue where we left off?',
];

/**
 * Messages for idle users
 */
export const idleUserMessages = [
  'Still there? Let me know if you need any help!',
  'I\'m here whenever you\'re ready to chat.',
  'Take your time - I\'ll be here when you need me!',
];

/**
 * Suggested conversation starters
 */
export const conversationStarters = [
  'What are the advantages of using Next.js?',
  'Help me write a professional email',
  'Explain a complex topic in simple terms',
  'Generate creative ideas for a project',
];

/**
 * Creates the default set of triggers for the ContextPulse Engine
 */
export function createDefaultTriggers(): Trigger[] {
  return [
    // New user welcome trigger
    {
      id: 'new-user-welcome',
      name: 'New User Welcome',
      description: 'Welcomes first-time visitors',
      priority: 'high',
      condition: (context: UserContext) => context.isFirstVisit,
      action: {
        type: 'message',
        content: newUserMessages[Math.floor(Math.random() * newUserMessages.length)],
      },
      cooldownMs: 0, // Only fires once per session
      enabled: true,
    },

    // Returning user greeting trigger
    {
      id: 'returning-user-greeting',
      name: 'Returning User Greeting',
      description: 'Greets users who have visited before',
      priority: 'medium',
      condition: (context: UserContext) =>
        !context.isFirstVisit &&
        context.activityState === 'returning' &&
        context.previousSessionCount > 0,
      action: {
        type: 'message',
        content: returningUserMessages[Math.floor(Math.random() * returningUserMessages.length)],
      },
      cooldownMs: 3600000, // 1 hour cooldown
      enabled: true,
    },

    // Time-based greeting trigger
    {
      id: 'time-based-greeting',
      name: 'Time-Based Greeting',
      description: 'Greets users based on time of day',
      priority: 'low',
      condition: (context: UserContext) =>
        !context.isFirstVisit && context.activityState === 'active',
      action: {
        type: 'message',
        content: '', // Will be filled dynamically based on time
        metadata: { dynamicGreeting: true },
      },
      cooldownMs: 7200000, // 2 hour cooldown
      enabled: true,
    },

    // Idle user prompt trigger
    {
      id: 'idle-user-prompt',
      name: 'Idle User Prompt',
      description: 'Prompts users who have been idle for a while',
      priority: 'low',
      condition: (context: UserContext) => {
        if (context.activityState !== 'idle' || !context.lastInteractionTime) {
          return false;
        }
        const idleTimeMs = Date.now() - context.lastInteractionTime.getTime();
        return idleTimeMs > 120000; // 2 minutes of idle time
      },
      action: {
        type: 'suggestion',
        content: idleUserMessages[Math.floor(Math.random() * idleUserMessages.length)],
      },
      cooldownMs: 300000, // 5 minute cooldown
      enabled: true,
    },

    // Conversation starter suggestion trigger
    {
      id: 'conversation-starter',
      name: 'Conversation Starter',
      description: 'Suggests conversation starters for new chats',
      priority: 'medium',
      condition: (context: UserContext) =>
        context.activityState === 'new' || context.previousSessionCount === 0,
      action: {
        type: 'suggestion',
        content: 'Here are some things you can ask me:',
        metadata: {
          suggestions: conversationStarters,
        },
      },
      cooldownMs: 1800000, // 30 minute cooldown
      enabled: true,
    },
  ];
}

/**
 * Gets a random greeting based on the current time of day
 */
export function getTimeBasedGreeting(timeOfDay: TimeOfDay): string {
  const greetings = greetingsByTimeOfDay[timeOfDay];
  return greetings[Math.floor(Math.random() * greetings.length)];
}
