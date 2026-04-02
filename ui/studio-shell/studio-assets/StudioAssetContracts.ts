export const StudioAssetRenderModes = Object.freeze({
  full: "full",
  embedded: "embedded",
  inline: "inline",
  readonly: "readonly",
});

export type StudioAssetRenderMode = typeof StudioAssetRenderModes[keyof typeof StudioAssetRenderModes];

export interface StudioAssetIdentity {
  readonly studioType: string;
  readonly studioId: string;
  readonly title: string;
  readonly summary?: string;
}

export interface StudioAssetHostCapabilities {
  readonly canNavigate: boolean;
  readonly canShowShellChrome: boolean;
  readonly canMutateDraft: boolean;
  readonly canLaunchRuns: boolean;
  readonly canManageSessionState: boolean;
}

export interface StudioSessionState {
  readonly sessionId?: string;
  readonly draftId?: string;
  readonly isBusy: boolean;
  readonly operationError?: string;
  readonly lastUpdatedAt?: string;
}

export interface StudioHostContext<TInput = unknown> {
  readonly hostId: string;
  readonly mode: StudioAssetRenderMode;
  readonly capabilities: StudioAssetHostCapabilities;
  readonly input: TInput;
  readonly layout?: {
    readonly minWidth?: number;
    readonly minHeight?: number;
    readonly maxWidth?: number;
    readonly maxHeight?: number;
    readonly width?: string | number;
    readonly height?: string | number;
  };
  readonly injectedContext?: Record<string, unknown>;
  readonly documentAccess?: {
    readonly readOnly: boolean;
    readDocument?: () => string;
    updateDocument?: (content: string) => void;
  };
  readonly preview?: {
    readonly enabled: boolean;
    readonly source?: string;
  };
}

export interface StudioAssetEvent<TPayload = unknown> {
  readonly type: string;
  readonly payload?: TPayload;
}

export interface StudioAssetContract<TInput = unknown, TEvent = StudioAssetEvent> {
  readonly identity: StudioAssetIdentity;
  readonly supportedModes: ReadonlyArray<StudioAssetRenderMode>;
  readonly accepts: {
    readonly context: string;
    readonly document: string;
    readonly input: TInput;
  };
  readonly emits: ReadonlyArray<string>;
  readonly hostCapabilities: StudioAssetHostCapabilities;
  readonly previewHooks?: {
    readonly canRenderPreview: boolean;
  };
  readonly runtimeHooks?: {
    readonly canStartRuntime: boolean;
  };
}

export interface StudioAssetDefinition<TInput = unknown, TEvent = StudioAssetEvent> {
  readonly contract: StudioAssetContract<TInput, TEvent>;
  render(props: {
    readonly context: StudioHostContext<TInput>;
    readonly session: StudioSessionState;
    readonly onEvent?: (event: TEvent) => void;
  }): JSX.Element;
}

export interface StudioHostBoundaryProps<TInput = unknown, TEvent = StudioAssetEvent> {
  readonly asset: StudioAssetDefinition<TInput, TEvent>;
  readonly context: StudioHostContext<TInput>;
  readonly session: StudioSessionState;
  readonly onEvent?: (event: TEvent) => void;
  readonly className?: string;
}

export function supportsStudioAssetMode(
  contract: StudioAssetContract<unknown, unknown>,
  mode: StudioAssetRenderMode,
): boolean {
  return contract.supportedModes.includes(mode);
}
