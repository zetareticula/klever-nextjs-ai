'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { memo } from 'react';
import { X } from 'lucide-react';
import type { ProactiveMessage } from '@/lib/ai/context-pulse';
import { Button } from './ui/button';

interface ProactiveMessageProps {
  /** The proactive message to display */
  message: ProactiveMessage | null;
  /** Callback when the message is dismissed */
  onDismiss: () => void;
  /** Callback when a suggested response is clicked */
  onSuggestedResponse?: (response: string) => void;
}

/**
 * Component to display proactive messages from the ContextPulse Engine
 */
function PureProactiveMessage({
  message,
  onDismiss,
  onSuggestedResponse,
}: ProactiveMessageProps) {
  if (!message) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative mx-auto mb-4 max-w-2xl rounded-xl border bg-card p-4 shadow-lg"
        data-testid="proactive-message"
      >
        {/* Dismiss button */}
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Dismiss message"
        >
          <X className="size-4" />
        </button>

        {/* Message type indicator */}
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {getMessageTypeLabel(message.type)}
          </span>
          {message.priority === 'high' || message.priority === 'urgent' ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {message.priority === 'urgent' ? 'Important' : 'New'}
            </span>
          ) : null}
        </div>

        {/* Message content */}
        <p className="pr-6 text-sm leading-relaxed text-foreground">
          {message.content}
        </p>

        {/* Suggested responses */}
        {message.suggestedResponses && message.suggestedResponses.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.suggestedResponses.map((response) => (
              <Button
                key={response}
                variant="outline"
                size="sm"
                onClick={() => onSuggestedResponse?.(response)}
                className="text-xs"
              >
                {response.length > 40 ? `${response.slice(0, 40)}...` : response}
              </Button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Gets a human-readable label for the message type
 */
function getMessageTypeLabel(
  type: 'greeting' | 'suggestion' | 'reminder' | 'prompt'
): string {
  switch (type) {
    case 'greeting':
      return '👋 Hello';
    case 'suggestion':
      return '💡 Suggestion';
    case 'reminder':
      return '⏰ Reminder';
    case 'prompt':
      return '💬 Tip';
    default:
      return 'Message';
  }
}

export const ProactiveMessageDisplay = memo(PureProactiveMessage);
