import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import { TaskType } from "../../../../contracts/runtime";

import { createComfyUiImageGenerationRuntimeAdapter } from "../createComfyUiImageGenerationRuntimeAdapter";

describe("createComfyUiImageGenerationRuntimeAdapter", () => {
  const baseSupervisor = {
    start: testDouble.fn(async () => {}),
    getRecentRuntimeOutput: testDouble.fn(() => []),
    getRuntimeDeviceMode: testDouble.fn(() => "auto"),
  };

  it("start ensures supervisor before submit and returns metadata", async () => {
    const supervisor = { ...baseSupervisor, start: testDouble.fn(async () => {}) };
    const client = { submitPrompt: testDouble.fn(async () => ({ prompt_id: "p1", number: 1 })), getQueue: testDouble.fn(), getHistory: testDouble.fn() };
    const adapter = createComfyUiImageGenerationRuntimeAdapter({ supervisor, client, mapperOptions: { defaultCheckpoint: "sdxl" }, now: () => "2026-04-30T00:00:00.000Z" });

    const result = await adapter.startTask({ taskType: TaskType.IMAGE_GENERATION, payload: { prompt: "cat" }, requestId: "r1" });
    expect(supervisor.start).toHaveBeenCalledOnce();
    expect(client.submitPrompt).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ requestId: "r1", status: "queued", metadata: { engine: "comfyui", comfyUiPromptId: "p1" } });
  });

  it("passes requested runtime device mode from image generation engine hints", async () => {
    const supervisor = {
      ...baseSupervisor,
      startWithRuntimeDeviceMode: testDouble.fn(async () => {}),
      getRuntimeDeviceMode: testDouble.fn(() => "cuda"),
    };
    const client = { submitPrompt: testDouble.fn(async () => ({ prompt_id: "p1", number: 1 })), getQueue: testDouble.fn(), getHistory: testDouble.fn() };
    const adapter = createComfyUiImageGenerationRuntimeAdapter({ supervisor, client, mapperOptions: { defaultCheckpoint: "sdxl" } });

    const result = await adapter.startTask({
      taskType: TaskType.IMAGE_GENERATION,
      payload: { prompt: "cat", engineHints: { runtimeDeviceMode: "cuda" } },
      requestId: "r1",
    });

    expect(supervisor.startWithRuntimeDeviceMode).toHaveBeenCalledWith({ runtimeDeviceMode: "cuda" });
    expect(result.metadata).toMatchObject({ requestedRuntimeDeviceMode: "cuda", runtimeDeviceMode: "cuda" });
  });

  it("prepares FaceID artifact references before submitting the ComfyUI prompt", async () => {
    const supervisor = { ...baseSupervisor, start: testDouble.fn(async () => {}) };
    const client = { submitPrompt: testDouble.fn(async () => ({ prompt_id: "p1", number: 1 })), getQueue: testDouble.fn(), getHistory: testDouble.fn() };
    const prepareFaceReferenceImage = testDouble.fn(async () => ({ imageName: "prepared-face.png" }));
    const adapter = createComfyUiImageGenerationRuntimeAdapter({
      supervisor,
      client,
      prepareFaceReferenceImage,
      mapperOptions: { defaultCheckpoint: "sdxl" },
    });

    await adapter.startTask({
      taskType: TaskType.IMAGE_GENERATION,
      payload: { prompt: "portrait", faceId: { enabled: true, references: [{ artifactId: "uploads/face.png" }] } },
      requestId: "r-face",
    });

    expect(prepareFaceReferenceImage.mock.calls[0]?.[0]).toMatchObject({
      artifactId: "uploads/face.png",
      imageRequest: { prompt: "portrait" },
    });
    const submittedPrompt = client.submitPrompt.mock.calls[0]?.[0]?.prompt;
    expect(submittedPrompt["17"]).toEqual({ class_type: "LoadImage", inputs: { image: "prepared-face.png" } });
    expect(Object.values(submittedPrompt).map((node: any) => node.class_type)).not.toContain("InstantIDModelLoader");
  });

  it("read maps running state", async () => {
    const adapter = createComfyUiImageGenerationRuntimeAdapter({
      supervisor: baseSupervisor,
      client: {
        submitPrompt: testDouble.fn(async () => ({ prompt_id: "p1", number: 1 })),
        getQueue: testDouble.fn(async () => ({ queue_running: [[1, "p1"]], queue_pending: [] })),
        getHistory: testDouble.fn(async () => ({})),
      }, mapperOptions: { defaultCheckpoint: "sdxl" },
    });
    await adapter.startTask({ taskType: TaskType.IMAGE_GENERATION, payload: { prompt: "cat" }, requestId: "r1" });
    const record = await adapter.getTaskStatus("r1");
    expect(record.status).toBe("running");
  });

  it("read maps succeeded outputs without bytes and unknown mapping", async () => {
    const adapter = createComfyUiImageGenerationRuntimeAdapter({
      supervisor: baseSupervisor,
      client: {
        submitPrompt: testDouble.fn(async () => ({ prompt_id: "p1" })),
        getQueue: testDouble.fn(async () => ({ queue_running: [], queue_pending: [] })),
        getHistory: testDouble.fn(async () => ({ p1: { outputs: { "7": { images: [{ filename: "x.png", subfolder: "", type: "output", data: "raw" }] } } } })),
      }, mapperOptions: { defaultCheckpoint: "sdxl" },
    });
    await adapter.startTask({ taskType: TaskType.IMAGE_GENERATION, payload: { prompt: "cat" }, requestId: "r1" });
    const record = await adapter.getTaskStatus("r1");
    expect(record.status).toBe("succeeded");
    expect(record.data).toEqual({ outputs: [{ fileName: "x.png", subfolder: undefined, type: "image", promptId: "p1", engine: "comfyui" }] });
    const unknown = await adapter.getTaskStatus("nope");
    expect(unknown.status).toBe("unknown");
  });

  it("uses generic fallback when history has no outputs and no error details", async () => {
    const adapter = createComfyUiImageGenerationRuntimeAdapter({
      supervisor: { ...baseSupervisor, getRecentRuntimeOutput: testDouble.fn(() => []) },
      client: {
        submitPrompt: testDouble.fn(async () => ({ prompt_id: "p1" })),
        getQueue: testDouble.fn(async () => ({ queue_running: [], queue_pending: [] })),
        getHistory: testDouble.fn(async () => ({ p1: { outputs: {} } })),
      }, mapperOptions: { defaultCheckpoint: "sdxl" },
    });
    await adapter.startTask({ taskType: TaskType.IMAGE_GENERATION, payload: { prompt: "cat" }, requestId: "r1" });
    const record = await adapter.getTaskStatus("r1");
    expect(record.status).toBe("failed");
    expect(record.error?.message).toBe("ComfyUI history entry did not contain image outputs.");
  });

  it("surfaces ComfyUI status exception details when history includes error metadata", async () => {
    const adapter = createComfyUiImageGenerationRuntimeAdapter({
      supervisor: { ...baseSupervisor, getRuntimeDeviceMode: testDouble.fn(() => "cuda") },
      client: {
        submitPrompt: testDouble.fn(async () => ({ prompt_id: "p1" })),
        getQueue: testDouble.fn(async () => ({ queue_running: [], queue_pending: [] })),
        getHistory: testDouble.fn(async () => ({ p1: { outputs: {}, status: { status_str: "error", messages: [["execution_error", { exception_message: "OOM on node", node_id: "12", node_type: "KSampler", traceback: ["a", "b", "c"] }]] } } })),
      }, mapperOptions: { defaultCheckpoint: "sdxl" },
    });
    await adapter.startTask({ taskType: TaskType.IMAGE_GENERATION, payload: { prompt: "cat" }, requestId: "r1" });
    const record = await adapter.getTaskStatus("r1");
    expect(record.status).toBe("failed");
    expect(record.error?.message).toContain("OOM on node");
    expect(record.metadata).toMatchObject({ runtimeDeviceMode: "cuda", failedNodeId: "12", failedNodeType: "KSampler" });
  });

  it("classifies DirectML OpaqueTensorImpl failure with actionable guidance", async () => {
    const adapter = createComfyUiImageGenerationRuntimeAdapter({
      supervisor: {
        ...baseSupervisor,
        getRuntimeDeviceMode: testDouble.fn(() => "directml"),
        getRecentRuntimeOutput: testDouble.fn(() => ["!!! Exception during processing !!! Cannot access storage of OpaqueTensorImpl", "NotImplementedError: Cannot access storage of OpaqueTensorImpl"]),
      },
      client: {
        submitPrompt: testDouble.fn(async () => ({ prompt_id: "p1" })),
        getQueue: testDouble.fn(async () => ({ queue_running: [], queue_pending: [] })),
        getHistory: testDouble.fn(async () => ({ p1: { outputs: {}, status: { status_str: "error" } } })),
      }, mapperOptions: { defaultCheckpoint: "sdxl" },
    });
    await adapter.startTask({ taskType: TaskType.IMAGE_GENERATION, payload: { prompt: "cat" }, requestId: "r1" });
    const record = await adapter.getTaskStatus("r1");
    expect(record.status).toBe("failed");
    expect(record.error?.message).toContain("ComfyUI failed during DirectML execution");
    expect(record.error?.message).toContain("Try CPU mode");
  });

  it("cancel returns truthful unsupported result", async () => {
    const adapter = createComfyUiImageGenerationRuntimeAdapter({
      supervisor: baseSupervisor,
      client: { submitPrompt: testDouble.fn(async () => ({ prompt_id: "p1" })), getQueue: testDouble.fn(), getHistory: testDouble.fn() },
      mapperOptions: { defaultCheckpoint: "sdxl" },
    });
    const result = await adapter.cancelTask("r1");
    expect(result).toEqual({ requestId: "r1", cancelled: false, status: "unknown", message: "Runtime task was not found in this task registry delegate." });
  });

  it("returns unknown with clear error when prompt disappears from queue and history", async () => {
    const adapter = createComfyUiImageGenerationRuntimeAdapter({
      supervisor: baseSupervisor,
      client: {
        submitPrompt: testDouble.fn(async () => ({ prompt_id: "p1" })),
        getQueue: testDouble.fn(async () => ({ queue_running: [], queue_pending: [] })),
        getHistory: testDouble.fn(async () => ({})),
      }, mapperOptions: { defaultCheckpoint: "sdxl" },
    });
    await adapter.startTask({ taskType: TaskType.IMAGE_GENERATION, payload: { prompt: "cat" }, requestId: "r1" });
    const record = await adapter.getTaskStatus("r1");
    expect(record.status).toBe("unknown");
    expect(record.error).toEqual({ code: "comfyui_task_missing", message: "ComfyUI prompt was not found in queue or history." });
  });

  it("rejects non-image runtime task types", async () => {
    const adapter = createComfyUiImageGenerationRuntimeAdapter({
      supervisor: baseSupervisor,
      client: { submitPrompt: testDouble.fn(async () => ({ prompt_id: "p1" })), getQueue: testDouble.fn(), getHistory: testDouble.fn() },
      mapperOptions: { defaultCheckpoint: "sdxl" },
    });
    await expect(adapter.startTask({ taskType: TaskType.MODEL_TRAINING, payload: {} })).rejects.toThrow("only supports image-generation tasks");
  });

  it("started tasks appear in listTasks without probing ComfyUI status endpoints", async () => {
    const supervisor = { ...baseSupervisor, start: testDouble.fn(async () => {}) };
    const client = {
      submitPrompt: testDouble.fn(async () => ({ prompt_id: "p-list", number: 1 })),
      getQueue: testDouble.fn(async () => ({ queue_running: [], queue_pending: [] })),
      getHistory: testDouble.fn(async () => ({})),
    };
    const adapter = createComfyUiImageGenerationRuntimeAdapter({ supervisor, client, mapperOptions: { defaultCheckpoint: "sdxl" }, now: () => "2026-05-06T00:00:00.000Z" });

    await adapter.startTask({ taskType: TaskType.IMAGE_GENERATION, payload: { prompt: "cat" }, requestId: "r-list" });
    const result = await adapter.listTasks({ taskTypes: [TaskType.IMAGE_GENERATION] });

    expect(result.tasks.length).toBe(1);
    expect(result.tasks[0]).toMatchObject({ requestId: "r-list", taskType: TaskType.IMAGE_GENERATION, status: "queued", metadata: { comfyUiPromptId: "p-list" } });
    expect(client.getQueue).not.toHaveBeenCalled();
    expect(client.getHistory).not.toHaveBeenCalled();
  });

  it("terminal tasks remain listable after status resolves final result", async () => {
    const adapter = createComfyUiImageGenerationRuntimeAdapter({
      supervisor: baseSupervisor,
      client: {
        submitPrompt: testDouble.fn(async () => ({ prompt_id: "p-final" })),
        getQueue: testDouble.fn(async () => ({ queue_running: [], queue_pending: [] })),
        getHistory: testDouble.fn(async () => ({ p_final: { outputs: {} }, "p-final": { outputs: { "7": { images: [{ filename: "x.png" }] } } } })),
      },
      mapperOptions: { defaultCheckpoint: "sdxl" },
      now: () => "2026-05-06T00:00:00.000Z",
    });

    await adapter.startTask({ taskType: TaskType.IMAGE_GENERATION, payload: { prompt: "cat" }, requestId: "r-final" });
    await adapter.getTaskStatus("r-final");
    const withoutCompleted = await adapter.listTasks({});
    const withCompleted = await adapter.listTasks({ includeCompleted: true });

    expect(withoutCompleted.tasks).toEqual([]);
    expect(withCompleted.tasks.length).toBe(1);
    expect(withCompleted.tasks[0]).toMatchObject({ requestId: "r-final", status: "succeeded" });
  });

  it("unknown task status and cancel responses are explicit and structured", async () => {
    const adapter = createComfyUiImageGenerationRuntimeAdapter({
      supervisor: baseSupervisor,
      client: { submitPrompt: testDouble.fn(), getQueue: testDouble.fn(), getHistory: testDouble.fn() },
      mapperOptions: { defaultCheckpoint: "sdxl" },
    });

    const status = await adapter.getTaskStatus("missing");
    const cancel = await adapter.cancelTask("missing");

    expect(status).toMatchObject({ status: "unknown", error: { code: "comfyui_task_not_found" }, metadata: { reason: "request-id-not-tracked" } });
    expect(cancel).toMatchObject({ requestId: "missing", cancelled: false, status: "unknown" });
  });

  it("status list and cancel for unknown task do not start or probe ComfyUI", async () => {
    const supervisor = { ...baseSupervisor, start: testDouble.fn(async () => {}) };
    const client = { submitPrompt: testDouble.fn(), getQueue: testDouble.fn(), getHistory: testDouble.fn() };
    const adapter = createComfyUiImageGenerationRuntimeAdapter({ supervisor, client, mapperOptions: { defaultCheckpoint: "sdxl" } });

    await adapter.getTaskStatus("missing");
    await adapter.listTasks({});
    await adapter.cancelTask("missing");

    expect(supervisor.start).not.toHaveBeenCalled();
    expect(client.submitPrompt).not.toHaveBeenCalled();
    expect(client.getQueue).not.toHaveBeenCalled();
    expect(client.getHistory).not.toHaveBeenCalled();
  });

});
