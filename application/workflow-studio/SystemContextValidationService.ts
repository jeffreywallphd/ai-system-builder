import type { SystemContextContract } from "../../domain/system-studio/SystemContextContract";
import type { WorkflowInputBindingDescriptor } from "../../domain/workflow-studio/WorkflowInputBindingDomain";
import { previewWorkflowInputBindings, type WorkflowInputBindingPreviewResult } from "./WorkflowInputBindingPreviewService";
import {
  createDefaultSystemContextDatasetReferenceResolver,
  type SystemContextDatasetReferenceResolver,
  SystemContextDatasetResolutionIssueCodes,
} from "./SystemContextDatasetReferenceResolver";

export type SystemContextValidationSeverity = "error" | "warning";

export interface SystemContextValidationIssue {
  readonly code:
    | "selected-image-missing"
    | "selected-image-invalid"
    | "dataset-reference-invalid"
    | "dataset-schema-intent-mismatch"
    | "media-schema-image-metadata-missing"
    | "required-parameter-missing"
    | "workflow-input-unresolved"
    | "dataset-reference-unresolved"
    | "dataset-reference-incompatible";
  readonly severity: SystemContextValidationSeverity;
  readonly message: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface SystemContextDatasetSchemaContract {
  readonly referenceId?: string;
  readonly instanceId?: string;
  readonly datasetAssetId?: string;
  readonly schemaIntentId?: string;
  readonly expectedRecordValueType?: "string" | "number" | "boolean" | "array" | "object";
  readonly required?: boolean;
}

export interface SystemContextMediaSchemaExpectation {
  readonly required?: boolean;
  readonly requireAssetReference?: boolean;
  readonly requiredMetadataFields?: ReadonlyArray<string>;
}

export interface SystemContextValidationRequest {
  readonly context: SystemContextContract;
  readonly requiredParameterKeys?: ReadonlyArray<string>;
  readonly datasetSchemaContracts?: ReadonlyArray<SystemContextDatasetSchemaContract>;
  readonly mediaSchema?: SystemContextMediaSchemaExpectation;
  readonly workflowInputBindings?: ReadonlyArray<WorkflowInputBindingDescriptor>;
}

export interface SystemContextValidationResult {
  readonly valid: boolean;
  readonly blockingIssues: ReadonlyArray<SystemContextValidationIssue>;
  readonly warningIssues: ReadonlyArray<SystemContextValidationIssue>;
  readonly issues: ReadonlyArray<SystemContextValidationIssue>;
  readonly normalizedContext: SystemContextContract;
  readonly bindingPreview?: WorkflowInputBindingPreviewResult;
}

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return true;
}

function inferValueType(value: unknown): "string" | "number" | "boolean" | "array" | "object" | "unknown" {
  if (typeof value === "string") {
    return "string";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (value && typeof value === "object") {
    return "object";
  }
  return "unknown";
}

function normalizeContext(context: SystemContextContract): SystemContextContract {
  const normalizedParameters = Object.fromEntries(
    Object.entries(context.parameters).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]),
  );

  return Object.freeze({
    ...context,
    parameters: Object.freeze(normalizedParameters),
  });
}

function matchesDatasetContract(
  dataset: SystemContextContract["datasets"][number],
  contract: SystemContextDatasetSchemaContract,
): boolean {
  if (contract.referenceId && dataset.referenceId !== contract.referenceId) {
    return false;
  }
  if (contract.instanceId && dataset.instanceId !== contract.instanceId) {
    return false;
  }
  if (contract.datasetAssetId && dataset.datasetAssetId !== contract.datasetAssetId) {
    return false;
  }
  return true;
}

export class SystemContextValidationService {
  constructor(
    private readonly datasetReferenceResolver: SystemContextDatasetReferenceResolver = createDefaultSystemContextDatasetReferenceResolver(),
  ) {}

