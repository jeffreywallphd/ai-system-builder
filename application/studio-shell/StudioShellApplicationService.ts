import type {
  AssetDraftResult,
  CreateAssetDraftCommand,
  InitializeStudioCommand,
  LoadAssetDraftQuery,
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
}
