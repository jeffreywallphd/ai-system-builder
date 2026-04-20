import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import {
  DESKTOP_DATASET_PREPARE_TEMPLATED_REQUEST_CHANNEL,
  createDesktopPrepareTemplatedDatasetRequest,
} from "../../../../contracts/ipc";
import { createContractError } from "../../../../contracts/shared";
import {
  createDesktopPrepareTemplatedDatasetIpcHandler,
  registerDatasetPreparationIpc,
  type PrepareTemplatedDatasetFromArtifactsUseCasePort,
} from "../dataset-preparation/registerDatasetPreparationIpc";

describe("registerDatasetPreparationIpc", () => {
  it("maps request payload/context to use case and returns success envelope", async () => {
    const execute = testDouble.fn<PrepareTemplatedDatasetFromArtifactsUseCasePort["execute"]>().mockResolvedValue({
      ok: true,
      value: {
        train: { sourceKind: "runtime", storage: { key: "stored-train", mediaType: "application/x-ndjson", sizeBytes: 10 } },
        test: { sourceKind: "runtime", storage: { key: "stored-test", mediaType: "application/x-ndjson", sizeBytes: 10 } },
        trainRowCount: 8,
        testRowCount: 2,
      },
      requestId: "req-1",
      correlationId: "corr-1",
    });

    const handler = createDesktopPrepareTemplatedDatasetIpcHandler({ execute });
    const response = await handler({}, createDesktopPrepareTemplatedDatasetRequest({
      command: {
        sourceArtifactIds: ["artifact-1"],
        template: "Prompt: {{text}}",
        split: { trainRatio: 0.8, testRatio: 0.2 },
        outputFormat: "jsonl",
      },
      boundary: { host: "desktop", source: "desktop.renderer.dataset-preparation" },
    }, { requestId: "req-1", correlationId: "corr-1" }));

    expect(execute).toHaveBeenCalled();
    expect(response.ok).toBe(true);
  });

  it("maps use case failures to ipc failure envelopes", async () => {
    const handler = createDesktopPrepareTemplatedDatasetIpcHandler({
      execute: testDouble.fn<PrepareTemplatedDatasetFromArtifactsUseCasePort["execute"]>().mockResolvedValue({
        ok: false,
        error: createContractError("validation", "bad input"),
      }),
    });

    const response = await handler({}, createDesktopPrepareTemplatedDatasetRequest({
      command: {
        sourceArtifactIds: ["artifact-1"],
        template: "Prompt: {{text}}",
        split: { trainRatio: 0.8, testRatio: 0.2 },
        outputFormat: "jsonl",
      },
      boundary: { host: "desktop", source: "desktop.renderer.dataset-preparation" },
    }));

    expect(response.ok).toBe(false);
  });

  it("registers the dataset preparation channel", () => {
    const channels: string[] = [];
    registerDatasetPreparationIpc({
      ipcMain: {
        handle: testDouble.fn((channel: string) => {
          channels.push(channel);
        }),
      },
      prepareTemplatedDatasetFromArtifactsUseCase: {
        execute: testDouble.fn(),
      },
    });

    expect(channels).toEqual([DESKTOP_DATASET_PREPARE_TEMPLATED_REQUEST_CHANNEL.value]);
  });
});
