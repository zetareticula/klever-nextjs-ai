import {
  type Message,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import { systemPrompt, ragEnhancedPrompt } from '@/lib/ai/prompts';
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
  extractTextFromMessageContent,
} from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment, isTestEnvironment } from '@/lib/constants';
import { NextResponse } from 'next/server';
import { myProvider } from '@/lib/ai/providers';
import { getDefaultContextPulseEngine } from '@/lib/ai/context-pulse';

export const maxDuration = 60;

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

    // Get the user message content for RAG retrieval
    const userMessageContent = extractTextFromMessageContent(userMessage.content);

    // Use ContextPulse Engine for RAG-enhanced context retrieval
    // Skip in test environment to avoid embedding generation
    let enhancedSystemPrompt = systemPrompt({ selectedChatModel });
    
    if (!isTestEnvironment && userMessageContent) {
      try {
        const cpe = getDefaultContextPulseEngine();
        
        // Retrieve relevant context for the user's query
        const contextResults = await cpe.retrieveContext(
          userMessageContent,
          session.user.id,
          { topK: 3, minScore: 0.6 }
        );

        // Build context string from retrieved results
        if (contextResults.length > 0) {
          const retrievedContext = contextResults
            .map((result) => `[${result.entry.metadata.category}] ${result.entry.content}`)
            .join('\n\n');

          enhancedSystemPrompt = ragEnhancedPrompt({
            basePrompt: systemPrompt({ selectedChatModel }),
            retrievedContext,
          });
        }

        // Store the current user message as context for future retrieval
        await cpe.processMessage(
          userMessageContent,
          'user',
          session.user.id,
          id
        );
      } catch (error) {
        // Log error but continue without RAG enhancement
        console.error('ContextPulse Engine error:', error);
      }
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
          system: enhancedSystemPrompt,
          messages,
          maxSteps: 5,
          experimental_activeTools: //activeTools,
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
                  //'pagingEmergency'
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

                // Store assistant responses in ContextPulse Engine for future RAG retrieval
                if (!isTestEnvironment) {
                  try {
                    const cpe = getDefaultContextPulseEngine();
                    for (const message of sanitizedResponseMessages) {
                      if (message.role === 'assistant') {
                        const content = extractTextFromMessageContent(message.content);
                        
                        if (content) {
                          await cpe.processMessage(
                            content,
                            'assistant',
                            session.user.id,
                            id
                          );
                        }
                      }
                    }
                  } catch (cpeError) {
                    console.error('Failed to store context in ContextPulse Engine:', cpeError);
                  }
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
