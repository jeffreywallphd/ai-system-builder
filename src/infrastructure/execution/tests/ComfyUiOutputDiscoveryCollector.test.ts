import { describe, expect, it, mock } from "bun:test";
import {
  ImageManipulationCollectedExecutionStatuses,
  ImageManipulationOutputSlotMatchStatuses,
} from "@application/image-workflows/ports";
import { ComfyUiOutputDiscoveryCollector } from "../comfyui/ComfyUiOutputDiscoveryCollector";
import { ComfyUiTransportClient } from "../comfyui/ComfyUiTransportClient";

describe("ComfyUiOutputDiscoveryCollector", () => {
  it("discovers completed prompt image outputs and collects normalized descriptor records", async () => {
    const fetchFn = mock(async () => new Response(JSON.stringify({
      "prompt-collect-1": Object.freeze({
        status: Object.freeze({
          completed: true,
          status_str: "success",
        }),
        outputs: Object.freeze({
          "9": Object.freeze({
            images: Object.freeze([
              Object.freeze({
                filename: "first.png",
                subfolder: "results",
                type: "output",
              }),
            ]),
          }),
          "13": Object.freeze({
            images: Object.freeze([
              Object.freeze({
                filename: "second.jpg",
                subfolder: "results",
                type: "output",
              }),
            ]),
          }),
        }),
      }),
    })));
    const transportClient = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
      now: () => new Date("2026-04-08T13:00:00.000Z"),
    });
    const collector = new ComfyUiOutputDiscoveryCollector({
      transportClient,
      now: () => new Date("2026-04-08T13:00:00.000Z"),
    });

    const result = await collector.discoverAndCollect({
      executionJobId: "job-1",
      runId: "run-1",
      workspaceId: "workspace-1",
      backendExecutionId: "prompt-collect-1",
      expectedOutputs: Object.freeze([
        Object.freeze({
          outputId: "output-primary",
          backendField: "outputs.9.images[0]",
          logicalTargetReference: "dataset-instance://output/primary",
        }),
        Object.freeze({
          outputId: "output-variant",
          backendField: "outputs.13.images[0]",
          logicalTargetReference: "dataset-instance://output/variant",
        }),
      ]),
    });

    expect(result.discovery.summary.discoveredCount).toBe(2);
    expect(result.discovery.summary.matchedSlotCount).toBe(2);
    expect(result.discovery.outputs[0]?.slotMatch?.status).toBe(ImageManipulationOutputSlotMatchStatuses.matched);
    expect(result.discovery.outputs[1]?.slotMatch?.status).toBe(ImageManipulationOutputSlotMatchStatuses.matched);
    expect(result.collected.status).toBe(ImageManipulationCollectedExecutionStatuses.collected);
    expect(result.collected.collectionFailure).toBeUndefined();
    expect(result.collected.summary.notPersistedCount).toBe(2);
  });

  it("marks collection as partially-collected when malformed image output references are present", async () => {
    const fetchFn = mock(async () => new Response(JSON.stringify({
      "prompt-collect-2": Object.freeze({
        status: Object.freeze({
          completed: true,
          status_str: "success",
        }),
        outputs: Object.freeze({
          "21": Object.freeze({
            images: Object.freeze([
              Object.freeze({
                filename: "valid.webp",
                subfolder: "results",
                type: "output",
              }),
              Object.freeze({
                filename: "C:\\temp\\unsafe.png",
                subfolder: "results",
                type: "output",
              }),
            ]),
          }),
        }),
      }),
    })));
    const transportClient = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
      now: () => new Date("2026-04-08T13:10:00.000Z"),
    });
    const collector = new ComfyUiOutputDiscoveryCollector({
      transportClient,
      now: () => new Date("2026-04-08T13:10:00.000Z"),
    });

    const result = await collector.discoverAndCollect({
      executionJobId: "job-2",
      runId: "run-2",
      workspaceId: "workspace-2",
      backendExecutionId: "prompt-collect-2",
    });

    expect(result.discovery.summary.discoveredCount).toBe(1);
    expect(result.collected.status).toBe(ImageManipulationCollectedExecutionStatuses.partiallyCollected);
    expect(result.collected.collectionFailure?.category).toBe("output");
    expect(result.collected.collectionFailure?.code).toBe("output-collection-partial-anomaly");
    expect(result.collected.collectionFailure?.partialOutputCount).toBe(1);
  });

  it("fails collection explicitly when completed jobs return no discoverable image outputs", async () => {
    const fetchFn = mock(async () => new Response(JSON.stringify({
      "prompt-collect-3": Object.freeze({
        status: Object.freeze({
          completed: true,
          status_str: "success",
        }),
        outputs: Object.freeze({}),
      }),
    })));
    const transportClient = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
      now: () => new Date("2026-04-08T13:20:00.000Z"),
    });
    const collector = new ComfyUiOutputDiscoveryCollector({
      transportClient,
      now: () => new Date("2026-04-08T13:20:00.000Z"),
    });

    const result = await collector.discoverAndCollect({
      executionJobId: "job-3",
      runId: "run-3",
      workspaceId: "workspace-3",
      backendExecutionId: "prompt-collect-3",
    });

    expect(result.discovery.summary.discoveredCount).toBe(0);
    expect(result.collected.status).toBe(ImageManipulationCollectedExecutionStatuses.failed);
    expect(result.collected.collectionFailure?.category).toBe("output");
    expect(result.collected.collectionFailure?.code).toBe("output-collection-failed");
    expect(result.collected.summary.collectedCount).toBe(0);
  });

  it("releases adapter-tracked temporary output references on explicit cleanup requests", async () => {
    const fetchFn = mock(async () => new Response(JSON.stringify({
      "prompt-collect-4": Object.freeze({
        status: Object.freeze({
          completed: true,
          status_str: "success",
        }),
        outputs: Object.freeze({
          "2": Object.freeze({
            images: Object.freeze([
              Object.freeze({
                filename: "output.png",
                subfolder: "results",
                type: "output",
              }),
            ]),
          }),
        }),
      }),
    })));
    const transportClient = new ComfyUiTransportClient({
      baseUrl: "http://localhost:8188",
      fetch: fetchFn as unknown as typeof fetch,
      now: () => new Date("2026-04-08T13:30:00.000Z"),
    });
    const collector = new ComfyUiOutputDiscoveryCollector({
      transportClient,
      now: () => new Date("2026-04-08T13:30:00.000Z"),
    });

    await collector.discoverAndCollect({
      executionJobId: "job-4",
      runId: "run-4",
      workspaceId: "workspace-4",
      backendExecutionId: "prompt-collect-4",
    });

    const released = await collector.releaseTemporaryReferences({
      executionJobId: "job-4",
      requestedAt: "2026-04-08T13:30:10.000Z",
      reason: "run-cancelled",
    });

    expect(released.status).toBe("completed");
    expect(released.releasedReferenceCount).toBe(1);

    const noTracked = await collector.releaseTemporaryReferences({
      executionJobId: "job-4",
      requestedAt: "2026-04-08T13:30:20.000Z",
      reason: "retry-cleanup",
    });

    expect(noTracked.status).toBe("none");
    expect(noTracked.releasedReferenceCount).toBe(0);
  });
});
