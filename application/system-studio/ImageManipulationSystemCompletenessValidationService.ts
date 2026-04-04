import {
  AssetValidationLayers,
  AssetValidationSeverities,
  AssetValidationStatuses,
  createAssetValidationResult,
  type AssetValidationIssue,
  type AssetValidationResult,
} from "../../domain/contracts/AssetValidation";
import type { WorkflowTemplateDefinition } from "../../domain/workflow-template-studio/WorkflowTemplateDomain";
import { DatasetInstanceRoles } from "../../domain/system-runtime/DatasetInstanceDomain";
import { parseStorageLogicalReference } from "../system-runtime/StorageInstanceProvisioningContract";
import {
  ComfyImageManipulationPropertySchema,
  createComfyImageManipulationDefaultConfig,
  validateComfyImageManipulationConfig,
  type ComfyImageManipulationPropertySchemaDefinition,
} from "./ComfyImageManipulationPropertySchema";
import {
  buildImageManipulationDatasetInstanceRequests,
  ImageManipulationSystemTemplate,
  type ImageManipulationSystemTemplateDefinition,
} from "./ImageManipulationSystemTemplate";
import { ImageManipulationWorkflowTemplate } from "../workflow-template-studio/ImageManipulationWorkflowTemplate";
import { ComfyRuntimeInstallationAssetId } from "../runtime/ComfyRuntimeInstallationAsset";
import { ComfyRuntimeWorkflowProfiles } from "../runtime/ComfyRuntimeRequirements";
import { ComfyRuntimeSystemDiagnosticsVersion } from "../runtime/ComfyRuntimeSystemDiagnostics";
import { ComfyImageManipulationDatasetBindingAssetId } from "./ComfyImageManipulationDatasetBindingAsset";
import { ComfyImageManipulationPropertyMappingAssetId } from "./ComfyImageManipulationPropertyMappingAsset";

export const ImageManipulationRuntimeTargets = Object.freeze({
  runtimeEnvironment: "comfyui",
  orchestrationMode: "workflow-template-driven",
  requiredCapabilities: Object.freeze([
    "comfyui-api",
    "workflow-template-execution",
    "image-generation",
    "dataset-runtime-handles",
  ]),
  requiredOrchestrationHints: Object.freeze([
    "external-runtime-adapter",
    "version-pinned-workflow-template",
  ]),
});

export const ImageManipulationTemplateValidationCategories = Object.freeze({
  systemAsset: "system-asset",
  pageAsset: "page-asset",
  workflowTemplate: "workflow-template",
  propertySchema: "property-schema",
  runtimeMetadata: "runtime-metadata",
  datasetBindings: "dataset-bindings",
  storageBindings: "storage-bindings",
  executionAdapter: "execution-adapter",
  runnableDefaults: "runnable-defaults",
} as const);

export type ImageManipulationTemplateValidationCategory =
  typeof ImageManipulationTemplateValidationCategories[keyof typeof ImageManipulationTemplateValidationCategories];

export type ImageManipulationTemplateValidationSeverity = "error" | "warning";

