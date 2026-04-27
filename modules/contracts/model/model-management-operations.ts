import type { ModelLifecycleStatus, ModelSource, ModelTaskTag } from "../../domain/model";
import { type ModelInferenceMode } from "./model-inference-mode";
import { type ModelBrowseProvider } from "./model-browse-provider";
import { normalizeModelInventoryRecord, type ModelInventoryRecord } from "./model-inventory";

export interface ListModelsRequest {
  source?: ModelSource;
  lifecycleStatus?: ModelLifecycleStatus;
  taskTags?: ModelTaskTag[];
  search?: string;
  limit?: number;
  cursor?: string;
}

export interface ListModelsResult {
  models: ModelInventoryRecord[];
  nextCursor?: string;
}

export interface SaveModelReferenceRequest {
  provider: ModelBrowseProvider;
  modelId: string;
  displayName?: string;
  inferenceMode?: ModelInferenceMode;
  taskTags?: ModelTaskTag[];
  metadata?: Record<string, unknown>;
}

export interface SaveModelReferenceResult {
  model: ModelInventoryRecord;
}

export interface DeleteModelRecordRequest {
  modelRecordId: string;
  deleteLocalFiles?: boolean;
}

export interface DeleteModelRecordResult {
  deletedModelRecordId: string;
  deletedLocalFiles: boolean;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeListModelsResult(result: ListModelsResult): ListModelsResult {
  return {
    models: result.models.map((model) => normalizeModelInventoryRecord(model)),
    nextCursor: normalizeOptionalText(result.nextCursor),
  };
}
