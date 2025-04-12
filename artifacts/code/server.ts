import { z } from 'zod';
import { streamObject } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import { codePrompt, updateDocumentPrompt } from '@/lib/ai/prompts';
import { createDocumentHandler } from '@/lib/artifacts/server';

/// This handler is used to create and update code documents
/// It uses the `createDocumentHandler` function to handle the creation and update of code documents
/// It uses the `streamObject` function to stream the code object from the AI model
/// It uses the `myProvider` object to get the AI model
/// It uses the `codePrompt` and `updateDocumentPrompt` functions to get the prompts for the AI model
/// It uses the `zod` library to validate the schema of the code object
// z here is used to validate the schema of the code object
// a z.object is used to create a schema object
export const codeDocumentHandler = createDocumentHandler<'code'>({
  kind: 'code',
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = '';

    const { fullStream } = streamObject({
      model: myProvider.languageModel('artifact-model'),
      system: codePrompt,
      prompt: title,
      schema: z.object({
        code: z.string(),
      }),
    });

    // The fullStream is used to stream the code object from the AI model
    // The fullStream is an async iterable that returns the code object
    // The code object is an object that contains the code property
    // delta is an object that contains the type and object properties
    for await (const delta of fullStream) {
      const { type } = delta;
      
      //if the type is object, then we can get the code object
      if (type === 'object') {
        const { object } = delta;
        const { code } = object;

        // The code object is an object that contains the code property
        // The code property is a string that contains the code
        // The code property is the code that we want to write to the data stream
        if (code) {
          dataStream.writeData({
            type: 'code-delta',
            content: code ?? '',
          });

          draftContent = code; //draftContent is the code that we want to write to the data stream
        }
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = '';

    const { fullStream } = streamObject({
      model: myProvider.languageModel('artifact-model'),
      system: updateDocumentPrompt(document.content, 'code'),
      prompt: description,
      schema: z.object({
        code: z.string(),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'object') {
        const { object } = delta;
        const { code } = object;

        if (code) {
          dataStream.writeData({
            type: 'code-delta',
            content: code ?? '',
          });

          draftContent = code;
        }
      }
    }

    return draftContent;
  },
});