export interface ImageManipulationTemplateValidationIssue {
  readonly category: ImageManipulationTemplateValidationCategory;
  readonly code: string;
  readonly severity: ImageManipulationTemplateValidationSeverity;
  readonly message: string;
  readonly path?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ImageManipulationTemplateCompletenessValidationResult {
  readonly status: "valid" | "invalid";
  readonly runnable: boolean;
  readonly issues: ReadonlyArray<ImageManipulationTemplateValidationIssue>;
  readonly categories: Readonly<Record<ImageManipulationTemplateValidationCategory, {
    readonly errors: number;
    readonly warnings: number;
  }>>;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly assetValidation: AssetValidationResult;
}

export interface ValidateImageManipulationTemplateCompletenessInput {
  readonly template?: ImageManipulationSystemTemplateDefinition;
  readonly workflowTemplate?: WorkflowTemplateDefinition;
  readonly propertySchema?: ComfyImageManipulationPropertySchemaDefinition;
  readonly buildTemplateContent?: string;
}

const requiredRuntimeCapabilities = Object.freeze([
  "workflow-template-execution",
  "dataset-instance-output-materialization",
  "storage-instance-dataset-bindings",
]);
const requiredRuntimeDependencies = Object.freeze(["model:checkpoint", "model:vae"]);
const requiredWorkflowDefaultParameters = Object.freeze([
  "positivePrompt",
  "negativePrompt",
  "steps",
  "cfg",
  "denoiseStrength",
  "sampler",
  "scheduler",
  "seed",
  "resultCount",
  "checkpointModel",
  "vaeModel",
  "faceIdEnabled",
  "faceIdReferenceBindings",
]);
const requiredTemplateEmits = Object.freeze(["sourceImageSelected", "runRequested"]);
const requiredExecutionAdapterHints = Object.freeze(["comfy-base-graph-required"]);
const requiredOutputHandlingHints = Object.freeze(["resolve-output-via-storage-instance-binding"]);

function looksLikeRawPath(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  return normalized.startsWith("/")
    || normalized.startsWith("./")
    || normalized.startsWith("../")
    || /^[A-Za-z]:[\\/]/.test(normalized)
    || normalized.includes("\\");
}

function createIssue(input: {
  readonly category: ImageManipulationTemplateValidationCategory;
  readonly code: string;
  readonly severity: ImageManipulationTemplateValidationSeverity;
  readonly message: string;
  readonly path?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}): ImageManipulationTemplateValidationIssue {
  return Object.freeze(input);
}

function getByPath(input: unknown, path: string): unknown {
  const parts = path.split(".").map((entry) => entry.trim()).filter(Boolean);
  let current: unknown = input;
  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function mapCategoryToLayer(category: ImageManipulationTemplateValidationCategory): "structural" | "referential" | "compatibility" {
  if (
    category === ImageManipulationTemplateValidationCategories.workflowTemplate
    || category === ImageManipulationTemplateValidationCategories.datasetBindings
    || category === ImageManipulationTemplateValidationCategories.storageBindings
    || category === ImageManipulationTemplateValidationCategories.pageAsset
  ) {
    return AssetValidationLayers.referential;
  }
  if (
    category === ImageManipulationTemplateValidationCategories.runtimeMetadata
    || category === ImageManipulationTemplateValidationCategories.executionAdapter
    || category === ImageManipulationTemplateValidationCategories.runnableDefaults
  ) {
    return AssetValidationLayers.compatibility;
  }
  return AssetValidationLayers.structural;
}

function toAssetValidationIssue(issue: ImageManipulationTemplateValidationIssue, assetId: string): AssetValidationIssue {
  return Object.freeze({
    code: issue.code,
    message: issue.message,
    severity: issue.severity === "warning" ? AssetValidationSeverities.warning : AssetValidationSeverities.error,
    layer: mapCategoryToLayer(issue.category),
    assetId,
    assetType: "system-template",
    path: issue.path,
    metadata: issue.metadata ? { category: issue.category, ...issue.metadata } : { category: issue.category },
  });
}

function parseBuildTemplateContent(content: string): Readonly<Record<string, unknown>> | undefined {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    return parsed as Readonly<Record<string, unknown>>;
  } catch {
    return undefined;
  }
}

function buildCategorySummary(
  issues: ReadonlyArray<ImageManipulationTemplateValidationIssue>,
): Readonly<Record<ImageManipulationTemplateValidationCategory, { readonly errors: number; readonly warnings: number }>> {
  const categories = Object.values(ImageManipulationTemplateValidationCategories);
  const summary: Record<ImageManipulationTemplateValidationCategory, { errors: number; warnings: number }> = Object.fromEntries(
    categories.map((category) => [category, { errors: 0, warnings: 0 }]),
  ) as Record<ImageManipulationTemplateValidationCategory, { errors: number; warnings: number }>;
  for (const issue of issues) {
    if (issue.severity === "error") summary[issue.category].errors += 1;
    else summary[issue.category].warnings += 1;
  }
  return Object.freeze(Object.fromEntries(
    Object.entries(summary).map(([key, value]) => [key, Object.freeze(value)]),
  ) as Record<ImageManipulationTemplateValidationCategory, { readonly errors: number; readonly warnings: number }>);
}

export function validateImageManipulationTemplateCompleteness(
  input: ValidateImageManipulationTemplateCompletenessInput = {},
): ImageManipulationTemplateCompletenessValidationResult {
  const template = input.template ?? ImageManipulationSystemTemplate;
  const workflowTemplate = input.workflowTemplate ?? ImageManipulationWorkflowTemplate;
  const propertySchema = input.propertySchema ?? ComfyImageManipulationPropertySchema;
  const issues: ImageManipulationTemplateValidationIssue[] = [];

  if (!template.systemAsset.assetId.trim()) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.systemAsset,
      code: "system-asset-id-missing",
      severity: "error",
      message: "System asset id is required for runnable template validation.",
      path: "systemAsset.assetId",
    }));
  }
  if (!template.compositionBindings.pageBindingId.trim()) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.pageAsset,
      code: "page-binding-id-missing",
      severity: "error",
      message: "Page binding id is required for runtime page resolution.",
      path: "compositionBindings.pageBindingId",
    }));
  }

  const requiredComponentAliases = new Set(template.systemAsset.components.map((entry) => entry.alias));
  if (!requiredComponentAliases.has(template.primaryWorkflowAsset.componentAlias)) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.systemAsset,
      code: "primary-workflow-component-alias-unresolved",
      severity: "error",
      message: "Primary workflow component alias is not present in the system asset component list.",
      path: "primaryWorkflowAsset.componentAlias",
      metadata: { alias: template.primaryWorkflowAsset.componentAlias },
    }));
  }
  if (!requiredComponentAliases.has(template.uiBindingBoundary.componentAlias)) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.systemAsset,
      code: "ui-component-alias-unresolved",
      severity: "error",
      message: "UI binding component alias is not present in the system asset component list.",
      path: "uiBindingBoundary.componentAlias",
      metadata: { alias: template.uiBindingBoundary.componentAlias },
    }));
  }
  for (const expectedEvent of requiredTemplateEmits) {
    if (!template.uiBindingBoundary.emits.includes(expectedEvent)) {
      issues.push(createIssue({
        category: ImageManipulationTemplateValidationCategories.runnableDefaults,
        code: "ui-emits-event-missing",
        severity: "error",
        message: `UI boundary is missing required runtime event '${expectedEvent}'.`,
        path: "uiBindingBoundary.emits",
      }));
    }
  }

  const requiredInputDataset = template.datasetInstances.find((entry) => entry.bindingId === template.compositionBindings.inputDatasetBindingId);
  const requiredOutputDataset = template.datasetInstances.find((entry) => entry.bindingId === template.compositionBindings.outputDatasetBindingId);
  const optionalReferenceDataset = template.datasetInstances.find((entry) => entry.bindingId === template.compositionBindings.optionalReferenceDatasetBindingId);
  if (!requiredInputDataset) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.datasetBindings,
      code: "required-input-dataset-binding-missing",
      severity: "error",
      message: "Required input dataset binding is missing.",
      path: "datasetInstances",
    }));
  } else {
    if (requiredInputDataset.optional) {
      issues.push(createIssue({
        category: ImageManipulationTemplateValidationCategories.datasetBindings,
        code: "required-input-dataset-marked-optional",
        severity: "error",
        message: "Required input dataset binding cannot be optional.",
        path: "datasetInstances.input-image-dataset.optional",
      }));
    }
    if (requiredInputDataset.role !== DatasetInstanceRoles.inputStore) {
      issues.push(createIssue({
        category: ImageManipulationTemplateValidationCategories.datasetBindings,
        code: "required-input-dataset-role-invalid",
        severity: "error",
        message: "Input dataset binding must use role 'input-store'.",
        path: "datasetInstances.input-image-dataset.role",
      }));
    }
  }
  if (!requiredOutputDataset) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.datasetBindings,
      code: "required-output-dataset-binding-missing",
      severity: "error",
      message: "Required output dataset binding is missing.",
      path: "datasetInstances",
    }));
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.datasetBindings,
      code: "output-dataset-binding-missing",
      severity: "error",
      message: "Image manipulation template must bind a required output image dataset instance.",
      path: "datasetInstances",
    }));
  } else {
    if (requiredOutputDataset.optional) {
      issues.push(createIssue({
        category: ImageManipulationTemplateValidationCategories.datasetBindings,
        code: "required-output-dataset-marked-optional",
        severity: "error",
        message: "Required output dataset binding cannot be optional.",
        path: "datasetInstances.output-image-dataset.optional",
      }));
    }
    if (requiredOutputDataset.role !== DatasetInstanceRoles.outputStore) {
      issues.push(createIssue({
        category: ImageManipulationTemplateValidationCategories.datasetBindings,
        code: "required-output-dataset-role-invalid",
        severity: "error",
        message: "Output dataset binding must use role 'output-store'.",
        path: "datasetInstances.output-image-dataset.role",
      }));
    }
  }
  if (!optionalReferenceDataset) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.datasetBindings,
      code: "optional-reference-dataset-binding-missing",
      severity: "error",
      message: "Optional FaceID reference dataset binding must be declared.",
      path: "datasetInstances",
    }));
  } else if (optionalReferenceDataset.optional !== true) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.datasetBindings,
      code: "optional-reference-dataset-binding-not-optional",
      severity: "error",
      message: "FaceID reference dataset binding must remain optional.",
      path: "datasetInstances.reference-image-dataset.optional",
    }));
  }
  for (const datasetBinding of template.datasetInstances) {
    if (!datasetBinding.storageBindingArea?.trim()) {
      issues.push(createIssue({
        category: ImageManipulationTemplateValidationCategories.storageBindings,
        code: "dataset-storage-binding-area-missing",
        severity: "error",
        message: `Dataset binding '${datasetBinding.bindingId}' is missing a storage binding area.`,
        path: `datasetInstances.${datasetBinding.bindingId}.storageBindingArea`,
      }));
    }
    if (looksLikeRawPath(datasetBinding.instanceId)) {
      issues.push(createIssue({
        category: ImageManipulationTemplateValidationCategories.storageBindings,
        code: "dataset-instance-id-raw-path-forbidden",
        severity: "error",
        message: `Dataset binding '${datasetBinding.bindingId}' instance id cannot be a filesystem path.`,
        path: `datasetInstances.${datasetBinding.bindingId}.instanceId`,
      }));
    }
  }

  if (template.primaryWorkflowAsset.workflowTemplateAssetId !== workflowTemplate.templateId) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.workflowTemplate,
      code: "primary-workflow-template-reference-mismatch",
      severity: "error",
      message: "Primary workflow template reference does not resolve to the configured default workflow template asset.",
      path: "primaryWorkflowAsset.workflowTemplateAssetId",
      metadata: {
        expected: workflowTemplate.templateId,
        actual: template.primaryWorkflowAsset.workflowTemplateAssetId,
      },
    }));
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.workflowTemplate,
      code: "workflow-template-binding-invalid",
      severity: "error",
      message: "Image manipulation template must bind the canonical primary workflow template asset.",
      path: "primaryWorkflowAsset.workflowTemplateAssetId",
    }));
  }
  if (
    template.primaryWorkflowAsset.workflowTemplateVersionId
    && template.primaryWorkflowAsset.workflowTemplateVersionId !== workflowTemplate.versionId
  ) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.workflowTemplate,
      code: "primary-workflow-template-version-mismatch",
      severity: "error",
      message: "Primary workflow template version id is not pinned to the default runnable workflow template version.",
      path: "primaryWorkflowAsset.workflowTemplateVersionId",
      metadata: {
        expected: workflowTemplate.versionId,
        actual: template.primaryWorkflowAsset.workflowTemplateVersionId,
      },
    }));
  }

  const workflowComposition = workflowTemplate.composition;
  if (!workflowComposition) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.workflowTemplate,
      code: "workflow-template-composition-missing",
      severity: "error",
      message: "Workflow template composition is required for runnable template validation.",
      path: "workflowTemplate.composition",
    }));
  } else {
    const outputBinding = workflowComposition.outputBindings.find((binding) => (
      binding.workflowOutputId === template.primaryWorkflowAsset.datasetBindings.workflowOutputId
    ));
    if (!outputBinding) {
      issues.push(createIssue({
        category: ImageManipulationTemplateValidationCategories.workflowTemplate,
        code: "workflow-output-binding-missing",
        severity: "error",
        message: "Workflow template is missing the required output binding for image materialization.",
        path: "workflowTemplate.composition.outputBindings",
      }));
    } else {
      if (!outputBinding.targetDatasetAssetId?.trim()) {
        issues.push(createIssue({
          category: ImageManipulationTemplateValidationCategories.storageBindings,
          code: "workflow-output-target-dataset-missing",
          severity: "error",
          message: `Workflow output binding '${outputBinding.bindingId}' must target a dataset asset.`,
          path: `workflowTemplate.composition.outputBindings.${outputBinding.bindingId}.targetDatasetAssetId`,
        }));
      }
      if (outputBinding.targetDatasetInstanceRef && looksLikeRawPath(outputBinding.targetDatasetInstanceRef)) {
        issues.push(createIssue({
          category: ImageManipulationTemplateValidationCategories.storageBindings,
          code: "workflow-output-dataset-instance-ref-raw-path-forbidden",
          severity: "error",
          message: `Workflow output binding '${outputBinding.bindingId}' uses a raw path for dataset instance reference.`,
          path: `workflowTemplate.composition.outputBindings.${outputBinding.bindingId}.targetDatasetInstanceRef`,
        }));
      }
      if (outputBinding.targetDatasetInstanceRef && !outputBinding.targetDatasetInstanceRef.startsWith("dataset-instance-ref:")) {
        issues.push(createIssue({
          category: ImageManipulationTemplateValidationCategories.storageBindings,
          code: "workflow-output-dataset-instance-ref-invalid",
          severity: "error",
          message: `Workflow output binding '${outputBinding.bindingId}' dataset instance reference must use dataset-instance-ref logical form.`,
          path: `workflowTemplate.composition.outputBindings.${outputBinding.bindingId}.targetDatasetInstanceRef`,
        }));
      }
      if (outputBinding.targetStorageBindingId && looksLikeRawPath(outputBinding.targetStorageBindingId)) {
        issues.push(createIssue({
          category: ImageManipulationTemplateValidationCategories.storageBindings,
          code: "workflow-output-storage-binding-id-raw-path-forbidden",
          severity: "error",
          message: `Workflow output binding '${outputBinding.bindingId}' uses a raw path for storage binding id.`,
          path: `workflowTemplate.composition.outputBindings.${outputBinding.bindingId}.targetStorageBindingId`,
        }));
      }
      if (!outputBinding.targetStorageInstanceRef?.trim()) {
        issues.push(createIssue({
          category: ImageManipulationTemplateValidationCategories.storageBindings,
          code: "workflow-output-storage-instance-ref-missing",
          severity: "error",
          message: `Workflow output binding '${outputBinding.bindingId}' must include a storage-instance reference.`,
          path: `workflowTemplate.composition.outputBindings.${outputBinding.bindingId}.targetStorageInstanceRef`,
        }));
      } else if (looksLikeRawPath(outputBinding.targetStorageInstanceRef)) {
        issues.push(createIssue({
          category: ImageManipulationTemplateValidationCategories.storageBindings,
          code: "workflow-output-storage-instance-ref-raw-path-forbidden",
          severity: "error",
          message: `Workflow output binding '${outputBinding.bindingId}' storage reference cannot be a filesystem path.`,
          path: `workflowTemplate.composition.outputBindings.${outputBinding.bindingId}.targetStorageInstanceRef`,
        }));
      } else {
        try {
          parseStorageLogicalReference(outputBinding.targetStorageInstanceRef);
        } catch (error) {
          issues.push(createIssue({
            category: ImageManipulationTemplateValidationCategories.storageBindings,
            code: "workflow-output-storage-instance-ref-invalid",
            severity: "error",
            message: error instanceof Error ? error.message : "Storage instance reference must use storage-instance:// logical form.",
            path: `workflowTemplate.composition.outputBindings.${outputBinding.bindingId}.targetStorageInstanceRef`,
          }));
        }
      }
    }
  }

  if (template.compositionBindings.propertySchemaBindingId !== propertySchema.id) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.propertySchema,
      code: "property-schema-binding-mismatch",
      severity: "error",
      message: "System template property schema binding id does not match the configured property schema asset.",
      path: "compositionBindings.propertySchemaBindingId",
      metadata: { expected: propertySchema.id, actual: template.compositionBindings.propertySchemaBindingId },
    }));
  }

  const defaultConfig = createComfyImageManipulationDefaultConfig();
  const defaultConfigIssues = validateComfyImageManipulationConfig(defaultConfig);
  for (const validationIssue of defaultConfigIssues) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.runnableDefaults,
      code: `property-default-invalid:${validationIssue.code}`,
      severity: "error",
      message: `Default property configuration is not runnable: ${validationIssue.message}`,
      path: validationIssue.path ? `propertySchema.defaultConfig.${validationIssue.path}` : "propertySchema.defaultConfig",
    }));
  }
  for (const group of propertySchema.fields) {
    for (const entry of group.entries) {
      if (!entry.required) continue;
      const value = getByPath(defaultConfig, entry.path);
      const isMissing = value === undefined || value === null || (typeof value === "string" && value.trim().length < 1);
      if (isMissing) {
        issues.push(createIssue({
          category: ImageManipulationTemplateValidationCategories.runnableDefaults,
          code: "required-property-default-missing",
          severity: "error",
          message: `Required property default '${entry.path}' is missing or empty.`,
          path: `propertySchema.defaultConfig.${entry.path}`,
        }));
      }
    }
  }

  for (const requiredParameterId of requiredWorkflowDefaultParameters) {
    const hasParameterDefault = workflowTemplate.parameterDefaults.some((entry) => entry.parameterId === requiredParameterId);
    const parameterDefinition = workflowTemplate.parameters?.find((entry) => entry.parameterId === requiredParameterId);
    if (!hasParameterDefault && parameterDefinition?.defaultValue === undefined) {
      issues.push(createIssue({
        category: ImageManipulationTemplateValidationCategories.runnableDefaults,
        code: "workflow-required-default-parameter-missing",
        severity: "error",
        message: `Workflow template is missing required runnable default '${requiredParameterId}'.`,
        path: "workflowTemplate.parameterDefaults",
        metadata: { parameterId: requiredParameterId },
      }));
    }
  }

  const executionMetadata = template.systemAsset.executionMetadata;
  if (!executionMetadata) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.runtimeMetadata,
      code: "system-execution-metadata-missing",
      severity: "error",
      message: "System execution metadata is required for runtime wiring.",
      path: "systemAsset.executionMetadata",
    }));
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.runtimeMetadata,
      code: "execution-metadata-missing",
      severity: "error",
      message: "Image manipulation template must declare execution metadata for runtime binding.",
      path: "systemAsset.executionMetadata",
    }));
  } else {
    if (executionMetadata.runtime?.environment !== ImageManipulationRuntimeTargets.runtimeEnvironment) {
      issues.push(createIssue({
        category: ImageManipulationTemplateValidationCategories.runtimeMetadata,
        code: "system-runtime-environment-invalid",
        severity: "error",
        message: "System execution metadata runtime environment must be 'comfyui'.",
        path: "systemAsset.executionMetadata.runtime.environment",
      }));
      issues.push(createIssue({
        category: ImageManipulationTemplateValidationCategories.runtimeMetadata,
        code: "runtime-environment-invalid",
        severity: "error",
        message: "Execution metadata must target the ComfyUI runtime environment.",
        path: "systemAsset.executionMetadata.runtime.environment",
      }));
    }
    if (executionMetadata.orchestration?.mode !== ImageManipulationRuntimeTargets.orchestrationMode) {
      issues.push(createIssue({
        category: ImageManipulationTemplateValidationCategories.runtimeMetadata,
        code: "system-runtime-orchestration-mode-invalid",
        severity: "error",
        message: "System execution metadata orchestration mode must be workflow-template-driven.",
        path: "systemAsset.executionMetadata.orchestration.mode",
      }));
      issues.push(createIssue({
        category: ImageManipulationTemplateValidationCategories.runtimeMetadata,
        code: "orchestration-mode-invalid",
        severity: "error",
        message: "Execution metadata must declare the workflow-template-driven orchestration mode.",
        path: "systemAsset.executionMetadata.orchestration.mode",
      }));
    }
    for (const requiredCapability of ImageManipulationRuntimeTargets.requiredCapabilities) {
      if (!executionMetadata.runtime?.requirements?.includes(requiredCapability)) {
        issues.push(createIssue({
          category: ImageManipulationTemplateValidationCategories.runtimeMetadata,
          code: "system-runtime-capability-missing",
          severity: "error",
          message: `System execution metadata is missing runtime capability '${requiredCapability}'.`,
          path: "systemAsset.executionMetadata.runtime.requirements",
        }));
        issues.push(createIssue({
          category: ImageManipulationTemplateValidationCategories.runtimeMetadata,
          code: "runtime-capability-missing",
          severity: "error",
          message: `Execution metadata is missing required runtime capability '${requiredCapability}'.`,
          path: "systemAsset.executionMetadata.runtime.requirements",
        }));
      }
    }
    for (const requiredHint of ImageManipulationRuntimeTargets.requiredOrchestrationHints) {
      if (!executionMetadata.orchestration?.hints?.includes(requiredHint)) {
        issues.push(createIssue({
          category: ImageManipulationTemplateValidationCategories.executionAdapter,
          code: "system-execution-adapter-hint-missing",
          severity: "error",
          message: `System execution metadata is missing adapter hint '${requiredHint}'.`,
          path: "systemAsset.executionMetadata.orchestration.hints",
        }));
      }
    }
  }

  if (!template.compositionBindings.runtimeBindingId.trim()) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.runtimeMetadata,
      code: "runtime-binding-id-missing",
      severity: "error",
      message: "Runtime binding id is required for runnable default launch wiring.",
      path: "compositionBindings.runtimeBindingId",
    }));
  }
  if (!template.compositionBindings.runtimeInstallationBindingId.trim()) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.runtimeMetadata,
      code: "runtime-installation-binding-id-missing",
      severity: "error",
      message: "Runtime installation binding id is required for runnable default launch wiring.",
      path: "compositionBindings.runtimeInstallationBindingId",
    }));
  }

  const workflowRuntime = workflowTemplate.executionMetadata?.runtime;
  if (!workflowRuntime) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.runtimeMetadata,
      code: "workflow-runtime-metadata-missing",
      severity: "error",
      message: "Workflow template runtime metadata is required for executable defaults.",
      path: "workflowTemplate.executionMetadata.runtime",
    }));
  } else {
    if (!workflowRuntime.backendId.trim()) {
      issues.push(createIssue({
        category: ImageManipulationTemplateValidationCategories.runtimeMetadata,
        code: "workflow-runtime-backend-id-missing",
        severity: "error",
        message: "Workflow runtime backend id is required.",
        path: "workflowTemplate.executionMetadata.runtime.backendId",
      }));
    }
    for (const requiredCapability of requiredRuntimeCapabilities) {
      if (!workflowRuntime.requiredCapabilities.includes(requiredCapability)) {
        issues.push(createIssue({
          category: ImageManipulationTemplateValidationCategories.runtimeMetadata,
          code: "workflow-runtime-capability-missing",
          severity: "error",
          message: `Workflow runtime metadata is missing required capability '${requiredCapability}'.`,
          path: "workflowTemplate.executionMetadata.runtime.requiredCapabilities",
        }));
      }
    }
    for (const dependency of requiredRuntimeDependencies) {
      if (!workflowRuntime.requiredDependencies.includes(dependency)) {
        issues.push(createIssue({
          category: ImageManipulationTemplateValidationCategories.runtimeMetadata,
          code: "workflow-runtime-dependency-missing",
          severity: "error",
          message: `Workflow runtime metadata is missing required dependency '${dependency}'.`,
          path: "workflowTemplate.executionMetadata.runtime.requiredDependencies",
        }));
      }
    }
  }

  const adapterHints = workflowTemplate.executionMetadata?.hints?.adapterHints ?? [];
  for (const requiredHint of requiredExecutionAdapterHints) {
    if (!adapterHints.includes(requiredHint)) {
      issues.push(createIssue({
        category: ImageManipulationTemplateValidationCategories.executionAdapter,
        code: "workflow-execution-adapter-hint-missing",
        severity: "error",
        message: `Workflow execution metadata is missing adapter hint '${requiredHint}'.`,
        path: "workflowTemplate.executionMetadata.hints.adapterHints",
      }));
    }
  }
  const outputHandlingHints = workflowTemplate.executionMetadata?.hints?.outputHandling ?? [];
  for (const requiredHint of requiredOutputHandlingHints) {
    if (!outputHandlingHints.includes(requiredHint)) {
      issues.push(createIssue({
        category: ImageManipulationTemplateValidationCategories.executionAdapter,
        code: "workflow-output-handling-hint-missing",
        severity: "error",
        message: `Workflow execution metadata is missing output-handling hint '${requiredHint}'.`,
        path: "workflowTemplate.executionMetadata.hints.outputHandling",
      }));
    }
  }

  if (!template.primaryWorkflowAsset.datasetBindings.inputDatasetBindingAssetId.trim()) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.executionAdapter,
      code: "input-dataset-binding-adapter-reference-missing",
      severity: "error",
      message: "Input dataset binding adapter reference is required.",
      path: "primaryWorkflowAsset.datasetBindings.inputDatasetBindingAssetId",
    }));
  }
  if (template.primaryWorkflowAsset.datasetBindings.inputDatasetBindingAssetId !== ComfyImageManipulationDatasetBindingAssetId) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.executionAdapter,
      code: "workflow-input-dataset-binding-asset-invalid",
      severity: "error",
      message: "Image manipulation template must bind the canonical input dataset workflow-binding asset.",
      path: "primaryWorkflowAsset.datasetBindings.inputDatasetBindingAssetId",
    }));
  }
  if (!template.primaryWorkflowAsset.datasetBindings.propertyMappingAssetId.trim()) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.executionAdapter,
      code: "property-mapping-adapter-reference-missing",
      severity: "error",
      message: "Property mapping adapter reference is required.",
      path: "primaryWorkflowAsset.datasetBindings.propertyMappingAssetId",
    }));
  }
  if (template.primaryWorkflowAsset.datasetBindings.propertyMappingAssetId !== ComfyImageManipulationPropertyMappingAssetId) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.executionAdapter,
      code: "workflow-property-mapping-asset-invalid",
      severity: "error",
      message: "Image manipulation template must bind the canonical Comfy property mapping asset.",
      path: "primaryWorkflowAsset.datasetBindings.propertyMappingAssetId",
    }));
  }

  if (template.runtimeInstallationAsset.assetId !== ComfyRuntimeInstallationAssetId) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.runtimeMetadata,
      code: "runtime-installation-asset-invalid",
      severity: "error",
      message: "Image manipulation template must reference the canonical Comfy runtime installation asset.",
      path: "runtimeInstallationAsset.assetId",
    }));
  }
  if (template.runtimeInstallationAsset.defaultWorkflowProfile !== ComfyRuntimeWorkflowProfiles.imageManipulationDefault) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.runtimeMetadata,
      code: "runtime-installation-default-workflow-profile-invalid",
      severity: "error",
      message: "Image manipulation template must declare the default Comfy runtime workflow profile.",
      path: "runtimeInstallationAsset.defaultWorkflowProfile",
    }));
  }
  if (template.runtimeInstallationAsset.diagnosticsContractVersion !== ComfyRuntimeSystemDiagnosticsVersion) {
    issues.push(createIssue({
      category: ImageManipulationTemplateValidationCategories.runtimeMetadata,
      code: "runtime-installation-diagnostics-contract-version-invalid",
      severity: "error",
      message: "Image manipulation template must expose the canonical Comfy runtime diagnostics contract version.",
      path: "runtimeInstallationAsset.diagnosticsContractVersion",
    }));
  }
  for (const requiredProfile of [
    ComfyRuntimeWorkflowProfiles.imageManipulationDefault,
    ComfyRuntimeWorkflowProfiles.imageManipulationFaceId,
  ]) {
    if (!template.runtimeInstallationAsset.supportedWorkflowProfiles.includes(requiredProfile)) {
      issues.push(createIssue({
        category: ImageManipulationTemplateValidationCategories.runtimeMetadata,
        code: "runtime-installation-supported-workflow-profile-missing",
        severity: "error",
        message: `Image manipulation runtime installation asset metadata must support workflow profile '${requiredProfile}'.`,
        path: "runtimeInstallationAsset.supportedWorkflowProfiles",
      }));
    }
  }

  const defaultDatasetRequests = buildImageManipulationDatasetInstanceRequests("system:image-manipulation");
  const requiredRequestBindingIds = new Set(defaultDatasetRequests
    .map((entry) => entry.seedMetadata?.datasetBindingId)
    .filter((entry): entry is string => Boolean(entry)));
  for (const requiredBindingId of [
    template.compositionBindings.inputDatasetBindingId,
    template.compositionBindings.outputDatasetBindingId,
  ]) {
    if (!requiredRequestBindingIds.has(requiredBindingId)) {
      issues.push(createIssue({
        category: ImageManipulationTemplateValidationCategories.runnableDefaults,
        code: "required-dataset-provisioning-request-missing",
        severity: "error",
        message: `Default provisioning requests must include dataset binding '${requiredBindingId}'.`,
        path: "buildImageManipulationDatasetInstanceRequests",
      }));
    }
  }

  if (input.buildTemplateContent !== undefined) {
    const parsedContent = parseBuildTemplateContent(input.buildTemplateContent);
    if (!parsedContent) {
      issues.push(createIssue({
        category: ImageManipulationTemplateValidationCategories.pageAsset,
        code: "build-template-content-invalid-json",
        severity: "error",
        message: "Build template content must be valid JSON.",
        path: "buildTemplateContent",
      }));
    } else {
      const systemSpec = parsedContent.systemSpec as Readonly<Record<string, unknown>> | undefined;
      const canvasAuthoring = systemSpec?.canvasAuthoring as Readonly<Record<string, unknown>> | undefined;
      const pageLayouts = Array.isArray(canvasAuthoring?.pageLayouts)
        ? canvasAuthoring.pageLayouts as ReadonlyArray<Readonly<Record<string, unknown>>>
        : [];
      const resolvedPanel = pageLayouts
        .flatMap((layout) => Array.isArray(layout.panels) ? layout.panels as ReadonlyArray<Readonly<Record<string, unknown>>> : [])
        .find((panel) => {
          const content = panel.content as Readonly<Record<string, unknown>> | undefined;
          return content?.kind === "embedded-studio" && content.studioAssetId === template.compositionBindings.pageBindingId;
        });
      if (!resolvedPanel) {
        issues.push(createIssue({
          category: ImageManipulationTemplateValidationCategories.pageAsset,
          code: "page-binding-unresolved-in-build-template",
          severity: "error",
          message: "Build template content does not resolve the image-manipulation page binding in canvas panel wiring.",
          path: "systemSpec.canvasAuthoring.pageLayouts",
          metadata: { pageBindingId: template.compositionBindings.pageBindingId },
        }));
      }
    }
  }

  const status = issues.some((issue) => issue.severity === "error")
    ? AssetValidationStatuses.invalid
    : AssetValidationStatuses.valid;
  const categories = buildCategorySummary(issues);
  const assetId = template.systemAsset.assetId;
  const assetValidationIssues = issues.map((issue) => toAssetValidationIssue(issue, assetId));
  const assetValidation = createAssetValidationResult({
    errors: assetValidationIssues.filter((issue) => issue.severity === AssetValidationSeverities.error),
    warnings: assetValidationIssues.filter((issue) => issue.severity === AssetValidationSeverities.warning),
    metadata: {
      validationKind: "image-manipulation-template-completeness",
      runnable: status === AssetValidationStatuses.valid,
      issueCount: issues.length,
      categorySummary: categories,
    },
  });

  return Object.freeze({
    status,
    runnable: status === AssetValidationStatuses.valid,
    issues: Object.freeze(issues),
    categories,
    metadata: Object.freeze({
      templateId: template.templateId,
      systemAssetId: template.systemAsset.assetId,
      workflowTemplateAssetId: workflowTemplate.templateId,
      workflowTemplateVersionId: workflowTemplate.versionId,
      issueCount: issues.length,
      errorCount: issues.filter((issue) => issue.severity === "error").length,
      warningCount: issues.filter((issue) => issue.severity === "warning").length,
      usedBuildTemplateContent: input.buildTemplateContent !== undefined,
    }),
    assetValidation,
  });
}

export function assertImageManipulationTemplateRunnableDefaults(
  input: ValidateImageManipulationTemplateCompletenessInput = {},
): ImageManipulationTemplateCompletenessValidationResult {
  const result = validateImageManipulationTemplateCompleteness(input);
  if (result.runnable) return result;
  const topIssues = result.issues
    .filter((issue) => issue.severity === "error")
    .slice(0, 5)
    .map((issue) => `${issue.code}: ${issue.message}`);
  throw new Error(`Image manipulation template runnable-default validation failed (${topIssues.join(" | ")})`);
}