  public validate(request: SystemContextValidationRequest): SystemContextValidationResult {
    const normalizedContext = normalizeContext(request.context);
    const issues: SystemContextValidationIssue[] = [];

    if (request.mediaSchema?.required && normalizedContext.selectedImages.length === 0) {
      issues.push(Object.freeze({
        code: "selected-image-missing",
        severity: "error",
        message: "System context requires at least one selected image.",
        path: "selectedImages",
      }));
    }

    normalizedContext.selectedImages.forEach((image, index) => {
      if (!image.imageId && !image.assetRef?.assetId) {
        issues.push(Object.freeze({
          code: "selected-image-invalid",
          severity: "error",
          message: "Selected image requires imageId or assetRef.assetId.",
          path: `selectedImages[${index}]`,
        }));
      }

      if (request.mediaSchema?.requireAssetReference && !image.assetRef?.assetId) {
        issues.push(Object.freeze({
          code: "selected-image-invalid",
          severity: "error",
          message: "Media schema expectation requires selected image assetRef.assetId.",
          path: `selectedImages[${index}].assetRef.assetId`,
        }));
      }

      request.mediaSchema?.requiredMetadataFields?.forEach((field) => {
        const metadata = image.metadata ?? {};
        if (!hasValue(metadata[field])) {
          issues.push(Object.freeze({
            code: "media-schema-image-metadata-missing",
            severity: "warning",
            message: `Selected image metadata is missing required field '${field}'.`,
            path: `selectedImages[${index}].metadata.${field}`,
          }));
        }
      });
    });

    request.requiredParameterKeys?.forEach((parameterKey) => {
      if (!hasValue(normalizedContext.parameters[parameterKey])) {
        issues.push(Object.freeze({
          code: "required-parameter-missing",
          severity: "error",
          message: `Required parameter '${parameterKey}' is missing from system context.`,
          path: `parameters.${parameterKey}`,
        }));
      }
    });

    normalizedContext.datasets.forEach((dataset, index) => {
      if (!dataset.instanceId && !dataset.datasetAssetId) {
        issues.push(Object.freeze({
          code: "dataset-reference-invalid",
          severity: "error",
          message: "Dataset reference requires instanceId or datasetAssetId.",
          path: `datasets[${index}]`,
        }));
      }
    });

    const datasetResolution = this.datasetReferenceResolver.resolve({ datasets: normalizedContext.datasets });
    datasetResolution.issues.forEach((issue) => {
      issues.push(Object.freeze({
        code: issue.code === SystemContextDatasetResolutionIssueCodes.incompatibleSchemaIntent
          ? "dataset-reference-incompatible"
          : "dataset-reference-unresolved",
        severity: issue.severity,
        message: issue.message,
        path: issue.path,
        details: issue.details,
      }));
    });

    request.datasetSchemaContracts?.forEach((contract, contractIndex) => {
      const matched = normalizedContext.datasets.find((dataset) => matchesDatasetContract(dataset, contract));
      if (!matched) {
        if (contract.required ?? true) {
          issues.push(Object.freeze({
            code: "dataset-reference-invalid",
            severity: "error",
            message: "Required dataset schema contract did not match any context dataset reference.",
            path: `datasetSchemaContracts[${contractIndex}]`,
            details: Object.freeze({ contract }),
          }));
        }
        return;
      }

      const actualIntent = typeof matched.metadata?.schemaIntentId === "string" ? matched.metadata.schemaIntentId : undefined;
      if (contract.schemaIntentId && contract.schemaIntentId !== actualIntent) {
        issues.push(Object.freeze({
          code: "dataset-schema-intent-mismatch",
          severity: "error",
          message: `Dataset schema intent mismatch. Expected '${contract.schemaIntentId}' but received '${actualIntent ?? "unknown"}'.`,
          path: `datasets.${matched.referenceId}.metadata.schemaIntentId`,
        }));
      }

      if (contract.expectedRecordValueType) {
        const actualValueType = inferValueType(matched.metadata?.sampleRecordValue);
        if (actualValueType !== "unknown" && actualValueType !== contract.expectedRecordValueType) {
          issues.push(Object.freeze({
            code: "dataset-schema-intent-mismatch",
            severity: "error",
            message: `Dataset record sample type mismatch. Expected '${contract.expectedRecordValueType}' but received '${actualValueType}'.`,
            path: `datasets.${matched.referenceId}.metadata.sampleRecordValue`,
          }));
        }
      }
    });

    let bindingPreview: WorkflowInputBindingPreviewResult | undefined;
    if (request.workflowInputBindings && request.workflowInputBindings.length > 0) {
      const selectedImage = normalizedContext.selectedImages[0]
        ? Object.freeze({
          selectionId: normalizedContext.selectedImages[0].selectionId,
          imageId: normalizedContext.selectedImages[0].imageId,
          assetRef: normalizedContext.selectedImages[0].assetRef,
          ...(normalizedContext.selectedImages[0].metadata ? { metadata: normalizedContext.selectedImages[0].metadata } : {}),
        })
        : undefined;

      bindingPreview = previewWorkflowInputBindings({
        bindings: request.workflowInputBindings,
        context: {
          uiFormValues: normalizedContext.parameters,
          runtimeParameters: normalizedContext.parameters,
          selectedImage,
          datasetInstances: datasetResolution.resolved
            .map((dataset) => ({
              instanceId: dataset.instanceId,
              systemId: dataset.systemAssetId,
              datasetAssetId: dataset.datasetAssetId,
              datasetVersionId: dataset.datasetVersionId,
              purpose: dataset.role,
              schema: {
                recordValueType: inferValueType(dataset.sampleRecordValue) === "unknown"
                  ? undefined
                  : inferValueType(dataset.sampleRecordValue),
              },
              records: dataset.sampleRecords,
            })),
        },
      });

      bindingPreview.unresolvedItems
        .filter((item) => item.required)
        .forEach((item) => {
          issues.push(Object.freeze({
            code: "workflow-input-unresolved",
            severity: "error",
            message: `Required workflow input '${item.inputId}' could not be resolved from system context.`,
            path: `workflowInputBindings.${item.bindingId}`,
          }));
        });
    }

    const blockingIssues = issues.filter((issue) => issue.severity === "error");
    const warningIssues = issues.filter((issue) => issue.severity === "warning");

    return Object.freeze({
      valid: blockingIssues.length === 0,
      blockingIssues: Object.freeze(blockingIssues),
      warningIssues: Object.freeze(warningIssues),
      issues: Object.freeze(issues),
      normalizedContext,
      bindingPreview,
    });
  }
}
