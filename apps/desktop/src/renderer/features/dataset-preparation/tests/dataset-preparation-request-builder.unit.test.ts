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
      trainRatio: "0.8",
      testRatio: "0.2",
      shuffle: true,
      outputFormat: "parquet",
      outputBaseName: "",
      localDestinationEnabled: true,
      huggingFaceDestinationEnabled: false,
      huggingFaceRepository: "",
      huggingFaceRevision: "",
      huggingFacePathPrefix: "",
      parsedSeed: undefined,
      parsedChunkSize: 1000,
      parsedChunkOverlap: 200,
      parsedMaxChunkCount: undefined,
      parsedMaxExamplesPerChunk: 4,
      parsedBatchSize: 4,
      parsedGenerationTemperature: undefined,
      parsedGenerationTopP: undefined,
      parsedGenerationMaxNewTokens: undefined,
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
});
