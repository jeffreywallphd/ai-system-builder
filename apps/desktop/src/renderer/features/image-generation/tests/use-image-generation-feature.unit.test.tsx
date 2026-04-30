import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useImageGenerationFeature } from "../hooks/useImageGenerationFeature";

function Harness({ client, onReady }: { client: ReturnType<typeof makeClient>; onReady: (h: ReturnType<typeof useImageGenerationFeature>) => void }) { onReady(useImageGenerationFeature(client as never)); return null; }
const makeClient = () => ({ startImageGeneration: vi.fn(), readImageGeneration: vi.fn(), finalizeImageGenerationIfCompleted: vi.fn(), cancelImageGeneration: vi.fn(), readComfyUiInstallStatus: vi.fn().mockResolvedValue({ ok: true, value: { status: "installed" } }), repairComfyUiInstall: vi.fn().mockResolvedValue({ ok: true, value: { status: "installed" } }) });

describe("useImageGenerationFeature", () => {
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
});
