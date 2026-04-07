import type { AssetContractDescriptor } from "@domain/contracts/AssetContract";
import type { AssetMetadata } from "../studio-shell/StudioShellDomain";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
  type TaxonomyBehaviorKind,
} from "../taxonomy/CompositionTaxonomy";

import {
  createWorkflowTemplateComposition,
  createWorkflowTemplateParameterDefinition,
  type WorkflowTemplateComposition,
  type WorkflowTemplateParameterDefinition,
} from "./WorkflowTemplateCompositionDomain";

export const WorkflowTemplateStudioIdentity = Object.freeze({
  studioType: "workflow-template-studio",
  defaultStudioId: "studio-workflow-templates",
  defaultStudioName: "Workflow Template Studio",
});

export type WorkflowTemplateCategory = "image-generation" | "image-editing" | "image-variation" | "image-upscaling" | "image-style-transfer";
export type WorkflowTemplateIntent = "text-to-image" | "image-to-image" | "inpainting" | "outpainting" | "upscaling";

export interface WorkflowTemplateInputRequirement {
  readonly inputId: string;
  readonly valueType: "text" | "image" | "mask" | "number" | "boolean" | "json";
  readonly required: boolean;
  readonly description?: string;
}

export interface WorkflowTemplateOutputExpectation {
  readonly outputId: string;
  readonly valueType: "image" | "images" | "json";
  readonly description?: string;
}

export interface WorkflowTemplateParameterDefault {
  readonly parameterId: string;
  readonly value: string | number | boolean | null;
  readonly description?: string;
}

export interface WorkflowTemplateAssetReference {
  readonly role: "workflow-definition" | "model" | "dataset" | "tool" | "config-profile";
  readonly assetId: string;
  readonly versionId?: string;
}

export interface WorkflowTemplateExecutionMetadata {
  readonly runtime: {
    readonly backendId: string;
    readonly runtimeProfile: "comfyui" | "interpreted" | "python-delegated";
    readonly requiredCapabilities: ReadonlyArray<string>;
    readonly requiredDependencies: ReadonlyArray<string>;
  };
  readonly capability: {
    readonly workflowMode: "image-to-image" | "text-to-image" | "upscaling";
    readonly supportsFaceId: boolean;
    readonly supportsBatchExecution: boolean;
  };
  readonly faceId?: {
    readonly referenceDatasetAssetId: string;
    readonly referenceBindingParameterId: string;
    readonly requiredWhenEnabled: boolean;
    readonly dependencyAssetIds: ReadonlyArray<string>;
  };
  readonly hints?: {
    readonly adapterHints?: ReadonlyArray<string>;
    readonly outputHandling?: ReadonlyArray<string>;
  };
}

export interface WorkflowTemplateDefinition {
  readonly templateId: string;
  readonly versionId: string;
  readonly name: string;
  readonly summary?: string;
  readonly category: WorkflowTemplateCategory;
  readonly supportedIntent: WorkflowTemplateIntent;
  readonly inputRequirements: ReadonlyArray<WorkflowTemplateInputRequirement>;
  readonly outputExpectations: ReadonlyArray<WorkflowTemplateOutputExpectation>;
  readonly parameterDefaults: ReadonlyArray<WorkflowTemplateParameterDefault>;
  readonly composition?: WorkflowTemplateComposition;
  readonly parameters?: ReadonlyArray<WorkflowTemplateParameterDefinition>;
  readonly workflowAssets: ReadonlyArray<WorkflowTemplateAssetReference>;
  readonly executionMetadata?: WorkflowTemplateExecutionMetadata;
  readonly tags: ReadonlyArray<string>;
  readonly metadata: Readonly<Record<string, string>>;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTags(tags?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set((tags ?? []).map((entry) => entry.trim()).filter(Boolean))]);
}

function normalizeOptionalStringList(values?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (!values) return undefined;
  return Object.freeze([...new Set(values.map((entry) => entry.trim()).filter(Boolean))]);
}

function normalizeRequiredStringList(values: ReadonlyArray<string>, label: string): ReadonlyArray<string> {
  const normalized = normalizeOptionalStringList(values) ?? [];
  if (normalized.length === 0) {
    throw new Error(`${label} requires at least one value.`);
  }
  return normalized;
}

function normalizeExecutionMetadata(value?: WorkflowTemplateExecutionMetadata): WorkflowTemplateExecutionMetadata | undefined {
  if (!value) return undefined;

  const runtimeCapabilities = normalizeRequiredStringList(
    value.runtime.requiredCapabilities,
    "Workflow template execution metadata runtime capabilities",
  );
  const runtimeDependencies = normalizeRequiredStringList(
    value.runtime.requiredDependencies,
    "Workflow template execution metadata runtime dependencies",
  );

  const normalizedFaceId = value.faceId
    ? Object.freeze({
      referenceDatasetAssetId: normalizeRequired(
        value.faceId.referenceDatasetAssetId,
        "Workflow template execution metadata FaceID reference dataset asset id",
      ),
      referenceBindingParameterId: normalizeRequired(
        value.faceId.referenceBindingParameterId,
        "Workflow template execution metadata FaceID reference binding parameter id",
      ),
      requiredWhenEnabled: Boolean(value.faceId.requiredWhenEnabled),
      dependencyAssetIds: normalizeRequiredStringList(
        value.faceId.dependencyAssetIds,
        "Workflow template execution metadata FaceID dependency assets",
      ),
    })
    : undefined;

  return Object.freeze({
    runtime: Object.freeze({
      backendId: normalizeRequired(value.runtime.backendId, "Workflow template execution metadata backend id"),
      runtimeProfile: value.runtime.runtimeProfile,
      requiredCapabilities: runtimeCapabilities,
      requiredDependencies: runtimeDependencies,
    }),
    capability: Object.freeze({
      workflowMode: value.capability.workflowMode,
      supportsFaceId: Boolean(value.capability.supportsFaceId),
      supportsBatchExecution: Boolean(value.capability.supportsBatchExecution),
    }),
    faceId: normalizedFaceId,
    hints: value.hints
      ? Object.freeze({
        adapterHints: normalizeOptionalStringList(value.hints.adapterHints),
        outputHandling: normalizeOptionalStringList(value.hints.outputHandling),
      })
      : undefined,
  });
}

