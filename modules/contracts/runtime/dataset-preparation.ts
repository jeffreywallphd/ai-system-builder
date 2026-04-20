export interface DatasetPreparationSourceInput {
  artifactId: string;
  localPath: string;
  mediaType?: string;
  originalName?: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentNormalizationConfig {
  targetFormat: "markdown";
  unsupportedDocumentPolicy?: "fail" | "skip";
  normalizationMode?: "best-effort" | "strict";
}

export interface MarkdownChunkingConfig {
  strategy: "character";
  chunkSize: number;
  chunkOverlap: number;
  preserveDocumentBoundaries?: boolean;
}

export interface GenerationParams {
  temperature?: number;
  topP?: number;
  maxNewTokens?: number;
}

export interface LocalModelConfig {
  provider: "transformers";
  modelId: string;
  device?: "cpu" | "cuda" | "auto";
  torchDtype?: "auto" | "float16" | "bfloat16" | "float32";
}

export interface ExampleGenerationConfig {
  mode: "qa";
  model: LocalModelConfig;
  promptTemplate?: string;
  maxExamplesPerChunk?: number;
  generationParams?: GenerationParams;
}

export interface DatasetPreparationRecipe {
  normalization: DocumentNormalizationConfig;
  chunking: MarkdownChunkingConfig;
  generation: ExampleGenerationConfig;
}

export interface DatasetSplitConfig {
  trainRatio: number;
  testRatio: number;
  seed?: number;
  shuffle?: boolean;
}

export interface DatasetOutputConfig {
  format: "jsonl" | "json" | "csv";
  naming?: {
    baseName?: string;
  };
}

export interface DatasetPreparationSummary {
  sourceDocumentCount: number;
  normalizedDocumentCount: number;
  skippedDocumentCount: number;
  chunkCount: number;
  generatedExampleCount: number;
  trainRowCount: number;
  testRowCount: number;
}

export interface DatasetPreparationWarning {
  code: string;
  message: string;
  sourceArtifactId?: string;
}
