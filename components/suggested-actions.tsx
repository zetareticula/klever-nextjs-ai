'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { ChatRequestOptions, CreateMessage, Message } from 'ai';
import { memo } from 'react';

// This component is used to display suggested actions for the user to take
// it is a client component that uses the 'use client' directive
// it is a pure component that uses the 'memo' function from react
// it is a functional component that takes in props and returns a JSX element
// the props are passed in as an object and destructured into the component
// the props are used to display the suggested actions
// the props are used to handle the click event of the suggested actions
interface SuggestedActionsProps {
  chatId: string;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
}

// PureSuggestedActions is a memoized component that displays suggested actions
// memoized is a performance optimization that prevents unnecessary re-renders
// by only re-rendering when the props change
function PureSuggestedActions({ chatId, append }: SuggestedActionsProps) {
  //suggestedActions is an array of objects that contains the title, label and action for each suggested action
  // each object contains a title, label and action
  // a title is the text that is displayed in bold and the label is the text that is displayed in normal font
  // if we wanted an emoji instead of the title we could use the label as the title and the action as the label
  // the action is the text that is sent to the server when the user clicks on the suggested action
  // the emoji would be displayed in the title and the label would be the text that is sent to the server
  // example: 
  // {
  //  title: '🤖',
  //  label: 'What are the advantages',
  //  action: 'of using Next.js?',
  // }
  // this would display the emoji in the title and the text in the label
  const suggestedActions = [
    {
      title: 'What are the advantages',
      label: 'of using Genie?',
      action: 'Render Fun activities for seniors in San Francisco',
    },
    {
      title: 'Interact with',
      label: `Neurogoo`,
      action: `Suggest Neurocognitive tasks for seniors`,
    },
    {
      title: 'Help me save important information',
      label: `using Trove`,
      action: `How can I save important information using LLM?`,
    },
    {
      title: 'What is the weather',
      label: 'in San Francisco?',
      action: 'What is the weather in San Francisco?',
    },
  ];

//this div is used to display the suggested actions, for example, if the user is asking about the weather, we can display suggested actions like "What is the weather in San Francisco?" or "What is the weather in New York?" etc.

  // the div is a grid that displays the suggested actions in a grid format
  // the grid is responsive and displays 2 columns on small screens and 1 column on larger screens
  // the gap between the grid items is 2
  // the grid items are displayed in a flex column format on small screens and a flex row format on larger screens
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
          key={`suggested-action-${suggestedAction.title}-${index}`}
          className={index > 1 ? 'hidden sm:block' : 'block'}
        >
          <Button
            variant="ghost"
            onClick={async () => {
              window.history.replaceState({}, '', `/chat/${chatId}`); // Update the URL without reloading the page

              append({
                role: 'user',
                content: suggestedAction.action,
              });
            }}
            className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start"
          >
            <span className="font-medium">{suggestedAction.title}</span>
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
