import { DatasetSchemaIntentIds } from "../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import {
  createSystemAsset,
  createSystemStudioTaxonomy,
  SystemBindingEndpointScopes,
  type SystemAsset,
} from "../../domain/system-studio/SystemAssetDomain";
import { TaxonomyBehaviorKinds, TaxonomySemanticRoles, TaxonomyStructuralKinds } from "../../domain/taxonomy/CompositionTaxonomy";
import { DatasetInstanceRoles, type DatasetInstanceRole } from "../../domain/system-runtime/DatasetInstanceDomain";
import type { EnsureRoleDatasetInstanceRequest } from "../system-runtime/SystemDatasetInstanceService";

export const ReferenceImageSystemTemplateId = "template:system:reference-image-manipulation";

export interface ReferenceImageDatasetInstanceTemplate {
  readonly bindingId: "input-image-dataset" | "output-image-dataset";
  readonly instanceId: string;
  readonly role: DatasetInstanceRole;
  readonly purpose: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly requiredSchemaIntentId: typeof DatasetSchemaIntentIds.media;
  readonly requiredOutputShapeKind: "image-metadata-records";
  readonly runtimeOwner: "system-runtime";
}

export interface ReferenceImageSystemTemplateDefinition {
  readonly templateId: string;
  readonly name: string;
  readonly summary: string;
  readonly systemAsset: SystemAsset;
  readonly datasetInstances: ReadonlyArray<ReferenceImageDatasetInstanceTemplate>;
  readonly workflowBindingBoundary: {
    readonly componentAlias: string;
    readonly inputIds: ReadonlyArray<string>;
    readonly outputIds: ReadonlyArray<string>;
  };
  readonly uiBindingBoundary: {
    readonly componentAlias: string;
    readonly emits: ReadonlyArray<string>;
    readonly consumes: ReadonlyArray<string>;
  };
}

