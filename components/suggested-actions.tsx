'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { ChatRequestOptions, CreateMessage, Message } from 'ai';
import { memo } from 'react';
//image react component
import Image from 'next/image';

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
      imageSrc: '/icons/image.png',
      label: 'Genie',
      action: 'Render Fun activities for seniors in San Francisco with links and images',
    },
    {
      imageSrc: '/icons/owl.png',
      label: 'Neurogoo',
      action: `Suggest a Neurocognitive task for seniors`,
    },
    {
      imageSrc: '/icons/paperclip.png',
      label: 'Trove',
      action: `Kindly and in a sophisticated manner implement a form of reminder using inference level LLM?`,
    },
    {
      imageSrc: '/icons/spiral.png',
      label: 'Tutorial?',
      action: 'Write a five step manual introducing chatbots to an accessibility first crowd, focus on simplicity and clarity; be folksy and friendly at the same time.?',
    },
  ];
//this div is used to display the suggested actions, for example, if the user is asking about the weather, we can display suggested actions like "What is the weather in San Francisco?" or "What is the weather in New York?" etc.

  // the div is a grid that displays the suggested actions in a grid format
  // the grid is responsive and displays 2 columns on small screens and 1 column on larger screens
  // the gap between the grid items is 2
  // the grid items are displayed in a flex column format on small screens and a flex row format on larger screens
  // the button is a ghost button that is used to display the suggested action
  // ghost buttons are used to display actions that are not the primary action
  // for example, here the primary action is to ask the question and the suggested actions are used to display other actions that the user can take
  // if we replace title with an image, we can display an image instead of the title
  //for example, if the user is asking about the weather, we can display an image of the weather instead of the title
  // i.e:
  // {
  //  title: <Image src="/weather.png" alt="weather" width={20} height={20} />,
  //  label: 'What is the weather',
  //  action: 'in San Francisco?',
  // }

  // this would display the image in the title and the text in the label
  // the action is the text that is sent to the server when the user clicks on the suggested action
  // the emoji would be displayed in the title and the label would be the text that is sent to the server
  // the label is the text that is displayed in normal font
  // the action is the text that is sent to the server when the user clicks on the suggested action
  // assume you have a png image in the public folder called weather.png
  // this would display the image in the title and the text in the label
  // return (
  //  <div
  //   data-testid="suggested-actions"
  //   className="grid sm:grid-cols-2 gap-2 w-full"
  //  >
  //   {suggestedActions.map((suggestedAction, index) => (
  //    <motion.div
  //     initial={{ opacity: 0, y: 20 }}
  //     animate={{ opacity: 1, y: 0 }}
  //     exit={{ opacity: 0, y: 20 }}
  //     transition={{ delay: 0.05 * index }}
  //     key={`suggested-action-${suggestedAction.title}-${index}`}
  //     className={index > 1 ? 'hidden sm:block' : 'block'}
  //    >
  //     <Button
  //      variant="ghost"
  //      onClick={async () => {
  //       window.history.replaceState({}, '', `/chat/${chatId}`); // Update the URL without reloading the page
  //       append({
  //        role: 'user',
  //        content: suggestedAction.action,
  //       });
  //      }}
  //      className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start"
  //     >

  //      <span className="font-medium">{suggestedAction.title}</span>
  //      <span className="text-muted-foreground">
  //       {suggestedAction.label}
  //      </span>
  //     </Button>
  //    </motion.div>
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
          key={`suggested-action-${index}`}
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
            <span className="font-medium">{suggestedAction.imageSrc && (
  <Image
    src={suggestedAction.imageSrc}
    alt="icon"
    width={40}
    height={50}
    className="mb-1"
  />
)}</span>
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
