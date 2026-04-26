const TRAIN_TEST_SUM_TOLERANCE = 0.000_001;

export function parseOptionalNumber(value: string): number | undefined {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function parseOptionalInteger(value: string): number | undefined {
  const parsed = parseOptionalNumber(value);
  if (typeof parsed !== "number") {
    return undefined;
  }

  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

export interface DatasetPreparationValidationInput {
  selectedArtifactIds: string[];
  chunkSize: string;
  chunkOverlap: string;
  maxChunkCount: string;
  modelId: string;
  maxExamplesPerChunk: string;
  batchSize: string;
  generationTemperature: string;
  generationTopP: string;
  generationMaxNewTokens: string;
  trainRatio: string;
  testRatio: string;
  seed: string;
  localDestinationEnabled: boolean;
  huggingFaceDestinationEnabled: boolean;
  huggingFaceRepository: string;
}

export function validateDatasetPreparationInputs(input: DatasetPreparationValidationInput): string | undefined {
  if (input.selectedArtifactIds.length === 0) {
    return "Select at least one source artifact.";
  }

  const chunkSize = parseOptionalInteger(input.chunkSize);
  if (typeof chunkSize !== "number" || Number.isNaN(chunkSize) || chunkSize <= 0) {
    return "Chunk size must be a positive integer.";
  }

  const chunkOverlap = parseOptionalInteger(input.chunkOverlap);
  if (typeof chunkOverlap !== "number" || Number.isNaN(chunkOverlap) || chunkOverlap < 0) {
    return "Chunk overlap must be an integer greater than or equal to 0.";
  }

  const maxChunkCount = parseOptionalInteger(input.maxChunkCount);
  if (typeof maxChunkCount === "number" && (Number.isNaN(maxChunkCount) || maxChunkCount <= 0)) {
    return "Max chunk count must be a positive integer when provided.";
  }

  const maxExamplesPerChunk = parseOptionalInteger(input.maxExamplesPerChunk);
  if (typeof maxExamplesPerChunk === "number" && (Number.isNaN(maxExamplesPerChunk) || maxExamplesPerChunk <= 0)) {
    return "Max examples per chunk must be a positive integer when provided.";
  }

  const batchSize = parseOptionalInteger(input.batchSize);
  if (typeof batchSize === "number" && (Number.isNaN(batchSize) || batchSize <= 0)) {
    return "Batch size must be a positive integer when provided.";
  }

  const generationMaxNewTokens = parseOptionalInteger(input.generationMaxNewTokens);
  if (typeof generationMaxNewTokens === "number" && (Number.isNaN(generationMaxNewTokens) || generationMaxNewTokens <= 0)) {
    return "Generation max new tokens must be a positive integer when provided.";
  }

  const generationTemperature = parseOptionalNumber(input.generationTemperature);
  if (typeof generationTemperature === "number" && Number.isNaN(generationTemperature)) {
    return "Generation temperature must be numeric when provided.";
  }

  const generationTopP = parseOptionalNumber(input.generationTopP);
  if (typeof generationTopP === "number" && Number.isNaN(generationTopP)) {
    return "Generation top-p must be numeric when provided.";
  }

  const trainRatio = Number(input.trainRatio);
  if (!Number.isFinite(trainRatio)) {
    return "Train ratio must be a valid number.";
  }

  const testRatio = Number(input.testRatio);
  if (!Number.isFinite(testRatio)) {
    return "Test ratio must be a valid number.";
  }

  if (trainRatio <= 0 || testRatio <= 0) {
    return "Train and test ratios must both be greater than 0.";
  }

  if (Math.abs((trainRatio + testRatio) - 1) > TRAIN_TEST_SUM_TOLERANCE) {
    return "Train and test ratios must sum to 1.0.";
  }

  const parsedSeed = parseOptionalNumber(input.seed);
  if (typeof parsedSeed === "number" && Number.isNaN(parsedSeed)) {
    return "Seed must be numeric when provided.";
  }

  if (!input.localDestinationEnabled && !input.huggingFaceDestinationEnabled) {
    return "Enable at least one output destination.";
  }

  if (input.huggingFaceDestinationEnabled && input.huggingFaceRepository.trim().length === 0) {
    return "Hugging Face repository is required when that destination is enabled.";
  }

  return undefined;
}
