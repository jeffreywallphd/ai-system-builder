import { describe, it, expect, vi } from "vitest";
import { createDesktopImageGenerationClient } from "../api";

describe("desktop image generation client", () => {
  it("calls desktop api methods", async () => {
    const hostWindow = globalThis as typeof globalThis & { window?: Window & typeof globalThis };
    hostWindow.window ??= {} as Window & typeof globalThis;
    const startImageGeneration = vi.fn().mockResolvedValue({ ok: true, value: { requestId: "r1" } });
    hostWindow.window.desktopApi = { startImageGeneration, readImageGeneration: vi.fn(), cancelImageGeneration: vi.fn(), finalizeImageGenerationIfCompleted: vi.fn() } as never;
    const client = createDesktopImageGenerationClient();
    await client.startImageGeneration({ prompt: "cat" }, { requestId: "bridge-1" });
    expect(startImageGeneration).toHaveBeenCalledWith({ prompt: "cat" }, { requestId: "bridge-1" });
  });
});
