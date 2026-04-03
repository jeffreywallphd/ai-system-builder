import type { ComfyAdapterErrorCode } from "../execution/comfyui/ComfyAdapterContract";
import type {
  ComfyImageManipulationExecutionFailure,
  ComfyImageManipulationGraphBuildRequest,
  ComfyImageManipulationMaterializationBinding,
} from "./ComfyImageManipulationExecutionAdapterContract";
import { ComfyImageManipulationExecutionContractVersion } from "./ComfyImageManipulationExecutionAdapterContract";
import {
  ComfyImageManipulationBaseGraph,
  createComfyImageManipulationBaseGraph,
} from "./ComfyImageManipulationBaseGraph";
import {
  resolveComfyImageManipulationGraphBindings,
  type ResolveComfyImageManipulationGraphBindingsResult,
} from "./ComfyImageManipulationPropertyMappingAsset";
import { resolveComfyInputDatasetBinding, type ResolvedComfyInputDatasetBinding } from "./ComfyImageManipulationDatasetBindingAsset";
import {
  resolveComfyImageManipulationRuntimeConfiguration,
  type ComfyImageManipulationRuntimeResolution,
} from "./ComfyImageManipulationRuntimeResolution";

export const SupportedComfyImageManipulationTemplateIds = Object.freeze([
  "asset:workflow-template:image-manipulation:default",
  "asset:workflow-template:image-to-image:starter",
]);

type ComfyExecutionReadinessValidationStage =
  | "workflow-template-resolution"
  | "property-to-node-mapping-resolution"
  | "dataset-storage-binding-resolution"
  | "runtime-configuration-resolution"
  | "model-dependency-availability"
  | "output-materialization-prerequisites";

