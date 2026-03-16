import { describe, expect, it } from "bun:test";
import { ComfyQueueClient } from "../ComfyQueueClient";

describe("ComfyQueueClient", () => {
  it("reads completion from history", async () => {
    const api = {
      queuePrompt: async () => ({ prompt_id: "p1" }),
      getHistory: async () => ({ p1: { status: { completed: true, status_str: "done" } } }),
      getQueue: async () => ({ queue_running: [], queue_pending: [] }),
      interrupt: async () => undefined,
    };

    const queue = new ComfyQueueClient({ apiClient: api as never, pollIntervalMs: 1, maxWaitMs: 20 });
    const progress = await queue.getPromptProgress("p1");
    expect(progress.status).toBe("completed");
  });
});
