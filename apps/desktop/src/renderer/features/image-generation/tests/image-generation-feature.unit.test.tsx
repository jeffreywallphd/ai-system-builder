import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { ImageGenerationFeature } from "../components/ImageGenerationFeature";

vi.mock("../hooks/useImageGenerationFeature", () => ({
  useImageGenerationFeature: () => ({
    form: { prompt: "", negativePrompt: "", seed: "", width: 1024, height: 1024, steps: 30, sampler: "", scheduler: "", model: "", numImages: 1 },
    setForm: vi.fn(), status: "running", requestId: "r1", message: "cancel unsupported", progress: { message: "doing work", current: 1, total: 2 }, error: undefined,
    taskData: { outputs: [{ fileName: "a.png", subfolder: "x", engine: "comfy", promptId: "p1" }] }, finalized: { assets: [{ assetId: "as1", artifactId: "ar1" }] }, validationError: undefined, start: vi.fn(), cancel: vi.fn(),
  }),
}));

describe("ImageGenerationFeature", () => {
  it("displays progress and finalized assets", async () => {
    const c = document.createElement("div");
    const root = createRoot(c);
    await act(async () => { root.render(<ImageGenerationFeature />); });
    expect(c.textContent).toContain("doing work");
    expect(c.textContent).toContain("as1 / ar1");
    expect(c.textContent).toContain("cancel unsupported");
    await act(async () => { root.unmount(); });
  });
});
