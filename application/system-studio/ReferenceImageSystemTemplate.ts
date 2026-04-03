import { DatasetSchemaIntentIds } from "../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import {
  createSystemContextWorkflowMappingConfiguration,
  type SystemContextWorkflowMappingConfiguration,
} from "../../domain/system-studio/SystemContextWorkflowMappingConfiguration";
import {
  createSystemAsset,
  createSystemStudioTaxonomy,
  SystemBindingEndpointScopes,
  type SystemAsset,
} from "../../domain/system-studio/SystemAssetDomain";
import { TaxonomyBehaviorKinds, TaxonomySemanticRoles, TaxonomyStructuralKinds } from "../../domain/taxonomy/CompositionTaxonomy";
import { DatasetInstanceRoles, type DatasetInstanceRole } from "../../domain/system-runtime/DatasetInstanceDomain";
import type { EnsureRoleDatasetInstanceRequest } from "../system-runtime/SystemDatasetInstanceService";
import type { StorageBindingArea } from "../system-runtime/StorageInstanceProvisioningContract";
import {
  ImageManipulationFaceIdReferenceDatasetAssetId,
  ImageManipulationInputDatasetAssetId,
  ImageManipulationOutputDatasetAssetId,
} from "../dataset-studio/ImageManipulationDatasetAssets";
import { CoreImageStarterWorkflowTemplates } from "../workflow-template-studio/CoreImageStarterWorkflowTemplates";
import {
  ImageManipulationWorkflowTemplateAssetId,
  ImageManipulationWorkflowTemplateVersionId,
} from "../workflow-template-studio/ImageManipulationWorkflowTemplate";
import { ComfyImageManipulationDatasetBindingAssetId } from "./ComfyImageManipulationDatasetBindingAsset";
import { ComfyImageManipulationPropertyMappingAssetId } from "./ComfyImageManipulationPropertyMappingAsset";

export const ReferenceImageSystemTemplateId = "template:system:reference-image-manipulation";
export const ReferenceImagePrimaryWorkflowTemplateAssetId = ImageManipulationWorkflowTemplateAssetId;
export const ReferenceImagePrimaryWorkflowTemplateVersionId = ImageManipulationWorkflowTemplateVersionId;

const ReferenceImagePrimaryWorkflowTemplate = CoreImageStarterWorkflowTemplates.find((template) => (
  template.templateId === ReferenceImagePrimaryWorkflowTemplateAssetId
));

if (!ReferenceImagePrimaryWorkflowTemplate) {
  throw new Error(`Reference image system template requires workflow template '${ReferenceImagePrimaryWorkflowTemplateAssetId}'.`);
}

export const ReferenceImageSystemWorkflowContextMapping: SystemContextWorkflowMappingConfiguration = createSystemContextWorkflowMappingConfiguration({
  mappings: [
    {
      mappingId: "reference-image.input.source-image",
      sourceRoot: "selected-image",
      sourcePath: "assetRef.assetId",
      targetKind: "workflow-input",
      targetPath: "sourceImage",
      required: true,
      description: "Map the selected image into the workflow source image input.",
    },
    {
      mappingId: "reference-image.input.instruction",
      sourceRoot: "parameters",
      sourcePath: "editInstruction",
      targetKind: "workflow-input",
      targetPath: "instruction",
      defaultValue: "",
      description: "Map user-entered edit instruction text into the workflow instruction input.",
    },
    {
      mappingId: "reference-image.input.variation-strength",
      sourceRoot: "parameters",
      sourcePath: "variationStrength",
      targetKind: "workflow-input",
      targetPath: "variationStrength",
      defaultValue: 0.5,
      description: "Map optional style/intensity control into variation strength.",
    },
    {
      mappingId: "reference-image.input.result-count",
      sourceRoot: "parameters",
      sourcePath: "resultCount",
      targetKind: "workflow-input",
      targetPath: "resultCount",
      defaultValue: 1,
      description: "Map optional result count control into bounded output count.",
    },
    {
      mappingId: "reference-image.metadata.dataset-instances",
      sourceRoot: "dataset-resolution",
      targetKind: "workflow-metadata",
      targetPath: "datasetInstances",
      transformId: "dataset-instances",
      description: "Expose resolved dataset instances to workflow runtime metadata.",
    },
    {
      mappingId: "reference-image.metadata.system-dataset-refs",
      sourceRoot: "dataset-resolution",
      targetKind: "workflow-metadata",
      targetPath: "systemDatasetInstanceRefs",
      transformId: "system-dataset-instance-refs",
      description: "Expose system-owned dataset references for runtime persistence and output routing.",
    },
    {
      mappingId: "reference-image.metadata.dataset-runtime-handles",
      sourceRoot: "dataset-resolution",
      targetKind: "workflow-metadata",
      targetPath: "datasetRuntimeHandles",
      transformId: "dataset-runtime-handles",
      description: "Expose runtime dataset handles for adapter-driven execution integration.",
    },
    {
      mappingId: "reference-image.metadata.runtime-context",
      sourceRoot: "runtime",
      targetKind: "workflow-metadata",
      targetPath: "runtimeContext",
      transformId: "runtime-context",
      description: "Carry runtime correlation ids for run tracing.",
    },
  ],
});

