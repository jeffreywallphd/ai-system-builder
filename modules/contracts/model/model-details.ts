import { type ModelTaskTag, normalizeModelTaskTags } from "../../domain/model";
import { normalizeModelBrowseProvider, type ModelBrowseProvider } from "./model-browse-provider";
import { normalizeModelInferenceMode, type ModelInferenceMode } from "./model-inference-mode";
import { normalizeModelBrowseItem, type ModelBrowseItem } from "./browse-models";

export interface GetModelDetailsRequest {
  provider: ModelBrowseProvider;
  modelId: string;
}

export interface ModelDetails extends ModelBrowseItem {
  cardMarkdown?: string;
  tags?: string[];
  pipelineTag?: string;
  siblings?: string[];
  config?: Record<string, unknown>;
  tokenizerAvailable?: boolean;
  safetensorsAvailable?: boolean;
  adapterAvailable?: boolean;
  estimatedParameterCount?: number;
  recommendedInferenceMode?: ModelInferenceMode;
  warnings?: string[];
  metadata?: Record<string, unknown>;
}

export interface GetModelDetailsResult {
  model: ModelDetails;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeStringList(values: readonly string[] | undefined): string[] | undefined {
  const normalized = values
    ?.map((value) => value.trim())
    .filter((value) => value.length > 0);

  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalNonNegativeNumber(value: number | undefined): number | undefined {
  if (typeof value !== "number") {
    return undefined;
  }

  return value >= 0 ? value : undefined;
}

export function normalizeGetModelDetailsRequest(request: GetModelDetailsRequest): GetModelDetailsRequest {
  const modelId = request.modelId.trim();
  if (modelId.length === 0) {
    throw new Error("Get model details request modelId must be a non-empty trimmed string.");
  }

  return {
    provider: normalizeModelBrowseProvider(request.provider),
    modelId,
  };
}

export function normalizeModelDetails(model: ModelDetails): ModelDetails {
  const browseModel = normalizeModelBrowseItem(model);

  return {
    ...browseModel,
    cardMarkdown: normalizeOptionalText(model.cardMarkdown),
    tags: normalizeStringList(model.tags),
    pipelineTag: normalizeOptionalText(model.pipelineTag),
    siblings: normalizeStringList(model.siblings),
    config: model.config,
    tokenizerAvailable: typeof model.tokenizerAvailable === "boolean" ? model.tokenizerAvailable : undefined,
    safetensorsAvailable: typeof model.safetensorsAvailable === "boolean" ? model.safetensorsAvailable : undefined,
    adapterAvailable: typeof model.adapterAvailable === "boolean" ? model.adapterAvailable : undefined,
    estimatedParameterCount: normalizeOptionalNonNegativeNumber(model.estimatedParameterCount),
    recommendedInferenceMode:
      typeof model.recommendedInferenceMode === "string"
        ? normalizeModelInferenceMode(model.recommendedInferenceMode)
        : undefined,
    warnings: normalizeStringList(model.warnings),
    metadata: model.metadata,
  };
}

export function normalizeGetModelDetailsResult(result: GetModelDetailsResult): GetModelDetailsResult {
  return {
    model: normalizeModelDetails(result.model),
  };
}
