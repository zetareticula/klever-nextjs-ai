import { Suggestion } from '@/lib/db/schema';
import { UseChatHelpers } from '@ai-sdk/react';
import { ComponentType, Dispatch, ReactNode, SetStateAction } from 'react';
import { DataStreamDelta } from './data-stream-handler';
import { UIArtifact } from './artifact';
// ArtifactActionContext is used to define the context of the artifact action
// it contains the content, handleVersionChange, currentVersionIndex, isCurrentVersion, mode, metadata and setMetadata
// the content is the content of the artifact, handleVersionChange is a function that is used to handle the version change
// the currentVersionIndex is the index of the current version, isCurrentVersion is a boolean that indicates if the current version is the latest version
// the mode is the mode of the artifact, metadata is the metadata of the artifact and setMetadata is a function that is used to set the metadata
export type ArtifactActionContext<M = any> = {
  content: string;
  handleVersionChange: (type: 'next' | 'prev' | 'toggle' | 'latest') => void;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  mode: 'edit' | 'diff';
  metadata: M;
  setMetadata: Dispatch<SetStateAction<M>>;
};

// ArtifactAction is used to define the action of the artifact
// it contains the icon, label, description, onClick and isDisabled
// ReactNode is used to define the icon of the artifact action which is a react component
// the react component for icon is passed as a prop to the ArtifactAction
// a prop is a property that is passed to a react component
// onClick is a function that is used to handle the click event of the artifact action
type ArtifactAction<M = any> = {
  icon: ReactNode;
  label?: string;
  description: string;
  onClick: (context: ArtifactActionContext<M>) => Promise<void> | void;
  isDisabled?: (context: ArtifactActionContext<M>) => boolean;
};

// ArtifactToolbarContext is used to define the context of the artifact toolbar
// it contains the appendMessage function which is used to append a message to the chat
export type ArtifactToolbarContext = {
  appendMessage: UseChatHelpers['append'];
};
// ArtifactToolbarItem is used to define the item of the artifact toolbar
// it contains the description, icon and onClick
export type ArtifactToolbarItem = {
  description: string;
  icon: ReactNode;
  onClick: (context: ArtifactToolbarContext) => void;
};

interface ArtifactContent<M = any> {
  title: string;
  content: string;
  mode: 'edit' | 'diff';
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: 'streaming' | 'idle';
  suggestions: Array<Suggestion>;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  isInline: boolean;
  getDocumentContentById: (index: number) => string;
  isLoading: boolean;
  metadata: M;
  setMetadata: Dispatch<SetStateAction<M>>;
}

interface InitializeParameters<M = any> {
  documentId: string;
  setMetadata: Dispatch<SetStateAction<M>>;
}

type ArtifactConfig<T extends string, M = any> = {
  kind: T;
  description: string;
  content: ComponentType<ArtifactContent<M>>;
  actions: Array<ArtifactAction<M>>;
  toolbar: ArtifactToolbarItem[];
  initialize?: (parameters: InitializeParameters<M>) => void;
  onStreamPart: (args: {
    setMetadata: Dispatch<SetStateAction<M>>;
    setArtifact: Dispatch<SetStateAction<UIArtifact>>;
    streamPart: DataStreamDelta;
  }) => void;
};

/// Artifact is used to define the artifact
/// it contains the kind, description, content, actions and toolbar
export class Artifact<T extends string, M = any> {
  readonly kind: T;
  readonly description: string;
  readonly content: ComponentType<ArtifactContent<M>>;
  readonly actions: Array<ArtifactAction<M>>;
  readonly toolbar: ArtifactToolbarItem[];
  readonly initialize?: (parameters: InitializeParameters) => void;
  readonly onStreamPart: (args: {
    setMetadata: Dispatch<SetStateAction<M>>;
    setArtifact: Dispatch<SetStateAction<UIArtifact>>;
    streamPart: DataStreamDelta;
  }) => void;

  constructor(config: ArtifactConfig<T, M>) {
    this.kind = config.kind;
    this.description = config.description;
    this.content = config.content;
    this.actions = config.actions || [];
    this.toolbar = config.toolbar || [];
    this.initialize = config.initialize || (async () => ({}));
    this.onStreamPart = config.onStreamPart;
  }
}
