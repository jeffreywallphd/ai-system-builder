import { describe, expect, it } from "../../../testing/node-test";

import {
  DESKTOP_DATASET_PREPARE_TEMPLATED_OPERATION,
  DESKTOP_DATASET_PREPARE_TEMPLATED_REQUEST_CHANNEL,
  DESKTOP_DATASET_PREPARE_TEMPLATED_RESPONSE_CHANNEL,
  createDesktopPrepareTemplatedDatasetRequest,
  createDesktopPrepareTemplatedDatasetSuccessResponse,
} from "..";

describe("desktop dataset preparation ipc contract", () => {
  it("defines operation/channel identities", () => {
    expect(DESKTOP_DATASET_PREPARE_TEMPLATED_OPERATION).toBe("artifact.prepare-templated-dataset");
    expect(DESKTOP_DATASET_PREPARE_TEMPLATED_REQUEST_CHANNEL.value).toBe("ipc.artifact.prepare-templated-dataset.request");
    expect(DESKTOP_DATASET_PREPARE_TEMPLATED_RESPONSE_CHANNEL.value).toBe("ipc.artifact.prepare-templated-dataset.response");
  });

  it("creates normalized request and success envelopes", () => {
    const request = createDesktopPrepareTemplatedDatasetRequest({
      command: {
        sourceArtifactIds: ["artifact-1"],
        template: "Prompt: {{text}}",
        split: { trainRatio: 0.8, testRatio: 0.2, seed: 7 },
        outputFormat: "jsonl",
      },
      boundary: {
        host: "desktop",
        source: " desktop.renderer.dataset-preparation ",
      },
    });

    expect(request.payload.boundary.source).toBe("desktop.renderer.dataset-preparation");

    const response = createDesktopPrepareTemplatedDatasetSuccessResponse({
      train: {
        sourceKind: "runtime",
        storage: { key: "stored-train", mediaType: "application/x-ndjson", sizeBytes: 10 },
      },
      test: {
        sourceKind: "runtime",
        storage: { key: "stored-test", mediaType: "application/x-ndjson", sizeBytes: 10 },
      },
      trainRowCount: 8,
      testRowCount: 2,
      warnings: [],
    });

    expect(response.ok).toBe(true);
    expect(response.value.result.train.storage.key).toBe("stored-train");
  });
});
