import type {
  CreateAssetDraftCommand,
  PublishAssetDraftVersionCommand,
  TransitionAssetDraftLifecycleCommand,
  UpdateAssetDraftCommand,
  UpdateAssetDraftDependenciesCommand,
} from "../../application/studio-shell/contracts";
import type {
  StudioShellApiResponse,
  StudioShellSnapshotReadModel,
  StudioShellValidationIssue,
} from "../../infrastructure/api/studio-shell/StudioShellBackendApi";
import { resolveDesktopStudioShellBridge } from "../composition/DesktopStudioShellBridgeAdapter";

export class StudioShellService {
  private requireBridge() {
    const bridge = resolveDesktopStudioShellBridge();
    if (!bridge) {
      throw new Error("Desktop Studio Shell bridge is unavailable in this runtime.");
    }
    return bridge;
  }

  public async initializeStudio(studioId: string, name: string): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    const raw = await this.requireBridge().initializeStudio(studioId, name);
    return JSON.parse(raw) as StudioShellApiResponse<StudioShellSnapshotReadModel>;
  }

  public async loadSnapshot(studioId: string): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel | undefined>> {
    const raw = await this.requireBridge().loadSnapshot(studioId);
    return JSON.parse(raw) as StudioShellApiResponse<StudioShellSnapshotReadModel | undefined>;
  }

  public async startSession(studioId: string): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    const raw = await this.requireBridge().startSession(studioId);
    return JSON.parse(raw) as StudioShellApiResponse<StudioShellSnapshotReadModel>;
  }

  public async createDraft(request: CreateAssetDraftCommand): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    const raw = await this.requireBridge().createDraft(JSON.stringify(request));
    return JSON.parse(raw) as StudioShellApiResponse<StudioShellSnapshotReadModel>;
  }

  public async updateDraft(request: UpdateAssetDraftCommand): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    const raw = await this.requireBridge().updateDraft(JSON.stringify(request));
    return JSON.parse(raw) as StudioShellApiResponse<StudioShellSnapshotReadModel>;
  }

  public async updateDependencies(request: UpdateAssetDraftDependenciesCommand): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    const raw = await this.requireBridge().updateDependencies(JSON.stringify(request));
    return JSON.parse(raw) as StudioShellApiResponse<StudioShellSnapshotReadModel>;
  }

  public async transitionLifecycle(request: TransitionAssetDraftLifecycleCommand): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    const raw = await this.requireBridge().transitionLifecycle(JSON.stringify(request));
    return JSON.parse(raw) as StudioShellApiResponse<StudioShellSnapshotReadModel>;
  }

  public async publishVersion(request: PublishAssetDraftVersionCommand): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    const raw = await this.requireBridge().publishVersion(JSON.stringify(request));
    return JSON.parse(raw) as StudioShellApiResponse<StudioShellSnapshotReadModel>;
  }

  public async validateDraft(studioId: string, draftId: string): Promise<StudioShellApiResponse<ReadonlyArray<StudioShellValidationIssue>>> {
    const raw = await this.requireBridge().validateDraft(JSON.stringify({ studioId, draftId }));
    return JSON.parse(raw) as StudioShellApiResponse<ReadonlyArray<StudioShellValidationIssue>>;
  }
}
