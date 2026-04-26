import { describe, expect, it } from "vitest";

import { buildDatasetPreparationRequest } from "../hooks/datasetPreparationRequestBuilder";

describe("datasetPreparationRequestBuilder", () => {
  it("builds request with resolved defaults and parsed values", () => {
    const request = buildDatasetPreparationRequest({
      selectedArtifactIds: ["artifact-1"],
      unsupportedDocumentPolicy: "",
      normalizationMode: "",
      preserveDocumentBoundaries: true,
      modelId: "",
      modelInferenceMode: "text2text",
      modelDevice: "",
      modelTorchDtype: "",
      failurePolicy: "skip",
      shuffle: true,
      outputFormat: "parquet",
      outputBaseName: "",
      localDestinationEnabled: true,
      huggingFaceDestinationEnabled: false,
      huggingFaceRepository: "",
      huggingFaceRevision: "",
      huggingFacePathPrefix: "",
      parsed: {
        chunkSize: 1000,
        chunkOverlap: 200,
        maxChunkCount: undefined,
        maxExamplesPerChunk: 4,
        batchSize: 4,
        generationTemperature: undefined,
        generationTopP: undefined,
        generationMaxNewTokens: undefined,
        trainRatio: 0.8,
        testRatio: 0.2,
        seed: undefined,
      },
      resolvedDefault: {
        provider: "transformers",
        modelId: "google/flan-t5-base",
        inferenceMode: "text2text",
        source: "global",
        device: "auto",
        torchDtype: "auto",
      },
    });

    expect(request.recipe.generation.model).toMatchObject({
      provider: "transformers",
      modelId: "google/flan-t5-base",
      inferenceMode: "text2text",
      device: "auto",
      torchDtype: "auto",
    });
    expect(request.split).toMatchObject({ trainRatio: 0.8, testRatio: 0.2 });
  });

  it("uses explicit model id and inference mode when provided", () => {
    const request = buildDatasetPreparationRequest({
      selectedArtifactIds: ["artifact-1"],
      unsupportedDocumentPolicy: "",
      normalizationMode: "",
      preserveDocumentBoundaries: true,
      modelId: "Qwen/Qwen2.5-1.5B-Instruct",
      modelInferenceMode: "chat",
      modelDevice: "cuda",
      modelTorchDtype: "float16",
      failurePolicy: "skip",
      shuffle: true,
      outputFormat: "parquet",
      outputBaseName: "",
      localDestinationEnabled: true,
      huggingFaceDestinationEnabled: false,
      huggingFaceRepository: "",
      huggingFaceRevision: "",
      huggingFacePathPrefix: "",
      parsed: {
        chunkSize: 1000,
        chunkOverlap: 200,
        maxChunkCount: undefined,
        maxExamplesPerChunk: 4,
        batchSize: 4,
        generationTemperature: undefined,
        generationTopP: undefined,
        generationMaxNewTokens: undefined,
        trainRatio: 0.8,
        testRatio: 0.2,
        seed: undefined,
      },
      resolvedDefault: {
        provider: "transformers",
        modelId: "google/flan-t5-base",
        inferenceMode: "text2text",
        source: "global",
        device: "auto",
        torchDtype: "auto",
      },
    });

    expect(request.recipe.generation.model).toMatchObject({
      modelId: "Qwen/Qwen2.5-1.5B-Instruct",
      inferenceMode: "chat",
      device: "cuda",
      torchDtype: "float16",
    });
  });
});
