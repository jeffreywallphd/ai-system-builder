import { describe, expect, it } from "vitest";

import { validateDatasetPreparationInputs } from "../hooks/datasetPreparationRequestValidation";

function createValidInput() {
  return {
    selectedArtifactIds: ["artifact-1"],
    chunkSize: "1000",
    chunkOverlap: "200",
    maxChunkCount: "",
    modelId: "",
    maxExamplesPerChunk: "4",
    batchSize: "4",
    generationTemperature: "",
    generationTopP: "",
    generationMaxNewTokens: "",
    trainRatio: "0.8",
    testRatio: "0.2",
    seed: "",
    localDestinationEnabled: true,
    huggingFaceDestinationEnabled: false,
    huggingFaceRepository: "",
  };
}

describe("datasetPreparationRequestValidation", () => {
  it("accepts valid input", () => {
    expect(validateDatasetPreparationInputs(createValidInput())).toBeUndefined();
  });

  it("rejects invalid chunk size", () => {
    expect(validateDatasetPreparationInputs({ ...createValidInput(), chunkSize: "0" })).toBe(
      "Chunk size must be a positive integer.",
    );
  });
});
