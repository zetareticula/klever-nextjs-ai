/**
 * Tests for the ContextPulse Engine
 */

import {
  type ContextPulseEngine,
  createContextPulseEngine,
  DEFAULT_CONFIG,
  getTimeOfDay,
} from '../index';

describe('ContextPulseEngine', () => {
  let engine: ContextPulseEngine;

  beforeEach(() => {
    engine = createContextPulseEngine();
  });

  describe('initialization', () => {
    it('should create an engine with default config', () => {
      const config = engine.getConfig();
      expect(config.enabled).toBe(DEFAULT_CONFIG.enabled);
      expect(config.maxMessagesPerSession).toBe(DEFAULT_CONFIG.maxMessagesPerSession);
      expect(config.minIntervalMs).toBe(DEFAULT_CONFIG.minIntervalMs);
    });

    it('should accept custom config', () => {
      const customEngine = createContextPulseEngine({
        enabled: false,
        maxMessagesPerSession: 5,
      });
      const config = customEngine.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.maxMessagesPerSession).toBe(5);
    });

    it('should initialize with user context', () => {
      engine.initialize({
        userId: 'test-user',
        isFirstVisit: true,
        previousSessionCount: 0,
      });
      const state = engine.getState();
      expect(state.currentContext).not.toBeNull();
      expect(state.currentContext?.userId).toBe('test-user');
      expect(state.currentContext?.isFirstVisit).toBe(true);
    });
  });

  describe('trigger evaluation', () => {
    it('should return no message when engine is disabled', () => {
      engine.initialize({ isFirstVisit: true });
      engine.disable();
      const message = engine.getProactiveMessage();
      expect(message).toBeNull();
    });

    it('should return no message when context is not initialized', () => {
      const message = engine.getProactiveMessage();
      expect(message).toBeNull();
    });

    it('should generate a welcome message for first-time visitors', () => {
      engine.initialize({ isFirstVisit: true });
      const message = engine.getProactiveMessage();
      expect(message).not.toBeNull();
      expect(message?.type).toBe('greeting');
      expect(message?.triggerId).toBe('new-user-welcome');
    });

    it('should respect max messages per session', () => {
      const limitedEngine = createContextPulseEngine({
        maxMessagesPerSession: 1,
        minIntervalMs: 0, // Disable min interval for testing
      });
      limitedEngine.initialize({ isFirstVisit: true });

      // First message should work
      const message1 = limitedEngine.getProactiveMessage();
      expect(message1).not.toBeNull();
      if (message1) {
        limitedEngine.markMessageShown(message1);
      }

      // Second message should be null due to limit
      const message2 = limitedEngine.getProactiveMessage();
      expect(message2).toBeNull();
    });
  });

  describe('trigger management', () => {
    it('should add custom triggers', () => {
      const customTrigger = {
        id: 'custom-trigger',
        name: 'Custom Trigger',
        description: 'A custom test trigger',
        priority: 'high' as const,
        condition: () => true,
        action: {
          type: 'message' as const,
          content: 'Custom message',
        },
        enabled: true,
      };

      engine.addTrigger(customTrigger);
      engine.initialize({ isFirstVisit: false });

      // The custom trigger should match
      const result = engine.evaluateTriggers();
      expect(result.matched).toBe(true);
      expect(result.matchedTriggers.some((t) => t.id === 'custom-trigger')).toBe(true);
    });

    it('should remove triggers by ID', () => {
      engine.initialize({ isFirstVisit: true });
      const removed = engine.removeTrigger('new-user-welcome');
      expect(removed).toBe(true);

      // The welcome trigger should no longer match
      const message = engine.getProactiveMessage();
      expect(message?.triggerId).not.toBe('new-user-welcome');
    });

    it('should enable/disable triggers', () => {
      engine.initialize({ isFirstVisit: true });
      engine.setTriggerEnabled('new-user-welcome', false);

      const message = engine.getProactiveMessage();
      expect(message?.triggerId).not.toBe('new-user-welcome');
    });
  });

  describe('context updates', () => {
    it('should update context', () => {
      engine.initialize({ isFirstVisit: true });
      engine.updateContext({ userId: 'updated-user' });
      
      const state = engine.getState();
      expect(state.currentContext?.userId).toBe('updated-user');
    });

    it('should record interactions', () => {
      engine.initialize({ isFirstVisit: true });
      engine.recordInteraction();
      
      const state = engine.getState();
      expect(state.currentContext?.activityState).toBe('active');
      expect(state.currentContext?.lastInteractionTime).toBeDefined();
    });

    it('should mark user as idle', () => {
      engine.initialize({ isFirstVisit: true });
      engine.markIdle();
      
      const state = engine.getState();
      expect(state.currentContext?.activityState).toBe('idle');
    });
  });

  describe('state management', () => {
    it('should reset state', () => {
      engine.initialize({ isFirstVisit: true });
      const message = engine.getProactiveMessage();
      if (message) {
        engine.markMessageShown(message);
      }

      engine.reset();
      const state = engine.getState();
      expect(state.currentContext).toBeNull();
      expect(state.shownMessageIds).toHaveLength(0);
      expect(state.messageCount).toBe(0);
    });

    it('should enable/disable the engine', () => {
      engine.disable();
      expect(engine.getState().isActive).toBe(false);

      engine.enable();
      expect(engine.getState().isActive).toBe(true);
    });
  });
});

describe('getTimeOfDay', () => {
  it('should return morning for hours 5-11', () => {
    expect(getTimeOfDay(5)).toBe('morning');
    expect(getTimeOfDay(8)).toBe('morning');
    expect(getTimeOfDay(11)).toBe('morning');
  });

  it('should return afternoon for hours 12-16', () => {
    expect(getTimeOfDay(12)).toBe('afternoon');
    expect(getTimeOfDay(14)).toBe('afternoon');
    expect(getTimeOfDay(16)).toBe('afternoon');
  });

  it('should return evening for hours 17-20', () => {
    expect(getTimeOfDay(17)).toBe('evening');
    expect(getTimeOfDay(19)).toBe('evening');
    expect(getTimeOfDay(20)).toBe('evening');
  });

  it('should return night for hours 21-4', () => {
    expect(getTimeOfDay(21)).toBe('night');
    expect(getTimeOfDay(0)).toBe('night');
    expect(getTimeOfDay(3)).toBe('night');
    expect(getTimeOfDay(4)).toBe('night');
  });
});
