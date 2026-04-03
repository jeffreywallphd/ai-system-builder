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
  readonly uiBindingBoundary: typeof ReferenceImageSystemTemplate.uiBindingBoundary;
  readonly compositionBindings: {
    readonly inputDatasetBindingId: "input-image-dataset";
    readonly outputDatasetBindingId: "output-image-dataset";
    readonly optionalReferenceDatasetBindingId: "reference-image-dataset";
    readonly workflowTemplateBindingId: "primary-image-workflow";
    readonly propertySchemaBindingId: typeof ComfyImageManipulationPropertySchemaId;
    readonly pageBindingId: "system-page:image-manipulation";
    readonly runtimeBindingId: "runtime:image-manipulation";
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
    pageBindingId: "system-page:image-manipulation",
    runtimeBindingId: "runtime:image-manipulation",
  }),
});

export const ImageManipulationSystemWorkflowContextMapping = ReferenceImageSystemWorkflowContextMapping;

export function buildImageManipulationDatasetInstanceRequests(
  systemId: string,
  options?: BuildReferenceImageDatasetInstanceRequestsOptions,
): ReadonlyArray<EnsureRoleDatasetInstanceRequest> {
  return buildReferenceImageDatasetInstanceRequests(systemId, options);
}
