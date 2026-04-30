import { describe, it, expect, vi } from "vitest";
import { createDesktopImageGenerationClient } from "../api";

describe("desktop image generation client", () => {
  it("calls desktop api methods", async () => {
    const hostWindow = globalThis as typeof globalThis & { window?: Window & typeof globalThis };
    hostWindow.window ??= {} as Window & typeof globalThis;
    const startImageGeneration = vi.fn().mockResolvedValue({ ok: true, value: { requestId: "r1" } });
    hostWindow.window.desktopApi = { startImageGeneration, readImageGeneration: vi.fn(), cancelImageGeneration: vi.fn(), finalizeImageGenerationIfCompleted: vi.fn() } as never;
    const client = createDesktopImageGenerationClient();
    const result = await client.startImageGeneration({ prompt: "cat" });
    expect(result.ok).toBe(true);
    expect(startImageGeneration).toHaveBeenCalled();
  });

  it("returns unavailable when desktop api methods are missing", async () => {
    const hostWindow = globalThis as typeof globalThis & { window?: Window & typeof globalThis };
    hostWindow.window ??= {} as Window & typeof globalThis;
    hostWindow.window.desktopApi = {} as never;
    const client = createDesktopImageGenerationClient();
    await expect(client.startImageGeneration({ prompt: "cat" })).resolves.toMatchObject({ ok: false, error: { message: "Desktop image generation API is unavailable." } });
    await expect(client.readImageGeneration({ requestId: "r1" })).resolves.toMatchObject({ ok: false, error: { message: "Desktop image generation API is unavailable." } });
  });
});
