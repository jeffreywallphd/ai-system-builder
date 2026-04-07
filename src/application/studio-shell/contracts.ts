import type {
  AssetDraft,
  AssetDraftDependencyReference,
  AssetDraftLifecycleStatus,
  AssetMetadata,
  AssetMetadataPatch,
  AssetSession,
  Studio,
} from "@domain/studio-shell/StudioShellDomain";
import type { AssetVersion } from "@domain/assets/AssetVersion";

export interface InitializeStudioCommand {
  readonly studioId: string;
  readonly name: string;
}

export interface StartAssetSessionCommand {
  readonly studioId: string;
  readonly sessionId?: string;
}

export interface CreateAssetDraftCommand {
  readonly studioId: string;
  readonly sessionId: string;
  readonly draftId?: string;
  readonly assetId?: string;
  readonly content: string;
  readonly metadata: AssetMetadata;
  readonly dependencies?: ReadonlyArray<AssetDraftDependencyReference>;
}

export interface LoadAssetDraftQuery {
  readonly studioId: string;
  readonly draftId: string;
}

export interface UpdateAssetDraftCommand {
  readonly studioId: string;
  readonly sessionId: string;
  readonly draftId: string;
  readonly content?: string;
  readonly metadata?: AssetMetadata;
  readonly metadataPatch?: AssetMetadataPatch;
}

export interface UpdateAssetDraftDependenciesCommand {
  readonly studioId: string;
  readonly sessionId: string;
  readonly draftId: string;
  readonly dependencies: ReadonlyArray<AssetDraftDependencyReference>;
}

export interface TransitionAssetDraftLifecycleCommand {
  readonly studioId: string;
  readonly sessionId: string;
  readonly draftId: string;
  readonly targetStatus: AssetDraftLifecycleStatus;
}

export interface PublishAssetDraftVersionCommand {
  readonly studioId: string;
  readonly sessionId: string;
  readonly draftId: string;
  readonly versionId?: string;
  readonly versionLabel?: string;
  readonly parentVersionId?: string;
  readonly createdBy?: string;
  readonly upstreamVersionIds?: ReadonlyArray<string>;
}

export interface ListAssetDraftVersionHistoryQuery {
  readonly studioId: string;
  readonly draftId: string;
}

export interface StudioInitializationResult {
  readonly studio: Studio;
  readonly activeSession: AssetSession;
}

export interface StudioSessionResult {
  readonly studio: Studio;
  readonly session: AssetSession;
  readonly drafts: ReadonlyArray<AssetDraft>;
}

export interface AssetDraftResult {
  readonly studio: Studio;
  readonly session: AssetSession;
  readonly draft: AssetDraft;
}

export interface AssetVersionResult extends AssetDraftResult {
  readonly version: AssetVersion;
}

export interface AssetVersionHistoryResult {
  readonly studio: Studio;
  readonly draft: AssetDraft;
  readonly versions: ReadonlyArray<AssetVersion>;
}

