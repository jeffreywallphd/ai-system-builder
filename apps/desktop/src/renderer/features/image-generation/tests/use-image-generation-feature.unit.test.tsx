import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useImageGenerationFeature } from "../hooks/useImageGenerationFeature";

function Harness({ onReady }: any) { onReady(useImageGenerationFeature()); return null; }

describe("useImageGenerationFeature", () => {
  it("starts, polls, finalizes, and cancels", async () => {
    vi.useFakeTimers();
    const client = {
      startImageGeneration: vi.fn().mockResolvedValue({ ok: true, value: { requestId: "req1" } }),
      readImageGeneration: vi.fn().mockResolvedValueOnce({ ok: true, status: "queued", value: { progress: { message: "q" } } }).mockResolvedValueOnce({ ok: true, status: "succeeded", value: { outputs: [] } }),
      finalizeImageGenerationIfCompleted: vi.fn().mockResolvedValue({ ok: true, value: { assets: [] } }),
      cancelImageGeneration: vi.fn().mockResolvedValue({ ok: true, value: { cancelled: false, message: "not supported" } }),
    };
    let hook: any; const c = document.createElement("div"); const root = createRoot(c);
    await act(async () => { root.render(<Harness onReady={(h: any) => { hook = useImageGenerationFeature(client as any); }} /> as any); });
    await act(async () => { hook.setForm({ ...hook.form, prompt: "cat" }); await hook.start(); vi.advanceTimersByTime(1400); });
    expect(client.startImageGeneration).toHaveBeenCalled();
    expect(client.readImageGeneration).toHaveBeenCalled();
    expect(client.finalizeImageGenerationIfCompleted).toHaveBeenCalledWith({ requestId: "req1" });
    await act(async () => { await hook.cancel(); });
    expect(client.cancelImageGeneration).toHaveBeenCalled();
    await act(async () => { root.unmount(); });
  });
});
