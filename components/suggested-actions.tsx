'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import type { ChatRequestOptions, CreateMessage, Message } from 'ai';
import { memo, useMemo } from 'react';
import Image from 'next/image';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';

// Interface for CPE-provided suggested actions
interface CPESuggestedAction {
  label: string;
  action: string;
  reason: string;
}

// Interface for CPE API response
interface CPEResponse {
  success: boolean;
  suggestedActions?: CPESuggestedAction[];
}

// This component is used to display suggested actions for the user to take
// Now enhanced with CPE (ContextPulse Engine) for context-aware suggestions
interface SuggestedActionsProps {
  chatId: string;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
}

// Default suggested actions as fallback
const defaultSuggestedActions = [
  {
    imageSrc: '/icons/image.png',
    label: 'Genie',
    action:
      'Render Fun activities for seniors in San Francisco with links and images',
  },
  {
    imageSrc: '/icons/owl.png',
    label: 'Neurogoo',
    action: 'Suggest a Neurocognitive task for seniors',
  },
  {
    imageSrc: '/icons/paperclip.png',
    label: 'Trove',
    action:
      'Kindly and in a sophisticated manner implement a form of reminder using inference level LLM?',
  },
  {
    imageSrc: '/icons/spiral.png',
    label: 'Tutorial?',
    action:
      'Write a five step manual introducing chatbots to an accessibility first crowd, focus on simplicity and clarity; be folksy and friendly at the same time.?',
  },
];

// PureSuggestedActions is a memoized component that displays suggested actions
// Enhanced with CPE integration for personalized suggestions
function PureSuggestedActions({ chatId, append }: SuggestedActionsProps) {
  // Fetch CPE suggestions
  const { data: cpeData } = useSWR<CPEResponse>('/api/cpe', fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  // Merge CPE suggestions with defaults, preferring CPE suggestions when available
  const suggestedActions = useMemo(() => {
    if (cpeData?.success && cpeData.suggestedActions?.length) {
      // Map CPE suggestions to the expected format
      const cpeSuggestions = cpeData.suggestedActions.slice(0, 4).map((s, i) => ({
        imageSrc: defaultSuggestedActions[i]?.imageSrc || '/icons/spiral.png',
        label: s.label,
        action: s.action,
        reason: s.reason,
      }));

      // Fill remaining slots with defaults if needed
      const remaining = 4 - cpeSuggestions.length;
      if (remaining > 0) {
        return [
          ...cpeSuggestions,
          ...defaultSuggestedActions.slice(0, remaining),
        ];
      }
      return cpeSuggestions;
    }
    return defaultSuggestedActions;
  }, [cpeData]);

  return (
    <div
      data-testid="suggested-actions"
      className="grid sm:grid-cols-2 gap-2 w-full"
    >
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${suggestedAction.label}-${index}`}
          className={index > 1 ? 'hidden sm:block' : 'block'}
        >
          <Button
            variant="ghost"
            onClick={async () => {
              window.history.replaceState({}, '', `/chat/${chatId}`);

              append({
                role: 'user',
                content: suggestedAction.action,
              });
            }}
            className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start"
            title={
              'reason' in suggestedAction
                ? (suggestedAction as { reason: string }).reason
                : undefined
            }
          >
            <span className="font-medium">
              {suggestedAction.imageSrc && (
                <Image
                  src={suggestedAction.imageSrc}
                  alt="icon"
                  width={40}
                  height={50}
                  className="mb-1"
                />
              )}
            </span>
            <span className="text-muted-foreground">
              {suggestedAction.label}
            </span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(PureSuggestedActions, () => true);
