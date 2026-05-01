import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isSelectableImageGenerationModel,
  toImageGenerationModelDropdownValue,
  useImageGenerationFeature,
} from "../hooks/useImageGenerationFeature";


const listModelsMock = vi.fn().mockResolvedValue([]);
vi.mock("../../models/api/desktopModelsClient", () => ({
  createDesktopModelsClient: () => ({ listModels: listModelsMock }),
}));

function Harness({ client, onReady }: { client: ReturnType<typeof makeClient>; onReady: (h: ReturnType<typeof useImageGenerationFeature>) => void }) { onReady(useImageGenerationFeature(client as never)); return null; }
const makeClient = () => ({ startImageGeneration: vi.fn(), readImageGeneration: vi.fn(), finalizeImageGenerationIfCompleted: vi.fn(), cancelImageGeneration: vi.fn(), readComfyUiInstallStatus: vi.fn().mockResolvedValue({ ok: true, value: { status: "installed" } }), repairComfyUiInstall: vi.fn().mockResolvedValue({ ok: true, value: { status: "installed" } }) });

describe("useImageGenerationFeature", () => {
  beforeEach(() => {
    listModelsMock.mockReset();
    listModelsMock.mockResolvedValue([]);
  });

  it("omits empty seed and includes explicit seed", async () => {
    const client = makeClient(); client.startImageGeneration.mockResolvedValue({ ok: true, value: { requestId: "r1" } }); client.readImageGeneration.mockResolvedValue({ ok: true, value: { status: "cancelled", requestId: "r1", taskType: "image-generation", concurrencyClass: "image-generation" } });
    let hook!: ReturnType<typeof useImageGenerationFeature>; const c = document.createElement("div"); const root = createRoot(c);
    await act(async () => root.render(<Harness client={client} onReady={(h) => { hook = h; }} />));
    await act(async () => { hook.setForm({ prompt:"cat", negativePrompt:"", seed:"", width:"1024", height:"1024", steps:"30", sampler:"", scheduler:"", model:"", numImages:"1" }); });
    await act(async () => { await hook.start(); });
    expect(client.startImageGeneration.mock.calls[0][0].seed).toBeUndefined();
    await act(async () => { hook.setForm({ prompt:"cat", negativePrompt:"", seed:"42", width:"1024", height:"1024", steps:"30", sampler:"", scheduler:"", model:"", numImages:"1" }); });
    await act(async () => { await hook.start(); });
    expect(client.startImageGeneration.mock.calls[1][0].seed).toBe(42);
    await act(async () => root.unmount());
  });

  it("prevents duplicate starts while running", async () => {
    vi.useFakeTimers();
    const client = makeClient();
    client.startImageGeneration.mockResolvedValue({ ok: true, value: { requestId: "r1" } });
    client.readImageGeneration.mockResolvedValue({ ok: true, value: { status: "running", requestId: "r1", taskType: "image-generation", concurrencyClass: "image-generation", progress: { message: "run" } } });
    let hook!: ReturnType<typeof useImageGenerationFeature>; const c = document.createElement("div"); const root = createRoot(c);
    await act(async () => root.render(<Harness client={client} onReady={(h) => { hook = h; }} />));
    await act(async () => { hook.setForm({ ...hook.form, prompt: "cat" }); await hook.start(); });
    await act(async () => { await hook.start(); vi.advanceTimersByTime(700); });
    expect(client.startImageGeneration).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });

  it("does not set install status after unmount while reading install status", async () => {
    let resolveStatus: (value: { ok: boolean; value?: { status: string } }) => void = () => {};
    const client = makeClient();
    client.readComfyUiInstallStatus.mockReturnValue(new Promise((resolve) => { resolveStatus = resolve; }));
    const c = document.createElement("div");
    const root = createRoot(c);
    await act(async () => root.render(<Harness client={client} onReady={() => {}} />));
    await act(async () => root.unmount());
    await act(async () => resolveStatus({ ok: true, value: { status: "installed" } }));
  });

  it("updates repair status correctly for success and failure", async () => {
    const client = makeClient();
    let hook!: ReturnType<typeof useImageGenerationFeature>; const c = document.createElement("div"); const root = createRoot(c);
    client.repairComfyUiInstall.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ ok: true, value: { status: "installed" } }), 0)));
    await act(async () => root.render(<Harness client={client} onReady={(h) => { hook = h; }} />));
    const repairPromise = act(async () => { void hook.repairInstall(); });
    expect(hook.installStatus).toBe("installing");
    await repairPromise;
    await act(async () => Promise.resolve());
    expect(hook.installStatus).toBe("installed");

    client.repairComfyUiInstall.mockResolvedValueOnce({ ok: false, error: { code: "boom", message: "repair failed" } });
    await act(async () => { await hook.repairInstall(); });
    expect(hook.error).toBe("repair failed");
    await act(async () => root.unmount());
  });

  it("keeps installed status when an older status read resolves after repair", async () => {
    let resolveStatus: (value: { ok: boolean; value?: { status: string } }) => void = () => {};
    const client = makeClient();
    client.readComfyUiInstallStatus.mockReturnValue(new Promise((resolve) => { resolveStatus = resolve; }));
    client.repairComfyUiInstall.mockResolvedValueOnce({ ok: true, value: { status: "installed" } });
    let hook!: ReturnType<typeof useImageGenerationFeature>; const c = document.createElement("div"); const root = createRoot(c);

    await act(async () => root.render(<Harness client={client} onReady={(h) => { hook = h; }} />));
    await act(async () => { await hook.repairInstall(); });
    expect(hook.installStatus).toBe("installed");

    await act(async () => resolveStatus({ ok: true, value: { status: "installing" } }));
    expect(hook.installStatus).toBe("installed");
    await act(async () => root.unmount());
  });

  it("lists only text-to-image models in the model dropdown source", async () => {
    listModelsMock.mockResolvedValueOnce([
      { modelRecordId: "1", modelId: "stabilityai/stable-diffusion", displayName: "sd", source: "huggingface", lifecycleStatus: "downloaded", artifactForm: "full-model", inferenceMode: "text-to-image", taskTags: ["text-to-image"] },
      { modelRecordId: "2", modelId: "openai/gpt", displayName: "gpt", source: "huggingface", lifecycleStatus: "downloaded", artifactForm: "full-model", inferenceMode: "chat", taskTags: ["chat"] },
      { modelRecordId: "3", modelId: "foo/bar", displayName: "bar", source: "generated", lifecycleStatus: "generated", artifactForm: "checkpoint", taskTags: ["text-to-image"] },
      { modelRecordId: "4", modelId: "foo/reference", displayName: "reference", source: "huggingface", lifecycleStatus: "saved-reference", artifactForm: "full-model", inferenceMode: "text-to-image", taskTags: ["text-to-image"] },
    ]);
    const client = makeClient();
    let hook!: ReturnType<typeof useImageGenerationFeature>; const c = document.createElement("div"); const root = createRoot(c);
    await act(async () => root.render(<Harness client={client} onReady={(h) => { hook = h; }} />));
    await act(async () => Promise.resolve());
    expect(listModelsMock).toHaveBeenCalledWith({ limit: 500, includeDiscovered: false });
    expect(hook.availableModels.map((model) => model.value)).toEqual(["stabilityai/stable-diffusion", "foo/bar"]);
    expect(hook.availableModels[0]?.label).toContain("sd - stabilityai/stable-diffusion - huggingface - downloaded");
    expect(hook.modelLoadStatus).toBe("success");
    await act(async () => root.unmount());
  });

  it("shows a model inventory load error instead of silently emptying the dropdown source", async () => {
    listModelsMock.mockRejectedValueOnce(new Error("inventory offline"));
    const client = makeClient();
    let hook!: ReturnType<typeof useImageGenerationFeature>; const c = document.createElement("div"); const root = createRoot(c);
    await act(async () => root.render(<Harness client={client} onReady={(h) => { hook = h; }} />));
    await act(async () => Promise.resolve());
    expect(hook.availableModels).toEqual([]);
    expect(hook.modelLoadStatus).toBe("error");
    expect(hook.modelLoadMessage).toBe("Failed to load model inventory for image generation: inventory offline");
    await act(async () => root.unmount());
  });

  it("accepts downloaded text-to-image full models from model management", () => {
    const model = {
      modelRecordId: "sdxl",
      displayName: "stable-diffusion-xl-base-1.0",
      lifecycleStatus: "downloaded",
      artifactForm: "full-model",
      modelId: "stabilityai/stable-diffusion-xl-base-1.0",
      inferenceMode: "text-to-image",
    } as const;

    expect(isSelectableImageGenerationModel(model)).toBe(true);
    expect(toImageGenerationModelDropdownValue(model)).toBe("stabilityai/stable-diffusion-xl-base-1.0");
  });
});
