import type { AssetDraft, AssetMetadata, AssetSession, Studio } from "../../domain/studio-shell/StudioShellDomain";

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
  readonly content: string;
  readonly metadata: AssetMetadata;
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
