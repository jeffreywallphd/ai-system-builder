import { DatasetSchemaIntentIds } from "@domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import type { SystemContextContract } from "@domain/system-studio/SystemContextContract";
import { createDefaultWorkflowSystemContextBindingAdapter } from "../workflow-studio/SystemContextWorkflowInputMapper";
import { SystemContextValidationService, type SystemContextValidationIssue } from "../workflow-studio/SystemContextValidationService";
import { ReferenceImageSystemTemplate } from "./ReferenceImageSystemTemplate";

export interface CrossStudioIntegrityIssue {
  readonly code:
    | "runtime-context-corrupted"
    | "selected-image-missing"
    | "selected-image-reference-missing"
    | "selected-image-ambiguous"
    | "dataset-reference-invalid"
    | "dataset-reference-unresolved"
    | "dataset-schema-incompatible"
    | "workflow-input-invalid"
    | "output-target-missing"
    | "output-target-incompatible"
    | "lineage-required-fields-missing";
  readonly severity: "error" | "warning";
  readonly userMessage: string;
  readonly technicalMessage: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ReferenceImagePersistLineageContext {
  readonly executionId?: string;
  readonly workflowAssetId?: string;
  readonly workflowAssetVersionId?: string;
  readonly systemAssetId?: string;
  readonly sourceAssetId?: string;
  readonly sourceRecordId?: string;
}

export interface ReferenceImageCrossStudioIntegrityResult {
  readonly valid: boolean;
  readonly blockingIssues: ReadonlyArray<CrossStudioIntegrityIssue>;
  readonly warningIssues: ReadonlyArray<CrossStudioIntegrityIssue>;
  readonly issues: ReadonlyArray<CrossStudioIntegrityIssue>;
}

function toIssue(input: {
  readonly code: CrossStudioIntegrityIssue["code"];
  readonly severity?: "error" | "warning";
  readonly userMessage: string;
  readonly technicalMessage: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}): CrossStudioIntegrityIssue {
  return Object.freeze({
    code: input.code,
    severity: input.severity ?? "error",
    userMessage: input.userMessage,
    technicalMessage: input.technicalMessage,
    path: input.path,
    details: input.details,
  });
}

function mapContextValidationIssue(issue: SystemContextValidationIssue): CrossStudioIntegrityIssue {
  if (issue.code === "selected-image-missing") {
    return toIssue({
      code: "selected-image-missing",
      severity: issue.severity,
      userMessage: "Choose an image before starting.",
      technicalMessage: issue.message,
      path: issue.path,
      details: issue.details,
    });
  }
  if (issue.code === "selected-image-invalid") {
    return toIssue({
      code: "selected-image-reference-missing",
      severity: issue.severity,
      userMessage: "We couldn't read the selected image. Please pick it again.",
      technicalMessage: issue.message,
      path: issue.path,
      details: issue.details,
    });
  }
  if (issue.code === "dataset-reference-unresolved") {
    return toIssue({
      code: "dataset-reference-unresolved",
      severity: issue.severity,
      userMessage: "Your image library link needs to be refreshed.",
      technicalMessage: issue.message,
      path: issue.path,
      details: issue.details,
    });
  }
  if (issue.code === "dataset-reference-incompatible" || issue.code === "dataset-schema-intent-mismatch") {
    return toIssue({
      code: "dataset-schema-incompatible",
      severity: "warning",
      userMessage: "This image library format isn't compatible with this template.",
      technicalMessage: issue.message,
      path: issue.path,
      details: issue.details,
    });
  }
  if (issue.code === "workflow-input-unresolved") {
    return toIssue({
      code: "workflow-input-invalid",
      severity: issue.severity,
      userMessage: "Some processing inputs are incomplete.",
      technicalMessage: issue.message,
      path: issue.path,
      details: issue.details,
    });
  }
  return toIssue({
    code: "runtime-context-corrupted",
    severity: issue.severity,
    userMessage: "Saved setup details are incomplete. Please reselect your inputs.",
    technicalMessage: issue.message,
    path: issue.path,
    details: issue.details,
  });
}

export function validateReferenceImageCrossStudioContext(
  context: SystemContextContract | undefined,
  lineage?: ReferenceImagePersistLineageContext,
): ReferenceImageCrossStudioIntegrityResult {
  const issues: CrossStudioIntegrityIssue[] = [];

  if (!context || context.contractVersion.trim().length === 0) {
    issues.push(toIssue({
      code: "runtime-context-corrupted",
      userMessage: "Saved setup details are incomplete. Please reselect your image.",
      technicalMessage: "System runtime context is missing or malformed.",
      path: "runtimeContext",
    }));
    return Object.freeze({
      valid: false,
      blockingIssues: Object.freeze(issues),
      warningIssues: Object.freeze([]),
      issues: Object.freeze(issues),
    });
  }

  const inputDataset = ReferenceImageSystemTemplate.datasetInstances.find((entry) => entry.bindingId === "input-image-dataset");
  const outputDataset = ReferenceImageSystemTemplate.datasetInstances.find((entry) => entry.bindingId === "output-image-dataset");

  const validator = new SystemContextValidationService();
  const contextValidation = validator.validate({
    context,
    requiredParameterKeys: ["resultCount"],
    mediaSchema: {
      required: true,
      requireAssetReference: true,
    },
    datasetSchemaContracts: inputDataset
      ? [{
        instanceId: inputDataset.instanceId,
        datasetAssetId: inputDataset.datasetAssetId,
        schemaIntentId: DatasetSchemaIntentIds.media,
        expectedRecordValueType: "object" as const,
        required: true,
      }]
      : [],
    workflowInputBindings: [
      {
        bindingId: "reference-image.input.source-image",
        inputId: "sourceImage",
        required: true,
        sources: [{ sourceId: "selected", kind: "selected-image", path: "assetRef.assetId", priority: 1 }],
      },
    ],
  });
  for (const issue of contextValidation.issues) {
    issues.push(mapContextValidationIssue(issue));
  }

  if (context.selectedImages.length > 1) {
    issues.push(toIssue({
      code: "selected-image-ambiguous",
      userMessage: "Pick one image to continue.",
      technicalMessage: "Reference image flow expects a single selected image but multiple selections were provided.",
      path: "selectedImages",
      details: Object.freeze({ selectedImageCount: context.selectedImages.length }),
    }));
  }

  const mapped = createDefaultWorkflowSystemContextBindingAdapter({
    mappingConfiguration: ReferenceImageSystemTemplate.primaryWorkflowAsset.contextMapping,
  }).map(context);
  const mappingIssues = ((mapped.metadata as Record<string, unknown>).systemContextMapping as { issues?: ReadonlyArray<{ message?: string; mappingId?: string }> } | undefined)?.issues ?? [];
  for (const issue of mappingIssues) {
    issues.push(toIssue({
      code: "workflow-input-invalid",
      userMessage: "Some processing inputs are incomplete.",
      technicalMessage: issue.message ?? "Workflow context mapping failed.",
      path: issue.mappingId,
    }));
  }

  const outputRef = context.datasets.find((entry) => entry.instanceId === outputDataset?.instanceId || entry.role === "system-owned-output");
  if (!outputRef) {
    issues.push(toIssue({
      code: "output-target-missing",
      severity: "warning",
      userMessage: "Couldn't find where to save generated images.",
      technicalMessage: "Required system output dataset reference is missing from runtime context.",
      path: "datasets",
    }));
  } else if (outputDataset && outputRef.datasetAssetId && outputRef.datasetAssetId !== outputDataset.datasetAssetId) {
    issues.push(toIssue({
      code: "output-target-incompatible",
      userMessage: "The selected output destination isn't compatible.",
      technicalMessage: `Expected output dataset asset '${outputDataset.datasetAssetId}' but received '${outputRef.datasetAssetId}'.`,
      path: `datasets.${outputRef.referenceId}.datasetAssetId`,
    }));
  }

  if (lineage) {
    if (!lineage.executionId?.trim()) {
      issues.push(toIssue({
        code: "lineage-required-fields-missing",
        userMessage: "Run details are incomplete. Please try again.",
        technicalMessage: "Lineage field 'executionId' is required.",
      }));
    }
    const sourceAssetId = context.selectedImages[0]?.assetRef?.assetId ?? lineage.sourceAssetId;
    if (!sourceAssetId) {
      issues.push(toIssue({
        code: "lineage-required-fields-missing",
        userMessage: "The selected image link is missing. Please choose your image again.",
        technicalMessage: "Lineage field 'sourceImageAssetId' is required for reference image runs.",
      }));
    }
  }

  const blockingIssues = issues.filter((issue) => issue.severity === "error");
  const warningIssues = issues.filter((issue) => issue.severity === "warning");
  return Object.freeze({
    valid: blockingIssues.length === 0,
    blockingIssues: Object.freeze(blockingIssues),
    warningIssues: Object.freeze(warningIssues),
    issues: Object.freeze(issues),
  });
}

