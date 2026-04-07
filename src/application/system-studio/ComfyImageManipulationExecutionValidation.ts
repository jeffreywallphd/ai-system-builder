import type { ComfyAdapterErrorCode } from "../execution/comfyui/ComfyAdapterContract";
import {
  ComfyRuntimeAssetValidationStatuses,
  ComfyRuntimeWorkflowProfiles,
  resolveComfyRuntimeAssetRequirementsForProfile,
  resolveComfyRuntimeCustomNodeRequirementsForProfile,
  type ComfyRuntimeAssetRequirement,
  type ComfyRuntimeAssetValidationEntry,
} from "../runtime/ComfyRuntimeRequirements";
import { ComfyRuntimeInstallationAsset } from "../runtime/ComfyRuntimeInstallationAsset";
import type { ComfyRuntimeSystemDiagnostics } from "../runtime/ComfyRuntimeSystemDiagnostics";
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
  | "runtime-dependency-readiness"
  | "output-materialization-prerequisites";

type ComfyDependencyIssueClassification =
  | "required-missing-dependency"
  | "optional-missing-dependency"
  | "incompatible-dependency"
  | "unresolved-dependency-reference";

export interface ComfyExecutionReadinessIssue {
  readonly severity: "error" | "warning";
  readonly stage: ComfyExecutionReadinessValidationStage;
  readonly code: string;
  readonly message: string;
  readonly classification?: ComfyDependencyIssueClassification;
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

interface ParsedRuntimeDependencyDiagnostics {
  readonly modelEntriesByRequirementId: ReadonlyMap<string, ComfyRuntimeAssetValidationEntry>;
  readonly customNodeEntriesByRequirementId: ReadonlyMap<string, {
    readonly requirementId: string;
    readonly status: string;
  }>;
  readonly modelPhaseIssues: ReadonlyArray<{
    readonly code: string;
    readonly severity: "error" | "warning";
    readonly message: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }>;
  readonly customNodePhaseIssues: ReadonlyArray<{
    readonly code: string;
    readonly severity: "error" | "warning";
    readonly message: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }>;
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

function appendDependencyIssue(
  target: ComfyExecutionReadinessIssue[],
  input: {
    readonly code: string;
    readonly message: string;
    readonly classification: ComfyDependencyIssueClassification;
    readonly severity: "error" | "warning";
    readonly details?: Readonly<Record<string, unknown>>;
  },
): void {
  target.push(createIssue({
    severity: input.severity,
    stage: "runtime-dependency-readiness",
    code: input.code,
    message: input.message,
    classification: input.classification,
    details: input.details,
  }));
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

function parseRuntimeDependencyDiagnostics(
  diagnostics: ComfyRuntimeSystemDiagnostics | undefined,
): ParsedRuntimeDependencyDiagnostics {
  if (!diagnostics) {
    return Object.freeze({
      modelEntriesByRequirementId: new Map(),
      customNodeEntriesByRequirementId: new Map(),
      modelPhaseIssues: Object.freeze([]),
      customNodePhaseIssues: Object.freeze([]),
    });
  }

  const modelEntries = new Map<string, ComfyRuntimeAssetValidationEntry>();
  const customNodeEntries = new Map<string, { readonly requirementId: string; readonly status: string }>();
  const modelPhaseIssues: ParsedRuntimeDependencyDiagnostics["modelPhaseIssues"] = [];
  const customNodePhaseIssues: ParsedRuntimeDependencyDiagnostics["customNodePhaseIssues"] = [];

  const modelPhase = diagnostics.phaseDiagnostics.find((entry) => entry.phase === "model-validation");
  const modelResult = modelPhase?.metadata?.modelValidation as
    | { readonly result?: { readonly entries?: ReadonlyArray<ComfyRuntimeAssetValidationEntry> } }
    | undefined;
  for (const entry of modelResult?.result?.entries ?? []) {
    if (entry?.requirementId) {
      modelEntries.set(entry.requirementId, entry);
    }
  }

  const customNodePhase = diagnostics.phaseDiagnostics.find((entry) => entry.phase === "custom-nodes");
  const customNodeInstall = customNodePhase?.metadata?.customNodeInstall as
    | { readonly entries?: ReadonlyArray<{ readonly requirementId?: string; readonly status?: string }> }
    | undefined;
  for (const entry of customNodeInstall?.entries ?? []) {
    const requirementId = entry.requirementId?.trim();
    if (!requirementId) continue;
    customNodeEntries.set(requirementId, Object.freeze({
      requirementId,
      status: entry.status?.trim() ?? "unknown",
    }));
  }

  for (const issue of diagnostics.failures) {
    if (issue.phase === "model-validation") {
      modelPhaseIssues.push(Object.freeze({
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
        metadata: issue.metadata,
      }));
    } else if (issue.phase === "custom-nodes") {
      customNodePhaseIssues.push(Object.freeze({
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
        metadata: issue.metadata,
      }));
    }
  }

  return Object.freeze({
    modelEntriesByRequirementId: modelEntries,
    customNodeEntriesByRequirementId: customNodeEntries,
    modelPhaseIssues: Object.freeze(modelPhaseIssues),
    customNodePhaseIssues: Object.freeze(customNodePhaseIssues),
  });
}

function isReferenceResolvableFromEntry(reference: string, entry: ComfyRuntimeAssetValidationEntry): boolean {
  const normalized = reference.trim().toLowerCase();
  if (!normalized || normalized === "system-default") return true;
  const resolved = entry.resolvedFileName?.trim().toLowerCase();
  if (resolved && (resolved === normalized || resolved.startsWith(`${normalized}.`))) {
    return true;
  }
  return false;
}

function validateRuntimeDependencyReadiness(input: {
  readonly request: ComfyImageManipulationGraphBuildRequest;
  readonly executionPath: "non-faceid" | "faceid";
  readonly requiredModelKinds: ReadonlySet<"checkpoint" | "vae" | "faceid">;
  readonly issues: ComfyExecutionReadinessIssue[];
  readonly checkpointModelRef?: string;
  readonly vaeModelRef?: string;
  readonly faceIdModelRef?: string;
}): void {
  const runtimeInstallationAsset = input.request.runtimeInstallationAsset ?? ComfyRuntimeInstallationAsset;
  const workflowProfile = input.executionPath === "faceid"
    ? ComfyRuntimeWorkflowProfiles.imageManipulationFaceId
    : ComfyRuntimeWorkflowProfiles.imageManipulationDefault;
  const hasRuntimeDiagnostics = Boolean(input.request.runtimeDiagnostics);
  const dependencyDiagnostics = parseRuntimeDependencyDiagnostics(input.request.runtimeDiagnostics);

  const requiredAssetRequirements = resolveComfyRuntimeAssetRequirementsForProfile({
    requirements: runtimeInstallationAsset.runtimeAssetRequirements,
    workflowProfile,
  });
  const requiredCustomNodeRequirements = resolveComfyRuntimeCustomNodeRequirementsForProfile({
    requirements: runtimeInstallationAsset.customNodeRequirements,
    workflowProfile,
  });

  validateExpectedRuntimeModelRequirement({
    expectedKind: "checkpoint",
    configuredModelRef: input.checkpointModelRef,
    requiredModelKinds: input.requiredModelKinds,
    requirements: requiredAssetRequirements,
    dependencyDiagnostics,
    hasRuntimeDiagnostics,
    executionPath: input.executionPath,
    issues: input.issues,
  });
  validateExpectedRuntimeModelRequirement({
    expectedKind: "vae",
    configuredModelRef: input.vaeModelRef,
    requiredModelKinds: input.requiredModelKinds,
    requirements: requiredAssetRequirements,
    dependencyDiagnostics,
    hasRuntimeDiagnostics,
    executionPath: input.executionPath,
    issues: input.issues,
  });
  if (input.executionPath === "faceid") {
    validateExpectedRuntimeModelRequirement({
      expectedKind: "faceid-model",
      configuredModelRef: input.faceIdModelRef,
      requiredModelKinds: new Set(["faceid"]),
      requirements: requiredAssetRequirements,
      dependencyDiagnostics,
      hasRuntimeDiagnostics,
      executionPath: input.executionPath,
      issues: input.issues,
    });
  }

  for (const requirement of requiredCustomNodeRequirements) {
    if (!requirement.required) {
      continue;
    }
    if (!hasRuntimeDiagnostics) {
      continue;
    }
    const installed = dependencyDiagnostics.customNodeEntriesByRequirementId.get(requirement.requirementId);
    if (!installed) {
      appendDependencyIssue(input.issues, {
        code: "custom-node-dependency-unresolved",
        message: `Custom-node dependency '${requirement.displayName}' does not have a resolvable runtime validation entry.`,
        classification: "unresolved-dependency-reference",
        severity: "error",
        details: Object.freeze({
          requirementId: requirement.requirementId,
          executionPath: input.executionPath,
        }),
      });
      continue;
    }
    if (installed.status === "failed") {
      appendDependencyIssue(input.issues, {
        code: "custom-node-dependency-incompatible",
        message: `Custom-node dependency '${requirement.displayName}' is installed but not compatible enough for execution.`,
        classification: "incompatible-dependency",
        severity: "error",
        details: Object.freeze({
          requirementId: requirement.requirementId,
          status: installed.status,
          executionPath: input.executionPath,
        }),
      });
    }
  }

  if (!hasRuntimeDiagnostics) {
    return;
  }

  for (const issue of dependencyDiagnostics.modelPhaseIssues) {
    if (issue.code === "runtime-asset-directory-missing" || issue.code === "runtime-asset-missing") {
      appendDependencyIssue(input.issues, {
        code: "runtime-model-dependency-missing",
        message: issue.message,
        classification: "required-missing-dependency",
        severity: issue.severity,
        details: issue.metadata,
      });
    } else if (issue.code.includes("incompatible")) {
      appendDependencyIssue(input.issues, {
        code: "runtime-model-dependency-incompatible",
        message: issue.message,
        classification: "incompatible-dependency",
        severity: issue.severity,
        details: issue.metadata,
      });
    }
  }

  for (const issue of dependencyDiagnostics.customNodePhaseIssues) {
    if (issue.code.includes("install-failed")) {
      appendDependencyIssue(input.issues, {
        code: "custom-node-dependency-required-missing",
        message: issue.message,
        classification: "required-missing-dependency",
        severity: issue.severity,
        details: issue.metadata,
      });
    } else if (issue.code.includes("validation-failed")) {
      appendDependencyIssue(input.issues, {
        code: "custom-node-dependency-incompatible",
        message: issue.message,
        classification: "incompatible-dependency",
        severity: issue.severity,
        details: issue.metadata,
      });
    }
  }
}

function validateExpectedRuntimeModelRequirement(input: {
  readonly expectedKind: "checkpoint" | "vae" | "faceid-model";
  readonly configuredModelRef?: string;
  readonly requiredModelKinds: ReadonlySet<"checkpoint" | "vae" | "faceid">;
  readonly requirements: ReadonlyArray<ComfyRuntimeAssetRequirement>;
  readonly dependencyDiagnostics: ParsedRuntimeDependencyDiagnostics;
  readonly hasRuntimeDiagnostics: boolean;
  readonly executionPath: "non-faceid" | "faceid";
  readonly issues: ComfyExecutionReadinessIssue[];
}): void {
  const isRequiredByWorkflow = input.expectedKind === "faceid-model"
    ? input.requiredModelKinds.has("faceid")
    : input.requiredModelKinds.has(input.expectedKind);
  if (!isRequiredByWorkflow) {
    return;
  }

  const matchingRequirement = input.requirements.find((entry) => entry.kind === input.expectedKind);
  if (!matchingRequirement) {
    appendDependencyIssue(input.issues, {
      code: "runtime-model-requirement-unresolved",
      message: `Workflow dependency '${input.expectedKind}' could not be resolved to an installer/runtime requirement.`,
      classification: "unresolved-dependency-reference",
      severity: "error",
      details: Object.freeze({
        expectedKind: input.expectedKind,
        executionPath: input.executionPath,
      }),
    });
    return;
  }

  const validationEntry = input.dependencyDiagnostics.modelEntriesByRequirementId.get(matchingRequirement.requirementId);
  if (!input.hasRuntimeDiagnostics) {
    return;
  }
  if (!validationEntry) {
    appendDependencyIssue(input.issues, {
      code: "runtime-model-validation-entry-unresolved",
      message: `Runtime model requirement '${matchingRequirement.displayName}' did not produce a resolvable validation entry.`,
      classification: "unresolved-dependency-reference",
      severity: "error",
      details: Object.freeze({
        requirementId: matchingRequirement.requirementId,
        executionPath: input.executionPath,
      }),
    });
    return;
  }

  if (
    validationEntry.status === ComfyRuntimeAssetValidationStatuses.missingRequired
    || (validationEntry.status === ComfyRuntimeAssetValidationStatuses.missingOptional && matchingRequirement.required)
  ) {
    appendDependencyIssue(input.issues, {
      code: "runtime-model-required-missing",
      message: `Required model dependency '${matchingRequirement.displayName}' is missing.`,
      classification: "required-missing-dependency",
      severity: "error",
      details: Object.freeze({
        requirementId: matchingRequirement.requirementId,
        requirementKind: matchingRequirement.kind,
        executionPath: input.executionPath,
      }),
    });
    return;
  }

  if (validationEntry.status === ComfyRuntimeAssetValidationStatuses.missingOptional && !matchingRequirement.required) {
    appendDependencyIssue(input.issues, {
      code: "runtime-model-optional-missing",
      message: `Optional model dependency '${matchingRequirement.displayName}' is missing.`,
      classification: "optional-missing-dependency",
      severity: "warning",
      details: Object.freeze({
        requirementId: matchingRequirement.requirementId,
        requirementKind: matchingRequirement.kind,
        executionPath: input.executionPath,
      }),
    });
    return;
  }

  if (validationEntry.status === ComfyRuntimeAssetValidationStatuses.incompatible) {
    appendDependencyIssue(input.issues, {
      code: "runtime-model-incompatible",
      message: `Model dependency '${matchingRequirement.displayName}' is incompatible with runtime requirements.`,
      classification: "incompatible-dependency",
      severity: "error",
      details: Object.freeze({
        requirementId: matchingRequirement.requirementId,
        requirementKind: matchingRequirement.kind,
        executionPath: input.executionPath,
      }),
    });
    return;
  }

  const configuredModelRef = input.configuredModelRef?.trim();
  if (!configuredModelRef || configuredModelRef === "system-default") {
    return;
  }
  if (!isReferenceResolvableFromEntry(configuredModelRef, validationEntry)) {
    appendDependencyIssue(input.issues, {
      code: "runtime-model-reference-unresolved",
      message: `Configured model reference '${configuredModelRef}' is not resolvable by runtime dependency validation.`,
      classification: "unresolved-dependency-reference",
      severity: "error",
      details: Object.freeze({
        configuredModelRef,
        requirementId: matchingRequirement.requirementId,
        resolvedFileName: validationEntry.resolvedFileName,
        executionPath: input.executionPath,
      }),
    });
  }
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

  const requiredModelKinds = new Set(parseRequiredDependencyModelKinds(
    request.workflowTemplate.executionMetadata?.runtime.requiredDependencies ?? [],
  ));
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
    requiredModelKinds.add("faceid");
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

  validateRuntimeDependencyReadiness({
    request,
    executionPath,
    requiredModelKinds,
    issues,
    checkpointModelRef: models.checkpointModel,
    vaeModelRef: models.vaeModel,
    faceIdModelRef: request.resolvedConfig.models.faceIdModel,
  });

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