export interface ReferenceImageDatasetInstanceTemplate {
  readonly bindingId: "input-image-dataset" | "output-image-dataset" | "reference-image-dataset";
  readonly instanceId: string;
  readonly role: DatasetInstanceRole;
  readonly purpose: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly requiredSchemaIntentId: typeof DatasetSchemaIntentIds.media;
  readonly requiredOutputShapeKind: "image-metadata-records";
  readonly runtimeOwner: "system-runtime";
  readonly storageBindingArea: StorageBindingArea;
  readonly optional?: boolean;
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
  readonly primaryWorkflowAsset: {
    readonly bindingId: "primary-image-workflow";
    readonly componentAlias: string;
    readonly workflowTemplateAssetId: string;
    readonly workflowTemplateVersionId?: string;
    readonly datasetBindings: Readonly<{
      readonly inputDatasetInstanceBindingId: "input-image-dataset";
      readonly workflowInputId: string;
      readonly outputDatasetInstanceBindingId: "output-image-dataset";
      readonly workflowOutputId: string;
      readonly inputDatasetBindingAssetId: typeof ComfyImageManipulationDatasetBindingAssetId;
      readonly propertyMappingAssetId: typeof ComfyImageManipulationPropertyMappingAssetId;
    }>;
    readonly parameterInputIds: ReadonlyArray<string>;
    readonly contextMapping: SystemContextWorkflowMappingConfiguration;
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
        assetId: ImageManipulationInputDatasetAssetId,
        alias: "input-image-dataset-asset",
        taxonomy: {
          structuralKind: TaxonomyStructuralKinds.atomic,
          semanticRole: TaxonomySemanticRoles.dataset,
          behaviorKind: TaxonomyBehaviorKinds.none,
        },
      },
      {
        componentKind: "atomic",
        assetId: ImageManipulationOutputDatasetAssetId,
        alias: "output-image-dataset-asset",
        taxonomy: {
          structuralKind: TaxonomyStructuralKinds.atomic,
          semanticRole: TaxonomySemanticRoles.dataset,
          behaviorKind: TaxonomyBehaviorKinds.none,
        },
      },
      {
        componentKind: "atomic",
        assetId: ImageManipulationFaceIdReferenceDatasetAssetId,
        alias: "reference-image-dataset-asset",
        taxonomy: {
          structuralKind: TaxonomyStructuralKinds.atomic,
          semanticRole: TaxonomySemanticRoles.dataset,
          behaviorKind: TaxonomyBehaviorKinds.none,
        },
      },
      {
        componentKind: "composite",
        assetId: ReferenceImagePrimaryWorkflowTemplate.templateId,
        versionId: ReferenceImagePrimaryWorkflowTemplate.versionId,
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
        source: { scope: SystemBindingEndpointScopes.componentOutput, componentAlias: "reference-workflow", endpointId: "images" },
        target: { scope: SystemBindingEndpointScopes.systemOutput, endpointId: "editedImages" },
      },
    ],
    executionMetadata: {
      runtime: {
        environment: "comfyui",
        requirements: [
          "comfyui-api",
          "workflow-template-execution",
          "image-generation",
          "dataset-runtime-handles",
        ],
      },
      orchestration: {
        mode: "workflow-template-driven",
        hints: [
          "external-runtime-adapter",
          "version-pinned-workflow-template",
        ],
      },
      workflowContextMapping: ReferenceImageSystemWorkflowContextMapping,
    },
  }),
  datasetInstances: Object.freeze([
    Object.freeze({
      bindingId: "input-image-dataset",
      instanceId: "dataset-instance:reference-image:input",
      role: DatasetInstanceRoles.inputStore,
      purpose: "incoming-images",
      datasetAssetId: ImageManipulationInputDatasetAssetId,
      requiredSchemaIntentId: DatasetSchemaIntentIds.media,
      requiredOutputShapeKind: "image-metadata-records",
      runtimeOwner: "system-runtime",
      storageBindingArea: "input",
    }),
    Object.freeze({
      bindingId: "output-image-dataset",
      instanceId: "dataset-instance:reference-image:output",
      role: DatasetInstanceRoles.outputStore,
      purpose: "workflow-output-images",
      datasetAssetId: ImageManipulationOutputDatasetAssetId,
      requiredSchemaIntentId: DatasetSchemaIntentIds.media,
      requiredOutputShapeKind: "image-metadata-records",
      runtimeOwner: "system-runtime",
      storageBindingArea: "output",
    }),
    Object.freeze({
      bindingId: "reference-image-dataset",
      instanceId: "dataset-instance:reference-image:faceid",
      role: DatasetInstanceRoles.inputStore,
      purpose: "optional-faceid-reference-images",
      datasetAssetId: ImageManipulationFaceIdReferenceDatasetAssetId,
      requiredSchemaIntentId: DatasetSchemaIntentIds.media,
      requiredOutputShapeKind: "image-metadata-records",
      runtimeOwner: "system-runtime",
      storageBindingArea: "input",
      optional: true,
    }),
  ]),
  workflowBindingBoundary: Object.freeze({
    componentAlias: "reference-workflow",
    inputIds: Object.freeze(["sourceImage", "instruction"]),
    outputIds: Object.freeze(["images"]),
  }),
  primaryWorkflowAsset: Object.freeze({
    bindingId: "primary-image-workflow",
    componentAlias: "reference-workflow",
    workflowTemplateAssetId: ReferenceImagePrimaryWorkflowTemplate.templateId,
    workflowTemplateVersionId: ReferenceImagePrimaryWorkflowTemplate.versionId,
    datasetBindings: Object.freeze({
      inputDatasetInstanceBindingId: "input-image-dataset",
      workflowInputId: "sourceImage",
      outputDatasetInstanceBindingId: "output-image-dataset",
      workflowOutputId: "images",
      inputDatasetBindingAssetId: ComfyImageManipulationDatasetBindingAssetId,
      propertyMappingAssetId: ComfyImageManipulationPropertyMappingAssetId,
    }),
    parameterInputIds: Object.freeze(["instruction", "variationStrength", "resultCount"]),
    contextMapping: ReferenceImageSystemWorkflowContextMapping,
  }),
  uiBindingBoundary: Object.freeze({
    componentAlias: "reference-ui",
    emits: Object.freeze(["sourceImageSelected", "instructionUpdated", "runRequested"]),
    consumes: Object.freeze(["editedImages", "runHistory"]),
  }),
});