export function createWorkflowTemplateDefinition(input: WorkflowTemplateDefinition): WorkflowTemplateDefinition {
  const inputRequirements = Object.freeze(input.inputRequirements.map((entry) => Object.freeze({
    inputId: normalizeRequired(entry.inputId, "Workflow template input requirement id"),
    valueType: entry.valueType,
    required: Boolean(entry.required),
    description: normalizeOptional(entry.description),
  })));

  const outputExpectations = Object.freeze(input.outputExpectations.map((entry) => Object.freeze({
    outputId: normalizeRequired(entry.outputId, "Workflow template output expectation id"),
    valueType: entry.valueType,
    description: normalizeOptional(entry.description),
  })));

  const parameterDefaults = Object.freeze(input.parameterDefaults.map((entry) => Object.freeze({
    parameterId: normalizeRequired(entry.parameterId, "Workflow template parameter default id"),
    value: entry.value,
    description: normalizeOptional(entry.description),
  })));

  const parameters = Object.freeze((input.parameters ?? []).map((entry) => createWorkflowTemplateParameterDefinition(entry)));
  const parameterIds = parameters.map((entry) => entry.parameterId);
  if (new Set(parameterIds).size !== parameterIds.length) {
    throw new Error("Workflow template parameters must use unique parameter ids.");
  }

  const workflowAssets = Object.freeze(input.workflowAssets.map((entry) => Object.freeze({
    role: entry.role,
    assetId: normalizeRequired(entry.assetId, "Workflow template asset reference id"),
    versionId: normalizeOptional(entry.versionId),
  })));

  if (!workflowAssets.some((entry) => entry.role === "workflow-definition")) {
    throw new Error("Workflow templates must reference at least one workflow-definition asset.");
  }

  return Object.freeze({
    templateId: normalizeRequired(input.templateId, "Workflow template id"),
    versionId: normalizeRequired(input.versionId, "Workflow template version id"),
    name: normalizeRequired(input.name, "Workflow template name"),
    summary: normalizeOptional(input.summary),
    category: input.category,
    supportedIntent: input.supportedIntent,
    inputRequirements,
    outputExpectations,
    parameterDefaults,
    composition: input.composition ? createWorkflowTemplateComposition(input.composition) : undefined,
    parameters,
    workflowAssets,
    executionMetadata: normalizeExecutionMetadata(input.executionMetadata),
    tags: normalizeTags(input.tags),
    metadata: Object.freeze(Object.fromEntries(
      Object.entries(input.metadata ?? {})
        .map(([key, value]) => [key.trim(), value.trim()] as const)
        .filter(([key, value]) => key.length > 0 && value.length > 0),
    )),
  });
}

export function serializeWorkflowTemplateDefinition(definition: WorkflowTemplateDefinition): string {
  return JSON.stringify(createWorkflowTemplateDefinition(definition));
}

export function deserializeWorkflowTemplateDefinition(serialized: string): WorkflowTemplateDefinition {
  return createWorkflowTemplateDefinition(JSON.parse(serialized) as WorkflowTemplateDefinition);
}

export function createWorkflowTemplateStudioTaxonomy(
  behaviorKind: Extract<TaxonomyBehaviorKind, "deterministic" | "conditional" | "iterative"> = TaxonomyBehaviorKinds.deterministic,
) {
  return createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.composite,
    semanticRole: TaxonomySemanticRoles.workflowTemplate,
    behaviorKind,
  });
}

export function createWorkflowTemplateAssetMetadata(input: {
  readonly title: string;
  readonly summary?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly creatorId?: string;
  readonly sourceLabel?: string;
  readonly behaviorKind?: Extract<TaxonomyBehaviorKind, "deterministic" | "conditional" | "iterative">;
  readonly contract?: AssetContractDescriptor;
}): AssetMetadata {
  return Object.freeze({
    title: input.title,
    summary: input.summary,
    tags: Object.freeze(["workflow-template", ...(input.tags ?? [])]),
    taxonomy: createWorkflowTemplateStudioTaxonomy(input.behaviorKind),
    contract: input.contract,
    provenance: {
      creatorId: input.creatorId,
      sourceType: "generated",
      sourceLabel: input.sourceLabel ?? WorkflowTemplateStudioIdentity.studioType,
    },
  });
}

