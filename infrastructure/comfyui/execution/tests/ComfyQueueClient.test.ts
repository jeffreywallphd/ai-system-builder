import { describe, expect, it } from "bun:test";
import { ComfyAdapterConfig } from "../ComfyAdapterConfig";
import { ComfyQueueClient } from "../ComfyQueueClient";

describe("ComfyQueueClient", () => {
  it("reads completion from history and normalizes output artifacts", async () => {
    const api = {
      queuePrompt: async () => ({ prompt_id: "p1" }),
      getHistory: async () => ({
        p1: {
          status: { completed: true, status_str: "done", messages: ["ok"] },
          outputs: {
            nodeA: {
              images: [{ filename: "image.png", subfolder: "outputs", type: "output" }],
              text: [{ text: "hello" }],
            },
          },
        },
      }),
      getQueue: async () => ({ queue_running: [], queue_pending: [] }),
      interrupt: async () => undefined,
      buildViewUrl: () => "http://example/file.png",
    };

    const queue = new ComfyQueueClient({ apiClient: api as never, pollIntervalMs: 1, maxWaitMs: 20 });
    const progress = await queue.getPromptProgress("p1");
    expect(progress.status).toBe("completed");
    expect(progress.completion?.outputs.nodeA?.length).toBe(2);
  });

  it("uses canonical adapter config for polling defaults", async () => {
    const queue = new ComfyQueueClient({
      apiClient: {
        getHistory: async () => ({}),
        getQueue: async () => ({ queue_running: [], queue_pending: [] }),
      } as never,
      config: new ComfyAdapterConfig({
        baseUrl: "http://localhost:8188",
        pollIntervalMs: 1,
        maxExecutionWaitMs: 2,
      }),
    });

    await expect(queue.waitForCompletion("p1")).rejects.toThrow("Timed out waiting for ComfyUI prompt");
  });
});
