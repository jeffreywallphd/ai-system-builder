import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useImageGenerationFeature } from "../hooks/useImageGenerationFeature";

function Harness({ client }: { client: any }) {
  const f = useImageGenerationFeature(client);
  return <div><button id="start" onClick={() => void f.start()}>start</button><button id="cancel" onClick={() => void f.cancel()}>cancel</button><span>{f.status}:{f.results.length}:{f.error ?? ""}</span></div>;
}

describe("useImageGenerationFeature", () => {
  it("polls and finalizes once", async () => {
    vi.useFakeTimers();
    const client = { createArtifactMediaViewUrl: vi.fn(), startImageGeneration: vi.fn().mockResolvedValue({ requestId: "r1" }), readImageGeneration: vi.fn().mockResolvedValueOnce({ requestId: "r1", status: "running" }).mockResolvedValueOnce({ requestId: "r1", status: "succeeded" }), finalizeImageGenerationIfCompleted: vi.fn().mockResolvedValue({ finalized: true, assets: [{ assetId: "a", artifactId: "b", storageKey: "k", mediaType: "image/png" }] }), cancelImageGeneration: vi.fn() };
    const c = document.createElement("div"); const root = createRoot(c);
    await act(async () => { root.render(<Harness client={client} />); });
    await act(async () => { (c.querySelector('#start') as HTMLButtonElement).click(); vi.advanceTimersByTime(2500); });
    expect(client.finalizeImageGenerationIfCompleted).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