export const ReferenceImageSystemTemplate: ReferenceImageSystemTemplateDefinition = Object.freeze({
  templateId: ReferenceImageSystemTemplateId,
  name: "Reference image manipulation system",
  summary: "System template that composes input/output image datasets with workflow and UI boundaries for reference-image editing.",
  systemAsset: createSystemAsset({
    assetId: "asset:system:reference-image-manipulation",
    taxonomy: createSystemStudioTaxonomy(TaxonomySemanticRoles.system, TaxonomyBehaviorKinds.deterministic),
    inputs: [
      { inputId: "sourceImage", valueType: "image-reference", required: true, description: "Reference image selected by the user." },
      { inputId: "editInstruction", valueType: "string", required: false, description: "Optional manipulation instruction." },
    ],
    outputs: [
      { outputId: "editedImages", valueType: "image-metadata-records", description: "Edited image output collection." },
    ],
    parameters: [
      { parameterId: "outputTarget", valueType: "string", required: false, defaultValue: "history" },
    ],
    components: [
      {
        componentKind: "atomic",
        assetId: "asset:dataset:image-reference-input",
        alias: "input-image-dataset-asset",
        taxonomy: {
          structuralKind: TaxonomyStructuralKinds.atomic,
          semanticRole: TaxonomySemanticRoles.dataset,
          behaviorKind: TaxonomyBehaviorKinds.none,
        },
      },
      {
        componentKind: "atomic",
        assetId: "asset:dataset:image-reference-output",
        alias: "output-image-dataset-asset",
        taxonomy: {
          structuralKind: TaxonomyStructuralKinds.atomic,
          semanticRole: TaxonomySemanticRoles.dataset,
          behaviorKind: TaxonomyBehaviorKinds.none,
        },
      },
      {
        componentKind: "composite",
        assetId: "asset:workflow-template:reference-image-editing",
        alias: "reference-workflow",
        taxonomy: {
          structuralKind: TaxonomyStructuralKinds.composite,
          semanticRole: TaxonomySemanticRoles.workflowTemplate,
          behaviorKind: TaxonomyBehaviorKinds.deterministic,
        },
      },
      {
        componentKind: "composite",
        assetId: "asset:tool-chain:reference-image-ui",
        alias: "reference-ui",
        taxonomy: {
          structuralKind: TaxonomyStructuralKinds.composite,
          semanticRole: TaxonomySemanticRoles.toolChain,
          behaviorKind: TaxonomyBehaviorKinds.deterministic,
        },
      },
    ],
    bindings: [
      {
        bindingId: "bind:system-source-to-workflow",
        source: { scope: SystemBindingEndpointScopes.systemInput, endpointId: "sourceImage" },
        target: { scope: SystemBindingEndpointScopes.componentInput, componentAlias: "reference-workflow", endpointId: "sourceImage" },
      },
      {
        bindingId: "bind:system-instruction-to-workflow",
        source: { scope: SystemBindingEndpointScopes.systemInput, endpointId: "editInstruction" },
        target: { scope: SystemBindingEndpointScopes.componentInput, componentAlias: "reference-workflow", endpointId: "instruction" },
      },
      {
        bindingId: "bind:workflow-output-to-system",
        source: { scope: SystemBindingEndpointScopes.componentOutput, componentAlias: "reference-workflow", endpointId: "editedImages" },
        target: { scope: SystemBindingEndpointScopes.systemOutput, endpointId: "editedImages" },
      },
    ],
  }),
  datasetInstances: Object.freeze([
    Object.freeze({
      bindingId: "input-image-dataset",
      instanceId: "dataset-instance:reference-image:input",
      role: DatasetInstanceRoles.inputStore,
      purpose: "incoming-images",
      datasetAssetId: "asset:dataset:image-reference-input",
      requiredSchemaIntentId: DatasetSchemaIntentIds.media,
      requiredOutputShapeKind: "image-metadata-records",
      runtimeOwner: "system-runtime",
    }),
    Object.freeze({
      bindingId: "output-image-dataset",
      instanceId: "dataset-instance:reference-image:output",
      role: DatasetInstanceRoles.outputStore,
      purpose: "workflow-output-images",
      datasetAssetId: "asset:dataset:image-reference-output",
      requiredSchemaIntentId: DatasetSchemaIntentIds.media,
      requiredOutputShapeKind: "image-metadata-records",
      runtimeOwner: "system-runtime",
    }),
  ]),
  workflowBindingBoundary: Object.freeze({
    componentAlias: "reference-workflow",
    inputIds: Object.freeze(["sourceImage", "instruction"]),
    outputIds: Object.freeze(["editedImages"]),
  }),
  uiBindingBoundary: Object.freeze({
    componentAlias: "reference-ui",
    emits: Object.freeze(["sourceImageSelected", "instructionUpdated", "runRequested"]),
    consumes: Object.freeze(["editedImages", "runHistory"]),
  }),
});

export function buildReferenceImageDatasetInstanceRequests(systemId: string): ReadonlyArray<EnsureRoleDatasetInstanceRequest> {
  const normalizedSystemId = systemId.trim();
  if (!normalizedSystemId) {
    throw new Error("Reference image system template requires a systemId.");
  }

  return Object.freeze(ReferenceImageSystemTemplate.datasetInstances.map((entry) => Object.freeze({
    systemId: normalizedSystemId,
    instanceId: entry.instanceId,
    datasetAssetId: entry.datasetAssetId,
    datasetAssetVersionId: entry.datasetAssetVersionId,
    role: entry.role,
    purpose: entry.purpose,
    requiredSchemaIntentId: entry.requiredSchemaIntentId,
    requiredOutputShapeKind: entry.requiredOutputShapeKind,
    seedMetadata: Object.freeze({
      templateId: ReferenceImageSystemTemplate.templateId,
      runtimeOwner: entry.runtimeOwner,
      datasetBindingId: entry.bindingId,
    }),
  })));
}
