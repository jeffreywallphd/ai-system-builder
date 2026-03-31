import type {
  CreateAssetDraftCommand,
  PublishAssetDraftVersionCommand,
  TransitionAssetDraftLifecycleCommand,
  UpdateAssetDraftCommand,
  UpdateAssetDraftDependenciesCommand,
} from "../../application/studio-shell/contracts";
import type {
  AssessWorkflowStudioExecutionReadinessRequest,
  RunWorkflowStudioDraftReadModel,
  RunWorkflowStudioDraftRequest,
  StudioShellApiResponse,
  StudioShellSnapshotReadModel,
  StudioShellValidationIssue,
  WorkflowExecutionReadinessReadModel,
} from "../../infrastructure/api/studio-shell/StudioShellBackendApi";
import type {
  StartSystemRuntimeExecutionRequest,
  StartSystemRuntimeExecutionResponse,
  SystemRuntimeApiResponse,
  RuntimeExecutionStatusReadModel,
  RuntimeExecutionTraceReadModel,
  RuntimeExecutionResultReadModel,
} from "../../infrastructure/api/system-runtime/SystemRuntimeBackendApi";
import type {
  AddSystemChildComponentRequest,
  ListSystemChildComponentsRequest,
  RemoveSystemChildComponentRequest,
  ReorderSystemChildComponentRequest,
  SystemStudioApiResponse,
  SystemStudioChildComponentReadModel,
  SystemCompatibilityInsightsReadModel,
  UpdateSystemExecutionMetadataRequest,
  UpdateSystemInterfacesRequest,
  UpdateSystemParametersRequest,
} from "../../infrastructure/api/system-studio/SystemStudioBackendApi";
import { resolveDesktopStudioShellBridge } from "../composition/DesktopStudioShellBridgeAdapter";
import { resolveBrowserStudioShellBridgeFallback } from "../composition/BrowserStudioShellBridgeFallback";

export class StudioShellService {
  private requireBridge() {
    const bridge = resolveDesktopStudioShellBridge();
    return bridge ?? resolveBrowserStudioShellBridgeFallback();
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

  public async assessWorkflowExecutionReadiness(
    request: AssessWorkflowStudioExecutionReadinessRequest,
  ): Promise<StudioShellApiResponse<WorkflowExecutionReadinessReadModel>> {
    const raw = await this.requireBridge().assessWorkflowExecutionReadiness(JSON.stringify(request));
    return JSON.parse(raw) as StudioShellApiResponse<WorkflowExecutionReadinessReadModel>;
  }

  public async runWorkflowDraft(request: RunWorkflowStudioDraftRequest): Promise<StudioShellApiResponse<RunWorkflowStudioDraftReadModel>> {
    const raw = await this.requireBridge().runWorkflowDraft(JSON.stringify(request));
    return JSON.parse(raw) as StudioShellApiResponse<RunWorkflowStudioDraftReadModel>;
  }

  public async listSystemChildComponents(request: ListSystemChildComponentsRequest): Promise<SystemStudioApiResponse<ReadonlyArray<SystemStudioChildComponentReadModel>>> {
    const raw = await this.requireBridge().listSystemChildComponents(JSON.stringify(request));
    return JSON.parse(raw) as SystemStudioApiResponse<ReadonlyArray<SystemStudioChildComponentReadModel>>;
  }

  public async addSystemChildComponent(request: AddSystemChildComponentRequest): Promise<SystemStudioApiResponse<{ readonly updated: boolean }>> {
    const raw = await this.requireBridge().addSystemChildComponent(JSON.stringify(request));
    return JSON.parse(raw) as SystemStudioApiResponse<{ readonly updated: boolean }>;
  }

  public async removeSystemChildComponent(request: RemoveSystemChildComponentRequest): Promise<SystemStudioApiResponse<{ readonly updated: boolean }>> {
    const raw = await this.requireBridge().removeSystemChildComponent(JSON.stringify(request));
    return JSON.parse(raw) as SystemStudioApiResponse<{ readonly updated: boolean }>;
  }

  public async reorderSystemChildComponent(request: ReorderSystemChildComponentRequest): Promise<SystemStudioApiResponse<{ readonly updated: boolean }>> {
    const raw = await this.requireBridge().reorderSystemChildComponent(JSON.stringify(request));
    return JSON.parse(raw) as SystemStudioApiResponse<{ readonly updated: boolean }>;
  }

  public async updateSystemInterfaces(request: UpdateSystemInterfacesRequest): Promise<SystemStudioApiResponse<{ readonly updated: boolean }>> {
    const raw = await this.requireBridge().updateSystemInterfaces(JSON.stringify(request));
    return JSON.parse(raw) as SystemStudioApiResponse<{ readonly updated: boolean }>;
  }

  public async updateSystemParameters(request: UpdateSystemParametersRequest): Promise<SystemStudioApiResponse<{ readonly updated: boolean }>> {
    const raw = await this.requireBridge().updateSystemParameters(JSON.stringify(request));
    return JSON.parse(raw) as SystemStudioApiResponse<{ readonly updated: boolean }>;
  }

  public async updateSystemExecutionMetadata(request: UpdateSystemExecutionMetadataRequest): Promise<SystemStudioApiResponse<{ readonly updated: boolean }>> {
    const raw = await this.requireBridge().updateSystemExecutionMetadata(JSON.stringify(request));
    return JSON.parse(raw) as SystemStudioApiResponse<{ readonly updated: boolean }>;
  }

  public async getSystemCompatibilityInsights(request: ListSystemChildComponentsRequest): Promise<SystemStudioApiResponse<SystemCompatibilityInsightsReadModel>> {
    const raw = await this.requireBridge().getSystemCompatibilityInsights(JSON.stringify(request));
    return JSON.parse(raw) as SystemStudioApiResponse<SystemCompatibilityInsightsReadModel>;
  }

  public async startSystemExecution(request: StartSystemRuntimeExecutionRequest): Promise<SystemRuntimeApiResponse<StartSystemRuntimeExecutionResponse>> {
    const raw = await this.requireBridge().startSystemExecution(JSON.stringify(request));
    return JSON.parse(raw) as SystemRuntimeApiResponse<StartSystemRuntimeExecutionResponse>;
  }

  public async getSystemExecutionStatus(executionId: string): Promise<SystemRuntimeApiResponse<RuntimeExecutionStatusReadModel>> {
    const raw = await this.requireBridge().getSystemExecutionStatus(executionId);
    return JSON.parse(raw) as SystemRuntimeApiResponse<RuntimeExecutionStatusReadModel>;
  }

  public async getSystemExecutionTrace(request: { readonly executionId: string; readonly eventLimit?: number; readonly logLimit?: number }): Promise<SystemRuntimeApiResponse<RuntimeExecutionTraceReadModel>> {
    const raw = await this.requireBridge().getSystemExecutionTrace(JSON.stringify(request));
    return JSON.parse(raw) as SystemRuntimeApiResponse<RuntimeExecutionTraceReadModel>;
  }

  public async getSystemExecutionResult(executionId: string): Promise<SystemRuntimeApiResponse<RuntimeExecutionResultReadModel>> {
    const raw = await this.requireBridge().getSystemExecutionResult(executionId);
    return JSON.parse(raw) as SystemRuntimeApiResponse<RuntimeExecutionResultReadModel>;
  }
}