export interface BuildReferenceImageDatasetInstanceRequestsOptions {
  readonly includeOptionalReferenceDatasets?: boolean;
  readonly storageBindingByArea?: Readonly<Partial<Record<StorageBindingArea, {
    readonly storageInstanceId: string;
    readonly storageInstanceRef: string;
    readonly bindingId: string;
    readonly bindingReference: string;
  }>>>;
}

export function buildReferenceImageDatasetInstanceRequests(
  systemId: string,
  options: BuildReferenceImageDatasetInstanceRequestsOptions = {},
): ReadonlyArray<EnsureRoleDatasetInstanceRequest> {
  const normalizedSystemId = systemId.trim();
  if (!normalizedSystemId) {
    throw new Error("Reference image system template requires a systemId.");
  }

  const includeOptional = options.includeOptionalReferenceDatasets ?? false;
  return Object.freeze(ReferenceImageSystemTemplate.datasetInstances
    .filter((entry) => includeOptional || entry.optional !== true)
    .map((entry) => Object.freeze({
    systemId: normalizedSystemId,
    instanceId: entry.instanceId,
    datasetAssetId: entry.datasetAssetId,
    datasetAssetVersionId: entry.datasetAssetVersionId,
    role: entry.role,
    purpose: entry.purpose,
      requiredSchemaIntentId: entry.requiredSchemaIntentId,
      requiredOutputShapeKind: entry.requiredOutputShapeKind,
      storageBinding: options.storageBindingByArea?.[entry.storageBindingArea]
        ? Object.freeze({
          storageInstanceId: options.storageBindingByArea[entry.storageBindingArea]!.storageInstanceId,
          storageInstanceRef: options.storageBindingByArea[entry.storageBindingArea]!.storageInstanceRef,
          bindingArea: entry.storageBindingArea,
          bindingId: options.storageBindingByArea[entry.storageBindingArea]!.bindingId,
          bindingReference: options.storageBindingByArea[entry.storageBindingArea]!.bindingReference,
        })
        : undefined,
      seedMetadata: Object.freeze({
        templateId: ReferenceImageSystemTemplate.templateId,
        runtimeOwner: entry.runtimeOwner,
        datasetBindingId: entry.bindingId,
        storageBindingArea: entry.storageBindingArea,
      }),
    })));
}
