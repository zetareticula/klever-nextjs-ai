import {
  type Message,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { retrieveContext } from '@/lib/ai/tools/retrieve-context';
import { isProductionEnvironment } from '@/lib/constants';
import { NextResponse } from 'next/server';
import { myProvider } from '@/lib/ai/providers';
import { getCPE } from '@/lib/ai/cpe';

export const maxDuration = 60;

/**
 * Helper function to extract text content from a message content field
 */
function extractTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part: unknown) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text: unknown }).text || '');
        }
        return '';
      })
      .join(' ')
      .trim();
  }
  return '';
}

// POST is used to create a new chat, or append a message to an existing chat
// it is a server action that is used to handle the chat messages
// if the chat already exists, it will append the message to the existing chat
// if the chat does not exist, it will create a new chat
export async function POST(request: Request) {
  //we try the data for the request, it contains the id, messages and selectedChatModel
  try {
    const {
      id,
      messages,
      selectedChatModel,
    }: {
      id: string; // The chat ID
      messages: Array<Message>; // The chat messages
      selectedChatModel: string; // The selected chat model which is used to generate the response
    } = await request.json(); // Parse the request body as JSON

    // Check if the id is provided
    const session = await auth(); // Get the session from the auth provider

    //if session is not found, return 401
    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // userMessage is the most recent user message in the chat
    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    const chat = await getChatById({ id });

    // Check if the chat exists, if it doesn't, create a new chat
    // if the chat exists, check if the user is authorized to access it
    // if the user is not authorized, return 401
    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message: userMessage,
      });

      //save the chat to the database, using the user id and the title
      await saveChat({ id, userId: session.user.id, title });
    } else {
      if (chat.userId !== session.user.id) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // Save the user message to the database which is used to display the chat history
    // the user message is the most recent message in the chat
    // the messages are the chat history
    await saveMessages({
      messages: [{ ...userMessage, createdAt: new Date(), chatId: id }],
    });

    // Use CPE to retrieve relevant context based on user message
    const cpe = getCPE();
    let retrievedContext: string | undefined;

    try {
      // Get the user message content for context retrieval
      const userContent = extractTextContent(userMessage.content);

      if (userContent) {
        const contextResult = await cpe.retrieveContext({
          query: userContent,
          userId: session.user.id,
          maxResults: 5,
          minScore: 0.3,
        });

        retrievedContext = contextResult.aggregatedContext;
      }
    } catch (error) {
      // Context retrieval is optional - continue without it on error
      console.error('CPE context retrieval failed:', error);
    }

    /**
     * let activeTools = selectedChatModel === 'chat-model-reasoning'
     * ? []
     * : [
     *  'getWeather',
     *  'createDocument',
     * 'updateDocument',
     * 'requestSuggestions',
     * //'pagingEmergency'
     * ];
     */
    // if (selectedChatModel !== 'chat-model-reasoning') {
     // activeTools.push('emergencyProtocol');
    // }
    // const initialPrompt = isEmergencyRequest
    // ? `Emergency request detected. Priority: inittiate emergencyProtocol to contact emergency services and provide assistance. ${systemPrompt({selectedChatModel})}
   // : systemPrompt({ selectedChatModel });

    // Check if the chat model is valid
    // if the chat model is not valid, return 400
    // streamText is used to stream the response from the AI model
    //experimental_activeTools is used to enable the tools that are used to generate the response
    return createDataStreamResponse({
      execute: (dataStream) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel, retrievedContext }),
          messages,
          maxSteps: 5,
          experimental_activeTools:
          //experimental_transform : smoothStream({ chunking: 'word' }),
          //experimental_generalMessageId : generateUUID,
          //tools:
          //getWeather,
          //createDocument({ session, dataStream }),
          //updateDocument({ session, dataStream }),
          //requestSuggestions({ session, dataStream }),
          // session,
          //dataStream,
          // }),
          //},
          //onFinish: async ({ response, reasoning }) => {
          //   if (session.user?.id) {
            //     try {
            //       const sanitizedResponseMessages = sanitizeResponseMessages({
            //         messages: response.messages,
            //         reasoning,
            //       });

            //  if (isEmergencyRequest) {
            //   **log the emergency request**
            //   console.log(`Emergency request processed at ${new Date().toISOString()} for user ${session.user.id}`);
            // }
            //       await saveMessages({
            //         messages: sanitizedResponseMessages.map((message) => {
            //           return {
            //             id: message.id,
            //             chatId: id,
            //             role: message.role,
            //             content: message.content,
            //             createdAt: new Date(),
            //           };
            //         }),
            //       });
            //     } catch (error) {
            //       console.error('Failed to save chat');
            //     }
            //   }
            // }
          // }),
          // experimental_telemetry: {
          //   isEnabled: isProductionEnvironment,
          //  functionId: 'stream-text',
          // },
          //})
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                  'retrieveContext',
                ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_generateMessageId: generateUUID,
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
            retrieveContext,
          },
          onFinish: async ({ response, reasoning }) => {
            if (session.user?.id) {
              try {
                const sanitizedResponseMessages = sanitizeResponseMessages({
                  messages: response.messages,
                  reasoning,
                });

                await saveMessages({
                  messages: sanitizedResponseMessages.map((message) => {
                    return {
                      id: message.id,
                      chatId: id,
                      role: message.role,
                      content: message.content,
                      createdAt: new Date(),
                    };
                  }),
                });

                // Record interaction in CPE for behavioral analysis
                try {
                  const userContent = extractTextContent(userMessage.content);

                  const assistantMessage = sanitizedResponseMessages.find(
                    (m) => m.role === 'assistant'
                  );

                  if (userContent && assistantMessage) {
                    const assistantContent = extractTextContent(
                      assistantMessage.content as Message['content']
                    );

                    cpe.recordInteraction(
                      session.user.id,
                      id,
                      userContent,
                      assistantContent
                    );
                  }
                } catch (cpeError) {
                  console.error('Failed to record interaction in CPE:', cpeError);
                }
              } catch (error) {
                console.error('Failed to save chat');
              }
            }
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        }); //end of streamText

        result.consumeStream();

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: () => {
        return 'Oops, an error occured!';
      },
    });
  } catch (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
} //end of POST

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}
