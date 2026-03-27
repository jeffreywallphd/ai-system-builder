import type {
  AssetDraftResult,
  AssetVersionHistoryResult,
  AssetVersionResult,
  CreateAssetDraftCommand,
  InitializeStudioCommand,
  ListAssetDraftVersionHistoryQuery,
  LoadAssetDraftQuery,
  PublishAssetDraftVersionCommand,
  StartAssetSessionCommand,
  StudioInitializationResult,
  StudioSessionResult,
  UpdateAssetDraftCommand,
} from "./contracts";

export interface StudioShellApplicationService {
  initializeStudio(command: InitializeStudioCommand): Promise<StudioInitializationResult>;
  startAssetSession(command: StartAssetSessionCommand): Promise<StudioSessionResult>;
  createAssetDraft(command: CreateAssetDraftCommand): Promise<AssetDraftResult>;
  loadAssetDraft(query: LoadAssetDraftQuery): Promise<AssetDraftResult | undefined>;
  updateAssetDraft(command: UpdateAssetDraftCommand): Promise<AssetDraftResult>;
  publishAssetDraftVersion(command: PublishAssetDraftVersionCommand): Promise<AssetVersionResult>;
  listAssetDraftVersionHistory(query: ListAssetDraftVersionHistoryQuery): Promise<AssetVersionHistoryResult>;
}
