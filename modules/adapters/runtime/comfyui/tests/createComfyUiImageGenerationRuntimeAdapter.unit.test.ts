import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import { createComfyUiImageGenerationRuntimeAdapter } from "../createComfyUiImageGenerationRuntimeAdapter";

describe("createComfyUiImageGenerationRuntimeAdapter", () => {
  it("start ensures supervisor before submit and returns metadata", async () => {
    const supervisor = { start: testDouble.fn(async () => {}) };
    const client = { submitPrompt: testDouble.fn(async () => ({ prompt_id: "p1", number: 1 })), getQueue: testDouble.fn(), getHistory: testDouble.fn() };
    const adapter = createComfyUiImageGenerationRuntimeAdapter({ supervisor, client, mapperOptions: { defaultCheckpoint: "sdxl" }, now: () => "2026-04-30T00:00:00.000Z" });

    const result = await adapter.startImageGeneration({ prompt: "cat" }, { requestId: "r1" });
    expect(supervisor.start).toHaveBeenCalledOnce();
    expect(client.submitPrompt).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ requestId: "r1", status: "queued", metadata: { engine: "comfyui", comfyUiPromptId: "p1" } });
  });

  it("read maps running state", async () => {
    const adapter = createComfyUiImageGenerationRuntimeAdapter({
      supervisor: { start: testDouble.fn(async () => {}) },
      client: {
        submitPrompt: testDouble.fn(async () => ({ prompt_id: "p1", number: 1 })),
        getQueue: testDouble.fn(async () => ({ queue_running: [[1, "p1"]], queue_pending: [] })),
        getHistory: testDouble.fn(async () => ({})),
      }, mapperOptions: { defaultCheckpoint: "sdxl" },
    });
    await adapter.startImageGeneration({ prompt: "cat" }, { requestId: "r1" });
    const record = await adapter.readImageGenerationTask("r1");
    expect(record.status).toBe("running");
  });

  it("read maps succeeded outputs without bytes and unknown mapping", async () => {
    const adapter = createComfyUiImageGenerationRuntimeAdapter({
      supervisor: { start: testDouble.fn(async () => {}) },
      client: {
        submitPrompt: testDouble.fn(async () => ({ prompt_id: "p1" })),
        getQueue: testDouble.fn(async () => ({ queue_running: [], queue_pending: [] })),
        getHistory: testDouble.fn(async () => ({ p1: { outputs: { "7": { images: [{ filename: "x.png", subfolder: "", type: "output", data: "raw" }] } } } })),
      }, mapperOptions: { defaultCheckpoint: "sdxl" },
    });
    await adapter.startImageGeneration({ prompt: "cat" }, { requestId: "r1" });
    const record = await adapter.readImageGenerationTask("r1");
    expect(record.status).toBe("succeeded");
    expect(record.data).toEqual({ outputs: [{ fileName: "x.png", subfolder: undefined, type: "output", comfyUiPromptId: "p1", engine: "comfyui" }] });
    const unknown = await adapter.readImageGenerationTask("nope");
    expect(unknown.status).toBe("unknown");
  });

  it("cancel returns truthful unsupported result", async () => {
    const adapter = createComfyUiImageGenerationRuntimeAdapter({
      supervisor: { start: testDouble.fn(async () => {}) },
      client: { submitPrompt: testDouble.fn(async () => ({ prompt_id: "p1" })), getQueue: testDouble.fn(), getHistory: testDouble.fn() },
      mapperOptions: { defaultCheckpoint: "sdxl" },
    });
    const result = await adapter.cancelImageGenerationTask("r1");
    expect(result).toEqual({ requestId: "r1", cancelled: false, status: "unknown", message: "ComfyUI image generation cancellation is not implemented yet." });
  });
});
