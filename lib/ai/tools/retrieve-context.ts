import { z } from 'zod';
import { tool } from 'ai';
import { getCPE } from '../cpe';

/**
 * Tool for retrieving context using the ContextPulse Engine
 * This enables the chatbot to explicitly request context when needed
 */
export const retrieveContext = tool({
  description:
    'Retrieve relevant context and suggestions based on the current conversation topic. Use this when you need additional background information or want to provide more personalized responses.',
  parameters: z.object({
    query: z
      .string()
      .describe(
        'The topic or question to retrieve context for. Should be a clear description of what context is needed.'
      ),
    category: z
      .enum([
        'user_preference',
        'interaction_history',
        'knowledge',
        'temporal',
        'goal',
      ])
      .optional()
      .describe('Optional category to filter context by'),
  }),
  execute: async ({ query, category }) => {
    try {
      const cpe = getCPE();

      const result = await cpe.retrieveContext({
        query,
        maxResults: 5,
        minScore: 0.3,
        categories: category ? [category] : undefined,
      });

      return {
        success: true,
        context: result.aggregatedContext,
        entriesFound: result.entries.length,
        suggestions: result.proactiveSuggestions.slice(0, 3).map((s) => ({
          message: s.message,
          type: s.type,
          priority: s.priority,
        })),
        retrievalTimeMs: result.metadata.retrievalTimeMs,
      };
    } catch (error) {
      console.error('Context retrieval failed:', error);
      return {
        success: false,
        error: 'Failed to retrieve context',
        context: '',
        entriesFound: 0,
        suggestions: [],
      };
    }
  },
});
