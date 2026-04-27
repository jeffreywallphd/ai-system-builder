import {
  normalizeModelArtifactForm,
  normalizeModelLifecycleStatus,
  normalizeModelSerializationFormat,
  normalizeModelSource,
  normalizeModelTaskTags,
  type ModelArtifactForm,
  type ModelLifecycleStatus,
  type ModelSerializationFormat,
  type ModelSource,
  type ModelTaskTag,
} from "../../domain/model";
import { normalizeModelBrowseProvider, type ModelBrowseProvider } from "./model-browse-provider";
import { normalizeModelInferenceMode, type ModelInferenceMode } from "./model-inference-mode";
import { normalizeModelValidationStatus, type ModelValidationStatus } from "./model-validation";

export interface ModelInventoryRecord {
  modelRecordId: string;
  displayName: string;
  source: ModelSource;
  lifecycleStatus: ModelLifecycleStatus;
  artifactForm: ModelArtifactForm;
  provider: ModelBrowseProvider;
  modelId?: string;
  localPath?: string;
  createdAt: string;
  updatedAt?: string;
  taskTags?: ModelTaskTag[];
  inferenceMode?: ModelInferenceMode;
  serializationFormat?: ModelSerializationFormat;
  parameterCount?: number;
  sizeBytes?: number;
  baseModelId?: string;
  generatedFromRunId?: string;
  adapterOfModelId?: string;
  validationStatus?: ModelValidationStatus;
  validationReportPath?: string;
  metadata?: Record<string, unknown>;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeRequiredText(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${fieldName} must be a non-empty trimmed string.`);
  }

  return normalized;
}

function normalizeOptionalNonNegativeNumber(value: number | undefined): number | undefined {
  if (typeof value !== "number") {
    return undefined;
  }

  return value >= 0 ? value : undefined;
}

export function normalizeModelInventoryRecord(record: ModelInventoryRecord): ModelInventoryRecord {
  return {
    modelRecordId: normalizeRequiredText(record.modelRecordId, "modelRecordId"),
    displayName: normalizeRequiredText(record.displayName, "displayName"),
    source: normalizeModelSource(record.source),
    lifecycleStatus: normalizeModelLifecycleStatus(record.lifecycleStatus),
    artifactForm: normalizeModelArtifactForm(record.artifactForm),
    provider: normalizeModelBrowseProvider(record.provider),
    modelId: normalizeOptionalText(record.modelId),
    localPath: normalizeOptionalText(record.localPath),
    createdAt: normalizeRequiredText(record.createdAt, "createdAt"),
    updatedAt: normalizeOptionalText(record.updatedAt),
    taskTags: normalizeModelTaskTags(record.taskTags),
    inferenceMode:
      typeof record.inferenceMode === "string"
        ? normalizeModelInferenceMode(record.inferenceMode)
        : undefined,
    serializationFormat:
      typeof record.serializationFormat === "string"
        ? normalizeModelSerializationFormat(record.serializationFormat)
        : undefined,
    parameterCount: normalizeOptionalNonNegativeNumber(record.parameterCount),
    sizeBytes: normalizeOptionalNonNegativeNumber(record.sizeBytes),
    baseModelId: normalizeOptionalText(record.baseModelId),
    generatedFromRunId: normalizeOptionalText(record.generatedFromRunId),
    adapterOfModelId: normalizeOptionalText(record.adapterOfModelId),
    validationStatus:
      typeof record.validationStatus === "string"
        ? normalizeModelValidationStatus(record.validationStatus)
        : undefined,
    validationReportPath: normalizeOptionalText(record.validationReportPath),
    metadata: record.metadata,
  };
}
