/**
 * Temporal and Behavioral Signal Handlers
 *
 * Provides utilities for extracting temporal context and behavioral signals
 * from user interactions to enable proactive conversation initiation.
 */

import type {
  TemporalContext,
  BehavioralSignal,
  UserGoal,
  InteractionHistoryEntry,
  ProactiveSuggestion,
} from './types';
import { generateUUID } from '@/lib/utils';

/**
 * Get the current temporal context
 */
export function getTemporalContext(date: Date = new Date()): TemporalContext {
  const hours = date.getHours();
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
  const dayIndex = date.getDay();

  let timeOfDay: TemporalContext['timeOfDay'];
  if (hours >= 5 && hours < 12) {
    timeOfDay = 'morning';
  } else if (hours >= 12 && hours < 17) {
    timeOfDay = 'afternoon';
  } else if (hours >= 17 && hours < 21) {
    timeOfDay = 'evening';
  } else {
    timeOfDay = 'night';
  }

  return {
    timestamp: date,
    timeOfDay,
    dayOfWeek,
    isWeekend: dayIndex === 0 || dayIndex === 6,
    timezoneOffset: date.getTimezoneOffset(),
  };
}

/**
 * Common topic keywords for categorization
 */
const TOPIC_KEYWORDS: Record<string, string[]> = {
  health: ['health', 'exercise', 'workout', 'diet', 'sleep', 'medicine', 'doctor', 'wellness'],
  productivity: ['work', 'task', 'project', 'deadline', 'meeting', 'schedule', 'plan', 'goal'],
  learning: ['learn', 'study', 'course', 'tutorial', 'book', 'read', 'education', 'skill'],
  entertainment: ['movie', 'music', 'game', 'show', 'fun', 'hobby', 'play', 'watch'],
  social: ['friend', 'family', 'call', 'visit', 'party', 'event', 'birthday', 'gather'],
  finance: ['money', 'budget', 'save', 'invest', 'expense', 'bill', 'payment', 'bank'],
  travel: ['trip', 'travel', 'vacation', 'flight', 'hotel', 'destination', 'visit', 'explore'],
  cooking: ['cook', 'recipe', 'meal', 'food', 'dinner', 'lunch', 'breakfast', 'ingredient'],
};

/**
 * Extract topics from a message
 */
export function extractTopics(message: string): string[] {
  const lowerMessage = message.toLowerCase();
  const topics: string[] = [];

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      topics.push(topic);
    }
  }

  return topics;
}

/**
 * Detect sentiment from a message (simple rule-based)
 */
export function detectSentiment(message: string): 'positive' | 'neutral' | 'negative' {
  const lowerMessage = message.toLowerCase();

  const positiveWords = ['great', 'good', 'happy', 'love', 'excellent', 'amazing', 'wonderful', 'thanks', 'helpful'];
  const negativeWords = ['bad', 'sad', 'angry', 'frustrated', 'terrible', 'awful', 'hate', 'problem', 'issue', 'error'];

  let positiveScore = 0;
  let negativeScore = 0;

  for (const word of positiveWords) {
    if (lowerMessage.includes(word)) positiveScore++;
  }

  for (const word of negativeWords) {
    if (lowerMessage.includes(word)) negativeScore++;
  }

  if (positiveScore > negativeScore) return 'positive';
  if (negativeScore > positiveScore) return 'negative';
  return 'neutral';
}

/**
 * Analyze interaction history to extract behavioral signals
 */
export function analyzeBehavioralSignals(
  interactions: InteractionHistoryEntry[]
): BehavioralSignal[] {
  const signals: BehavioralSignal[] = [];

  if (interactions.length === 0) return signals;

  // Analyze topic frequency
  const topicCounts: Record<string, { count: number; lastSeen: Date }> = {};

  for (const interaction of interactions) {
    for (const topic of interaction.topics) {
      if (!topicCounts[topic]) {
        topicCounts[topic] = { count: 0, lastSeen: interaction.timestamp };
      }
      topicCounts[topic].count++;
      if (interaction.timestamp > topicCounts[topic].lastSeen) {
        topicCounts[topic].lastSeen = interaction.timestamp;
      }
    }
  }

  // Convert to signals with confidence based on frequency
  const totalInteractions = interactions.length;
  for (const [topic, data] of Object.entries(topicCounts)) {
    const frequency = data.count / totalInteractions;
    if (frequency > 0.1) { // At least 10% of interactions
      signals.push({
        type: 'frequent_topic',
        value: topic,
        confidence: Math.min(frequency * 2, 1), // Scale confidence
        lastObserved: data.lastSeen,
        frequency: data.count,
      });
    }
  }

  // Analyze time patterns
  const hourCounts: Record<number, number> = {};
  for (const interaction of interactions) {
    const hour = interaction.timestamp.getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }

  // Find peak hours
  const sortedHours = Object.entries(hourCounts)
    .map(([hour, count]) => ({ hour: Number.parseInt(hour, 10), count }))
    .sort((a, b) => b.count - a.count);

  if (sortedHours.length > 0 && sortedHours[0].count >= 3) {
    const peakHour = sortedHours[0].hour;
    let timeLabel: string;
    if (peakHour >= 5 && peakHour < 12) timeLabel = 'morning';
    else if (peakHour >= 12 && peakHour < 17) timeLabel = 'afternoon';
    else if (peakHour >= 17 && peakHour < 21) timeLabel = 'evening';
    else timeLabel = 'night';

    signals.push({
      type: 'time_pattern',
      value: `prefers_${timeLabel}_interactions`,
      confidence: sortedHours[0].count / totalInteractions,
      lastObserved: new Date(),
      frequency: sortedHours[0].count,
    });
  }

  return signals;
}

