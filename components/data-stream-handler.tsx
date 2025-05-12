'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef } from 'react';
import { artifactDefinitions, ArtifactKind } from './artifact';
import { Suggestion } from '@/lib/db/schema';
import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';

/// This is the data stream that is received from the server
/// The data stream is used to update the artifact state
/// The data stream is an array of objects that contain the type and content of the data
/// The type of the data can be text-delta, code-delta, sheet-delta, image-delta, title, id, suggestion, clear, finish, or kind
export type DataStreamDelta = {
  type:
    | 'text-delta'
    | 'code-delta'
    | 'sheet-delta'
    | 'image-delta'
    | 'title'
    | 'id'
    | 'suggestion'
    | 'clear'
    | 'finish'
    | 'kind';
  content: string | Suggestion;
};

/// This component handles the data stream from the server and updates the artifact state accordingly
export function DataStreamHandler({ id }: { id: string }) {
  /// This component is used to handle the data stream from the server
  const { data: dataStream } = useChat({ id }); //useChat is used to fetch the data stream from the server
  /// This is the data stream that is received from the server
  const { artifact, setArtifact, setMetadata } = useArtifact(); //useArtifact is used to fetch the artifact data from the server
  /// This is the artifact that is used to store the data stream
  const lastProcessedIndex = useRef(-1);

  /// This is used to keep track of the last processed index of the data stream
  //useEffect(() => { is used to process the data stream and update the artifact state
  useEffect(() => {
    /// This is used to process the data stream and update the artifact state
    if (!dataStream?.length) return;

    /// Check if the data stream has changed
    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    /// If the data stream has not changed, return
    lastProcessedIndex.current = dataStream.length - 1;

    /// If the artifact is not set, return
    (newDeltas as DataStreamDelta[]).forEach((delta: DataStreamDelta) => {
      //for artifactDefinition, we are using the artifactDefinitions array to find the artifact definition that matches the kind of the artifact
      const artifactDefinition = artifactDefinitions.find(
        (artifactDefinition) => artifactDefinition.kind === artifact.kind,
      );

      /// If the artifact definition is not found, return
      if (artifactDefinition?.onStreamPart) {
        // Call the onStreamPart function of the artifact definition
        artifactDefinition.onStreamPart({
          /// Pass the artifact definition, artifact, and delta to the onStreamPart function
          streamPart: delta,
          // Pass the artifact to the onStreamPart function
          setArtifact,
          // Pass the artifact definition to the onStreamPart function
          setMetadata,
        });
      }

      /// If the artifact is not set, return
      setArtifact((draftArtifact) => {
        /// If the artifact is not set, return the initial artifact data
        if (!draftArtifact) {
          //initialArtifactData is used to set the initial data of the artifact
          return { ...initialArtifactData, status: 'streaming' };
        }

        //create multiplexer for artifact where type is the type of the artifact
        // This is used to handle the different types of artifacts
        //delta is the data stream that is received from the server
        switch (delta.type) {
          // This is used to handle the text-delta type of artifact
          case 'id':
            // This is used to handle the id type of artifact
            return {
              ...draftArtifact,
              documentId: delta.content as string,
              status: 'streaming',
            };
            
          case 'title':
            return {
              ...draftArtifact,
              title: delta.content as string,
              status: 'streaming',
            };

          case 'kind':
            return {
              ...draftArtifact,
              kind: delta.content as ArtifactKind,
              status: 'streaming',
            };

          case 'clear':
            return {
              ...draftArtifact,
              content: '',
              status: 'streaming',
            };

          case 'finish':
            return {
              ...draftArtifact,
              status: 'idle',
            };

          default:
            return draftArtifact;
        }
      });
    });
  }, [dataStream, setArtifact, setMetadata, artifact]);

  return null;
}
