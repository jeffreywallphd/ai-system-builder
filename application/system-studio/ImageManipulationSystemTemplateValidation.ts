import {
  AssetValidationLayers,
  AssetValidationSeverities,
  createAssetValidationResult,
  type AssetValidationIssue,
  type AssetValidationResult,
} from "../../domain/contracts/AssetValidation";
import { DatasetInstanceRoles } from "../../domain/system-runtime/DatasetInstanceDomain";
import {
  ImageManipulationFaceIdReferenceDatasetAssetId,
  ImageManipulationInputDatasetAssetId,
  ImageManipulationOutputDatasetAssetId,
} from "../dataset-studio/ImageManipulationDatasetAssets";
import {
  ImageManipulationPrimaryWorkflowTemplateAssetId,
  type ImageManipulationSystemTemplateDefinition,
} from "./ImageManipulationSystemTemplate";

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

function createIssue(input: {
  readonly code: string;
  readonly message: string;
  readonly assetId: string;
  readonly layer?: "structural" | "referential" | "compatibility";
  readonly path?: string;
  readonly metadata?: Record<string, unknown>;
}): AssetValidationIssue {
  return Object.freeze({
    code: input.code,
    message: input.message,
    severity: AssetValidationSeverities.error,
    layer: input.layer ?? AssetValidationLayers.structural,
    assetId: input.assetId,
    assetType: "system-template",
    path: input.path,
    metadata: input.metadata,
  });
}