/**
 * Extract potential goals from interaction history
 */
export function extractGoals(
  interactions: InteractionHistoryEntry[]
): UserGoal[] {
  const goals: UserGoal[] = [];
  const goalPatterns = [
    { pattern: /i want to (.*?)(?:\.|,|$)/i, category: 'desire' },
    { pattern: /i need to (.*?)(?:\.|,|$)/i, category: 'need' },
    { pattern: /help me (.*?)(?:\.|,|$)/i, category: 'request' },
    { pattern: /i'm trying to (.*?)(?:\.|,|$)/i, category: 'effort' },
    { pattern: /my goal is to (.*?)(?:\.|,|$)/i, category: 'stated_goal' },
    { pattern: /remind me to (.*?)(?:\.|,|$)/i, category: 'reminder' },
  ];

  const extractedGoals: Map<string, { description: string; category: string; count: number; lastSeen: Date }> = new Map();

  for (const interaction of interactions) {
    for (const { pattern, category } of goalPatterns) {
      const match = interaction.userMessage.match(pattern);
      if (match?.[1]) {
        const description = match[1].trim();
        const key = description.toLowerCase();

        const existing = extractedGoals.get(key);
        if (existing) {
          existing.count++;
          if (interaction.timestamp > existing.lastSeen) {
            existing.lastSeen = interaction.timestamp;
          }
        } else {
          extractedGoals.set(key, {
            description,
            category,
            count: 1,
            lastSeen: interaction.timestamp,
          });
        }
      }
    }
  }

  // Convert to UserGoal format
  for (const [key, data] of Array.from(extractedGoals.entries())) {
    goals.push({
      id: generateUUID(),
      description: data.description,
      category: data.category,
      priority: data.count >= 3 ? 'high' : data.count >= 2 ? 'medium' : 'low',
      isActive: true,
      createdAt: data.lastSeen,
      progress: 0,
    });
  }

  return goals;
}

/**
 * Generate proactive suggestions based on context
 */
export function generateProactiveSuggestions(
  temporalContext: TemporalContext,
  behavioralSignals: BehavioralSignal[],
  goals: UserGoal[]
): ProactiveSuggestion[] {
  const suggestions: ProactiveSuggestion[] = [];

  // Time-based suggestions
  if (temporalContext.timeOfDay === 'morning') {
    suggestions.push({
      id: generateUUID(),
      message: "Good morning! Would you like to review your goals for today?",
      reason: "Morning is a great time to plan the day ahead",
      type: 'check_in',
      priority: 'medium',
      confidence: 0.7,
      relatedContextIds: [],
      triggerTime: temporalContext.timestamp,
    });
  }

  // Behavioral signal-based suggestions
  for (const signal of behavioralSignals) {
    if (signal.type === 'frequent_topic' && signal.confidence > 0.5) {
      suggestions.push({
        id: generateUUID(),
        message: `I noticed you're often interested in ${signal.value}. Would you like some recommendations or updates on this topic?`,
        reason: `High engagement with ${signal.value} topic detected`,
        type: 'recommendation',
        priority: signal.confidence > 0.7 ? 'high' : 'medium',
        confidence: signal.confidence,
        relatedContextIds: [],
      });
    }
  }

  // Goal-based suggestions
  for (const goal of goals) {
    if (goal.isActive && goal.priority === 'high') {
      suggestions.push({
        id: generateUUID(),
        message: `How is your progress on "${goal.description}"? Would you like some help or tips?`,
        reason: `Active high-priority goal detected`,
        type: 'goal_progress',
        priority: 'high',
        confidence: 0.8,
        relatedContextIds: [],
      });
    }
  }

  // Weekend-specific suggestions
  if (temporalContext.isWeekend) {
    const hasProductivityGoal = goals.some(g =>
      g.category === 'effort' || g.category === 'stated_goal'
    );

    if (!hasProductivityGoal) {
      suggestions.push({
        id: generateUUID(),
        message: "It's the weekend! Would you like suggestions for relaxing activities or hobbies?",
        reason: "Weekend detected with no urgent goals",
        type: 'recommendation',
        priority: 'low',
        confidence: 0.6,
        relatedContextIds: [],
      });
    }
  }

  // Sort by priority and confidence
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  suggestions.sort((a, b) => {
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.confidence - a.confidence;
  });

  return suggestions;
}
