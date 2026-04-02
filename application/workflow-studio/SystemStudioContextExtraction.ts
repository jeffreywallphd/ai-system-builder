import {
  createSystemContextContract,
  type SystemContextContract,
  type SystemContextDatasetReference,
  type SystemContextImageReference,
} from "../../domain/system-studio/SystemContextContract";

export interface SystemStudioSelectedImageState {
  readonly selectionId?: string;
  readonly imageId?: string;
  readonly assetRef?: Readonly<{
    readonly assetId?: string;
    readonly versionId?: string;
    readonly recordId?: string;
    readonly uri?: string;
  }>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SystemStudioDatasetSelectionState {
  readonly referenceId?: string;
  readonly instanceId?: string;
  readonly datasetAssetId?: string;
  readonly datasetVersionId?: string;
  readonly role?: string;
  readonly systemAssetId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SystemStudioRuntimeMetadataState {
  readonly runtimeSessionId?: string;
  readonly workflowRunId?: string;
  readonly selectorSessionId?: string;
  readonly systemAssetId?: string;
  readonly workflowAssetId?: string;
  readonly sourceStudio?: string;
  readonly triggerEventId?: string;
  readonly triggerName?: string;
}

export interface SystemStudioContextExtractionSource {
  readonly selectedImages?: ReadonlyArray<SystemStudioSelectedImageState>;
  readonly parameterValues?: Readonly<Record<string, unknown>>;
  readonly datasets?: ReadonlyArray<SystemStudioDatasetSelectionState>;
  readonly runtime?: SystemStudioRuntimeMetadataState;
  readonly extensions?: Readonly<Record<string, unknown>>;
}

export interface SystemStudioContextExtractionIssue {
  readonly code: "selected-image-missing-reference" | "dataset-reference-missing-identity";
  readonly severity: "warning";
  readonly message: string;
  readonly path?: string;
}

export interface SystemStudioContextExtractionResult {
  readonly context: SystemContextContract;
  readonly issues: ReadonlyArray<SystemStudioContextExtractionIssue>;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeParameters(values?: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  if (!values) {
    return Object.freeze({});
  }

  const normalizedEntries = Object.entries(values).map(([key, value]) => {
    if (typeof value === "string") {
      return [key, value.trim()] as const;
    }
    return [key, value] as const;
  });

  return Object.freeze(Object.fromEntries(normalizedEntries));
}

function mapSelectedImages(
  selectedImages: ReadonlyArray<SystemStudioSelectedImageState> | undefined,
): ReadonlyArray<SystemContextImageReference> {
  if (!selectedImages) {
    return Object.freeze([]);
  }

  return Object.freeze(selectedImages.map((item, index) => {
    const selectionId = normalizeOptionalString(item.selectionId)
      ?? normalizeOptionalString(item.imageId)
      ?? `selected-image-${index + 1}`;
    const assetId = normalizeOptionalString(item.assetRef?.assetId);
    const assetRef = assetId
      ? Object.freeze({
        assetId,
        versionId: normalizeOptionalString(item.assetRef?.versionId),
        recordId: normalizeOptionalString(item.assetRef?.recordId),
        uri: normalizeOptionalString(item.assetRef?.uri),
      })
      : undefined;

    return Object.freeze({
      selectionId,
      imageId: normalizeOptionalString(item.imageId),
      assetRef,
      metadata: item.metadata ? Object.freeze({ ...item.metadata }) : undefined,
    } satisfies SystemContextImageReference);
  }));
}

function mapDatasets(
  datasets: ReadonlyArray<SystemStudioDatasetSelectionState> | undefined,
): ReadonlyArray<SystemContextDatasetReference> {
  if (!datasets) {
    return Object.freeze([]);
  }

  return Object.freeze(datasets.map((item, index) => Object.freeze({
    referenceId: normalizeOptionalString(item.referenceId) ?? `dataset-ref-${index + 1}`,
    instanceId: normalizeOptionalString(item.instanceId),
    datasetAssetId: normalizeOptionalString(item.datasetAssetId),
    datasetVersionId: normalizeOptionalString(item.datasetVersionId),
    role: normalizeOptionalString(item.role),
    systemAssetId: normalizeOptionalString(item.systemAssetId),
    metadata: item.metadata ? Object.freeze({ ...item.metadata }) : undefined,
  } satisfies SystemContextDatasetReference)));
}

export interface SystemStudioContextExtractor {
  readonly extract: (source: SystemStudioContextExtractionSource) => SystemStudioContextExtractionResult;
}

export function createDefaultSystemStudioContextExtractor(): SystemStudioContextExtractor {
  return Object.freeze({
    extract: (source) => {
      const selectedImages = mapSelectedImages(source.selectedImages);
      const datasets = mapDatasets(source.datasets);
      const parameters = normalizeParameters(source.parameterValues);

      const issues: SystemStudioContextExtractionIssue[] = [];
      selectedImages.forEach((image, index) => {
        if (!image.imageId && !image.assetRef?.assetId) {
          issues.push(Object.freeze({
            code: "selected-image-missing-reference",
            severity: "warning",
            message: "Selected image entry does not contain an imageId or assetRef.assetId.",
            path: `selectedImages[${index}]`,
          }));
        }
      });

      datasets.forEach((dataset, index) => {
        if (!dataset.instanceId && !dataset.datasetAssetId) {
          issues.push(Object.freeze({
            code: "dataset-reference-missing-identity",
            severity: "warning",
            message: "Dataset reference should include instanceId or datasetAssetId.",
            path: `datasets[${index}]`,
          }));
        }
      });

      const context = createSystemContextContract({
        selectedImages,
        parameters,
        datasets,
        runtime: {
          runtimeSessionId: normalizeOptionalString(source.runtime?.runtimeSessionId),
          workflowRunId: normalizeOptionalString(source.runtime?.workflowRunId),
          selectorSessionId: normalizeOptionalString(source.runtime?.selectorSessionId),
          systemAssetId: normalizeOptionalString(source.runtime?.systemAssetId),
          workflowAssetId: normalizeOptionalString(source.runtime?.workflowAssetId),
          sourceStudio: normalizeOptionalString(source.runtime?.sourceStudio),
          triggerEventId: normalizeOptionalString(source.runtime?.triggerEventId),
          triggerName: normalizeOptionalString(source.runtime?.triggerName),
        },
        extensions: source.extensions ? Object.freeze({ ...source.extensions }) : undefined,
      });

      return Object.freeze({
        context,
        issues: Object.freeze(issues),
      });
    },
  });
}