export interface ComfyExecutionReadinessIssue {
  readonly severity: "error" | "warning";
  readonly stage: ComfyExecutionReadinessValidationStage;
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ComfyImageManipulationExecutionReadinessResult {
  readonly ready: boolean;
  readonly executionPath: "non-faceid" | "faceid";
  readonly issues: ReadonlyArray<ComfyExecutionReadinessIssue>;
  readonly inspection: Readonly<{
    readonly templateId: string;
    readonly templateVersionId: string;
    readonly mappingResolved: boolean;
    readonly datasetBindingResolved: boolean;
    readonly runtimeResolution?: ComfyImageManipulationRuntimeResolution;
    readonly materializationBindingCount: number;
  }>;
  readonly graph?: ReturnType<typeof createComfyImageManipulationBaseGraph>;
  readonly mapping?: ResolveComfyImageManipulationGraphBindingsResult;
  readonly sourceDatasetBinding?: ResolvedComfyInputDatasetBinding;
  readonly runtimeResolution?: ComfyImageManipulationRuntimeResolution;
  readonly materializationBindings: ReadonlyArray<ComfyImageManipulationMaterializationBinding>;
}

function createIssue(input: ComfyExecutionReadinessIssue): ComfyExecutionReadinessIssue {
  return Object.freeze(input);
}

function appendErrors(
  target: ComfyExecutionReadinessIssue[],
  stage: ComfyExecutionReadinessValidationStage,
  messages: ReadonlyArray<string>,
): void {
  for (const message of messages) {
    target.push(createIssue({
      severity: "error",
      stage,
      code: "validation-failed",
      message,
    }));
  }
}

function parseRequiredDependencyModelKinds(
  requiredDependencies: ReadonlyArray<string>,
): ReadonlySet<"checkpoint" | "vae" | "faceid"> {
  const required = new Set<"checkpoint" | "vae" | "faceid">();
  for (const dependency of requiredDependencies) {
    const normalized = dependency.trim().toLowerCase();
    if (normalized === "model:checkpoint") {
      required.add("checkpoint");
    } else if (normalized === "model:vae") {
      required.add("vae");
    } else if (normalized === "model:faceid") {
      required.add("faceid");
    }
  }
  return required;
}

function resolveMaterializationBindings(
  request: ComfyImageManipulationGraphBuildRequest,
): ReadonlyArray<ComfyImageManipulationMaterializationBinding> {
  const bindings = request.workflowTemplate.composition?.outputBindings ?? [];
  return Object.freeze(bindings
    .map((binding) => Object.freeze({
      bindingId: binding.bindingId,
      targetDatasetAssetId: binding.targetDatasetAssetId ?? "",
      targetDatasetInstanceRef: binding.targetDatasetInstanceRef,
      targetStorageInstanceRef: binding.targetStorageInstanceRef,
      targetStorageBindingId: binding.targetStorageBindingId,
    }))
    .filter((entry) => entry.targetDatasetAssetId.trim().length > 0));
}

export function validateComfyImageManipulationExecutionReadiness(
  request: ComfyImageManipulationGraphBuildRequest,
): ComfyImageManipulationExecutionReadinessResult {
  const issues: ComfyExecutionReadinessIssue[] = [];

  if (request.contractVersion !== ComfyImageManipulationExecutionContractVersion) {
    issues.push(createIssue({
      severity: "error",
      stage: "workflow-template-resolution",
      code: "unsupported-contract-version",
      message: `Unsupported Comfy image manipulation execution contract version '${request.contractVersion}'.`,
    }));
  }

  if (!SupportedComfyImageManipulationTemplateIds.includes(request.workflowTemplate.templateId)) {
    issues.push(createIssue({
      severity: "error",
      stage: "workflow-template-resolution",
      code: "unsupported-template",
      message: `Unsupported image manipulation template '${request.workflowTemplate.templateId}'.`,
    }));
  }

  let graph: ReturnType<typeof createComfyImageManipulationBaseGraph> | undefined;
  try {
    graph = createComfyImageManipulationBaseGraph(request.baseGraph ?? ComfyImageManipulationBaseGraph);
  } catch (error) {
    issues.push(createIssue({
      severity: "error",
      stage: "workflow-template-resolution",
      code: "base-graph-resolution-failed",
      message: error instanceof Error ? error.message : "Unable to resolve Comfy base graph.",
    }));
  }

  let mapping: ResolveComfyImageManipulationGraphBindingsResult | undefined;
  try {
    mapping = resolveComfyImageManipulationGraphBindings(request.resolvedConfig);
  } catch (error) {
    issues.push(createIssue({
      severity: "error",
      stage: "property-to-node-mapping-resolution",
      code: "mapping-resolution-failed",
      message: error instanceof Error ? error.message : "Unable to resolve property-to-node mappings.",
    }));
  }

  const executionPath = mapping?.subworkflowBindings[0]?.enabled ? "faceid" : "non-faceid";
  const faceIdBinding = mapping?.subworkflowBindings[0];

  let sourceDatasetBinding: ResolvedComfyInputDatasetBinding | undefined;
  try {
    sourceDatasetBinding = resolveComfyInputDatasetBinding({ handles: request.datasetHandles });
  } catch (error) {
    issues.push(createIssue({
      severity: "error",
      stage: "dataset-storage-binding-resolution",
      code: "input-dataset-binding-missing",
      message: error instanceof Error ? error.message : "Unable to resolve source image dataset binding.",
    }));
  }

  const materializationBindings = resolveMaterializationBindings(request);
  if (materializationBindings.length < 1) {
    issues.push(createIssue({
      severity: "error",
      stage: "output-materialization-prerequisites",
      code: "materialization-binding-missing",
      message: "At least one output materialization binding is required.",
    }));
  }
  for (const binding of materializationBindings) {
    if (!binding.targetDatasetAssetId.trim()) {
      issues.push(createIssue({
        severity: "error",
        stage: "output-materialization-prerequisites",
        code: "materialization-target-dataset-missing",
        message: `Materialization binding '${binding.bindingId}' must include a target dataset asset id.`,
      }));
    }
    if (
      !binding.targetDatasetInstanceRef
      && !binding.targetStorageInstanceRef
      && !binding.targetStorageBindingId
    ) {
      issues.push(createIssue({
        severity: "error",
        stage: "output-materialization-prerequisites",
        code: "materialization-target-reference-missing",
        message: `Materialization binding '${binding.bindingId}' must include dataset or storage target references.`,
      }));
    }
    if (binding.targetStorageInstanceRef && !binding.targetStorageInstanceRef.startsWith("storage-instance://")) {
      issues.push(createIssue({
        severity: "error",
        stage: "output-materialization-prerequisites",
        code: "materialization-storage-reference-invalid",
        message: `Materialization binding '${binding.bindingId}' storage reference must use storage-instance:// logical URI form.`,
      }));
    }
  }

  const runtimeResolution = resolveComfyImageManipulationRuntimeConfiguration({
    workflowTemplate: request.workflowTemplate,
    datasetHandles: request.datasetHandles,
    runtimeEnvironment: request.runtimeEnvironment,
    capabilityBinding: request.runtimeCapabilityBinding,
  });
  appendErrors(issues, "runtime-configuration-resolution", runtimeResolution.diagnostics.issues);
  for (const warning of runtimeResolution.diagnostics.warnings) {
    issues.push(createIssue({
      severity: "warning",
      stage: "runtime-configuration-resolution",
      code: "runtime-warning",
      message: warning,
    }));
  }

  const requiredModelKinds = parseRequiredDependencyModelKinds(
    request.workflowTemplate.executionMetadata?.runtime.requiredDependencies ?? [],
  );
  const models = request.resolvedConfig.models;
  if (requiredModelKinds.has("checkpoint") && !models.checkpointModel.trim()) {
    issues.push(createIssue({
      severity: "error",
      stage: "model-dependency-availability",
      code: "checkpoint-model-missing",
      message: "Checkpoint model selection is required for execution.",
    }));
  }
  if (requiredModelKinds.has("vae") && !models.vaeModel.trim()) {
    issues.push(createIssue({
      severity: "error",
      stage: "model-dependency-availability",
      code: "vae-model-missing",
      message: "VAE model selection is required for execution.",
    }));
  }

  if (executionPath === "faceid") {
    if (!faceIdBinding?.enabled) {
      issues.push(createIssue({
        severity: "error",
        stage: "model-dependency-availability",
        code: "faceid-not-enabled",
        message: "FaceID execution path requires FaceID to be enabled.",
      }));
    }
    if (!faceIdBinding?.model?.trim()) {
      issues.push(createIssue({
        severity: "error",
        stage: "model-dependency-availability",
        code: "faceid-model-missing",
        message: "FaceID model selection is required when FaceID is enabled.",
      }));
    }
    if ((faceIdBinding?.referenceBindings.length ?? 0) < 1) {
      issues.push(createIssue({
        severity: "error",
        stage: "dataset-storage-binding-resolution",
        code: "faceid-reference-binding-missing",
        message: "FaceID reference dataset bindings are required when FaceID is enabled.",
      }));
    }
  }

  if (request.runtimeCapabilityBinding?.availability.status === "unavailable") {
    issues.push(createIssue({
      severity: "error",
      stage: "model-dependency-availability",
      code: "runtime-capability-unavailable",
      message: request.runtimeCapabilityBinding.availability.message
        ?? "Runtime capability binding is unavailable for the selected execution path.",
      details: Object.freeze({
        missingCapabilities: request.runtimeCapabilityBinding.availability.missingCapabilities,
      }),
    }));
  }

  const ready = issues.every((issue) => issue.severity !== "error");
  return Object.freeze({
    ready,
    executionPath,
    issues: Object.freeze(issues),
    inspection: Object.freeze({
      templateId: request.workflowTemplate.templateId,
      templateVersionId: request.workflowTemplate.versionId,
      mappingResolved: Boolean(mapping),
      datasetBindingResolved: Boolean(sourceDatasetBinding),
      runtimeResolution,
      materializationBindingCount: materializationBindings.length,
    }),
    graph,
    mapping,
    sourceDatasetBinding,
    runtimeResolution,
    materializationBindings,
  });
}

export function createComfyExecutionReadinessFailure(
  readiness: ComfyImageManipulationExecutionReadinessResult,
  executionId?: string,
): ComfyImageManipulationExecutionFailure {
  const blocking = readiness.issues.filter((issue) => issue.severity === "error");
  const message = blocking[0]?.message ?? "Comfy image manipulation execution is not ready.";

  return Object.freeze({
    status: "failed",
    executionId,
    error: Object.freeze({
      code: "invalid-request" as ComfyAdapterErrorCode,
      category: "validation",
      message,
      retryable: false,
      details: Object.freeze({
        stage: "execution-readiness-validation",
        executionPath: readiness.executionPath,
        issues: blocking,
      }),
    }),
    inspection: Object.freeze({
      readiness,
    }),
  });
}

export class ComfyImageManipulationExecutionReadinessError extends Error {
  public constructor(
    public readonly readiness: ComfyImageManipulationExecutionReadinessResult,
    public readonly failure: ComfyImageManipulationExecutionFailure,
  ) {
    super(failure.error.message);
    this.name = "ComfyImageManipulationExecutionReadinessError";
  }
}
