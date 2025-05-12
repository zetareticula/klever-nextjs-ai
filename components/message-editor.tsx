'use client';

import { ChatRequestOptions, Message } from 'ai';
import { Button } from './ui/button';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { Textarea } from './ui/textarea';
import { deleteTrailingMessages } from '@/app/(chat)/actions';
import { toast } from 'sonner';

/// This component is used to edit a message in the chat
export type MessageEditorProps = {
  message: Message; // This is the message that is being edited
  /// Dispatch is used to update the state of the message, if 'view' is selected, the message will be displayed in view mode
  /// if 'edit' is selected, the message will be displayed in edit mode
  setMode: Dispatch<SetStateAction<'view' | 'edit'>>;
  setMessages: (
    ///Promise is used to update the state of the messages
    /// the messages are updated by calling the setMessages function
    messages: Message[] | ((messages: Message[]) => Message[]),
  ) => void;
  reload: (
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>; //Promise is used to reload the messages
};

export function MessageEditor({
  message,
  setMode,
  setMessages,
  reload,
}: MessageEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false); //the phase of the message is used to determine if the message is being submitted

  const [draftContent, setDraftContent] = useState<string>(message.content); //draftContent is used to set the content of the message, it is used to display the content of the message in the input box
  const textareaRef = useRef<HTMLTextAreaElement>(null); //

  //textareaRef is used to set the textarea element, it is used to get the height of the textarea element
  useEffect(() => {
    //this is used to set the height of the textarea element
    if (textareaRef.current) {
      //adjustHeight is not defined yet, so we call it here
      adjustHeight();
    }
  }, []);

  //const to make adjustHeight function a function which is used to set the height of the textarea element
  const adjustHeight = () => {
    //if the current textareaRef is not null, we set the height of the textarea element to auto and then set the height of the textarea element to the scrollHeight + 2px
    if (textareaRef.current) {

      //set to auto to get the correct height
      textareaRef.current.style.height = 'auto';

      //set the height of the textarea element to the scrollHeight + 2px
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  //this is how we handle input in the textarea element
  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftContent(event.target.value);
    adjustHeight();
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <Textarea
        data-testid="message-editor"
        ref={textareaRef}
        className="bg-transparent outline-none overflow-hidden resize-none !text-base rounded-xl w-full"
        value={draftContent}
        onChange={handleInput}
      />

      <div className="flex flex-row gap-2 justify-end">
        <Button
          variant="outline"
          className="h-fit py-2 px-3"
          onClick={() => {
            setMode('view');
          }}
        >
          Cancel
        </Button>
        <Button
          data-testid="message-editor-send-button"
          variant="default"
          className="h-fit py-2 px-3"
          disabled={isSubmitting}
          onClick={async () => {
            setIsSubmitting(true);

            await deleteTrailingMessages({
              id: message.id,
            });

            setMessages((messages) => {
              const index = messages.findIndex((m) => m.id === message.id);

              if (index !== -1) {
                const updatedMessage = {
                  ...message,
                  content: draftContent,
                };

                return [...messages.slice(0, index), updatedMessage];
              }

              return messages;
            });

            setMode('view');
            reload();
          }}
        >
          {isSubmitting ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  );
}
