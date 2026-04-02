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

export const StudioUiAssetKinds = Object.freeze({
  atomic: "atomic",
  composed: "composed",
  systemPage: "system-page",
});

export type StudioUiAssetKind = typeof StudioUiAssetKinds[keyof typeof StudioUiAssetKinds];

export interface StudioUiAssetMetadata {
  readonly displayName?: string;
  readonly description?: string;
  readonly group?: string;
  readonly iconToken?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly keywords?: ReadonlyArray<string>;
  readonly contractCategory?: string;
  readonly capabilityFlags?: ReadonlyArray<string>;
}

export interface StudioUiAssetPropsSchemaDescriptor {
  readonly schemaId: string;
  readonly schemaVersion: string;
}

export interface StudioUiAssetPersistenceDescriptor {
  readonly documentType: string;
  readonly serialization: "json";
}

export interface StudioUiAssetRenderingDescriptor {
  readonly renderer: "react";
  readonly resolution: "definition-render";
}

interface StudioAssetContractBase<TInput> {
  readonly identity: StudioAssetIdentity;
  readonly kind: StudioUiAssetKind;
  readonly metadata?: StudioUiAssetMetadata;
  readonly propsSchema: StudioUiAssetPropsSchemaDescriptor;
  readonly supportedModes: ReadonlyArray<StudioAssetRenderMode>;
  readonly accepts: {
    readonly context: string;
    readonly document: string;
    readonly input: TInput;
  };
  readonly emits: ReadonlyArray<string>;
  readonly hostCapabilities: StudioAssetHostCapabilities;
  readonly rendering: StudioUiAssetRenderingDescriptor;
  readonly persistence: StudioUiAssetPersistenceDescriptor;
  readonly previewHooks?: {
    readonly canRenderPreview: boolean;
  };
  readonly runtimeHooks?: {
    readonly canStartRuntime: boolean;
  };
}

export interface AtomicStudioAssetCapabilities {
  readonly interactive: boolean;
  readonly viewer: boolean;
}

export interface AtomicStudioAssetContract<TInput = unknown> extends StudioAssetContractBase<TInput> {
  readonly kind: "atomic";
  readonly capabilities: AtomicStudioAssetCapabilities;
  readonly constraints: {
    readonly allowsChildren: false;
  };
}

export interface ComposedStudioAssetSlotContract {
  readonly slotId: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly allowsMultiple?: boolean;
  readonly allowedChildKinds: ReadonlyArray<StudioUiAssetKind>;
  readonly allowedChildAssetTypes?: ReadonlyArray<string>;
  readonly allowedRegistrationCategories?: ReadonlyArray<"atomic-ui" | "composed-ui" | "system-page">;
}

export interface ComposedStudioAssetContract<TInput = unknown> extends StudioAssetContractBase<TInput> {
  readonly kind: "composed";
  readonly childSlots: ReadonlyArray<ComposedStudioAssetSlotContract>;
  readonly compositionRules: {
    readonly allowsNestedStudios: boolean;
    readonly allowedChildKinds: ReadonlyArray<StudioUiAssetKind>;
  };
}

export const SystemPageLayoutKinds = Object.freeze({
  singleColumn: "single-column",
  twoPane: "two-pane",
  workspace: "workspace",
  custom: "custom",
});

export type SystemPageLayoutKind = typeof SystemPageLayoutKinds[keyof typeof SystemPageLayoutKinds];

export interface SystemPageRegionDescriptor {
  readonly regionId: string;
  readonly label: string;
  readonly required?: boolean;
  readonly allowsMultiple: boolean;
  readonly allowedChildKinds: ReadonlyArray<StudioUiAssetKind>;
  readonly allowedChildAssetTypes?: ReadonlyArray<string>;
  readonly allowedRegistrationCategories?: ReadonlyArray<"atomic-ui" | "composed-ui" | "system-page">;
}

export interface SystemPageRuntimeNavigationDescriptor {
  readonly route: string;
  readonly title?: string;
  readonly supportsDeepLinking: boolean;
  readonly navGroup?: string;
  readonly requiresRuntimeSession?: boolean;
}

export interface SystemPageAssetContract<TInput = unknown> extends StudioAssetContractBase<TInput> {
  readonly kind: "system-page";
  readonly pageStructure: {
    readonly layoutKind: SystemPageLayoutKind;
    readonly regions: ReadonlyArray<SystemPageRegionDescriptor>;
    readonly defaultRegionId?: string;
  };
  readonly layoutResponsibilities: ReadonlyArray<string>;
  readonly panelReferences?: ReadonlyArray<string>;
  readonly navigation?: SystemPageRuntimeNavigationDescriptor;
  readonly compositionRules: {
    readonly allowsNestedPages: boolean;
    readonly allowedChildKinds: ReadonlyArray<StudioUiAssetKind>;
  };
}

export type StudioAssetContract<TInput = unknown> =
  | AtomicStudioAssetContract<TInput>
  | ComposedStudioAssetContract<TInput>
  | SystemPageAssetContract<TInput>;

export interface StudioAssetDefinition<TInput = unknown, TEvent = StudioAssetEvent> {
  readonly contract: StudioAssetContract<TInput>;
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
  contract: StudioAssetContract<unknown>,
  mode: StudioAssetRenderMode,
): boolean {
  return contract.supportedModes.includes(mode);
}
