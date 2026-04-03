import type { WorkflowTemplateDefinition } from "../../domain/workflow-template-studio/WorkflowTemplateDomain";
import {
  ComfyImageManipulationBaseGraphContractVersion,
  type ComfyImageManipulationBaseGraph,
} from "./ComfyImageManipulationBaseGraph";
import type { ComfyImageManipulationConfig } from "./ComfyImageManipulationPropertySchema";
import type {
  ComfyImageManipulationDatasetRuntimeHandle,
  ResolvedComfyInputDatasetBinding,
} from "./ComfyImageManipulationDatasetBindingAsset";
import type {
  ComfyAdapterErrorCode,
  ComfyAdapterLifecycleStatus,
} from "../execution/comfyui/ComfyAdapterContract";

export const ComfyImageManipulationExecutionContractVersion = "1.0.0";

export interface ComfyPromptGraphNode {
  readonly class_type: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly _meta?: Readonly<{ readonly title?: string; readonly purpose?: string }>;
}

export interface ComfyImageManipulationPromptGraph {
  readonly prompt: Readonly<Record<string, ComfyPromptGraphNode>>;
  readonly outputNodeIds: ReadonlyArray<string>;
}

export interface ComfyImageManipulationExecutionRuntimeMetadata {
  readonly executionId?: string;
  readonly workflowVersionId?: string;
  readonly parentExecutionId?: string;
  readonly systemAssetId?: string;
  readonly systemVersionId?: string;
  readonly sessionId?: string;
  readonly traceId?: string;
  readonly runtimeProfile?: string;
  readonly triggerSource?: string;
  readonly triggerAction?: string;
  readonly tags?: ReadonlyArray<string>;
}

export interface ComfyImageManipulationGraphBuildRequest {
  readonly contractVersion: typeof ComfyImageManipulationExecutionContractVersion;
  readonly workflowTemplate: Pick<WorkflowTemplateDefinition, "templateId" | "versionId" | "metadata" | "executionMetadata" | "composition">;
  readonly baseGraph: ComfyImageManipulationBaseGraph;
  readonly resolvedConfig: ComfyImageManipulationConfig;
  readonly datasetHandles: ReadonlyArray<ComfyImageManipulationDatasetRuntimeHandle>;
  readonly runtimeMetadata: ComfyImageManipulationExecutionRuntimeMetadata;
}

export interface ComfyImageManipulationMaterializationBinding {
  readonly bindingId: string;
  readonly targetDatasetAssetId: string;
  readonly targetDatasetInstanceRef?: string;
  readonly targetStorageInstanceRef?: string;
  readonly targetStorageBindingId?: string;
}

export interface ComfyImageManipulationExecutionSubmission {
  readonly contractVersion: typeof ComfyImageManipulationExecutionContractVersion;
  readonly executionRequestId: string;
  readonly graph: ComfyImageManipulationPromptGraph;
  readonly sourceDatasetBinding: ResolvedComfyInputDatasetBinding;
  readonly runtimeMetadata: ComfyImageManipulationExecutionRuntimeMetadata;
  readonly materializationBindings: ReadonlyArray<ComfyImageManipulationMaterializationBinding>;
  readonly inspection: Readonly<{
    readonly graphAssetId: string;
    readonly graphContractVersion: typeof ComfyImageManipulationBaseGraphContractVersion;
    readonly templateId: string;
    readonly templateVersionId: string;
    readonly nodeCount: number;
    readonly boundInputCount: number;
    readonly executionPath: "non-faceid" | "faceid";
    readonly extensionBindings: ReadonlyArray<Readonly<Record<string, unknown>>>;
    readonly subworkflowBindings?: ReadonlyArray<Readonly<Record<string, unknown>>>;
  }>;
}

export interface ComfyImageManipulationExecutionProgressSnapshot {
  readonly executionId: string;
  readonly status: ComfyAdapterLifecycleStatus;
  readonly percent?: number;
  readonly message?: string;
  readonly queuePosition?: number;
  readonly updatedAt: string;
}

export interface ComfyImageManipulationMaterializationHookBinding {
  readonly workflowOutputId: string;
  readonly outputNodeId: string;
  readonly outputIndex: number;
  readonly binding: ComfyImageManipulationMaterializationBinding;
}

export interface ComfyImageManipulationExecutionSuccess {
  readonly status: "completed";
  readonly executionId: string;
  readonly outputs: ReadonlyArray<Readonly<{
    readonly outputNodeId: string;
    readonly outputIndex: number;
    readonly reference: string;
    readonly assetRef?: Readonly<{ readonly assetId: string; readonly versionId?: string }>;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }>>;
  readonly materializationHooks: ReadonlyArray<ComfyImageManipulationMaterializationHookBinding>;
  readonly inspection?: Readonly<Record<string, unknown>>;
}

export interface ComfyImageManipulationExecutionFailure {
  readonly status: "failed" | "cancelled";
  readonly executionId?: string;
  readonly error: Readonly<{
    readonly code: ComfyAdapterErrorCode;
    readonly category:
      | "connectivity"
      | "validation"
      | "mapping"
      | "execution"
      | "timeout"
      | "cancellation"
      | "output"
      | "unknown";
    readonly message: string;
    readonly retryable: boolean;
    readonly details?: Readonly<Record<string, unknown>>;
  }>;
  readonly inspection?: Readonly<Record<string, unknown>>;
}

export type ComfyImageManipulationExecutionResult =
  | ComfyImageManipulationExecutionSuccess
  | ComfyImageManipulationExecutionFailure;

export interface IComfyImageManipulationExecutionAdapter {
  buildGraphRequest(request: ComfyImageManipulationGraphBuildRequest): ComfyImageManipulationExecutionSubmission;
  submitExecution(request: ComfyImageManipulationExecutionSubmission): Promise<{ readonly executionId: string }>;
  getExecutionProgress(executionId: string): Promise<ComfyImageManipulationExecutionProgressSnapshot>;
  waitForExecutionResult(executionId: string): Promise<ComfyImageManipulationExecutionResult>;
}
