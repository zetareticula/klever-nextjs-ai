'use client';

import type { Attachment, Message } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr'; //this is used to fetch data from the server
import { ChatHeader } from '@/components/chat-header'; //this is used to display the chat header
import type { Vote } from '@/lib/db/schema'; //this is a vote type
import { fetcher, generateUUID } from '@/lib/utils';
import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages'; //messages is used to display the chat messages
import { VisibilityType } from './visibility-selector'; //this is used to determine the visibility type of the chat
import { useArtifactSelector } from '@/hooks/use-artifact';
import { toast } from 'sonner';

//this is the chat component that is used in the chat page
// it is used to display the chat messages and the input box
// it is also used to display the chat header and the artifact

export function Chat({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<Message>; //this is used to set the initial messages in the chat.
  selectedChatModel: string; //this is used to set the selected chat model
  selectedVisibilityType: VisibilityType; //this is used to set the selected visibility type
  isReadonly: boolean;
}) {
  const { mutate } = useSWRConfig(); //this is used to mutate the swr cache

  //the consts below are used to set the messages and the input box using the useChat hook
  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    status,
    stop,
    reload,
  } = useChat({
    id,
    body: { id, selectedChatModel: selectedChatModel },
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    onFinish: () => {
      mutate('/api/history');
    },
    onError: () => {
      toast.error('An error occured, please try again!');
    },
  });

  // this is used to fetch the votes from the server
  const { data: votes } = useSWR<Array<Vote>>(
    `/api/vote?chatId=${id}`,
    fetcher,
  );

  // setAttachments is used to set the attachments in the input box i.e: images, videos, etc.
  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  //isArtifactVisible is used to determine if the artifact is visible or not
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          selectedModelId={selectedChatModel}
          selectedVisibilityType={selectedVisibilityType}
          isReadonly={isReadonly}
        />

        <Messages
          chatId={id}
          status={status}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
        />

        <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              status={status}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              append={append}
            />
          )}
        </form>
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        status={status}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        append={append}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        votes={votes}
        isReadonly={isReadonly}
      />
    </>
  );
}
