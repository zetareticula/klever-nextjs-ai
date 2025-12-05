/**
 * useContextPulse Hook
 * React hook for integrating the ContextPulse Engine with chat components
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createContextPulseEngine,
  type ContextPulseConfig,
  type ProactiveMessage,
  type UserContext,
} from '@/lib/ai/context-pulse';

interface UseContextPulseOptions {
  /** Configuration for the ContextPulse Engine */
  config?: Partial<ContextPulseConfig>;
  /** Initial user context */
  initialContext?: Partial<UserContext>;
  /** Callback when a proactive message is generated */
  onMessage?: (message: ProactiveMessage) => void;
  /** Whether to auto-check for messages on a timer */
  autoCheck?: boolean;
  /** Interval for auto-checking in milliseconds */
  autoCheckIntervalMs?: number;
}

interface UseContextPulseReturn {
  /** The current proactive message, if any */
  message: ProactiveMessage | null;
  /** Whether the engine is active */
  isActive: boolean;
  /** Check for a proactive message */
  checkForMessage: () => ProactiveMessage | null;
  /** Dismiss the current message */
  dismissMessage: () => void;
  /** Record a user interaction */
  recordInteraction: () => void;
  /** Mark the user as idle */
  markIdle: () => void;
  /** Update the user context */
  updateContext: (updates: Partial<UserContext>) => void;
  /** Enable the engine */
  enable: () => void;
  /** Disable the engine */
  disable: () => void;
  /** Reset the engine state */
  reset: () => void;
}

/**
 * Custom hook for using the ContextPulse Engine in React components
 */
export function useContextPulse(
  options: UseContextPulseOptions = {}
): UseContextPulseReturn {
  const {
    config,
    initialContext,
    onMessage,
    autoCheck = false,
    autoCheckIntervalMs = 30000, // 30 seconds
  } = options;

  // Create the engine instance
  const engine = useMemo(
    () => createContextPulseEngine(config),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // State for the current message
  const [message, setMessage] = useState<ProactiveMessage | null>(null);
  const [isActive, setIsActive] = useState(engine.getState().isActive);

  // Ref for the message callback
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // Initialize the engine with context on mount
  useEffect(() => {
    // Determine if this is a first visit based on localStorage
    const visitKey = 'cpe-visited';
    const isFirstVisit = typeof window !== 'undefined' 
      ? !localStorage.getItem(visitKey) 
      : true;

    engine.initialize({
      isFirstVisit,
      activityState: 'new',
      previousSessionCount: 0,
      ...initialContext,
    });

    // Mark as visited
    if (typeof window !== 'undefined' && isFirstVisit) {
      localStorage.setItem(visitKey, 'true');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check for a proactive message
  const checkForMessage = useCallback((): ProactiveMessage | null => {
    const newMessage = engine.getProactiveMessage();

    if (newMessage) {
      engine.markMessageShown(newMessage);
      setMessage(newMessage);
      onMessageRef.current?.(newMessage);
    }

    return newMessage;
  }, [engine]);

  // Dismiss the current message
  const dismissMessage = useCallback(() => {
    setMessage(null);
  }, []);

  // Record a user interaction
  const recordInteraction = useCallback(() => {
    engine.recordInteraction();
    // Dismiss any current message on interaction
    setMessage(null);
  }, [engine]);

  // Mark the user as idle
  const markIdle = useCallback(() => {
    engine.markIdle();
  }, [engine]);

  // Update the user context
  const updateContext = useCallback(
    (updates: Partial<UserContext>) => {
      engine.updateContext(updates);
    },
    [engine]
  );

  // Enable the engine
  const enable = useCallback(() => {
    engine.enable();
    setIsActive(true);
  }, [engine]);

  // Disable the engine
  const disable = useCallback(() => {
    engine.disable();
    setIsActive(false);
    setMessage(null);
  }, [engine]);

  // Reset the engine
  const reset = useCallback(() => {
    engine.reset();
    setMessage(null);
    setIsActive(engine.getState().isActive);
  }, [engine]);

  // Auto-check for messages on an interval
  useEffect(() => {
    if (!autoCheck || !isActive) return;

    const interval = setInterval(() => {
      checkForMessage();
    }, autoCheckIntervalMs);

    return () => clearInterval(interval);
  }, [autoCheck, autoCheckIntervalMs, isActive, checkForMessage]);

  // Check for a message on initial render
  useEffect(() => {
    // Small delay to allow the page to settle
    const timeout = setTimeout(() => {
      checkForMessage();
    }, 500);

    return () => clearTimeout(timeout);
  }, [checkForMessage]);

  return {
    message,
    isActive,
    checkForMessage,
    dismissMessage,
    recordInteraction,
    markIdle,
    updateContext,
    enable,
    disable,
    reset,
  };
}
