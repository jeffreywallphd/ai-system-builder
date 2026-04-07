import type { EnsureRoleDatasetInstanceRequest } from "../system-runtime/SystemDatasetInstanceService";
import {
  type BuildReferenceImageDatasetInstanceRequestsOptions,
  buildReferenceImageDatasetInstanceRequests,
  ReferenceImagePrimaryWorkflowTemplateAssetId,
  ReferenceImagePrimaryWorkflowTemplateVersionId,
  ReferenceImageSystemTemplate,
  ReferenceImageSystemTemplateId,
  ReferenceImageSystemWorkflowContextMapping,
} from "./ReferenceImageSystemTemplate";
import { ComfyImageManipulationPropertySchemaId } from "./ComfyImageManipulationPropertySchema";
import { ComfyImageManipulationDatasetBindingAssetId } from "./ComfyImageManipulationDatasetBindingAsset";
import { ComfyImageManipulationPropertyMappingAssetId } from "./ComfyImageManipulationPropertyMappingAsset";

export const ImageManipulationSystemTemplateId = ReferenceImageSystemTemplateId;
export const ImageManipulationPrimaryWorkflowTemplateAssetId = ReferenceImagePrimaryWorkflowTemplateAssetId;
export const ImageManipulationPrimaryWorkflowTemplateVersionId = ReferenceImagePrimaryWorkflowTemplateVersionId;

export interface ImageManipulationSystemTemplateDefinition {
  readonly templateId: string;
  readonly name: string;
  readonly summary: string;
  readonly systemAsset: typeof ReferenceImageSystemTemplate.systemAsset;
  readonly datasetInstances: typeof ReferenceImageSystemTemplate.datasetInstances;
  readonly workflowBindingBoundary: typeof ReferenceImageSystemTemplate.workflowBindingBoundary;
  readonly primaryWorkflowAsset: typeof ReferenceImageSystemTemplate.primaryWorkflowAsset;
  readonly runtimeInstallationAsset: typeof ReferenceImageSystemTemplate.runtimeInstallationAsset;
  readonly uiBindingBoundary: typeof ReferenceImageSystemTemplate.uiBindingBoundary;
  readonly compositionBindings: {
    readonly inputDatasetBindingId: "input-image-dataset";
    readonly outputDatasetBindingId: "output-image-dataset";
    readonly optionalReferenceDatasetBindingId: "reference-image-dataset";
    readonly workflowTemplateBindingId: "primary-image-workflow";
    readonly propertySchemaBindingId: typeof ComfyImageManipulationPropertySchemaId;
    readonly propertyMappingBindingId: typeof ComfyImageManipulationPropertyMappingAssetId;
    readonly inputDatasetWorkflowBindingId: typeof ComfyImageManipulationDatasetBindingAssetId;
    readonly pageBindingId: "system-page:image-manipulation";
    readonly runtimeBindingId: "runtime:image-manipulation";
    readonly runtimeInstallationBindingId: "runtime-installation:comfyui";
  };
}

export const ImageManipulationSystemTemplate: ImageManipulationSystemTemplateDefinition = Object.freeze({
  ...ReferenceImageSystemTemplate,
  compositionBindings: Object.freeze({
    inputDatasetBindingId: "input-image-dataset",
    outputDatasetBindingId: "output-image-dataset",
    optionalReferenceDatasetBindingId: "reference-image-dataset",
    workflowTemplateBindingId: "primary-image-workflow",
    propertySchemaBindingId: ComfyImageManipulationPropertySchemaId,
    propertyMappingBindingId: ComfyImageManipulationPropertyMappingAssetId,
    inputDatasetWorkflowBindingId: ComfyImageManipulationDatasetBindingAssetId,
    pageBindingId: "system-page:image-manipulation",
    runtimeBindingId: "runtime:image-manipulation",
    runtimeInstallationBindingId: "runtime-installation:comfyui",
  }),
});

export const ImageManipulationSystemWorkflowContextMapping = ReferenceImageSystemWorkflowContextMapping;

export function buildImageManipulationDatasetInstanceRequests(
  systemId: string,
  options?: BuildReferenceImageDatasetInstanceRequestsOptions,
): ReadonlyArray<EnsureRoleDatasetInstanceRequest> {
  return buildReferenceImageDatasetInstanceRequests(systemId, options);
}
