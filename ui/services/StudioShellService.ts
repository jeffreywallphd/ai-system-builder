import type {
  CreateAssetDraftCommand,
  PublishAssetDraftVersionCommand,
  TransitionAssetDraftLifecycleCommand,
  UpdateAssetDraftCommand,
  UpdateAssetDraftDependenciesCommand,
} from "../../application/studio-shell/contracts";
import type {
  AssessWorkflowStudioExecutionReadinessRequest,
  DuplicatePersistedWorkflowRequest,
  ListWorkflowStudioRunsRequest,
  RunWorkflowStudioDraftReadModel,
  StartWorkflowRunRerunRequest,
  RunWorkflowStudioDraftRequest,
  RunDataStudioPipelineRequest,
  StudioShellApiResponse,
  StudioShellSnapshotReadModel,
  StudioShellValidationIssue,
  ListDataStudioPipelinesRequest,
  LoadDataStudioPipelineRequest,
  DataStudioPersistedPipelineReadModel,
  DataStudioPipelineVersionReadModel,
  RunDataStudioPipelineReadModel,
  AssessDataStudioExecutionReadinessRequest,
  DataStudioExecutionReadinessReadModel,
  WorkflowRunDetailReadModel,
  WorkflowRunRerunLaunchReadModel,
  WorkflowRunSummaryReadModel,
  WorkflowExecutionReadinessReadModel,
  PersistedWorkflowReadModel,
  IngestReferenceImageUploadReadModel,
  IngestReferenceImageUploadRequest,
  ChainReferenceImageDatasetItemReadModel,
  ChainReferenceImageDatasetItemRequest,
  ListReferenceImageRunHistoryRequest,
  ListReferenceImageOutputsRequest,
  PersistReferenceImageOutputsReadModel,
  PersistReferenceImageOutputsRequest,
} from "../../infrastructure/api/studio-shell/StudioShellBackendApi";
import type { ImageRunHistoryListing } from "../../application/system-runtime/ImageRunHistoryDataContract";
import type { OutputGalleryListing } from "../../application/system-runtime/OutputGalleryDataContract";
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
  SaveSystemDefinitionRequest,
  LoadSystemDefinitionRequest,
  DuplicateSystemDefinitionRequest,
  ModifySystemDefinitionRequest,
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

  public async getPersistedWorkflow(workflowId: string): Promise<StudioShellApiResponse<PersistedWorkflowReadModel>> {
    const raw = await this.requireBridge().getPersistedWorkflow(workflowId);
    return JSON.parse(raw) as StudioShellApiResponse<PersistedWorkflowReadModel>;
  }

  public async duplicatePersistedWorkflow(
    request: DuplicatePersistedWorkflowRequest,
  ): Promise<StudioShellApiResponse<PersistedWorkflowReadModel>> {
    const raw = await this.requireBridge().duplicatePersistedWorkflow(JSON.stringify(request));
    return JSON.parse(raw) as StudioShellApiResponse<PersistedWorkflowReadModel>;
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

  public async assessDataStudioExecutionReadiness(
    request: AssessDataStudioExecutionReadinessRequest,
  ): Promise<StudioShellApiResponse<DataStudioExecutionReadinessReadModel>> {
    const raw = await this.requireBridge().assessDataStudioExecutionReadiness(JSON.stringify(request));
    return JSON.parse(raw) as StudioShellApiResponse<DataStudioExecutionReadinessReadModel>;
  }

  public async runDataStudioPipeline(
    request: RunDataStudioPipelineRequest,
  ): Promise<StudioShellApiResponse<RunDataStudioPipelineReadModel>> {
    const raw = await this.requireBridge().runDataStudioPipeline(JSON.stringify(request));
    return JSON.parse(raw) as StudioShellApiResponse<RunDataStudioPipelineReadModel>;
  }

  public async listDataStudioPipelines(
    request: ListDataStudioPipelinesRequest,
  ): Promise<StudioShellApiResponse<ReadonlyArray<DataStudioPipelineVersionReadModel>>> {
    const raw = await this.requireBridge().listDataStudioPipelines(JSON.stringify(request));
    return JSON.parse(raw) as StudioShellApiResponse<ReadonlyArray<DataStudioPipelineVersionReadModel>>;
  }

  public async loadDataStudioPipeline(
    request: LoadDataStudioPipelineRequest,
  ): Promise<StudioShellApiResponse<DataStudioPersistedPipelineReadModel>> {
    const raw = await this.requireBridge().loadDataStudioPipeline(JSON.stringify(request));
    return JSON.parse(raw) as StudioShellApiResponse<DataStudioPersistedPipelineReadModel>;
  }

  public async listWorkflowRuns(
    request: ListWorkflowStudioRunsRequest,
  ): Promise<StudioShellApiResponse<ReadonlyArray<WorkflowRunSummaryReadModel>>> {
    const raw = await this.requireBridge().listWorkflowRuns(JSON.stringify(request));
    return JSON.parse(raw) as StudioShellApiResponse<ReadonlyArray<WorkflowRunSummaryReadModel>>;
  }

  public async getWorkflowRunDetail(runId: string): Promise<StudioShellApiResponse<WorkflowRunDetailReadModel>> {
    const raw = await this.requireBridge().getWorkflowRunDetail(runId);
    return JSON.parse(raw) as StudioShellApiResponse<WorkflowRunDetailReadModel>;
  }

  public async startWorkflowRunRerun(
    request: StartWorkflowRunRerunRequest,
  ): Promise<StudioShellApiResponse<WorkflowRunRerunLaunchReadModel>> {
    const raw = await this.requireBridge().startWorkflowRunRerun(JSON.stringify(request));
    return JSON.parse(raw) as StudioShellApiResponse<WorkflowRunRerunLaunchReadModel>;
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

  public async saveSystemDefinition(request: SaveSystemDefinitionRequest): Promise<SystemStudioApiResponse<{
    readonly draft: StudioShellSnapshotReadModel["draft"];
    readonly serialization: Readonly<Record<string, unknown>>;
  }>> {
    const raw = await this.requireBridge().saveSystemDefinition(JSON.stringify(request));
    return JSON.parse(raw) as SystemStudioApiResponse<{
      readonly draft: StudioShellSnapshotReadModel["draft"];
      readonly serialization: Readonly<Record<string, unknown>>;
    }>;
  }

  public async loadSystemDefinition(request: LoadSystemDefinitionRequest): Promise<SystemStudioApiResponse<Readonly<Record<string, unknown>>>> {
    const raw = await this.requireBridge().loadSystemDefinition(JSON.stringify(request));
    return JSON.parse(raw) as SystemStudioApiResponse<Readonly<Record<string, unknown>>>;
  }

  public async duplicateSystemDefinition(request: DuplicateSystemDefinitionRequest): Promise<SystemStudioApiResponse<Readonly<Record<string, unknown>>>> {
    const raw = await this.requireBridge().duplicateSystemDefinition(JSON.stringify(request));
    return JSON.parse(raw) as SystemStudioApiResponse<Readonly<Record<string, unknown>>>;
  }

  public async modifySystemDefinition(request: ModifySystemDefinitionRequest): Promise<SystemStudioApiResponse<Readonly<Record<string, unknown>>>> {
    const raw = await this.requireBridge().modifySystemDefinition(JSON.stringify(request));
    return JSON.parse(raw) as SystemStudioApiResponse<Readonly<Record<string, unknown>>>;
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

  public async ingestReferenceImageUpload(request: IngestReferenceImageUploadRequest): Promise<StudioShellApiResponse<IngestReferenceImageUploadReadModel>> {
    const raw = await this.requireBridge().ingestReferenceImageUpload(JSON.stringify(request));
    return JSON.parse(raw) as StudioShellApiResponse<IngestReferenceImageUploadReadModel>;
  }

  public async persistReferenceImageOutputs(
    request: PersistReferenceImageOutputsRequest,
  ): Promise<StudioShellApiResponse<PersistReferenceImageOutputsReadModel>> {
    const raw = await this.requireBridge().persistReferenceImageOutputs(JSON.stringify(request));
    return JSON.parse(raw) as StudioShellApiResponse<PersistReferenceImageOutputsReadModel>;
  }

  public async listReferenceImageOutputs(
    request: ListReferenceImageOutputsRequest,
  ): Promise<StudioShellApiResponse<OutputGalleryListing>> {
    const raw = await this.requireBridge().listReferenceImageOutputs(JSON.stringify(request));
    return JSON.parse(raw) as StudioShellApiResponse<OutputGalleryListing>;
  }

  public async listReferenceImageRunHistory(
    request: ListReferenceImageRunHistoryRequest,
  ): Promise<StudioShellApiResponse<ImageRunHistoryListing>> {
    const raw = await this.requireBridge().listReferenceImageRunHistory(JSON.stringify(request));
    return JSON.parse(raw) as StudioShellApiResponse<ImageRunHistoryListing>;
  }

  public async chainReferenceImageDatasetItemToInput(
    request: ChainReferenceImageDatasetItemRequest,
  ): Promise<StudioShellApiResponse<ChainReferenceImageDatasetItemReadModel>> {
    const raw = await this.requireBridge().chainReferenceImageDatasetItemToInput(JSON.stringify(request));
    return JSON.parse(raw) as StudioShellApiResponse<ChainReferenceImageDatasetItemReadModel>;
  }
}