export function validateImageManipulationSystemTemplate(
  template: ImageManipulationSystemTemplateDefinition,
): AssetValidationResult {
  const assetId = template.systemAsset.assetId;
  const errors: AssetValidationIssue[] = [];

  if (!template.templateId.trim()) {
    errors.push(createIssue({
      code: "template-id-missing",
      message: "Image manipulation system template must declare a template id.",
      assetId,
      path: "templateId",
    }));
  }

  if (!template.name.trim() || !template.summary.trim()) {
    errors.push(createIssue({
      code: "template-metadata-missing",
      message: "Image manipulation system template must declare non-empty name and summary metadata.",
      assetId,
      path: "name",
    }));
  }

  const requiredInput = template.datasetInstances.find((entry) => entry.bindingId === template.compositionBindings.inputDatasetBindingId);
  if (!requiredInput) {
    errors.push(createIssue({
      code: "input-dataset-binding-missing",
      message: "Image manipulation template must bind a required input image dataset instance.",
      assetId,
      path: "datasetInstances",
    }));
  } else {
    if (requiredInput.optional) {
      errors.push(createIssue({
        code: "input-dataset-must-be-required",
        message: "Input image dataset instance cannot be optional.",
        assetId,
        path: "datasetInstances.input-image-dataset",
      }));
    }
    if (requiredInput.datasetAssetId !== ImageManipulationInputDatasetAssetId) {
      errors.push(createIssue({
        code: "input-dataset-asset-mismatch",
        message: "Input image dataset instance must reference the canonical input dataset asset.",
        assetId,
        layer: "referential",
        path: "datasetInstances.input-image-dataset.datasetAssetId",
        metadata: { expected: ImageManipulationInputDatasetAssetId, actual: requiredInput.datasetAssetId },
      }));
    }
    if (requiredInput.role !== DatasetInstanceRoles.inputStore) {
      errors.push(createIssue({
        code: "input-dataset-role-invalid",
        message: "Input image dataset instance must use role 'input-store'.",
        assetId,
        layer: "compatibility",
        path: "datasetInstances.input-image-dataset.role",
      }));
    }
  }

  const requiredOutput = template.datasetInstances.find((entry) => entry.bindingId === template.compositionBindings.outputDatasetBindingId);
  if (!requiredOutput) {
    errors.push(createIssue({
      code: "output-dataset-binding-missing",
      message: "Image manipulation template must bind a required output image dataset instance.",
      assetId,
      path: "datasetInstances",
    }));
  } else {
    if (requiredOutput.optional) {
      errors.push(createIssue({
        code: "output-dataset-must-be-required",
        message: "Output image dataset instance cannot be optional.",
        assetId,
        path: "datasetInstances.output-image-dataset",
      }));
    }
    if (requiredOutput.datasetAssetId !== ImageManipulationOutputDatasetAssetId) {
      errors.push(createIssue({
        code: "output-dataset-asset-mismatch",
        message: "Output image dataset instance must reference the canonical output dataset asset.",
        assetId,
        layer: "referential",
        path: "datasetInstances.output-image-dataset.datasetAssetId",
        metadata: { expected: ImageManipulationOutputDatasetAssetId, actual: requiredOutput.datasetAssetId },
      }));
    }
    if (requiredOutput.role !== DatasetInstanceRoles.outputStore) {
      errors.push(createIssue({
        code: "output-dataset-role-invalid",
        message: "Output image dataset instance must use role 'output-store'.",
        assetId,
        layer: "compatibility",
        path: "datasetInstances.output-image-dataset.role",
      }));
    }
  }

  const optionalFaceId = template.datasetInstances.find((entry) => (
    entry.bindingId === template.compositionBindings.optionalReferenceDatasetBindingId
  ));
  if (!optionalFaceId) {
    errors.push(createIssue({
      code: "optional-reference-dataset-missing",
      message: "Image manipulation template must declare the optional FaceID reference dataset binding.",
      assetId,
      path: "datasetInstances",
    }));
  } else {
    if (optionalFaceId.optional !== true) {
      errors.push(createIssue({
        code: "optional-reference-dataset-semantic-invalid",
        message: "FaceID reference dataset binding must remain optional.",
        assetId,
        layer: "compatibility",
        path: "datasetInstances.reference-image-dataset.optional",
      }));
    }
    if (optionalFaceId.datasetAssetId !== ImageManipulationFaceIdReferenceDatasetAssetId) {
      errors.push(createIssue({
        code: "optional-reference-dataset-asset-mismatch",
        message: "FaceID reference dataset binding must reference the canonical FaceID dataset asset.",
        assetId,
        layer: "referential",
        path: "datasetInstances.reference-image-dataset.datasetAssetId",
      }));
    }
  }

  if (template.primaryWorkflowAsset.workflowTemplateAssetId !== ImageManipulationPrimaryWorkflowTemplateAssetId) {
    errors.push(createIssue({
      code: "workflow-template-binding-invalid",
      message: "Image manipulation template must bind the canonical primary workflow template asset.",
      assetId,
      layer: "referential",
      path: "primaryWorkflowAsset.workflowTemplateAssetId",
      metadata: {
        expected: ImageManipulationPrimaryWorkflowTemplateAssetId,
        actual: template.primaryWorkflowAsset.workflowTemplateAssetId,
      },
    }));
  }

  const executionMetadata = template.systemAsset.executionMetadata;
  if (!executionMetadata) {
    errors.push(createIssue({
      code: "execution-metadata-missing",
      message: "Image manipulation template must declare execution metadata for runtime binding.",
      assetId,
      path: "systemAsset.executionMetadata",
    }));
  } else {
    if (executionMetadata.runtime?.environment !== ImageManipulationRuntimeTargets.runtimeEnvironment) {
      errors.push(createIssue({
        code: "runtime-environment-invalid",
        message: "Execution metadata must target the ComfyUI runtime environment.",
        assetId,
        layer: "compatibility",
        path: "systemAsset.executionMetadata.runtime.environment",
      }));
    }

    for (const requiredCapability of ImageManipulationRuntimeTargets.requiredCapabilities) {
      if (!executionMetadata.runtime?.requirements?.includes(requiredCapability)) {
        errors.push(createIssue({
          code: "runtime-capability-missing",
          message: `Execution metadata is missing required runtime capability '${requiredCapability}'.`,
          assetId,
          layer: "compatibility",
          path: "systemAsset.executionMetadata.runtime.requirements",
        }));
      }
    }

    if (executionMetadata.orchestration?.mode !== ImageManipulationRuntimeTargets.orchestrationMode) {
      errors.push(createIssue({
        code: "orchestration-mode-invalid",
        message: "Execution metadata must declare the workflow-template-driven orchestration mode.",
        assetId,
        layer: "compatibility",
        path: "systemAsset.executionMetadata.orchestration.mode",
      }));
    }

    for (const requiredHint of ImageManipulationRuntimeTargets.requiredOrchestrationHints) {
      if (!executionMetadata.orchestration?.hints?.includes(requiredHint)) {
        errors.push(createIssue({
          code: "orchestration-hint-missing",
          message: `Execution metadata is missing required orchestration hint '${requiredHint}'.`,
          assetId,
          layer: "compatibility",
          path: "systemAsset.executionMetadata.orchestration.hints",
        }));
      }
    }
  }

  return createAssetValidationResult({
    errors,
    metadata: {
      validatedTemplateId: template.templateId,
      datasetBindingCount: template.datasetInstances.length,
      issueCount: errors.length,
    },
  });
}
