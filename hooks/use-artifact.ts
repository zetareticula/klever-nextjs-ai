'use client';

import useSWR from 'swr';
import { UIArtifact } from '@/components/artifact';
import { useCallback, useMemo } from 'react';

/// This is the initial artifact data that is used to set the artifact state
export const initialArtifactData: UIArtifact = {
  //doumentId is used to set the document id of the artifact
  documentId: 'init',
  //content is used to set the content of the artifact
  content: '',
  //kind is a string that is used to set the kind of the artifact
  kind: 'text',
  //title is used to set the title of the artifact
  title: '',
  status: 'idle',
  isVisible: false,
  //boundingBox is used to set the bounding box of the artifact
  boundingBox: {
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  },
};

//for every T in the UIArtifact, we create a selector that takes the state and returns T
type Selector<T> = (state: UIArtifact) => T;

/// This is used to select a specific part of the artifact state
export function useArtifactSelector<Selected>(selector: Selector<Selected>) {
  /// This is used to select a specific part of the artifact state, the selector is a function that takes the state and returns the selected part
  const { data: localArtifact } = useSWR<UIArtifact>('artifact', null, {
    //fallbackData is used to set the initial data of the artifact, an empty object.
    fallbackData: initialArtifactData,
  });

  //
  const selectedValue = useMemo(() => {
    if (!localArtifact) return selector(initialArtifactData);
    return selector(localArtifact);
  }, [localArtifact, selector]);

  return selectedValue;
}

//useArtifact is used to get the artifact state and set the artifact state
export function useArtifact() {
  //for data stream, we use the useSWR hook to fetch the data from the server
  const { data: localArtifact, mutate: setLocalArtifact } = useSWR<UIArtifact>(
    'artifact',
    null,
    {
      fallbackData: initialArtifactData,
    },
  );

  //useMemo is used to memoize the artifact state, so that it does not re-render every time the state changes
  const artifact = useMemo(() => {
    //if the localArtifact is not set, return the initial artifact data
    if (!localArtifact) return initialArtifactData;
    //if the localArtifact is set, return the localArtifact
    return localArtifact;
  }, [localArtifact]); 

  //useCallback is used to memoize the setArtifact function, so that it does not re-render every time the state changes 
  const setArtifact = useCallback(
    //UIArtifact is used to set the artifact state and updaterFn is a function that takes the current artifact and returns the updated artifact
    (updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact)) => {
     
      //setLocalArtifact to set the artifact state
      setLocalArtifact((currentArtifact) => {
        //if the currentArtifact is not set, return the initial artifact data
        const artifactToUpdate = currentArtifact || initialArtifactData;

        //if the updaterFn is a function, call the function with the current artifact and return the updated artifact
        if (typeof updaterFn === 'function') {
          
          return updaterFn(artifactToUpdate);
        }

        return updaterFn;
      });
    },
    [setLocalArtifact],
  );

  //useSWR is used to fetch the artifact metadata from the server
  const { data: localArtifactMetadata, mutate: setLocalArtifactMetadata } =
    useSWR<any>(
      () =>
        artifact.documentId ? `artifact-metadata-${artifact.documentId}` : null,
      null,
      {
        fallbackData: null,
      },
    );

  //useMemo is used to memoize the artifact metadata state, so that it does not re-render every time the state changes
  return useMemo(
    () => ({
      artifact,
      setArtifact,
      metadata: localArtifactMetadata,
      setMetadata: setLocalArtifactMetadata,
    }),
    [artifact, setArtifact, localArtifactMetadata, setLocalArtifactMetadata],
  );
}
