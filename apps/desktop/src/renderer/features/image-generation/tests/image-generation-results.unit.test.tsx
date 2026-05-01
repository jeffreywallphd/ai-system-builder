import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { ImageGenerationResults } from "../components/ImageGenerationResults";

describe("ImageGenerationResults", () => {
  it("renders finalized preview and no deferred text", async () => {
    const c = document.createElement("div");
    const root = createRoot(c);
    await act(async () => {
      root.render(<ImageGenerationResults status="succeeded" outputs={[{ fileName: "tmp.png" }]} finalizedAssets={[{ assetId: "a1", artifactId: "generated/images/a1/x.png", previewUrl: "blob:x", previewStatus: "ready" }]} />);
    });
    expect(c.textContent).not.toContain("Preview retrieval is deferred");
    expect(c.querySelector("img")?.getAttribute("src")).toBe("blob:x");
    await act(async () => root.unmount());
  });

  it("shows pending and failure messaging", async () => {
    const c = document.createElement("div");
    const root = createRoot(c);
    await act(async () => {
      root.render(<ImageGenerationResults status="finalizing" error={undefined} outputs={[]} finalizedAssets={[]} />);
    });
    expect(c.textContent).toContain("Finalizing generated images");
    await act(async () => {
      root.render(<ImageGenerationResults status="failed" error="finalize failed" outputs={[]} finalizedAssets={[]} />);
    });
    expect(c.textContent).toContain("finalize failed");
    await act(async () => root.unmount());
  });
});
